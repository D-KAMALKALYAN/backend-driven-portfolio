import { supabase } from './supabaseClient';

/**
 * Session ID persists across page refreshes but resets on new browser sessions.
 * Uses sessionStorage per the spec — not localStorage.
 */
function getSessionId() {
  const KEY = 'sid';
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

/**
 * Fire-and-forget analytics event.
 * Never throws — safe anywhere without try/catch.
 *
 * @param {'page_view'|'project_view'|'resume_download'|'contact_open'|'profile_click'|'github_click'} event
 * @param {Record<string, string>} [meta]
 */
export function trackEvent(event, meta = {}) {
  supabase
    .from('analytics')
    .insert({
      event,
      path:       window.location.pathname,
      referrer:   document.referrer || null,
      user_agent: navigator.userAgent,
      session_id: getSessionId(),
      meta,
    })
    .then()
    .catch((err) => {
      console.debug('[analytics] track failed:', err?.message);
    });
}
