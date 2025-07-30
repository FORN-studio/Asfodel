export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // allows auto-instanciation with right options
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      agent_memories: {
        Row: {
          agent: number
          created_at: string
          id: number
          memory: string
        }
        Insert: {
          agent: number
          created_at?: string
          id?: number
          memory: string
        }
        Update: {
          agent?: number
          created_at?: string
          id?: number
          memory?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_memories_agent_fkey"
            columns: ["agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_plans: {
        Row: {
          agent: number
          created_at: string
          id: number
          plan: string
        }
        Insert: {
          agent: number
          created_at?: string
          id?: number
          plan: string
        }
        Update: {
          agent?: number
          created_at?: string
          id?: number
          plan?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_plans_agent_fkey"
            columns: ["agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_trust: {
        Row: {
          agent: number
          id: number
          other_agent: number
          other_agent_trustworthiness: number
        }
        Insert: {
          agent: number
          id?: number
          other_agent: number
          other_agent_trustworthiness?: number
        }
        Update: {
          agent?: number
          id?: number
          other_agent?: number
          other_agent_trustworthiness?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_trust_agent_fkey"
            columns: ["agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_trust_other_agent_fkey"
            columns: ["other_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          color: string
          created_at: string
          currently_being_processed: boolean
          energy: number
          id: number
          name: string
          processed_at: string | null
          times_processed: number
          x_position: number
          y_position: number
        }
        Insert: {
          color?: string
          created_at?: string
          currently_being_processed?: boolean
          energy?: number
          id?: number
          name?: string
          processed_at?: string | null
          times_processed?: number
          x_position?: number
          y_position?: number
        }
        Update: {
          color?: string
          created_at?: string
          currently_being_processed?: boolean
          energy?: number
          id?: number
          name?: string
          processed_at?: string | null
          times_processed?: number
          x_position?: number
          y_position?: number
        }
        Relationships: []
      }
      eggs: {
        Row: {
          created_at: string
          hatched: boolean
          id: number
          laid_by: number | null
          name: string
          nurtured_by: number | null
          nurtured_times: number
          x_position: number
          y_position: number
        }
        Insert: {
          created_at?: string
          hatched?: boolean
          id?: number
          laid_by?: number | null
          name: string
          nurtured_by?: number | null
          nurtured_times?: number
          x_position: number
          y_position: number
        }
        Update: {
          created_at?: string
          hatched?: boolean
          id?: number
          laid_by?: number | null
          name?: string
          nurtured_by?: number | null
          nurtured_times?: number
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "eggs_laid_by_fkey"
            columns: ["laid_by"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eggs_nurtured_by_fkey"
            columns: ["nurtured_by"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      energy_packets: {
        Row: {
          created_at: string
          id: string
          is_booby_trapped: boolean
          x_position: number
          y_position: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_booby_trapped?: boolean
          x_position?: number
          y_position?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_booby_trapped?: boolean
          x_position?: number
          y_position?: number
        }
        Relationships: []
      }
      event_queue: {
        Row: {
          created_at: string
          created_by: number | null
          function_args: Json
          function_name: string
          id: number
          metadata: Json | null
          prompt_to_target: string | null
          target_agent: number | null
        }
        Insert: {
          created_at?: string
          created_by?: number | null
          function_args: Json
          function_name: string
          id?: number
          metadata?: Json | null
          prompt_to_target?: string | null
          target_agent?: number | null
        }
        Update: {
          created_at?: string
          created_by?: number | null
          function_args?: Json
          function_name?: string
          id?: number
          metadata?: Json | null
          prompt_to_target?: string | null
          target_agent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_queue_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_queue_target_agent_fkey"
            columns: ["target_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          created_at: string
          created_by: number | null
          id: number
          log: string
          x_position: number
          y_position: number
        }
        Insert: {
          created_at?: string
          created_by?: number | null
          id?: number
          log: string
          x_position: number
          y_position: number
        }
        Update: {
          created_at?: string
          created_by?: number | null
          id?: number
          log?: string
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          from_agent: number | null
          id: number
          to_agent: number | null
        }
        Insert: {
          content: string
          created_at?: string
          from_agent?: number | null
          id?: number
          to_agent?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          from_agent?: number | null
          id?: number
          to_agent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_from_agent_fkey"
            columns: ["from_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_to_agent_fkey"
            columns: ["to_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      trees: {
        Row: {
          age: number
          created_at: string
          id: string
          is_consumed: boolean
          planted_by: number | null
          x_position: number
          y_position: number
        }
        Insert: {
          age?: number
          created_at?: string
          id?: string
          is_consumed?: boolean
          planted_by?: number | null
          x_position: number
          y_position: number
        }
        Update: {
          age?: number
          created_at?: string
          id?: string
          is_consumed?: boolean
          planted_by?: number | null
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "trees_planted_by_fkey"
            columns: ["planted_by"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_tree_ages: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
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
    Enums: {},
  },
} as const
