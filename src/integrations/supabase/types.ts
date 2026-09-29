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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      employees: {
        Row: {
          active: boolean
          bonus_rate: number
          coef_min: number
          coef_target: number
          created_at: string
          email: string | null
          id: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          salary: number
          user_id: string | null
        }
        Insert: {
          active?: boolean
          bonus_rate?: number
          coef_min?: number
          coef_target?: number
          created_at?: string
          email?: string | null
          id?: string
          name: string
          role?: Database["public"]["Enums"]["app_role"]
          salary?: number
          user_id?: string | null
        }
        Update: {
          active?: boolean
          bonus_rate?: number
          coef_min?: number
          coef_target?: number
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["app_role"]
          salary?: number
          user_id?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          amount: number | null
          comment: string | null
          created_at: string
          id: string
          income: string | null
          lead_date: string | null
          manager_id: string | null
          name: string
          net: number | null
          next_action: string | null
          payment_date: string | null
          payment_method: string | null
          phone: string | null
          raw_status: string | null
          request: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          tariff: string | null
          telegram: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          comment?: string | null
          created_at?: string
          id?: string
          income?: string | null
          lead_date?: string | null
          manager_id?: string | null
          name?: string
          net?: number | null
          next_action?: string | null
          payment_date?: string | null
          payment_method?: string | null
          phone?: string | null
          raw_status?: string | null
          request?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tariff?: string | null
          telegram?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          comment?: string | null
          created_at?: string
          id?: string
          income?: string | null
          lead_date?: string | null
          manager_id?: string | null
          name?: string
          net?: number | null
          next_action?: string | null
          payment_date?: string | null
          payment_method?: string | null
          phone?: string | null
          raw_status?: string | null
          request?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tariff?: string | null
          telegram?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          client_name: string
          contact: string | null
          created_at: string
          id: string
          lead_id: string | null
          manager_id: string | null
          net_profit: number
          order_no: number | null
          payment_date: string
          payment_method: string | null
          receivable: number
          revenue: number
          schedule: string | null
          tariff: string | null
        }
        Insert: {
          client_name: string
          contact?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          manager_id?: string | null
          net_profit?: number
          order_no?: number | null
          payment_date?: string
          payment_method?: string | null
          receivable?: number
          revenue?: number
          schedule?: string | null
          tariff?: string | null
        }
        Update: {
          client_name?: string
          contact?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          manager_id?: string | null
          net_profit?: number
          order_no?: number | null
          payment_date?: string
          payment_method?: string | null
          receivable?: number
          revenue?: number
          schedule?: string | null
          tariff?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          period: string
          plan_max: number
          plan_min: number
          plan_target: number
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          period: string
          plan_max?: number
          plan_min?: number
          plan_target?: number
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          period?: string
          plan_max?: number
          plan_min?: number
          plan_target?: number
        }
        Relationships: [
          {
            foreignKeyName: "plans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      current_employee_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      link_current_user: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "manager"
      lead_status: "new" | "in_work" | "kp_sent" | "paid" | "lost"
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
      app_role: ["admin", "manager"],
      lead_status: ["new", "in_work", "kp_sent", "paid", "lost"],
    },
  },
} as const
