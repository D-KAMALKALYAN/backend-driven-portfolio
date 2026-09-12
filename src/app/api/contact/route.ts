import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '../../../lib/supabase/server';
import { getProfile } from '../../../lib/content';
import { notifyOwner, parseSubmission, submitContact } from '../../../lib/contact';

/**
 * POST /api/contact
 *
 * The first write in this project that goes through a server. Until now the
 * browser inserted into contact_messages directly with the anon key, which
 * meant no secret could be involved - so no email, and messages sat in a
 * table nobody was reading (audit problem #8).
 *
 * Here: validate and sanitise (same functions the form uses, so the client
 * cannot be more permissive than the server), insert - with the real IP
 * recorded, which the browser could never supply - then notify the owner
 * through Resend. The database's own rate-limit trigger still applies and
 * is reported as 429.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Expected a JSON body' }, { status: 400 });
  }

  const submission = parseSubmission(body);
  const service = createServiceSupabase();
  const db = service ?? createServerSupabase();

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
  const userAgent = request.headers.get('user-agent');

  let outcome = await submitContact(db, submission, { ip, userAgent, returnId: service !== null });
  if (!outcome.ok && outcome.status === 500 && service) {
    // A rotated or mistyped service key must not cost the visitor their
    // message. Say so loudly in the logs, then take the anon path the
    // browser used to take.
    console.error('[contact] service-role insert failed; retrying with the anon key');
    outcome = await submitContact(createServerSupabase(), submission, { ip, userAgent, returnId: false });
  }
  if (!outcome.ok) {
    const payload = 'errors' in outcome ? { ok: false, errors: outcome.errors } : { ok: false, message: outcome.message };
    return NextResponse.json(payload, { status: outcome.status });
  }

  // Notification is best-effort: the message is saved regardless.
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && outcome.stored) {
    const to = process.env.CONTACT_NOTIFY_TO || (await getProfile().then((p) => p.email).catch(() => null));
    if (to) {
      const result = await notifyOwner({
        to,
        from: process.env.RESEND_FROM || 'Portfolio <onboarding@resend.dev>',
        apiKey,
        submission,
        id: outcome.id,
      });
      if (!result.sent) console.error('[contact] notification failed:', result.detail);
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
