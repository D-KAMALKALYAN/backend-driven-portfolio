import { supabase } from './supabaseClient';

/**
 * Fetch site content (taglines, meta, etc.)
 */
export async function fetchSiteContent() {
  const { data, error } = await supabase
    .from('site_content')
    .select('*');
  if (error) throw error;
  return data;
}

/**
 * Fetch profile/about data
 */
export async function fetchProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Fetch all projects (list view)
 */
export async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('view_count', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Fetch single project by slug
 */
export async function fetchProjectBySlug(slug) {
  const { data, error } = await supabase
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
export async function fetchProjectSections(projectId) {
  const { data, error } = await supabase
    .from('project_sections')
    .select('*')
    .eq('project_id', projectId);
  if (error) throw error;
  return data;
}

/**
 * Fetch project metrics
 */
export async function fetchProjectMetrics(projectId) {
  const { data, error } = await supabase
    .from('project_metrics')
    .select('*')
    .eq('project_id', projectId);
  if (error) throw error;
  return data;
}

/**
 * Fetch external profiles (GitHub, LinkedIn, etc.)
 */
export async function fetchExternalProfiles() {
  const { data, error } = await supabase
    .from('external_profiles')
    .select('*');
  if (error) throw error;
  return data;
}

/**
 * Fetch skills
 */
export async function fetchSkills() {
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('category', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Fetch experience entries
 */
export async function fetchExperience() {
  const { data, error } = await supabase
    .from('experience')
    .select('*')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Submit contact message (sanitized server-side via RLS)
 */
export async function submitContactMessage(message) {
  const { data, error } = await supabase
    .from('contact_messages')
    .insert([message]);
  if (error) throw error;
  return data;
}

/**
 * Fetch resume URL from Supabase storage
 */
export async function fetchResumeUrl() {
  const { data, error } = await supabase
    .from('resume_versions')
    .select('file_url')
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  return `${data.file_url}?v=${Date.now()}`;
}

/**
 * Fetch achievements (certifications, awards, publications, etc.)
 */
export async function fetchAchievements() {
  const { data, error } = await supabase
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
export async function fetchAnalyticsSummary() {
  const { data, error } = await supabase.rpc('get_analytics_summary');
  if (error) throw error;
  // RPC returns a single JSON object
  return typeof data === 'string' ? JSON.parse(data) : data;
}

/**
 * Daily visit counts for the last 30 days.
 * Requires: CREATE VIEW analytics_daily_visits in Supabase.
 */
export async function fetchDailyVisits() {
  const { data, error } = await supabase
    .from('analytics_daily_visits')
    .select('date, visits, unique_visitors')
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Top N projects by view_count — only published.
 */
export async function fetchTopProjects(limit = 8) {
  const { data, error } = await supabase
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
export async function fetchRecentEvents(limit = 20) {
  const { data, error } = await supabase
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
export async function fetchProjectStorytelling(projectId) {
  const { data, error } = await supabase
    .from('project_storytelling')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

