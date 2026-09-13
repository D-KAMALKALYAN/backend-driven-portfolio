import type { ActiveResume, AnalyticsSummary, ContactMessageInsert, Db } from '../types/rows';

/**
 * Every query takes the client as its first argument rather than importing a
 * singleton. The same function then serves three callers: server components
 * (a per-request client whose fetch is cached and tagged), the browser (the
 * shared client, for the live analytics page), and tests (a recorder).
 */

/**
 * Fetch site content (taglines, meta, etc.)
 */
export async function fetchSiteContent(db: Db) {
  const { data, error } = await db
    .from('site_content')
    .select('*');
  if (error) throw error;
  return data;
}

/**
 * Fetch profile/about data
 */
export async function fetchProfile(db: Db) {
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Fetch all projects (list view)
 */
export async function fetchProjects(db: Db) {
  const { data, error } = await db
    .from('projects')
    .select('*')
    // sort_order was set in the database (0,1,1,2,3) and ignored entirely -
    // the list was ordered by popularity alone, so the authored order could
    // not be controlled without changing view counts. Popularity is kept as
    // the tie-break, which is what sort_order collisions need.
    //
    // `featured` is no longer part of the ordering: the column was true on
    // every row, and the badge it fed is now derived from end_date instead.
    .order('sort_order', { ascending: true })
    .order('view_count', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Fetch single project by slug
 */
export async function fetchProjectBySlug(db: Db, slug: string) {
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Fetch project sections for a given project
 */
export async function fetchProjectSections(db: Db, projectId: string) {
  const { data, error } = await db
    .from('project_sections')
    .select('*')
    .eq('project_id', projectId)
    // No ordering at all previously, so block order came back in whatever
    // physical order Postgres happened to return. It looked correct only
    // because rows were inserted in order - any UPDATE rewrites a row's
    // position and would have silently reshuffled the case study.
    // created_at is the stable tie-break for equal sort_order.
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Fetch external profiles (GitHub, LinkedIn, etc.)
 */
export async function fetchExternalProfiles(db: Db) {
  const { data, error } = await db
    .from('external_profiles')
    .select('*');
  if (error) throw error;
  return data;
}

/**
 * Fetch skills
 */
export async function fetchSkills(db: Db) {
  const { data, error } = await db
    .from('skills')
    .select('*')
    // Ordered by category alone, so order WITHIN a category was
    // non-deterministic even though sort_order is populated (4,5,6,7 for
    // frameworks). name is the final tie-break so the list never shuffles
    // between requests.
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Fetch experience entries
 */
export async function fetchExperience(db: Db) {
  const { data, error } = await db
    .from('experience')
    .select('*')
    // sort_order lets the timeline be arranged explicitly; start_date is the
    // tie-break. Matches the current output, but no longer by coincidence.
    .order('sort_order', { ascending: true })
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Submit contact message (sanitized server-side via RLS)
 */
export async function submitContactMessage(db: Db, message: ContactMessageInsert) {
  const { data, error } = await db
    .from('contact_messages')
    .insert(message);
  if (error) throw error;
  return data;
}

/**
 * Fetch the currently active resume.
 *
 * Reads the `resume` table, which is populated automatically by the
 * `handle_resume_upload` trigger on storage.objects. The public URL is
 * resolved from the stored object name via the Storage SDK rather than
 * read from `file_url`: the trigger builds that column by string
 * concatenation, so filenames containing spaces produce a URL that does
 * not resolve. getPublicUrl() percent-encodes correctly.
 *
 * Errors are surfaced, not swallowed. A silent null here previously hid a
 * missing table for months and silently downgraded the whole workflow to a
 * manual copy-paste step.
 *
 * Resolves to null only when no resume has been marked active.
 */
export async function fetchActiveResume(db: Db): Promise<ActiveResume | null> {
  const { data, error } = await db
    .from('resume')
    .select('file_name, file_url, version, updated_at')
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const objectName = data.file_name || deriveObjectName(data.file_url);
  if (!objectName) return null;

  const { data: pub } = db.storage.from('resumes').getPublicUrl(objectName);

  return {
    url: pub?.publicUrl ?? null,
    fileName: objectName,
    version: data.version ?? null,
    updatedAt: data.updated_at ?? null,
  };
}

/**
 * Last-resort recovery of the storage object name from a legacy absolute
 * URL, for rows written before file_name was populated.
 */
function deriveObjectName(fileUrl: string | null): string | null {
  if (typeof fileUrl !== 'string' || !fileUrl) return null;
  const marker = '/resumes/';
  const i = fileUrl.indexOf(marker);
  if (i === -1) return null;
  const raw = fileUrl.slice(i + marker.length).split('?')[0] ?? '';
  try { return decodeURIComponent(raw); } catch { return raw; }
}

/**
 * Fetch achievements (certifications, awards, publications, etc.)
 */
export async function fetchAchievements(db: Db) {
  const { data, error } = await db
    .from('achievements')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('date_earned', { ascending: false });
  if (error) throw error;
  return data;
}

// ─── Analytics API ────────────────────────────────────────────────────────────

/**
 * Aggregate summary stats via RPC (computed server-side).
 * Requires: CREATE FUNCTION get_analytics_summary() in Supabase.
 */
export async function fetchAnalyticsSummary(db: Db): Promise<AnalyticsSummary> {
  const { data, error } = await db.rpc('get_analytics_summary');
  if (error) throw error;
  // The function is declared RETURNS json, so the generated type is `Json`.
  // Narrow it once here rather than at every consumer.
  const raw: unknown = typeof data === 'string' ? JSON.parse(data) : data;
  return (raw ?? {}) as AnalyticsSummary;
}

/**
 * Daily visit counts for the last 30 days.
 * Requires: CREATE VIEW analytics_daily_visits in Supabase.
 */
export async function fetchDailyVisits(db: Db) {
  const { data, error } = await db
    .from('analytics_daily_visits')
    .select('date, visits, unique_visitors')
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Top N projects by view_count — only published.
 */
export async function fetchTopProjects(db: Db, limit = 8) {
  const { data, error } = await db
    .from('projects')
    .select('id, title, slug, view_count, cover_image_url, tagline')
    .eq('status', 'published')
    .eq('is_deleted', false)
    .order('view_count', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/**
 * Recent analytics events (for live feed display).
 */
export async function fetchRecentEvents(db: Db, limit = 20) {
  const { data, error } = await db
    .from('analytics')
    .select('id, event, path, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ─── Storytelling API ─────────────────────────────────────────────────────────

/**
 * Fetch storytelling sections for a project.
 * Requires: CREATE TABLE project_storytelling in Supabase.
 */
export async function fetchProjectStorytelling(db: Db, projectId: string) {
  const { data, error } = await db
    .from('project_storytelling')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

