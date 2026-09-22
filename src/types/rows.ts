/**
 * Convenience aliases over the generated Database type.
 *
 * `Database['public']['Tables']['projects']['Row']` is precise but unreadable
 * at a call site. These names are what components and hooks import.
 *
 * Regenerate src/types/database.ts with `npm run db:types` after any schema
 * change; these aliases pick up the new shape automatically.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database';

/** A typed client: a per-request server instance, or a recorder in tests.
 *  The browser has none (ADR-043). */
export type Db = SupabaseClient<Database>;

type Tables = Database['public']['Tables'];
type Views = Database['public']['Views'];

export type Profile = Tables['profiles']['Row'];
export type Project = Tables['projects']['Row'];
export type ProjectSection = Tables['project_sections']['Row'];
export type ProjectStorytelling = Tables['project_storytelling']['Row'];
export type ExternalProfile = Tables['external_profiles']['Row'];
export type Skill = Tables['skills']['Row'];
export type Experience = Tables['experience']['Row'];
export type Achievement = Tables['achievements']['Row'];
export type ContactMessage = Tables['contact_messages']['Row'];
export type ContactMessageInsert = Tables['contact_messages']['Insert'];
export type AnalyticsEvent = Tables['analytics']['Row'];
export type AnalyticsEventInsert = Tables['analytics']['Insert'];
export type Resume = Tables['resume']['Row'];
export type SiteContent = Tables['site_content']['Row'];
export type FeatureFlag = Tables['feature_flags']['Row'];
export type DailyVisit = Views['analytics_daily_visits']['Row'];
export type NowEntry = Tables['now_entries']['Row'];
export type Venture = Tables['ventures']['Row'];
export type PageSection = Tables['page_sections']['Row'];
export type Post = Tables['posts']['Row'];
export type PostBlock = Tables['post_blocks']['Row'];

/** What a content block renderer needs - satisfied by PageSection and PostBlock alike. */
export type BlockLike = Pick<PageSection, 'id' | 'heading' | 'description' | 'config'>;

/** Shape returned by the get_analytics_summary() RPC. */
export interface AnalyticsSummary {
  total_visits: number;
  unique_visitors: number;
  total_project_views: number;
  visits_today: number;
  visits_this_week: number;
}

/** The columns fetchTopProjects selects. */
export type TopProject = Pick<Project, 'id' | 'title' | 'slug' | 'view_count' | 'cover_image_url' | 'tagline'>;

/**
 * What GET /api/analytics returns: the dashboard in one round trip. A part
 * that failed is null and its error is named in `errors`, so one broken
 * view degrades one panel rather than the page.
 */
export interface AnalyticsDashboard {
  summary: AnalyticsSummary | null;
  daily: DailyVisit[] | null;
  topProjects: TopProject[] | null;
  recentEvents: Pick<AnalyticsEvent, 'id' | 'event' | 'path' | 'created_at'>[] | null;
  /** The latest daily digest (ADR-054); null until the cron has written one. */
  digest: { period_start: string; body: string } | null;
  errors: string[];
}

/** What the app knows about the active resume after resolving its URL. */
export interface ActiveResume {
  url: string | null;
  fileName: string;
  version: string | null;
  updatedAt: string | null;
}

/** JSON value as Postgres jsonb can hold it. Mirrors the generated `Json`. */
export type { Json } from './database';
