import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '../../../lib/supabase/server';
import { parseTrackRequest, recordEvent, trackContextFrom } from '../../../lib/track';

/**
 * POST /api/track
 *
 * Analytics writes, moved behind the server (ADR-007 follow-on). The
 * browser sends what only it knows - event, path, referrer, its ids - and
 * the server adds what only it knows: IP, country, the idempotency key.
 *
 * Always answers quickly and never with a body the client would read;
 * telemetry must not be able to surface a failure to a visitor.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const req = parseTrackRequest(body);
  if (!req) return new NextResponse(null, { status: 400 });

  const ctx = trackContextFrom(request.headers);
  const service = createServiceSupabase();
  let outcome = await recordEvent(service ?? createServerSupabase(), req, ctx);
  if (!outcome.ok && service) {
    // Same fallback as /api/contact: a bad service key is logged, not
    // allowed to drop data while the anon policy still exists.
    console.error('[track] service-role insert failed; retrying with the anon key');
    outcome = await recordEvent(createServerSupabase(), req, ctx);
  }

  return new NextResponse(null, { status: outcome.ok ? 204 : 500 });
}
