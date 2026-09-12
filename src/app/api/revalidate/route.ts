import { NextResponse, type NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CONTENT_TAG } from '../../../lib/supabase/server';

/**
 * POST /api/revalidate
 *
 * Content reads are cached for an hour (lib/supabase/server.ts). This is
 * how an edit shows up sooner: a Supabase Database Webhook on the content
 * tables POSTs here with the standard payload, and the affected table's tag
 * is expired. A manual call with ?tag=content flushes everything.
 *
 * Authenticated by a shared secret in the Authorization header, set as
 * REVALIDATE_SECRET on the deployment and as a header on the webhook.
 * Without the secret configured the route refuses everything, rather than
 * being an open cache-buster.
 */
interface WebhookPayload {
  type?: 'INSERT' | 'UPDATE' | 'DELETE';
  table?: string;
  schema?: string;
}

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, message: 'REVALIDATE_SECRET is not configured' }, { status: 503 });
  }
  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const explicit = request.nextUrl.searchParams.get('tag');
  let table: string | undefined;
  if (!explicit) {
    try {
      const payload = (await request.json()) as WebhookPayload;
      table = typeof payload.table === 'string' ? payload.table : undefined;
    } catch {
      // No body: treat as a full flush below.
    }
  }

  // Tags are namespaced (table:<name>) so a webhook cannot expire arbitrary
  // cache entries by naming them; only `content` and table tags exist.
  const tag = explicit === CONTENT_TAG || !explicit && !table ? CONTENT_TAG : `table:${explicit ?? table}`;

  // { expire: 0 }: the next request re-reads rather than serving the stale
  // entry, which is what "I just edited it" expects to see.
  revalidateTag(tag, { expire: 0 });
  return NextResponse.json({ ok: true, revalidated: tag, at: new Date().toISOString() });
}
