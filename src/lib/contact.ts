import 'server-only';
import { sanitizeFormData } from '../utils/sanitize';
import { validateContactForm, type ContactFormErrors } from '../utils/validators';
import type { ContactMessageInsert, Db } from '../types/rows';

/**
 * The contact write path, as pure functions the route handler composes.
 * Kept out of route.ts so the validation, the insert and the notification
 * can each be unit-tested with fakes and no HTTP.
 */

export interface ContactSubmission {
  name: string;
  email: string;
  subject: string;
  message: string;
  /** Honeypot. Humans never see the field; anything in it is a bot. */
  website?: string;
}

export type ContactOutcome =
  | { ok: true; stored: boolean; id: string | null }
  | { ok: false; status: 400; errors: ContactFormErrors }
  | { ok: false; status: 429; message: string }
  | { ok: false; status: 500; message: string };

const MAX = { name: 100, email: 200, subject: 200, message: 2000 } as const;

/** Body -> typed, length-capped, tag-stripped submission. Never throws. */
export function parseSubmission(body: unknown): ContactSubmission {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  return sanitizeFormData({
    name: str(b['name'], MAX.name),
    email: str(b['email'], MAX.email),
    subject: str(b['subject'], MAX.subject),
    message: str(b['message'], MAX.message),
    website: str(b['website'], 200),
  });
}

/**
 * Validate, insert, return. The rate-limit trigger in Postgres raises
 * check_violation (23514) on the fourth message from one address in 24h;
 * that is reported as 429 so the client can say something honest.
 */
export interface SubmitMeta {
  ip: string | null;
  userAgent: string | null;
  /**
   * INSERT ... RETURNING needs SELECT under RLS, which anon does not have on
   * this table. Only a service-role client can read the new id back.
   */
  returnId: boolean;
}

export async function submitContact(db: Db, s: ContactSubmission, meta: SubmitMeta): Promise<ContactOutcome> {
  if (s.website) {
    // A bot filled the honeypot. Pretend it worked; do not store it.
    return { ok: true, stored: false, id: null };
  }

  const { isValid, errors } = validateContactForm(s);
  if (!isValid) return { ok: false, status: 400, errors };

  const row: ContactMessageInsert = {
    name: s.name,
    email: s.email,
    subject: s.subject || 'No Subject',
    message: s.message,
    ip_address: meta.ip,
    user_agent: meta.userAgent,
    meta: { via: 'api/contact' },
  };

  const { data, error } = meta.returnId
    ? await db.from('contact_messages').insert(row).select('id').single()
    : await db.from('contact_messages').insert(row).then((r) => ({ data: null, error: r.error }));
  if (error) {
    if (error.code === '23514' || /rate limit/i.test(error.message)) {
      return { ok: false, status: 429, message: 'Too many messages from this address today. Please try again tomorrow.' };
    }
    // Logged server-side with the Postgres code; the visitor gets the
    // generic line. A column or policy problem is ours to see, not theirs.
    console.error('[contact] insert failed:', error.code, error.message, error.details ?? '');
    return { ok: false, status: 500, message: 'Could not save your message. Please try again.' };
  }
  return { ok: true, stored: true, id: data?.id ?? null };
}

export interface NotifyInput {
  to: string;
  from: string;
  apiKey: string;
  submission: ContactSubmission;
  id: string | null;
}

/**
 * Email the owner through Resend's REST API. No SDK: one POST, one JSON
 * body, and the dependency it would add is not worth a wrapper around fetch.
 *
 * Fire-and-forget from the caller's point of view: the message is already
 * in the database, and a notification failure must not turn a saved message
 * into a visible error. The result is returned so it can be logged.
 */
export async function notifyOwner({ to, from, apiKey, submission, id }: NotifyInput, fetchImpl: typeof fetch = fetch): Promise<{ sent: boolean; detail?: string }> {
  const subject = `[Portfolio] ${submission.subject || 'New message'} — from ${submission.name}`;
  const text = [
    `From: ${submission.name} <${submission.email}>`,
    `Subject: ${submission.subject || 'No Subject'}`,
    id ? `Row: contact_messages/${id}` : '',
    '',
    submission.message,
  ].filter((l, i) => l !== '' || i === 3).join('\n');

  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: submission.email, subject, text }),
    });
    if (!res.ok) return { sent: false, detail: `resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { sent: true };
  } catch (err) {
    return { sent: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
