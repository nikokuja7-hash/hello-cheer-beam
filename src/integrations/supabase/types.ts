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
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_system: boolean | null
          match_id: string | null
          tournament_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_system?: boolean | null
          match_id?: string | null
          tournament_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_system?: boolean | null
          match_id?: string | null
          tournament_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      match_results: {
        Row: {
          ai_extracted: Json | null
          ai_verified: boolean | null
          created_at: string
          id: string
          match_id: string
          screenshot_url: string
          submitted_by: string
        }
        Insert: {
          ai_extracted?: Json | null
          ai_verified?: boolean | null
          created_at?: string
          id?: string
          match_id: string
          screenshot_url: string
          submitted_by: string
        }
        Update: {
          ai_extracted?: Json | null
          ai_verified?: boolean | null
          created_at?: string
          id?: string
          match_id?: string
          screenshot_url?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          id: string
          konami_room_info: string | null
          player1_checked_in: boolean | null
          player1_id: string | null
          player1_score: number | null
          player2_checked_in: boolean | null
          player2_id: string | null
          player2_score: number | null
          round: number | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          tournament_id: string | null
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          konami_room_info?: string | null
          player1_checked_in?: boolean | null
          player1_id?: string | null
          player1_score?: number | null
          player2_checked_in?: boolean | null
          player2_id?: string | null
          player2_score?: number | null
          round?: number | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          tournament_id?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          konami_room_info?: string | null
          player1_checked_in?: boolean | null
          player1_id?: string | null
          player1_score?: number | null
          player2_checked_in?: boolean | null
          player2_id?: string | null
          player2_score?: number | null
          round?: number | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          tournament_id?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          read: boolean | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_kes: number
          created_at: string
          external_ref: string | null
          id: string
          mpesa_receipt: string | null
          phone: string
          status: Database["public"]["Enums"]["payment_status"]
          tournament_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          external_ref?: string | null
          id?: string
          mpesa_receipt?: string | null
          phone: string
          status?: Database["public"]["Enums"]["payment_status"]
          tournament_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          external_ref?: string | null
          id?: string
          mpesa_receipt?: string | null
          phone?: string
          status?: Database["public"]["Enums"]["payment_status"]
          tournament_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount_kes: number
          created_at: string
          id: string
          marked_paid_at: string | null
          marked_paid_by: string | null
          notes: string | null
          phone: string
          position: number | null
          status: Database["public"]["Enums"]["payout_status"]
          tournament_id: string | null
          user_id: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          id?: string
          marked_paid_at?: string | null
          marked_paid_by?: string | null
          notes?: string | null
          phone: string
          position?: number | null
          status?: Database["public"]["Enums"]["payout_status"]
          tournament_id?: string | null
          user_id: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          id?: string
          marked_paid_at?: string | null
          marked_paid_by?: string | null
          notes?: string | null
          phone?: string
          position?: number | null
          status?: Database["public"]["Enums"]["payout_status"]
          tournament_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          career_earnings: number | null
          country: string | null
          created_at: string
          division: number | null
          efootball_name: string | null
          efootball_screenshot_url: string | null
          id: string
          is_verified: boolean | null
          konami_id: string | null
          notifications_enabled: boolean | null
          onboarding_complete: boolean | null
          phone: string | null
          photo_url: string | null
          updated_at: string
          username: string
          warning_strikes: number | null
        }
        Insert: {
          career_earnings?: number | null
          country?: string | null
          created_at?: string
          division?: number | null
          efootball_name?: string | null
          efootball_screenshot_url?: string | null
          id: string
          is_verified?: boolean | null
          konami_id?: string | null
          notifications_enabled?: boolean | null
          onboarding_complete?: boolean | null
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
          username: string
          warning_strikes?: number | null
        }
        Update: {
          career_earnings?: number | null
          country?: string | null
          created_at?: string
          division?: number | null
          efootball_name?: string | null
          efootball_screenshot_url?: string | null
          id?: string
          is_verified?: boolean | null
          konami_id?: string | null
          notifications_enabled?: boolean | null
          onboarding_complete?: boolean | null
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
          username?: string
          warning_strikes?: number | null
        }
        Relationships: []
      }
      tournament_entries: {
        Row: {
          eliminated_at: string | null
          final_position: number | null
          id: string
          joined_at: string
          paid: boolean | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          eliminated_at?: string | null
          final_position?: number | null
          id?: string
          joined_at?: string
          paid?: boolean | null
          tournament_id: string
          user_id: string
        }
        Update: {
          eliminated_at?: string | null
          final_position?: number | null
          id?: string
          joined_at?: string
          paid?: boolean | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          creator_id: string | null
          ends_at: string | null
          entry_fee_kes: number
          format: string | null
          id: string
          invite_code: string | null
          is_public: boolean | null
          kind: Database["public"]["Enums"]["tournament_kind"]
          match_window_hours: number | null
          max_players: number
          min_players: number
          name: string
          prize_split: Json | null
          registration_closes_at: string | null
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["tournament_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id?: string | null
          ends_at?: string | null
          entry_fee_kes?: number
          format?: string | null
          id?: string
          invite_code?: string | null
          is_public?: boolean | null
          kind?: Database["public"]["Enums"]["tournament_kind"]
          match_window_hours?: number | null
          max_players?: number
          min_players?: number
          name: string
          prize_split?: Json | null
          registration_closes_at?: string | null
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string | null
          ends_at?: string | null
          entry_fee_kes?: number
          format?: string | null
          id?: string
          invite_code?: string | null
          is_public?: boolean | null
          kind?: Database["public"]["Enums"]["tournament_kind"]
          match_window_hours?: number | null
          max_players?: number
          min_players?: number
          name?: string
          prize_split?: Json | null
          registration_closes_at?: string | null
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "player"
      match_status:
        | "scheduled"
        | "checked_in"
        | "active"
        | "submitted"
        | "verified"
        | "disputed"
        | "closed"
        | "forfeit"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      payout_status: "pending" | "sent" | "failed"
      tournament_kind: "quick_cash" | "cup" | "friendly" | "league"
      tournament_status:
        | "open"
        | "filling"
        | "active"
        | "completed"
        | "settled"
        | "cancelled"
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
      app_role: ["admin", "moderator", "player"],
      match_status: [
        "scheduled",
        "checked_in",
        "active",
        "submitted",
        "verified",
        "disputed",
        "closed",
        "forfeit",
      ],
      payment_status: ["pending", "paid", "failed", "refunded"],
      payout_status: ["pending", "sent", "failed"],
      tournament_kind: ["quick_cash", "cup", "friendly", "league"],
      tournament_status: [
        "open",
        "filling",
        "active",
        "completed",
        "settled",
        "cancelled",
      ],
    },
  },
} as const
