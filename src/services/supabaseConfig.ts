/**
 * Public Supabase configuration, read once.
 *
 * `NEXT_PUBLIC_*` names are inlined into the browser bundle at build time,
 * so they must be referenced literally - `process.env[name]` would not be
 * replaced. The anon key is public by design; Row Level Security is the
 * authorization boundary, not the key.
 *
 * A missing value used to reach createClient('') and throw "supabaseUrl is
 * required" from inside the SDK at module-evaluation time, so a
 * misconfigured deploy white-screened with an error pointing at node_modules.
 * Fall back to a syntactically valid placeholder instead: importing never
 * throws, every request fails, and that surfaces as the normal error state.
 */
export function getPublicSupabaseConfig(): { url: string; key: string; configured: boolean } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const configured = Boolean(url && key);
  return {
    url: url || 'https://placeholder.supabase.co',
    key: key || 'placeholder-anon-key',
    configured,
  };
}
