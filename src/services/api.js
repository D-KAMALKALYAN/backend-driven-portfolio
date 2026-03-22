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
  const { data } = supabase.storage
    .from('resumes')
    .getPublicUrl('resume.pdf');
  return data?.publicUrl || null;
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

