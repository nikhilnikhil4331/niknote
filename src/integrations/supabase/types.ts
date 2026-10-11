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
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          category: string
          created_at: string
          details: Json | null
          device_type: string | null
          id: string
          ip_address: string | null
          page_url: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          category?: string
          created_at?: string
          details?: Json | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          page_url?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          category?: string
          created_at?: string
          details?: Json | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          page_url?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          token_hash: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip_address?: string | null
          token_hash: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          token_hash?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      badges: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          requirement_type: string
          requirement_value: number
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          icon?: string
          id?: string
          name: string
          requirement_type: string
          requirement_value?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          requirement_type?: string
          requirement_value?: number
        }
        Relationships: []
      }
      billing_plans: {
        Row: {
          code: string
          created_at: string
          id: string
          interval_count: number
          interval_unit: string
          price_inr: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          interval_count?: number
          interval_unit: string
          price_inr: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          interval_count?: number
          interval_unit?: string
          price_inr?: number
          updated_at?: string
        }
        Relationships: []
      }
      block_comments: {
        Row: {
          author_id: string
          block_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          mentions: Json
          notebook_id: string | null
          resolved: boolean
          thread_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          block_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          mentions?: Json
          notebook_id?: string | null
          resolved?: boolean
          thread_id?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          block_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          mentions?: Json
          notebook_id?: string | null
          resolved?: boolean
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_comments_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_wellness: {
        Row: {
          day: string
          exercise_minutes: number
          mood: string
          pomodoros: number
          sleep_hours: number
          user_id: string
          water: number
        }
        Insert: {
          day?: string
          exercise_minutes?: number
          mood?: string
          pomodoros?: number
          sleep_hours?: number
          user_id?: string
          water?: number
        }
        Update: {
          day?: string
          exercise_minutes?: number
          mood?: string
          pomodoros?: number
          sleep_hours?: number
          user_id?: string
          water?: number
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          component: string | null
          created_at: string
          device_type: string | null
          error_message: string
          error_stack: string | null
          error_type: string
          id: string
          page_url: string | null
          resolved: boolean | null
          severity: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          component?: string | null
          created_at?: string
          device_type?: string | null
          error_message: string
          error_stack?: string | null
          error_type: string
          id?: string
          page_url?: string | null
          resolved?: boolean | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          component?: string | null
          created_at?: string
          device_type?: string | null
          error_message?: string
          error_stack?: string | null
          error_type?: string
          id?: string
          page_url?: string | null
          resolved?: boolean | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      feature_usage: {
        Row: {
          created_at: string
          feature_name: string
          id: string
          updated_at: string
          usage_count: number
          usage_month: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_name: string
          id?: string
          updated_at?: string
          usage_count?: number
          usage_month?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature_name?: string
          id?: string
          updated_at?: string
          usage_count?: number
          usage_month?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          rating: number | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          rating?: number | null
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          rating?: number | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      habit_checks: {
        Row: {
          day: string
          habit_id: string
          user_id: string
        }
        Insert: {
          day?: string
          habit_id: string
          user_id?: string
        }
        Update: {
          day?: string
          habit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_checks_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          block: string
          created_at: string
          emoji: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          block?: string
          created_at?: string
          emoji?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          block?: string
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      handwriting_models: {
        Row: {
          analysis_notes: string | null
          baseline_jitter: boolean
          created_at: string
          font_size: number
          id: string
          ink_color: string
          is_default: boolean
          letter_spacing_variation: number | null
          line_spacing: number
          name: string
          pen_pressure_feel: number | null
          sample_image_url: string | null
          slant: number | null
          stroke_randomness: boolean
          stroke_thickness: number | null
          suggested_font: string
          updated_at: string
          user_id: string
          word_spacing: number
        }
        Insert: {
          analysis_notes?: string | null
          baseline_jitter?: boolean
          created_at?: string
          font_size?: number
          id?: string
          ink_color?: string
          is_default?: boolean
          letter_spacing_variation?: number | null
          line_spacing?: number
          name?: string
          pen_pressure_feel?: number | null
          sample_image_url?: string | null
          slant?: number | null
          stroke_randomness?: boolean
          stroke_thickness?: number | null
          suggested_font?: string
          updated_at?: string
          user_id: string
          word_spacing?: number
        }
        Update: {
          analysis_notes?: string | null
          baseline_jitter?: boolean
          created_at?: string
          font_size?: number
          id?: string
          ink_color?: string
          is_default?: boolean
          letter_spacing_variation?: number | null
          line_spacing?: number
          name?: string
          pen_pressure_feel?: number | null
          sample_image_url?: string | null
          slant?: number | null
          stroke_randomness?: boolean
          stroke_thickness?: number | null
          suggested_font?: string
          updated_at?: string
          user_id?: string
          word_spacing?: number
        }
        Relationships: []
      }
      money_goals: {
        Row: {
          created_at: string
          id: string
          name: string
          saved: number
          target: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          saved?: number
          target: number
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          saved?: number
          target?: number
          user_id?: string
        }
        Relationships: []
      }
      money_transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          id: string
          kind: string
          note: string
          occurred_on: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          id?: string
          kind?: string
          note?: string
          occurred_on?: string
          user_id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          id?: string
          kind?: string
          note?: string
          occurred_on?: string
          user_id?: string
        }
        Relationships: []
      }
      notebooks: {
        Row: {
          cover_color: string
          created_at: string
          description: string | null
          folder: string | null
          handwriting_model_id: string | null
          id: string
          page_size: string
          page_style: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_color?: string
          created_at?: string
          description?: string | null
          folder?: string | null
          handwriting_model_id?: string | null
          id?: string
          page_size?: string
          page_style?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_color?: string
          created_at?: string
          description?: string | null
          folder?: string | null
          handwriting_model_id?: string | null
          id?: string
          page_size?: string
          page_style?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebooks_handwriting_model_id_fkey"
            columns: ["handwriting_model_id"]
            isOneToOne: false
            referencedRelation: "handwriting_models"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          content: Json
          created_at: string
          id: string
          notebook_id: string
          page_number: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          notebook_id: string
          page_number?: number
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          notebook_id?: string
          page_number?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarding_completed: boolean
          updated_at: string
          use_case: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          use_case?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          use_case?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          coins_awarded: number
          created_at: string
          id: string
          premium_days_awarded: number
          referred_user_id: string
          referrer_id: string
          reward_granted: boolean
        }
        Insert: {
          coins_awarded?: number
          created_at?: string
          id?: string
          premium_days_awarded?: number
          referred_user_id: string
          referrer_id: string
          reward_granted?: boolean
        }
        Update: {
          coins_awarded?: number
          created_at?: string
          id?: string
          premium_days_awarded?: number
          referred_user_id?: string
          referrer_id?: string
          reward_granted?: boolean
        }
        Relationships: []
      }
      todos: {
        Row: {
          created_at: string
          done: boolean
          id: string
          position: number
          priority: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          priority?: string
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          priority?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      tracker_settings: {
        Row: {
          currency: string
          monthly_budget: number
          updated_at: string
          user_id: string
          water_goal: number
        }
        Insert: {
          currency?: string
          monthly_budget?: number
          updated_at?: string
          user_id?: string
          water_goal?: number
        }
        Update: {
          currency?: string
          monthly_budget?: number
          updated_at?: string
          user_id?: string
          water_goal?: number
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_rewards: {
        Row: {
          coins: number
          created_at: string
          last_spin_at: string | null
          referral_code: string
          referred_by: string | null
          total_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          coins?: number
          created_at?: string
          last_spin_at?: string | null
          referral_code?: string
          referred_by?: string | null
          total_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          coins?: number
          created_at?: string
          last_spin_at?: string | null
          referral_code?: string
          referred_by?: string | null
          total_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_active_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_active_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_active_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_code: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_code: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_code?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      verified_payments: {
        Row: {
          amount_paise: number
          created_at: string
          order_id: string
          payment_id: string
          plan_code: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          order_id: string
          payment_id: string
          plan_code: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          order_id?: string
          payment_id?: string
          plan_code?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_verified_purchase: {
        Args: {
          _amount_paise: number
          _order_id: string
          _payment_id: string
          _plan_code: string
          _user_id: string
        }
        Returns: boolean
      }
      claim_referral_bonus: {
        Args: { p_referral_code: string; p_user_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      redeem_coins_for_premium: {
        Args: { p_days?: number; p_user_id: string }
        Returns: Json
      }
      spin_daily_wheel: { Args: { p_user_id: string }; Returns: Json }
      update_user_streak: { Args: { p_user_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
