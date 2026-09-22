export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          created_at: string | null
          credential_url: string | null
          date_earned: string | null
          description: string | null
          expiry_date: string | null
          id: string
          image_url: string | null
          is_featured: boolean | null
          issuer: string | null
          meta: Json | null
          sort_order: number | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credential_url?: string | null
          date_earned?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          issuer?: string | null
          meta?: Json | null
          sort_order?: number | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credential_url?: string | null
          date_earned?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          issuer?: string | null
          meta?: Json | null
          sort_order?: number | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      analytics: {
        Row: {
          country: string | null
          created_at: string | null
          device_type: string | null
          event: string
          id: string
          ip_address: string | null
          meta: Json | null
          path: string | null
          referrer: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          event: string
          id?: string
          ip_address?: string | null
          meta?: Json | null
          path?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          event?: string
          id?: string
          ip_address?: string | null
          meta?: Json | null
          path?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      analytics_daily: {
        Row: {
          day: string
          event: string
          events: number
          paths: Json
          rolled_at: string
          sessions: number
          visitors: number
        }
        Insert: {
          day: string
          event: string
          events?: number
          paths?: Json
          rolled_at?: string
          sessions?: number
          visitors?: number
        }
        Update: {
          day?: string
          event?: string
          events?: number
          paths?: Json
          rolled_at?: string
          sessions?: number
          visitors?: number
        }
        Relationships: []
      }
      ask_log: {
        Row: {
          answer: string | null
          answered_at: string | null
          asked_at: string
          citations: Json
          context_href: string | null
          cost_micro_usd: number
          feature: string
          featured: boolean
          id: string
          input_tokens: number | null
          ip_hash: string | null
          model: string | null
          output_tokens: number | null
          question: string | null
          question_norm: string
          sources: Json
          status: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          asked_at?: string
          citations?: Json
          context_href?: string | null
          cost_micro_usd?: number
          feature?: string
          featured?: boolean
          id?: string
          input_tokens?: number | null
          ip_hash?: string | null
          model?: string | null
          output_tokens?: number | null
          question?: string | null
          question_norm: string
          sources?: Json
          status?: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          asked_at?: string
          citations?: Json
          context_href?: string | null
          cost_micro_usd?: number
          feature?: string
          featured?: boolean
          id?: string
          input_tokens?: number | null
          ip_hash?: string | null
          model?: string | null
          output_tokens?: number | null
          question?: string | null
          question_norm?: string
          sources?: Json
          status?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string | null
          email: string
          id: string
          ip_address: string | null
          message: string
          meta: Json | null
          name: string
          replied_at: string | null
          status: string | null
          subject: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          ip_address?: string | null
          message: string
          meta?: Json | null
          name: string
          replied_at?: string | null
          status?: string | null
          subject?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          ip_address?: string | null
          message?: string
          meta?: Json | null
          name?: string
          replied_at?: string | null
          status?: string | null
          subject?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      content_chunks: {
        Row: {
          body: string
          chunk_index: number
          content_hash: string
          embedding: string | null
          href: string
          id: string
          indexed_at: string
          kind: string
          title: string
        }
        Insert: {
          body: string
          chunk_index?: number
          content_hash: string
          embedding?: string | null
          href: string
          id?: string
          indexed_at?: string
          kind: string
          title: string
        }
        Update: {
          body?: string
          chunk_index?: number
          content_hash?: string
          embedding?: string | null
          href?: string
          id?: string
          indexed_at?: string
          kind?: string
          title?: string
        }
        Relationships: []
      }
      digests: {
        Row: {
          body: string
          cost_micro_usd: number
          created_at: string
          id: string
          kind: string
          model: string | null
          period_start: string
        }
        Insert: {
          body: string
          cost_micro_usd?: number
          created_at?: string
          id?: string
          kind?: string
          model?: string | null
          period_start: string
        }
        Update: {
          body?: string
          cost_micro_usd?: number
          created_at?: string
          id?: string
          kind?: string
          model?: string | null
          period_start?: string
        }
        Relationships: []
      }
      experience: {
        Row: {
          company: string
          company_logo: string | null
          company_url: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          highlights: string[] | null
          id: string
          is_current: boolean | null
          is_deleted: boolean | null
          location: string | null
          meta: Json | null
          role: string
          sort_order: number | null
          start_date: string
          tech_used: string[] | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          company: string
          company_logo?: string | null
          company_url?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          highlights?: string[] | null
          id?: string
          is_current?: boolean | null
          is_deleted?: boolean | null
          location?: string | null
          meta?: Json | null
          role: string
          sort_order?: number | null
          start_date: string
          tech_used?: string[] | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          company?: string
          company_logo?: string | null
          company_url?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          highlights?: string[] | null
          id?: string
          is_current?: boolean | null
          is_deleted?: boolean | null
          location?: string | null
          meta?: Json | null
          role?: string
          sort_order?: number | null
          start_date?: string
          tech_used?: string[] | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      external_profiles: {
        Row: {
          created_at: string | null
          display_order: number | null
          icon_url: string | null
          id: string
          is_active: boolean | null
          meta: Json | null
          platform: string
          profile_url: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          meta?: Json | null
          platform: string
          profile_url: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          meta?: Json | null
          platform?: string
          profile_url?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: string
          key: string
          meta: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          key: string
          meta?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          key?: string
          meta?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      now_entries: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          kind: string
          progress: string | null
          project_id: string | null
          sort_order: number
          started_on: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind: string
          progress?: string | null
          project_id?: string | null
          sort_order?: number
          started_on?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          progress?: string | null
          project_id?: string | null
          sort_order?: number
          started_on?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "now_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      page_sections: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          heading: string | null
          id: string
          is_visible: boolean
          page: string
          section_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          heading?: string | null
          id?: string
          is_visible?: boolean
          page: string
          section_type: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          heading?: string | null
          id?: string
          is_visible?: boolean
          page?: string
          section_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      post_blocks: {
        Row: {
          block_type: string
          config: Json
          created_at: string
          description: string | null
          heading: string | null
          id: string
          post_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          block_type: string
          config?: Json
          created_at?: string
          description?: string | null
          heading?: string | null
          id?: string
          post_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          block_type?: string
          config?: Json
          created_at?: string
          description?: string | null
          heading?: string | null
          id?: string
          post_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_blocks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          created_at: string
          id: string
          meta: Json
          published_at: string | null
          slug: string
          status: string
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json
          published_at?: string | null
          slug: string
          status?: string
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json
          published_at?: string | null
          slug?: string
          status?: string
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string
          full_name: string
          github_url: string | null
          id: string
          is_active: boolean | null
          linkedin_url: string | null
          location: string | null
          meta: Json | null
          phone: string | null
          resume_url: string | null
          title: string | null
          twitter_url: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email: string
          full_name: string
          github_url?: string | null
          id?: string
          is_active?: boolean | null
          linkedin_url?: string | null
          location?: string | null
          meta?: Json | null
          phone?: string | null
          resume_url?: string | null
          title?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          github_url?: string | null
          id?: string
          is_active?: boolean | null
          linkedin_url?: string | null
          location?: string | null
          meta?: Json | null
          phone?: string | null
          resume_url?: string | null
          title?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      project_sections: {
        Row: {
          content: Json
          created_at: string | null
          id: string
          project_id: string
          sort_order: number | null
          title: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          content?: Json
          created_at?: string | null
          id?: string
          project_id: string
          sort_order?: number | null
          title?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          id?: string
          project_id?: string
          sort_order?: number | null
          title?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_storytelling: {
        Row: {
          body: string
          created_at: string | null
          id: string
          project_id: string
          section_type: string
          sort_order: number | null
          title: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          project_id: string
          section_type: string
          sort_order?: number | null
          title?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          project_id?: string
          section_type?: string
          sort_order?: number | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_storytelling_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          case_study_url: string | null
          cover_image_url: string | null
          created_at: string | null
          demo_url: string | null
          description: string | null
          end_date: string | null
          featured: boolean | null
          id: string
          is_deleted: boolean | null
          meta: Json | null
          repo_url: string | null
          slug: string
          sort_order: number | null
          start_date: string | null
          status: string | null
          tagline: string | null
          tags: string[] | null
          tech_stack: string[] | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          case_study_url?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          demo_url?: string | null
          description?: string | null
          end_date?: string | null
          featured?: boolean | null
          id?: string
          is_deleted?: boolean | null
          meta?: Json | null
          repo_url?: string | null
          slug: string
          sort_order?: number | null
          start_date?: string | null
          status?: string | null
          tagline?: string | null
          tags?: string[] | null
          tech_stack?: string[] | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          case_study_url?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          demo_url?: string | null
          description?: string | null
          end_date?: string | null
          featured?: boolean | null
          id?: string
          is_deleted?: boolean | null
          meta?: Json | null
          repo_url?: string | null
          slug?: string
          sort_order?: number | null
          start_date?: string | null
          status?: string | null
          tagline?: string | null
          tags?: string[] | null
          tech_stack?: string[] | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      resume: {
        Row: {
          created_at: string | null
          file_name: string
          file_url: string
          id: string
          is_active: boolean | null
          notes: string | null
          storage_path: string | null
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_url: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          storage_path?: string | null
          updated_at?: string | null
          version: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_url?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          storage_path?: string | null
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          created_at: string | null
          id: string
          is_public: boolean | null
          key: string
          section: string | null
          type: string | null
          updated_at: string | null
          value: string | null
          value_json: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          key: string
          section?: string | null
          type?: string | null
          updated_at?: string | null
          value?: string | null
          value_json?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          key?: string
          section?: string | null
          type?: string | null
          updated_at?: string | null
          value?: string | null
          value_json?: Json | null
        }
        Relationships: []
      }
      skills: {
        Row: {
          category: string
          created_at: string | null
          icon_url: string | null
          id: string
          is_deleted: boolean | null
          is_featured: boolean | null
          meta: Json | null
          name: string
          proficiency: number | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          icon_url?: string | null
          id?: string
          is_deleted?: boolean | null
          is_featured?: boolean | null
          meta?: Json | null
          name: string
          proficiency?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          icon_url?: string | null
          id?: string
          is_deleted?: boolean | null
          is_featured?: boolean | null
          meta?: Json | null
          name?: string
          proficiency?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ventures: {
        Row: {
          created_at: string
          description: string | null
          ended_on: string | null
          founded_on: string | null
          id: string
          industry: string[]
          is_featured: boolean
          is_visible: boolean
          link_checked_at: string | null
          logo_url: string | null
          meta: Json
          name: string
          relationship: string
          role: string | null
          slug: string
          sort_order: number
          status: string
          tagline: string | null
          tech_stack: string[]
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          ended_on?: string | null
          founded_on?: string | null
          id?: string
          industry?: string[]
          is_featured?: boolean
          is_visible?: boolean
          link_checked_at?: string | null
          logo_url?: string | null
          meta?: Json
          name: string
          relationship: string
          role?: string | null
          slug: string
          sort_order?: number
          status?: string
          tagline?: string | null
          tech_stack?: string[]
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          ended_on?: string | null
          founded_on?: string | null
          id?: string
          industry?: string[]
          is_featured?: boolean
          is_visible?: boolean
          link_checked_at?: string | null
          logo_url?: string | null
          meta?: Json
          name?: string
          relationship?: string
          role?: string | null
          slug?: string
          sort_order?: number
          status?: string
          tagline?: string | null
          tech_stack?: string[]
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      analytics_daily_visits: {
        Row: {
          date: string | null
          unique_visitors: number | null
          visits: number | null
        }
        Relationships: []
      }
      featured_qa: {
        Row: {
          answer: string | null
          answered_at: string | null
          citations: Json | null
          context_href: string | null
          id: string | null
          question: string | null
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          citations?: Json | null
          context_href?: string | null
          id?: string | null
          question?: string | null
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          citations?: Json | null
          context_href?: string | null
          id?: string | null
          question?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ask_begin: {
        Args: {
          p_cache_days?: number
          p_cap_cents?: number
          p_context_href?: string
          p_daily_cap_cents?: number
          p_feature?: string
          p_ip_hash: string
          p_per_ip_hour?: number
          p_question: string
          p_question_norm: string
        }
        Returns: Json
      }
      ask_context: {
        Args: {
          max_docs?: number
          q: string
          q_embedding?: string
          scope_href?: string
        }
        Returns: {
          body: string
          href: string
          kind: string
          title: string
        }[]
      }
      ask_corpus: {
        Args: never
        Returns: {
          body: string
          href: string
          kind: string
          title: string
        }[]
      }
      ask_finish: {
        Args: {
          p_answer: string
          p_citations: Json
          p_cost_micro_usd: number
          p_id: string
          p_input_tokens: number
          p_model: string
          p_output_tokens: number
          p_sources?: Json
          p_status: string
        }
        Returns: undefined
      }
      ask_index_state: { Args: never; Returns: Json }
      ask_query_terms: { Args: { q: string }; Returns: string }
      ask_retention: { Args: { p_days?: number }; Returns: Json }
      ask_spend: { Args: never; Returns: Json }
      explain_source: {
        Args: { p_id: string; p_table: string }
        Returns: {
          body: string
          href: string
          kind: string
          title: string
          version: string
        }[]
      }
      get_analytics_summary: { Args: never; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      jsonb_strings: { Args: { doc: Json }; Returns: string }
      refresh_project_view_counts: { Args: never; Returns: undefined }
      revalidate_diagnostics: { Args: never; Returns: Json }
      rollup_analytics: { Args: { retain_days?: number }; Returns: Json }
      search_content: {
        Args: { max_results?: number; q: string }
        Returns: {
          href: string
          kind: string
          rank: number
          snippet: string
          title: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
