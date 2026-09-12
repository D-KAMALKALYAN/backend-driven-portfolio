/**
 * Convenience aliases over the generated Database type.
 *
 * `Database['public']['Tables']['projects']['Row']` is precise but unreadable
 * at a call site. These names are what components and hooks import.
 *
 * Regenerate src/types/database.ts with `npm run db:types` after any schema
 * change; these aliases pick up the new shape automatically.
 */
import type { Database } from './database';

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

/** Shape returned by the get_analytics_summary() RPC. */
export interface AnalyticsSummary {
  total_visits: number;
  unique_visitors: number;
  total_project_views: number;
  visits_today: number;
  visits_this_week: number;
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
