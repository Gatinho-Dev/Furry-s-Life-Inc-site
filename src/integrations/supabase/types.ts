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
      aircare_readings: {
        Row: {
          co2_ppm: number | null
          created_at: string
          humidity_pct: number | null
          id: string
          measured_at: string
          notes: string | null
          pm25: number | null
          temperature_c: number | null
          unit_id: string
        }
        Insert: {
          co2_ppm?: number | null
          created_at?: string
          humidity_pct?: number | null
          id?: string
          measured_at?: string
          notes?: string | null
          pm25?: number | null
          temperature_c?: number | null
          unit_id: string
        }
        Update: {
          co2_ppm?: number | null
          created_at?: string
          humidity_pct?: number | null
          id?: string
          measured_at?: string
          notes?: string | null
          pm25?: number | null
          temperature_c?: number | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aircare_readings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "aircare_units"
            referencedColumns: ["id"]
          },
        ]
      }
      aircare_units: {
        Row: {
          created_at: string
          filter_model: string | null
          id: string
          installed_at: string | null
          location: string | null
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          filter_model?: string | null
          id?: string
          installed_at?: string | null
          location?: string | null
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          filter_model?: string | null
          id?: string
          installed_at?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string
          id: string
          name: string
          room: string | null
          schedule: string | null
          teacher_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          room?: string | null
          schedule?: string | null
          teacher_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          room?: string | null
          schedule?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_inbox: {
        Row: {
          body: string
          created_at: string
          email: string
          id: string
          name: string
          replied_at: string | null
          status: string
          subject: string
        }
        Insert: {
          body: string
          created_at?: string
          email: string
          id?: string
          name: string
          replied_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          body?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          replied_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      osint_case_edges: {
        Row: {
          created_at: string
          id: string
          investigation_id: string
          label: string | null
          source_node: string
          target_node: string
        }
        Insert: {
          created_at?: string
          id?: string
          investigation_id: string
          label?: string | null
          source_node: string
          target_node: string
        }
        Update: {
          created_at?: string
          id?: string
          investigation_id?: string
          label?: string | null
          source_node?: string
          target_node?: string
        }
        Relationships: [
          {
            foreignKeyName: "osint_case_edges_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "osint_investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "osint_case_edges_source_node_fkey"
            columns: ["source_node"]
            isOneToOne: false
            referencedRelation: "osint_case_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "osint_case_edges_target_node_fkey"
            columns: ["target_node"]
            isOneToOne: false
            referencedRelation: "osint_case_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      osint_case_nodes: {
        Row: {
          created_at: string
          data: Json
          id: string
          investigation_id: string
          label: string
          node_type: string
          pos_x: number
          pos_y: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          investigation_id: string
          label: string
          node_type: string
          pos_x?: number
          pos_y?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          investigation_id?: string
          label?: string
          node_type?: string
          pos_x?: number
          pos_y?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "osint_case_nodes_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "osint_investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      osint_findings: {
        Row: {
          created_at: string
          finding_type: string
          id: string
          investigation_id: string
          label: string | null
          payload: Json
          snapshot_url: string | null
          source: string
          url: string | null
        }
        Insert: {
          created_at?: string
          finding_type: string
          id?: string
          investigation_id: string
          label?: string | null
          payload?: Json
          snapshot_url?: string | null
          source: string
          url?: string | null
        }
        Update: {
          created_at?: string
          finding_type?: string
          id?: string
          investigation_id?: string
          label?: string | null
          payload?: Json
          snapshot_url?: string | null
          source?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "osint_findings_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "osint_investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      osint_investigations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          status: string
          target: string
          target_type: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          status?: string
          target: string
          target_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          status?: string
          target?: string
          target_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      residents: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          photo_url: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_notices: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          severity: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          severity?: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          severity?: string
          title?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          class_group: string | null
          course: string | null
          created_at: string
          email: string | null
          enrollment: string
          full_name: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          class_group?: string | null
          course?: string | null
          created_at?: string
          email?: string | null
          enrollment: string
          full_name: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          class_group?: string | null
          course?: string | null
          created_at?: string
          email?: string | null
          enrollment?: string
          full_name?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      teachers: {
        Row: {
          bio: string | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id?: string
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
      user_subsidiary_access: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          subsidiary: Database["public"]["Enums"]["subsidiary"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          subsidiary: Database["public"]["Enums"]["subsidiary"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          subsidiary?: Database["public"]["Enums"]["subsidiary"]
          user_id?: string
        }
        Relationships: []
      }
      user_subsidiary_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          sub_role: string
          subsidiary: Database["public"]["Enums"]["subsidiary"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          sub_role: string
          subsidiary: Database["public"]["Enums"]["subsidiary"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          sub_role?: string
          subsidiary?: Database["public"]["Enums"]["subsidiary"]
          user_id?: string
        }
        Relationships: []
      }
      visitor_logs: {
        Row: {
          created_at: string
          document: string | null
          entry_at: string
          exit_at: string | null
          id: string
          reason: string | null
          recorded_by: string | null
          resident_id: string | null
          unit_visited: string
          visitor_name: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          entry_at?: string
          exit_at?: string | null
          id?: string
          reason?: string | null
          recorded_by?: string | null
          resident_id?: string | null
          unit_visited: string
          visitor_name: string
        }
        Update: {
          created_at?: string
          document?: string | null
          entry_at?: string
          exit_at?: string | null
          id?: string
          reason?: string | null
          recorded_by?: string | null
          resident_id?: string | null
          unit_visited?: string
          visitor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_logs_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_sub_role: {
        Args: {
          _role: string
          _sub: Database["public"]["Enums"]["subsidiary"]
          _user_id: string
        }
        Returns: boolean
      }
      has_subsidiary_access: {
        Args: {
          _sub: Database["public"]["Enums"]["subsidiary"]
          _user_id: string
        }
        Returns: boolean
      }
      is_ceo_or_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "ceo" | "admin" | "staff"
      subsidiary:
        | "fli"
        | "studios"
        | "cruise"
        | "maldivas"
        | "college"
        | "cond"
        | "camping"
        | "labs"
        | "theater"
        | "energy"
        | "server"
        | "soccer"
        | "agency"
        | "lifeplus"
        | "aircare"
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
      app_role: ["ceo", "admin", "staff"],
      subsidiary: [
        "fli",
        "studios",
        "cruise",
        "maldivas",
        "college",
        "cond",
        "camping",
        "labs",
        "theater",
        "energy",
        "server",
        "soccer",
        "agency",
        "lifeplus",
        "aircare",
      ],
    },
  },
} as const
