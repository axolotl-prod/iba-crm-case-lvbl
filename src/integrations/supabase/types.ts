export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      activities: {
        Row: {
          assignee_id: string | null;
          completed_at: string | null;
          created_at: string;
          deal_id: string;
          due_at: string | null;
          id: string;
          note: string | null;
          subject: string;
          type: Database["public"]["Enums"]["activity_type"];
          updated_at: string;
        };
        Insert: {
          assignee_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          deal_id: string;
          due_at?: string | null;
          id?: string;
          note?: string | null;
          subject: string;
          type?: Database["public"]["Enums"]["activity_type"];
          updated_at?: string;
        };
        Update: {
          assignee_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          deal_id?: string;
          due_at?: string | null;
          id?: string;
          note?: string | null;
          subject?: string;
          type?: Database["public"]["Enums"]["activity_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      compensation_terms: {
        Row: {
          bonus_rate: number;
          coef_min: number;
          coef_target: number;
          created_at: string;
          employee_id: string;
          id: string;
          salary: number;
          updated_at: string;
          valid_from: string;
          valid_to: string | null;
        };
        Insert: {
          bonus_rate?: number;
          coef_min?: number;
          coef_target?: number;
          created_at?: string;
          employee_id: string;
          id?: string;
          salary?: number;
          updated_at?: string;
          valid_from: string;
          valid_to?: string | null;
        };
        Update: {
          bonus_rate?: number;
          coef_min?: number;
          coef_target?: number;
          created_at?: string;
          employee_id?: string;
          id?: string;
          salary?: number;
          updated_at?: string;
          valid_from?: string;
          valid_to?: string | null;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          income_band: string | null;
          legacy_lead_id: string | null;
          phone: string | null;
          telegram: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string;
          id?: string;
          income_band?: string | null;
          legacy_lead_id?: string | null;
          phone?: string | null;
          telegram?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          income_band?: string | null;
          legacy_lead_id?: string | null;
          phone?: string | null;
          telegram?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      deal_status_history: {
        Row: {
          changed_at: string;
          changed_by_user_id: string | null;
          comment: string | null;
          deal_id: string;
          from_status: Database["public"]["Enums"]["deal_status"] | null;
          id: string;
          to_status: Database["public"]["Enums"]["deal_status"];
        };
        Insert: {
          changed_at?: string;
          changed_by_user_id?: string | null;
          comment?: string | null;
          deal_id: string;
          from_status?: Database["public"]["Enums"]["deal_status"] | null;
          id?: string;
          to_status: Database["public"]["Enums"]["deal_status"];
        };
        Update: {
          changed_at?: string;
          changed_by_user_id?: string | null;
          comment?: string | null;
          deal_id?: string;
          from_status?: Database["public"]["Enums"]["deal_status"] | null;
          id?: string;
          to_status?: Database["public"]["Enums"]["deal_status"];
        };
        Relationships: [];
      };
      deals: {
        Row: {
          agreed_amount: number | null;
          closed_at: string | null;
          created_at: string;
          customer_id: string;
          expected_net: number | null;
          id: string;
          lead_date: string | null;
          legacy_lead_id: string | null;
          legacy_status: string | null;
          lost_reason: string | null;
          manager_id: string | null;
          payment_terms: string | null;
          product_id: string | null;
          request: string | null;
          source: string | null;
          status: Database["public"]["Enums"]["deal_status"];
          updated_at: string;
        };
        Insert: {
          agreed_amount?: number | null;
          closed_at?: string | null;
          created_at?: string;
          customer_id: string;
          expected_net?: number | null;
          id?: string;
          lead_date?: string | null;
          legacy_lead_id?: string | null;
          legacy_status?: string | null;
          lost_reason?: string | null;
          manager_id?: string | null;
          payment_terms?: string | null;
          product_id?: string | null;
          request?: string | null;
          source?: string | null;
          status?: Database["public"]["Enums"]["deal_status"];
          updated_at?: string;
        };
        Update: {
          agreed_amount?: number | null;
          closed_at?: string | null;
          created_at?: string;
          customer_id?: string;
          expected_net?: number | null;
          id?: string;
          lead_date?: string | null;
          legacy_lead_id?: string | null;
          legacy_status?: string | null;
          lost_reason?: string | null;
          manager_id?: string | null;
          payment_terms?: string | null;
          product_id?: string | null;
          request?: string | null;
          source?: string | null;
          status?: Database["public"]["Enums"]["deal_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deals_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deals_manager_id_fkey";
            columns: ["manager_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deals_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      employees: {
        Row: {
          active: boolean;
          bonus_rate: number;
          coef_min: number;
          coef_target: number;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          role: Database["public"]["Enums"]["app_role"];
          salary: number;
          user_id: string | null;
        };
        Insert: {
          active?: boolean;
          bonus_rate?: number;
          coef_min?: number;
          coef_target?: number;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          role?: Database["public"]["Enums"]["app_role"];
          salary?: number;
          user_id?: string | null;
        };
        Update: {
          active?: boolean;
          bonus_rate?: number;
          coef_min?: number;
          coef_target?: number;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          role?: Database["public"]["Enums"]["app_role"];
          salary?: number;
          user_id?: string | null;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          amount: number | null;
          comment: string | null;
          created_at: string;
          id: string;
          income: string | null;
          lead_date: string | null;
          manager_id: string | null;
          name: string;
          net: number | null;
          next_action: string | null;
          payment_date: string | null;
          payment_method: string | null;
          phone: string | null;
          raw_status: string | null;
          request: string | null;
          source: string | null;
          status: Database["public"]["Enums"]["lead_status"];
          tariff: string | null;
          telegram: string | null;
          updated_at: string;
        };
        Insert: {
          amount?: number | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          income?: string | null;
          lead_date?: string | null;
          manager_id?: string | null;
          name?: string;
          net?: number | null;
          next_action?: string | null;
          payment_date?: string | null;
          payment_method?: string | null;
          phone?: string | null;
          raw_status?: string | null;
          request?: string | null;
          source?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          tariff?: string | null;
          telegram?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          income?: string | null;
          lead_date?: string | null;
          manager_id?: string | null;
          name?: string;
          net?: number | null;
          next_action?: string | null;
          payment_date?: string | null;
          payment_method?: string | null;
          phone?: string | null;
          raw_status?: string | null;
          request?: string | null;
          source?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          tariff?: string | null;
          telegram?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_manager_id_fkey";
            columns: ["manager_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number | null;
          client_name: string;
          contact: string | null;
          created_at: string;
          credited_employee_id: string | null;
          currency: string;
          deal_id: string | null;
          external_ref: string | null;
          id: string;
          lead_id: string | null;
          manager_id: string | null;
          method: string | null;
          net_amount: number | null;
          net_profit: number;
          note: string | null;
          order_no: number | null;
          paid_at: string | null;
          payment_date: string;
          payment_method: string | null;
          receivable: number;
          revenue: number;
          schedule: string | null;
          tariff: string | null;
          updated_at: string;
        };
        Insert: {
          amount?: number | null;
          client_name: string;
          contact?: string | null;
          created_at?: string;
          credited_employee_id?: string | null;
          currency?: string;
          deal_id?: string | null;
          external_ref?: string | null;
          id?: string;
          lead_id?: string | null;
          manager_id?: string | null;
          method?: string | null;
          net_amount?: number | null;
          net_profit?: number;
          note?: string | null;
          order_no?: number | null;
          paid_at?: string | null;
          payment_date?: string;
          payment_method?: string | null;
          receivable?: number;
          revenue?: number;
          schedule?: string | null;
          tariff?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number | null;
          client_name?: string;
          contact?: string | null;
          created_at?: string;
          credited_employee_id?: string | null;
          currency?: string;
          deal_id?: string | null;
          external_ref?: string | null;
          id?: string;
          lead_id?: string | null;
          manager_id?: string | null;
          method?: string | null;
          net_amount?: number | null;
          net_profit?: number;
          note?: string | null;
          order_no?: number | null;
          paid_at?: string | null;
          payment_date?: string;
          payment_method?: string | null;
          receivable?: number;
          revenue?: number;
          schedule?: string | null;
          tariff?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_manager_id_fkey";
            columns: ["manager_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          created_at: string;
          employee_id: string | null;
          id: string;
          period: string;
          plan_max: number;
          plan_min: number;
          plan_target: number;
        };
        Insert: {
          created_at?: string;
          employee_id?: string | null;
          id?: string;
          period: string;
          plan_max?: number;
          plan_min?: number;
          plan_target?: number;
        };
        Update: {
          created_at?: string;
          employee_id?: string | null;
          id?: string;
          period?: string;
          plan_max?: number;
          plan_min?: number;
          plan_target?: number;
        };
        Relationships: [
          {
            foreignKeyName: "plans_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          id: string;
          list_price: number | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          id?: string;
          list_price?: number | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          id?: string;
          list_price?: number | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sales_plans: {
        Row: {
          created_at: string;
          employee_id: string | null;
          id: string;
          period: string;
          plan_max: number;
          plan_min: number;
          plan_target: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          employee_id?: string | null;
          id?: string;
          period: string;
          plan_max?: number;
          plan_min?: number;
          plan_target?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          employee_id?: string | null;
          id?: string;
          period?: string;
          plan_max?: number;
          plan_min?: number;
          plan_target?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_deal_with_customer: {
        Args: {
          _full_name: string;
          _income_band?: string | null;
          _manager_id?: string | null;
          _phone?: string | null;
          _request?: string | null;
          _source?: string | null;
          _telegram?: string | null;
        };
        Returns: string;
      };
      current_employee_id: { Args: never; Returns: string };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      link_current_user: { Args: never; Returns: string };
      record_deal_payment: {
        Args: {
          _amount: number;
          _deal_id: string;
          _mark_paid?: boolean;
          _method?: string | null;
          _net_amount?: number;
          _note?: string | null;
          _paid_at?: string;
        };
        Returns: string;
      };
      set_employee_compensation: {
        Args: {
          _bonus_rate: number;
          _coef_min: number;
          _coef_target: number;
          _employee_id: string;
          _salary: number;
          _valid_from: string;
        };
        Returns: string;
      };
    };
    Enums: {
      activity_type: "call" | "message" | "meeting" | "task" | "other";
      app_role: "admin" | "manager";
      deal_status: "new" | "in_work" | "offer_sent" | "awaiting_payment" | "paid" | "lost";
      lead_status: "new" | "in_work" | "kp_sent" | "paid" | "lost";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      activity_type: ["call", "message", "meeting", "task", "other"],
      app_role: ["admin", "manager"],
      deal_status: ["new", "in_work", "offer_sent", "awaiting_payment", "paid", "lost"],
      lead_status: ["new", "in_work", "kp_sent", "paid", "lost"],
    },
  },
} as const;
