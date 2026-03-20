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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activecollab_credentials: {
        Row: {
          api_url: string
          created_at: string | null
          id: string
          is_active: boolean | null
          organization_id: string | null
          password: string | null
          token: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          api_url: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          password?: string | null
          token?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          api_url?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          password?: string | null
          token?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      activecollab_sync_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          records_synced: number | null
          started_at: string | null
          status: string | null
          sync_type: string | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          records_synced?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          records_synced?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
        }
        Relationships: []
      }
      activecollab_task_data: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          due_date: string | null
          id: string
          project_id: number | null
          status: string | null
          synced_at: string | null
          task_id: number
          task_name: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          project_id?: number | null
          status?: string | null
          synced_at?: string | null
          task_id: number
          task_name?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          project_id?: number | null
          status?: string | null
          synced_at?: string | null
          task_id?: number
          task_name?: string | null
        }
        Relationships: []
      }
      admin_google_drive_folders: {
        Row: {
          created_at: string | null
          folder_id: string
          folder_name: string
          id: string
          is_active: boolean | null
          purpose: string | null
        }
        Insert: {
          created_at?: string | null
          folder_id: string
          folder_name: string
          id?: string
          is_active?: boolean | null
          purpose?: string | null
        }
        Update: {
          created_at?: string | null
          folder_id?: string
          folder_name?: string
          id?: string
          is_active?: boolean | null
          purpose?: string | null
        }
        Relationships: []
      }
      agent_memories: {
        Row: {
          agent_id: string | null
          agent_user_id: string | null
          context: Json | null
          created_at: string | null
          id: string
          memory_text: string
          tags: string[] | null
        }
        Insert: {
          agent_id?: string | null
          agent_user_id?: string | null
          context?: Json | null
          created_at?: string | null
          id?: string
          memory_text: string
          tags?: string[] | null
        }
        Update: {
          agent_id?: string | null
          agent_user_id?: string | null
          context?: Json | null
          created_at?: string | null
          id?: string
          memory_text?: string
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_memories_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_knowledge_selection: {
        Row: {
          agent_id: string
          category_id: string
          created_at: string
          id: string
          is_enabled: boolean
          priority: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          category_id: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          priority?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          category_id?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_knowledge_selection_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_knowledge_selection_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_runs: {
        Row: {
          agent_id: string | null
          ai_summary: string | null
          approval_status: string | null
          approved_at: string | null
          brand_id: string | null
          category: string | null
          cost_usd: number | null
          created_at: string | null
          executed_by: string | null
          execution_context: Json | null
          generated_tasks: Json | null
          id: string
          output: Json | null
          status: string | null
          title: string | null
          total_tokens: number | null
        }
        Insert: {
          agent_id?: string | null
          ai_summary?: string | null
          approval_status?: string | null
          approved_at?: string | null
          brand_id?: string | null
          category?: string | null
          cost_usd?: number | null
          created_at?: string | null
          executed_by?: string | null
          execution_context?: Json | null
          generated_tasks?: Json | null
          id?: string
          output?: Json | null
          status?: string | null
          title?: string | null
          total_tokens?: number | null
        }
        Update: {
          agent_id?: string | null
          ai_summary?: string | null
          approval_status?: string | null
          approved_at?: string | null
          brand_id?: string | null
          category?: string | null
          cost_usd?: number | null
          created_at?: string | null
          executed_by?: string | null
          execution_context?: Json | null
          generated_tasks?: Json | null
          id?: string
          output?: Json | null
          status?: string | null
          title?: string | null
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_runs_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          category: string | null
          config: Json | null
          created_at: string | null
          created_by: string | null
          data_sources: Json | null
          description: string | null
          external_data_sources: Json | null
          fallback_provider: string | null
          id: string
          is_active: boolean | null
          is_enabled: boolean | null
          knowledge_sources: Json | null
          model_provider: string | null
          model_version: string | null
          name: string
          output_actions: Json | null
          schedule_config: Json | null
          scope: string | null
          slug: string | null
          system_prompt: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          data_sources?: Json | null
          description?: string | null
          external_data_sources?: Json | null
          fallback_provider?: string | null
          id?: string
          is_active?: boolean | null
          is_enabled?: boolean | null
          knowledge_sources?: Json | null
          model_provider?: string | null
          model_version?: string | null
          name: string
          output_actions?: Json | null
          schedule_config?: Json | null
          scope?: string | null
          slug?: string | null
          system_prompt?: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          data_sources?: Json | null
          description?: string | null
          external_data_sources?: Json | null
          fallback_provider?: string | null
          id?: string
          is_active?: boolean | null
          is_enabled?: boolean | null
          knowledge_sources?: Json | null
          model_provider?: string | null
          model_version?: string | null
          name?: string
          output_actions?: Json | null
          schedule_config?: Json | null
          scope?: string | null
          slug?: string | null
          system_prompt?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_configurations: {
        Row: {
          business_context: Json | null
          created_at: string | null
          id: string
          model_settings: Json | null
          prompts: Json | null
          updated_at: string | null
        }
        Insert: {
          business_context?: Json | null
          created_at?: string | null
          id?: string
          model_settings?: Json | null
          prompts?: Json | null
          updated_at?: string | null
        }
        Update: {
          business_context?: Json | null
          created_at?: string | null
          id?: string
          model_settings?: Json | null
          prompts?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_generated_images: {
        Row: {
          brand_id: string | null
          created_at: string | null
          generated_by: string | null
          id: string
          image_url: string | null
          metadata: Json | null
          model: string | null
          prompt: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json | null
          model?: string | null
          prompt: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json | null
          model?: string | null
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_images_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_shared_resources: {
        Row: {
          content: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          resource_name: string | null
          resource_type: string | null
          updated_at: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          resource_name?: string | null
          resource_type?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          resource_name?: string | null
          resource_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_shared_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_analytics_data: {
        Row: {
          brand_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          metric_date: string
          metric_name: string
          metric_value: number | null
          source: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_date: string
          metric_name: string
          metric_value?: number | null
          source?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_date?: string
          metric_name?: string
          metric_value?: number | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_analytics_data_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_analytics_integrations: {
        Row: {
          brand_id: string | null
          created_at: string | null
          credentials: Json | null
          id: string
          integration_type: string | null
          is_active: boolean | null
          property_id: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          credentials?: Json | null
          id?: string
          integration_type?: string | null
          is_active?: boolean | null
          property_id?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          credentials?: Json | null
          id?: string
          integration_type?: string | null
          is_active?: boolean | null
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_analytics_integrations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_file_comments: {
        Row: {
          comment: string
          created_at: string | null
          file_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          comment: string
          created_at?: string | null
          file_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string | null
          file_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_file_comments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "brand_knowledge_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_file_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_generated_posts: {
        Row: {
          agent_id: string | null
          brand_id: string
          created_at: string | null
          generated_by: string | null
          id: string
          metadata: Json | null
          platform: string | null
          post_body: string
          post_title: string | null
          scheduled_date: string | null
          status: string | null
        }
        Insert: {
          agent_id?: string | null
          brand_id: string
          created_at?: string | null
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          platform?: string | null
          post_body: string
          post_title?: string | null
          scheduled_date?: string | null
          status?: string | null
        }
        Update: {
          agent_id?: string | null
          brand_id?: string
          created_at?: string | null
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          platform?: string | null
          post_body?: string
          post_title?: string | null
          scheduled_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_generated_posts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_generated_posts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_generated_posts_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_knowledge_files: {
        Row: {
          brand_id: string
          created_at: string | null
          embedding_count: number | null
          error_message: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          is_indexed: boolean | null
          processing_status: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          embedding_count?: number | null
          error_message?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_indexed?: boolean | null
          processing_status?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          embedding_count?: number | null
          error_message?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_indexed?: boolean | null
          processing_status?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_knowledge_files_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_knowledge_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_kpis: {
        Row: {
          brand_id: string
          category: string | null
          created_at: string | null
          current_value: number | null
          description: string | null
          id: string
          kpi_name: string
          target_value: number | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          brand_id: string
          category?: string | null
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          kpi_name: string
          target_value?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: string
          category?: string | null
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          kpi_name?: string
          target_value?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_kpis_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          active_integrations: string[] | null
          co_owner_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          industry: string | null
          is_active: boolean | null
          logo_url: string | null
          monthly_budget: number | null
          name: string
          organization_id: string | null
          owner_id: string | null
          slug: string
          status: string
          team_members: string[] | null
          type: string | null
          updated_at: string | null
          website: string | null
          website_url: string | null
        }
        Insert: {
          active_integrations?: string[] | null
          co_owner_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          monthly_budget?: number | null
          name: string
          organization_id?: string | null
          owner_id?: string | null
          slug: string
          status?: string
          team_members?: string[] | null
          type?: string | null
          updated_at?: string | null
          website?: string | null
          website_url?: string | null
        }
        Update: {
          active_integrations?: string[] | null
          co_owner_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          monthly_budget?: number | null
          name?: string
          organization_id?: string | null
          owner_id?: string | null
          slug?: string
          status?: string
          team_members?: string[] | null
          type?: string | null
          updated_at?: string | null
          website?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_co_owner_id_fkey"
            columns: ["co_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          activecollab_id: number | null
          company: string | null
          created_at: string | null
          email: string | null
          id: string
          industry: string | null
          metadata: Json | null
          name: string
          phone: string | null
          slug: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          activecollab_id?: number | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          metadata?: Json | null
          name: string
          phone?: string | null
          slug: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          activecollab_id?: number | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          metadata?: Json | null
          name?: string
          phone?: string | null
          slug?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      code_analysis_results: {
        Row: {
          analysis_type: string | null
          analyzed_at: string | null
          id: string
          repository_id: string | null
          results: Json | null
        }
        Insert: {
          analysis_type?: string | null
          analyzed_at?: string | null
          id?: string
          repository_id?: string | null
          results?: Json | null
        }
        Update: {
          analysis_type?: string | null
          analyzed_at?: string | null
          id?: string
          repository_id?: string | null
          results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "code_analysis_results_repository_id_fkey"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "code_repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      code_generation_templates: {
        Row: {
          category: string | null
          created_at: string | null
          framework: string | null
          id: string
          language: string | null
          name: string
          template: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          framework?: string | null
          id?: string
          language?: string | null
          name: string
          template: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          framework?: string | null
          id?: string
          language?: string | null
          name?: string
          template?: string
        }
        Relationships: []
      }
      code_repositories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          platform: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          platform?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          platform?: string | null
          url?: string | null
        }
        Relationships: []
      }
      collabai_agents: {
        Row: {
          config: Json | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          client_id: string | null
          company: string | null
          created_at: string | null
          email: string | null
          first_name: string
          hubspot_id: string | null
          id: string
          last_name: string
          phone: string | null
          role: string | null
        }
        Insert: {
          client_id?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          first_name: string
          hubspot_id?: string | null
          id?: string
          last_name: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          client_id?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string
          hubspot_id?: string | null
          id?: string
          last_name?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      content_performance_metrics: {
        Row: {
          brand_id: string | null
          clicks: number | null
          content_id: string | null
          content_type: string | null
          conversions: number | null
          engagement_rate: number | null
          id: string
          recorded_at: string | null
          views: number | null
        }
        Insert: {
          brand_id?: string | null
          clicks?: number | null
          content_id?: string | null
          content_type?: string | null
          conversions?: number | null
          engagement_rate?: number | null
          id?: string
          recorded_at?: string | null
          views?: number | null
        }
        Update: {
          brand_id?: string | null
          clicks?: number | null
          content_id?: string | null
          content_type?: string | null
          conversions?: number | null
          engagement_rate?: number | null
          id?: string
          recorded_at?: string | null
          views?: number | null
        }
        Relationships: []
      }
      control_tower_api_keys: {
        Row: {
          api_key_encrypted: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          key_name: string
        }
        Insert: {
          api_key_encrypted?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_name: string
        }
        Update: {
          api_key_encrypted?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_name?: string
        }
        Relationships: []
      }
      control_tower_sync_logs: {
        Row: {
          error_message: string | null
          id: string
          records_synced: number | null
          status: string | null
          sync_type: string | null
          synced_at: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          records_synced?: number | null
          status?: string | null
          sync_type?: string | null
          synced_at?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          records_synced?: number | null
          status?: string | null
          sync_type?: string | null
          synced_at?: string | null
        }
        Relationships: []
      }
      deals: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          created_at: string | null
          expected_close_date: string | null
          hubspot_id: string | null
          id: string
          metadata: Json | null
          name: string
          probability: number | null
          stage: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string | null
          expected_close_date?: string | null
          hubspot_id?: string | null
          id?: string
          metadata?: Json | null
          name: string
          probability?: number | null
          stage?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string | null
          expected_close_date?: string | null
          hubspot_id?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          probability?: number | null
          stage?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      documentation_output_config: {
        Row: {
          config_name: string
          created_at: string | null
          id: string
          output_format: string | null
          settings: Json | null
        }
        Insert: {
          config_name: string
          created_at?: string | null
          id?: string
          output_format?: string | null
          settings?: Json | null
        }
        Update: {
          config_name?: string
          created_at?: string | null
          id?: string
          output_format?: string | null
          settings?: Json | null
        }
        Relationships: []
      }
      documentation_repository_links: {
        Row: {
          created_at: string | null
          documentation_url: string | null
          id: string
          link_type: string | null
          repository_id: string | null
        }
        Insert: {
          created_at?: string | null
          documentation_url?: string | null
          id?: string
          link_type?: string | null
          repository_id?: string | null
        }
        Update: {
          created_at?: string | null
          documentation_url?: string | null
          id?: string
          link_type?: string | null
          repository_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentation_repository_links_repository_id_fkey"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "code_repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      documentation_rules: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          rule: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          rule: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          rule?: string
        }
        Relationships: []
      }
      documentation_templates: {
        Row: {
          category: string | null
          created_at: string | null
          doc_category: string | null
          id: string
          is_active: boolean | null
          name: string
          output_format: string | null
          sections_template: Json | null
          system_prompt: string | null
          template: string
          template_name: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          doc_category?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          output_format?: string | null
          sections_template?: Json | null
          system_prompt?: string | null
          template: string
          template_name?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          doc_category?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          output_format?: string | null
          sections_template?: Json | null
          system_prompt?: string | null
          template?: string
          template_name?: string | null
        }
        Relationships: []
      }
      employee_user_mapping: {
        Row: {
          created_at: string | null
          employee_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_user_mapping_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_user_mapping_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string | null
          department: string | null
          email: string | null
          employee_id: string
          first_name: string
          hire_date: string | null
          id: string
          is_active: boolean | null
          job_title: string | null
          last_name: string
          metadata: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          email?: string | null
          employee_id: string
          first_name: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          last_name: string
          metadata?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string | null
          email?: string | null
          employee_id?: string
          first_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          last_name?: string
          metadata?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      feedback_comments: {
        Row: {
          comment: string
          created_at: string | null
          feedback_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          comment: string
          created_at?: string | null
          feedback_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string | null
          feedback_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_comments_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_reports: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          priority: string | null
          status: string | null
          submitted_by: string | null
          title: string
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          submitted_by?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          submitted_by?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_reports_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gemini_videos: {
        Row: {
          brand_id: string | null
          created_at: string | null
          generated_by: string | null
          id: string
          metadata: Json | null
          prompt: string
          status: string | null
          video_url: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          prompt: string
          status?: string | null
          video_url?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          prompt?: string
          status?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gemini_videos_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_posts: {
        Row: {
          agent_id: string | null
          caption_ideas: string[] | null
          carousel_outline: string[] | null
          created_at: string | null
          generated_by: string | null
          id: string
          leader_id: string | null
          model_used: string | null
          post_body: string
          post_title: string | null
          source_id: string | null
          source_type: string | null
        }
        Insert: {
          agent_id?: string | null
          caption_ideas?: string[] | null
          carousel_outline?: string[] | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          leader_id?: string | null
          model_used?: string | null
          post_body: string
          post_title?: string | null
          source_id?: string | null
          source_type?: string | null
        }
        Update: {
          agent_id?: string | null
          caption_ideas?: string[] | null
          carousel_outline?: string[] | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          leader_id?: string | null
          model_used?: string | null
          post_body?: string
          post_title?: string | null
          source_id?: string | null
          source_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_posts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_posts_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_posts_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "thought_leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      gohighlevel_contacts: {
        Row: {
          email: string | null
          first_name: string | null
          ghl_id: string | null
          id: string
          last_name: string | null
          metadata: Json | null
          phone: string | null
          synced_at: string | null
          tags: string[] | null
        }
        Insert: {
          email?: string | null
          first_name?: string | null
          ghl_id?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json | null
          phone?: string | null
          synced_at?: string | null
          tags?: string[] | null
        }
        Update: {
          email?: string | null
          first_name?: string | null
          ghl_id?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json | null
          phone?: string | null
          synced_at?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      gohighlevel_integrations: {
        Row: {
          api_key_encrypted: string | null
          config: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          location_id: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_id?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_id?: string | null
        }
        Relationships: []
      }
      google_drive_settings: {
        Row: {
          brand_id: string | null
          created_at: string | null
          credentials: Json | null
          folder_id: string | null
          id: string
          is_active: boolean | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          credentials?: Json | null
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          credentials?: Json | null
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "google_drive_settings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      hackathon_events: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          is_active: boolean | null
          location: string | null
          max_team_size: number | null
          min_team_size: number | null
          name: string
          prizes: Json | null
          registration_deadline: string | null
          rules: string | null
          start_date: string
          status: string | null
          theme: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          max_team_size?: number | null
          min_team_size?: number | null
          name: string
          prizes?: Json | null
          registration_deadline?: string | null
          rules?: string | null
          start_date: string
          status?: string | null
          theme?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          max_team_size?: number | null
          min_team_size?: number | null
          name?: string
          prizes?: Json | null
          registration_deadline?: string | null
          rules?: string | null
          start_date?: string
          status?: string | null
          theme?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hackathon_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hackathon_judges: {
        Row: {
          assigned_at: string | null
          event_id: string | null
          expertise: string[] | null
          id: string
          user_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          event_id?: string | null
          expertise?: string[] | null
          id?: string
          user_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          event_id?: string | null
          expertise?: string[] | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hackathon_judges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hackathon_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hackathon_judges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hackathon_participants: {
        Row: {
          event_id: string | null
          id: string
          interests: string[] | null
          registration_date: string | null
          skills: string[] | null
          status: string | null
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          event_id?: string | null
          id?: string
          interests?: string[] | null
          registration_date?: string | null
          skills?: string[] | null
          status?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          event_id?: string | null
          id?: string
          interests?: string[] | null
          registration_date?: string | null
          skills?: string[] | null
          status?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hackathon_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hackathon_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hackathon_participants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "hackathon_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hackathon_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hackathon_scores: {
        Row: {
          comments: string | null
          execution_score: number | null
          feedback: string | null
          id: string
          impact_score: number | null
          innovation_score: number | null
          judge_id: string | null
          presentation_score: number | null
          scored_at: string | null
          submission_id: string | null
          technical_score: number | null
          total_score: number | null
        }
        Insert: {
          comments?: string | null
          execution_score?: number | null
          feedback?: string | null
          id?: string
          impact_score?: number | null
          innovation_score?: number | null
          judge_id?: string | null
          presentation_score?: number | null
          scored_at?: string | null
          submission_id?: string | null
          technical_score?: number | null
          total_score?: number | null
        }
        Update: {
          comments?: string | null
          execution_score?: number | null
          feedback?: string | null
          id?: string
          impact_score?: number | null
          innovation_score?: number | null
          judge_id?: string | null
          presentation_score?: number | null
          scored_at?: string | null
          submission_id?: string | null
          technical_score?: number | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hackathon_scores_judge_id_fkey"
            columns: ["judge_id"]
            isOneToOne: false
            referencedRelation: "hackathon_judges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hackathon_scores_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "hackathon_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      hackathon_submissions: {
        Row: {
          demo_url: string | null
          description: string
          github_url: string | null
          id: string
          is_finalized: boolean | null
          presentation_url: string | null
          status: string | null
          submission_title: string
          submitted_at: string | null
          team_id: string | null
          tech_stack: string[] | null
          video_url: string | null
        }
        Insert: {
          demo_url?: string | null
          description: string
          github_url?: string | null
          id?: string
          is_finalized?: boolean | null
          presentation_url?: string | null
          status?: string | null
          submission_title: string
          submitted_at?: string | null
          team_id?: string | null
          tech_stack?: string[] | null
          video_url?: string | null
        }
        Update: {
          demo_url?: string | null
          description?: string
          github_url?: string | null
          id?: string
          is_finalized?: boolean | null
          presentation_url?: string | null
          status?: string | null
          submission_title?: string
          submitted_at?: string | null
          team_id?: string | null
          tech_stack?: string[] | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hackathon_submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "hackathon_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      hackathon_team_members: {
        Row: {
          id: string
          joined_at: string | null
          participant_id: string | null
          role: string | null
          team_id: string | null
        }
        Insert: {
          id?: string
          joined_at?: string | null
          participant_id?: string | null
          role?: string | null
          team_id?: string | null
        }
        Update: {
          id?: string
          joined_at?: string | null
          participant_id?: string | null
          role?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hackathon_team_members_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "hackathon_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hackathon_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "hackathon_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      hackathon_teams: {
        Row: {
          created_at: string | null
          event_id: string | null
          id: string
          project_description: string | null
          project_name: string | null
          status: string | null
          team_lead_id: string | null
          team_name: string
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          project_description?: string | null
          project_name?: string | null
          status?: string | null
          team_lead_id?: string | null
          team_name: string
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          project_description?: string | null
          project_name?: string | null
          status?: string | null
          team_lead_id?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "hackathon_teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hackathon_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hackathon_teams_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_style_library: {
        Row: {
          created_at: string | null
          id: string
          influencer_name: string
          is_active: boolean | null
          sample_posts: string[] | null
          style_description: string | null
          tone_keywords: string[] | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          influencer_name: string
          is_active?: boolean | null
          sample_posts?: string[] | null
          style_description?: string | null
          tone_keywords?: string[] | null
        }
        Update: {
          created_at?: string | null
          id?: string
          influencer_name?: string
          is_active?: boolean | null
          sample_posts?: string[] | null
          style_description?: string | null
          tone_keywords?: string[] | null
        }
        Relationships: []
      }
      integration_logs: {
        Row: {
          action: string | null
          created_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          id: string
          integration_type: string | null
          performed_by: string | null
          request_data: Json | null
          request_payload: Json | null
          response_data: Json | null
          status: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          integration_type?: string | null
          performed_by?: string | null
          request_data?: Json | null
          request_payload?: Json | null
          response_data?: Json | null
          status?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          integration_type?: string | null
          performed_by?: string | null
          request_data?: Json | null
          request_payload?: Json | null
          response_data?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      keyword_ranking_history: {
        Row: {
          id: string
          keyword_id: string | null
          position: number | null
          recorded_at: string | null
          url: string | null
        }
        Insert: {
          id?: string
          keyword_id?: string | null
          position?: number | null
          recorded_at?: string | null
          url?: string | null
        }
        Update: {
          id?: string
          keyword_id?: string | null
          position?: number | null
          recorded_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "keyword_ranking_history_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keyword_research"
            referencedColumns: ["id"]
          },
        ]
      }
      keyword_research: {
        Row: {
          cpc: number | null
          created_at: string | null
          difficulty: number | null
          id: string
          keyword: string
          search_volume: number | null
          trends: Json | null
        }
        Insert: {
          cpc?: number | null
          created_at?: string | null
          difficulty?: number | null
          id?: string
          keyword: string
          search_volume?: number | null
          trends?: Json | null
        }
        Update: {
          cpc?: number | null
          created_at?: string | null
          difficulty?: number | null
          id?: string
          keyword?: string
          search_volume?: number | null
          trends?: Json | null
        }
        Relationships: []
      }
      keyword_suggestions: {
        Row: {
          brand_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          keyword: string
          relevance_score: number | null
          source: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          keyword: string
          relevance_score?: number | null
          source?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          keyword?: string
          relevance_score?: number | null
          source?: string | null
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          category_id: string | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          knowledge_type: string | null
          source_url: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          knowledge_type?: string | null
          source_url?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          knowledge_type?: string | null
          source_url?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_synced: string | null
          name: string
          parent_id: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_synced?: string | null
          name: string
          parent_id?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_synced?: string | null
          name?: string
          parent_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_files: {
        Row: {
          category_id: string | null
          created_at: string | null
          embedding_count: number | null
          error_message: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          is_indexed: boolean | null
          processing_status: string | null
          title: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          embedding_count?: number | null
          error_message?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_indexed?: boolean | null
          processing_status?: string | null
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          embedding_count?: number | null
          error_message?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_indexed?: boolean | null
          processing_status?: string | null
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_files_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_files: {
        Row: {
          created_at: string | null
          error_message: string | null
          file_name: string
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          is_indexed: boolean | null
          processing_status: string | null
          source_id: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          file_name: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_indexed?: boolean | null
          processing_status?: string | null
          source_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_indexed?: boolean | null
          processing_status?: string | null
          source_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_files_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sources: {
        Row: {
          brand_id: string | null
          category_id: string | null
          config: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          is_company_wide: boolean | null
          name: string
          source_type: string | null
          updated_at: string | null
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_company_wide?: boolean | null
          name: string
          source_type?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_company_wide?: boolean | null
          name?: string
          source_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_sources_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leader_uploads: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          is_indexed: boolean | null
          leader_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_indexed?: boolean | null
          leader_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_indexed?: boolean | null
          leader_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leader_uploads_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "thought_leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leader_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_agent_templates: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          persona_tone: string | null
          prompt_template: string
          role_category: string | null
          system_prompt: string | null
          template_name: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          persona_tone?: string | null
          prompt_template: string
          role_category?: string | null
          system_prompt?: string | null
          template_name: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          persona_tone?: string | null
          prompt_template?: string
          role_category?: string | null
          system_prompt?: string | null
          template_name?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      linkedin_analytics_upload: {
        Row: {
          brand_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          metric_date: string | null
          metric_name: string | null
          metric_value: number | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_date?: string | null
          metric_name?: string | null
          metric_value?: number | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_date?: string | null
          metric_name?: string | null
          metric_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_analytics_upload_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_content_metadata: {
        Row: {
          brand_id: string | null
          comments: number | null
          created_at: string | null
          engagement_rate: number | null
          id: string
          impressions: number | null
          likes: number | null
          metadata: Json | null
          post_id: string | null
          shares: number | null
        }
        Insert: {
          brand_id?: string | null
          comments?: number | null
          created_at?: string | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          metadata?: Json | null
          post_id?: string | null
          shares?: number | null
        }
        Update: {
          brand_id?: string | null
          comments?: number | null
          created_at?: string | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          metadata?: Json | null
          post_id?: string | null
          shares?: number | null
        }
        Relationships: []
      }
      marketing_team_members: {
        Row: {
          brand_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_team_members_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_workflow_configs: {
        Row: {
          base_url: string | null
          config: Json | null
          created_at: string | null
          id: string
          is_enabled: boolean | null
          updated_at: string | null
          webhook_url: string | null
          workflow_name: string
          workflow_slug: string | null
          workflow_url: string | null
        }
        Insert: {
          base_url?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          updated_at?: string | null
          webhook_url?: string | null
          workflow_name: string
          workflow_slug?: string | null
          workflow_url?: string | null
        }
        Update: {
          base_url?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          updated_at?: string | null
          webhook_url?: string | null
          workflow_name?: string
          workflow_slug?: string | null
          workflow_url?: string | null
        }
        Relationships: []
      }
      n8n_workflow_executions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          input_data: Json | null
          output_data: Json | null
          started_at: string | null
          status: string | null
          workflow_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          started_at?: string | null
          status?: string | null
          workflow_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          started_at?: string | null
          status?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "n8n_workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "n8n_workflow_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      newsletter_sources: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          rss_url: string
          source_name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          rss_url: string
          source_name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          rss_url?: string
          source_name?: string
        }
        Relationships: []
      }
      organization_integrations: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          integration_type: string
          is_active: boolean | null
          organization_id: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          integration_type: string
          is_active?: boolean | null
          organization_id?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          integration_type?: string
          is_active?: boolean | null
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      perplexity_settings: {
        Row: {
          api_key_encrypted: string | null
          created_at: string | null
          id: string
          is_enabled: boolean | null
          model: string | null
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          model?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          model?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pod_members: {
        Row: {
          employee_id: string | null
          id: string
          joined_at: string | null
          pod_id: string | null
          role: string | null
        }
        Insert: {
          employee_id?: string | null
          id?: string
          joined_at?: string | null
          pod_id?: string | null
          role?: string | null
        }
        Update: {
          employee_id?: string | null
          id?: string
          joined_at?: string | null
          pod_id?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pod_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_members_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
        ]
      }
      pods: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          pod_lead_id: string | null
          pod_name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          pod_lead_id?: string | null
          pod_name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          pod_lead_id?: string | null
          pod_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pods_pod_lead_id_fkey"
            columns: ["pod_lead_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      post_agent_references: {
        Row: {
          agent_id: string | null
          created_at: string | null
          id: string
          post_id: string | null
          reference_type: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          post_id?: string | null
          reference_type?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          post_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_agent_references_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      project_knowledge_files: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          processing_status: string | null
          project_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          processing_status?: string | null
          project_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          processing_status?: string | null
          project_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_knowledge_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_knowledge_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_meetings: {
        Row: {
          attendees: string[] | null
          created_at: string | null
          created_by: string | null
          duration_minutes: number | null
          id: string
          meeting_date: string | null
          meeting_url: string | null
          notes: string | null
          project_id: string | null
          title: string
        }
        Insert: {
          attendees?: string[] | null
          created_at?: string | null
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          meeting_date?: string | null
          meeting_url?: string | null
          notes?: string | null
          project_id?: string | null
          title: string
        }
        Update: {
          attendees?: string[] | null
          created_at?: string | null
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          meeting_date?: string | null
          meeting_url?: string | null
          notes?: string | null
          project_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_task_comments: {
        Row: {
          comment: string
          created_at: string | null
          created_by: string | null
          id: string
          task_id: string | null
        }
        Insert: {
          comment: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          task_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_task_comments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          activecollab_task_id: number | null
          actual_hours: number | null
          assigned_to: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          project_id: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          activecollab_task_id?: number | null
          actual_hours?: number | null
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          activecollab_task_id?: number | null
          actual_hours?: number | null
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          activecollab_id: number | null
          client_id: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          metadata: Json | null
          name: string
          project_manager_id: string | null
          slug: string
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          activecollab_id?: number | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json | null
          name: string
          project_manager_id?: string | null
          slug: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          activecollab_id?: number | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          project_manager_id?: string | null
          slug?: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_manager_id_fkey"
            columns: ["project_manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          quantity: number | null
          quote_id: string | null
          sort_order: number | null
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          quantity?: number | null
          quote_id?: string | null
          sort_order?: number | null
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          quantity?: number | null
          quote_id?: string | null
          sort_order?: number | null
          total_price?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          client_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          metadata: Json | null
          status: string | null
          title: string
          total_amount: number | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          title: string
          total_amount?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          title?: string
          total_amount?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          id: string
          permission: string
          resource_type: string | null
          role: string
        }
        Insert: {
          id?: string
          permission: string
          resource_type?: string | null
          role: string
        }
        Update: {
          id?: string
          permission?: string
          resource_type?: string | null
          role?: string
        }
        Relationships: []
      }
      seo_blog_content: {
        Row: {
          audience: string | null
          author_id: string | null
          brand_id: string | null
          brand_name: string | null
          content: Json | null
          created_at: string | null
          id: string
          keywords: string[] | null
          meta_description: string | null
          primary_keyword: string | null
          primary_reference: string | null
          published_at: string | null
          secondary_keyword: string | null
          third_keyword: string | null
          title: string
          tone: string | null
        }
        Insert: {
          audience?: string | null
          author_id?: string | null
          brand_id?: string | null
          brand_name?: string | null
          content?: Json | null
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          primary_keyword?: string | null
          primary_reference?: string | null
          published_at?: string | null
          secondary_keyword?: string | null
          third_keyword?: string | null
          title: string
          tone?: string | null
        }
        Update: {
          audience?: string | null
          author_id?: string | null
          brand_id?: string | null
          brand_name?: string | null
          content?: Json | null
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          primary_keyword?: string | null
          primary_reference?: string | null
          published_at?: string | null
          secondary_keyword?: string | null
          third_keyword?: string | null
          title?: string
          tone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_blog_content_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_blog_content_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_reference_summaries: {
        Row: {
          generated_at: string | null
          id: string
          key_points: string[] | null
          source_url: string
          summary: string
        }
        Insert: {
          generated_at?: string | null
          id?: string
          key_points?: string[] | null
          source_url: string
          summary: string
        }
        Update: {
          generated_at?: string | null
          id?: string
          key_points?: string[] | null
          source_url?: string
          summary?: string
        }
        Relationships: []
      }
      sora_videos: {
        Row: {
          brand_id: string | null
          created_at: string | null
          generated_by: string | null
          id: string
          metadata: Json | null
          prompt: string
          status: string | null
          video_url: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          prompt: string
          status?: string | null
          video_url?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          prompt?: string
          status?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sora_videos_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      team_daily_summaries: {
        Row: {
          generated_at: string | null
          generated_by_ai: boolean | null
          id: string
          summary_date: string
          summary_text: string | null
          total_submissions: number | null
        }
        Insert: {
          generated_at?: string | null
          generated_by_ai?: boolean | null
          id?: string
          summary_date: string
          summary_text?: string | null
          total_submissions?: number | null
        }
        Update: {
          generated_at?: string | null
          generated_by_ai?: boolean | null
          id?: string
          summary_date?: string
          summary_text?: string | null
          total_submissions?: number | null
        }
        Relationships: []
      }
      team_eod_submissions: {
        Row: {
          challenges: string | null
          hours_worked: number | null
          id: string
          metadata: Json | null
          mood_rating: number | null
          submission_date: string
          submitted_at: string | null
          tomorrow_plan: string | null
          user_id: string
          wins: string | null
        }
        Insert: {
          challenges?: string | null
          hours_worked?: number | null
          id?: string
          metadata?: Json | null
          mood_rating?: number | null
          submission_date: string
          submitted_at?: string | null
          tomorrow_plan?: string | null
          user_id: string
          wins?: string | null
        }
        Update: {
          challenges?: string | null
          hours_worked?: number | null
          id?: string
          metadata?: Json | null
          mood_rating?: number | null
          submission_date?: string
          submitted_at?: string | null
          tomorrow_plan?: string | null
          user_id?: string
          wins?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_eod_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string | null
          role: string | null
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          joined_at?: string | null
          role?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          joined_at?: string | null
          role?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          team_lead_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          team_lead_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          team_lead_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          author_name: string
          author_title: string | null
          company: string | null
          content: string
          created_at: string | null
          id: string
          is_approved: boolean | null
          rating: number | null
        }
        Insert: {
          author_name: string
          author_title?: string | null
          company?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          rating?: number | null
        }
        Update: {
          author_name?: string
          author_title?: string | null
          company?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          rating?: number | null
        }
        Relationships: []
      }
      thought_leaders: {
        Row: {
          agent_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          key_topics: string[] | null
          linkedin_url: string | null
          name: string
          slug: string
          target_audience: string | null
          title: string | null
          updated_at: string | null
          writing_tone: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          key_topics?: string[] | null
          linkedin_url?: string | null
          name: string
          slug: string
          target_audience?: string | null
          title?: string | null
          updated_at?: string | null
          writing_tone?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          key_topics?: string[] | null
          linkedin_url?: string | null
          name?: string
          slug?: string
          target_audience?: string | null
          title?: string | null
          updated_at?: string | null
          writing_tone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "thought_leaders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thought_leaders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_accountability_chart: {
        Row: {
          created_at: string | null
          id: string
          responsibilities: string | null
          serial_number: number | null
          type_of_work: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          responsibilities?: string | null
          serial_number?: number | null
          type_of_work?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          responsibilities?: string | null
          serial_number?: number | null
          type_of_work?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_accountability_chart_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activecollab_settings: {
        Row: {
          activecollab_user_id: number | null
          created_at: string | null
          id: string
          settings: Json | null
          user_id: string
        }
        Insert: {
          activecollab_user_id?: number | null
          created_at?: string | null
          id?: string
          settings?: Json | null
          user_id: string
        }
        Update: {
          activecollab_user_id?: number | null
          created_at?: string | null
          id?: string
          settings?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activecollab_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_brands: {
        Row: {
          brand_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_brands_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_google_tokens: {
        Row: {
          access_token: string | null
          created_at: string | null
          id: string
          refresh_token: string | null
          scopes: string[] | null
          token_expiry: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          refresh_token?: string | null
          scopes?: string[] | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          refresh_token?: string | null
          scopes?: string[] | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_google_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string | null
          granted_by: string | null
          id: string
          permission: string
          resource_id: string | null
          resource_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          permission: string
          resource_id?: string | null
          resource_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          permission?: string
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vision_examples: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          title?: string
        }
        Relationships: []
      }
      weekly_client_summary: {
        Row: {
          client_id: string | null
          created_at: string | null
          generated_by: string | null
          id: string
          summary_text: string | null
          week_end: string | null
          week_start: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          summary_text?: string | null
          week_end?: string | null
          week_start?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          summary_text?: string | null
          week_end?: string | null
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_client_summary_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_client_summary_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_content_ideas: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          headline: string
          id: string
          is_active: boolean | null
          leader_id: string | null
          source_urls: string[] | null
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          headline: string
          id?: string
          is_active?: boolean | null
          leader_id?: string | null
          source_urls?: string[] | null
          week_end_date: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          headline?: string
          id?: string
          is_active?: boolean | null
          leader_id?: string | null
          source_urls?: string[] | null
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: []
      }
      weekly_trends: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          headline: string
          id: string
          is_active: boolean | null
          source_urls: string[] | null
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          headline: string
          id?: string
          is_active?: boolean | null
          source_urls?: string[] | null
          week_end_date: string
          week_start_date: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          headline?: string
          id?: string
          is_active?: boolean | null
          source_urls?: string[] | null
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_trends_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_role: { Args: never; Returns: string }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      user_has_brand_access: {
        Args: { _brand_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_client_access: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "pm" | "brand_manager" | "manager" | "super_admin"
      linkedin_post_source: "trend" | "influencer" | "custom"
      processing_status: "pending" | "processing" | "completed" | "failed"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "pm", "brand_manager", "manager", "super_admin"],
      linkedin_post_source: ["trend", "influencer", "custom"],
      processing_status: ["pending", "processing", "completed", "failed"],
    },
  },
} as const
