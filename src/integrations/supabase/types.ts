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
      cond_incidents: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          occurred_at: string
          resolved_at: string | null
          severity: string
          status: string
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          occurred_at?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          occurred_at?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cond_maintenance: {
        Row: {
          assignee: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          priority: string
          scheduled_for: string | null
          status: string
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          assignee?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: string
          scheduled_for?: string | null
          status?: string
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          assignee?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: string
          scheduled_for?: string | null
          status?: string
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cond_notices: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cond_packages: {
        Row: {
          carrier: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          picked_up_at: string | null
          received_at: string
          recipient: string
          tracking_code: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          picked_up_at?: string | null
          received_at?: string
          recipient: string
          tracking_code?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          picked_up_at?: string | null
          received_at?: string
          recipient?: string
          tracking_code?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      cond_reservations: {
        Row: {
          area: string
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          notes: string | null
          resident_name: string
          starts_at: string
          status: string
          unit: string
          updated_at: string
        }
        Insert: {
          area: string
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          resident_name: string
          starts_at: string
          status?: string
          unit: string
          updated_at?: string
        }
        Update: {
          area?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          resident_name?: string
          starts_at?: string
          status?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
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
      drive_favorites: {
        Row: {
          created_at: string
          file_id: string | null
          folder_id: string | null
          id: string
          resource_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_id?: string | null
          folder_id?: string | null
          id?: string
          resource_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_id?: string | null
          folder_id?: string | null
          id?: string
          resource_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_favorites_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "drive_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_favorites_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "drive_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_files: {
        Row: {
          created_at: string
          folder_id: string | null
          id: string
          last_opened_at: string | null
          mime_type: string
          name: string
          owner_id: string
          size_bytes: number
          storage_path: string
          trashed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          folder_id?: string | null
          id?: string
          last_opened_at?: string | null
          mime_type?: string
          name: string
          owner_id: string
          size_bytes?: number
          storage_path: string
          trashed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          folder_id?: string | null
          id?: string
          last_opened_at?: string | null
          mime_type?: string
          name?: string
          owner_id?: string
          size_bytes?: number
          storage_path?: string
          trashed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "drive_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          parent_id: string | null
          trashed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          parent_id?: string | null
          trashed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          parent_id?: string | null
          trashed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "drive_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_shares: {
        Row: {
          created_at: string
          file_id: string | null
          folder_id: string | null
          id: string
          link_token: string | null
          owner_id: string
          permission: string
          resource_type: string
          shared_with: string | null
          shared_with_email: string | null
        }
        Insert: {
          created_at?: string
          file_id?: string | null
          folder_id?: string | null
          id?: string
          link_token?: string | null
          owner_id: string
          permission?: string
          resource_type: string
          shared_with?: string | null
          shared_with_email?: string | null
        }
        Update: {
          created_at?: string
          file_id?: string | null
          folder_id?: string | null
          id?: string
          link_token?: string | null
          owner_id?: string
          permission?: string
          resource_type?: string
          shared_with?: string | null
          shared_with_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drive_shares_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "drive_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_shares_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "drive_folders"
            referencedColumns: ["id"]
          },
        ]
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
      form_collaborators: {
        Row: {
          created_at: string
          email: string
          form_id: string
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          form_id: string
          id?: string
          permission?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          form_id?: string
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_collaborators_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_responses: {
        Row: {
          answers: Json
          created_at: string
          form_id: string
          id: string
          respondent_id: string | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          form_id: string
          id?: string
          respondent_id?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string
          form_id?: string
          id?: string
          respondent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_versions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          fields: Json
          form_id: string
          id: string
          label: string | null
          settings: Json
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          fields: Json
          form_id: string
          id?: string
          label?: string | null
          settings: Json
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          fields?: Json
          form_id?: string
          id?: string
          label?: string | null
          settings?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_versions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string
          description: string
          fields: Json
          id: string
          owner_id: string
          settings: Json
          status: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          description?: string
          fields?: Json
          id?: string
          owner_id: string
          settings?: Json
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          description?: string
          fields?: Json
          id?: string
          owner_id?: string
          settings?: Json
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      lifepay_accounts: {
        Row: {
          account_type: string
          admin_notes: string | null
          balance: number
          closing_day: number
          created_at: string
          credit_limit: number
          credit_used: number
          department: string | null
          display_name: string
          due_day: number
          email: string | null
          first_access_done: boolean
          full_name: string | null
          is_admin: boolean
          is_worker: boolean
          job_title: string | null
          last_access_at: string | null
          must_change_password: boolean
          pin_hash: string | null
          pix_key: string
          salary_cents: number
          salary_day: number
          status: string
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string
          admin_notes?: string | null
          balance?: number
          closing_day?: number
          created_at?: string
          credit_limit?: number
          credit_used?: number
          department?: string | null
          display_name: string
          due_day?: number
          email?: string | null
          first_access_done?: boolean
          full_name?: string | null
          is_admin?: boolean
          is_worker?: boolean
          job_title?: string | null
          last_access_at?: string | null
          must_change_password?: boolean
          pin_hash?: string | null
          pix_key: string
          salary_cents?: number
          salary_day?: number
          status?: string
          terms_accepted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          admin_notes?: string | null
          balance?: number
          closing_day?: number
          created_at?: string
          credit_limit?: number
          credit_used?: number
          department?: string | null
          display_name?: string
          due_day?: number
          email?: string | null
          first_access_done?: boolean
          full_name?: string | null
          is_admin?: boolean
          is_worker?: boolean
          job_title?: string | null
          last_access_at?: string | null
          must_change_password?: boolean
          pin_hash?: string | null
          pix_key?: string
          salary_cents?: number
          salary_day?: number
          status?: string
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lifepay_admin_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      lifepay_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_kind: string
          after_data: Json | null
          auth_method: string | null
          before_data: Json | null
          created_at: string
          device: string | null
          id: string
          ip: string | null
          reason: string | null
          status: string
          target_ref: string | null
          target_user: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_kind?: string
          after_data?: Json | null
          auth_method?: string | null
          before_data?: Json | null
          created_at?: string
          device?: string | null
          id?: string
          ip?: string | null
          reason?: string | null
          status?: string
          target_ref?: string | null
          target_user?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_kind?: string
          after_data?: Json | null
          auth_method?: string | null
          before_data?: Json | null
          created_at?: string
          device?: string | null
          id?: string
          ip?: string | null
          reason?: string | null
          status?: string
          target_ref?: string | null
          target_user?: string | null
        }
        Relationships: []
      }
      lifepay_cards: {
        Row: {
          brand: string
          card_limit: number
          created_at: string
          cvv: string
          deleted_at: string | null
          exp_month: number
          exp_year: number
          expires_at: string | null
          holder_name: string
          id: string
          is_temporary: boolean
          is_virtual: boolean
          label: string
          last4: string
          pan: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string
          card_limit?: number
          created_at?: string
          cvv: string
          deleted_at?: string | null
          exp_month: number
          exp_year: number
          expires_at?: string | null
          holder_name: string
          id?: string
          is_temporary?: boolean
          is_virtual?: boolean
          label?: string
          last4: string
          pan: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string
          card_limit?: number
          created_at?: string
          cvv?: string
          deleted_at?: string | null
          exp_month?: number
          exp_year?: number
          expires_at?: string | null
          holder_name?: string
          id?: string
          is_temporary?: boolean
          is_virtual?: boolean
          label?: string
          last4?: string
          pan?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lifepay_faceid: {
        Row: {
          created_at: string
          device_label: string
          id: string
          last_used_at: string | null
          samples: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string
          id?: string
          last_used_at?: string | null
          samples: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string
          id?: string
          last_used_at?: string | null
          samples?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lifepay_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          invoice_id: string | null
          number: number
          purchase_id: string
          status: string
          total_count: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          invoice_id?: string | null
          number: number
          purchase_id: string
          status?: string
          total_count: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          invoice_id?: string | null
          number?: number
          purchase_id?: string
          status?: string
          total_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifepay_installments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "lifepay_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifepay_installments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "lifepay_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      lifepay_invoices: {
        Row: {
          closing_date: string
          created_at: string
          due_date: string
          id: string
          paid: number
          reference_month: string
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          closing_date: string
          created_at?: string
          due_date: string
          id?: string
          paid?: number
          reference_month: string
          status?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          closing_date?: string
          created_at?: string
          due_date?: string
          id?: string
          paid?: number
          reference_month?: string
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lifepay_keys: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          key_type: string
          key_value: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          key_type: string
          key_value: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          key_type?: string
          key_value?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      lifepay_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      lifepay_payment_requests: {
        Row: {
          amount: number
          created_at: string
          expires_at: string
          id: string
          note: string | null
          paid_at: string | null
          paid_by: string | null
          status: string
          token: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at: string
          id?: string
          note?: string | null
          paid_at?: string | null
          paid_by?: string | null
          status?: string
          token: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          paid_by?: string | null
          status?: string
          token?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lifepay_purchases: {
        Row: {
          amount: number
          card_id: string | null
          category: string
          created_at: string
          created_by: string | null
          id: string
          idempotency_key: string | null
          installments_count: number
          merchant: string
          purchased_at: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          card_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string | null
          installments_count?: number
          merchant: string
          purchased_at?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          card_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string | null
          installments_count?: number
          merchant?: string
          purchased_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifepay_purchases_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "lifepay_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      lifepay_transactions: {
        Row: {
          amount: number
          auth_method: string | null
          created_at: string
          from_balance_after: number | null
          from_balance_before: number | null
          from_user: string | null
          id: string
          idempotency_key: string | null
          key_used: string | null
          kind: string
          note: string | null
          receipt_code: string | null
          status: string
          to_balance_after: number | null
          to_balance_before: number | null
          to_user: string | null
        }
        Insert: {
          amount: number
          auth_method?: string | null
          created_at?: string
          from_balance_after?: number | null
          from_balance_before?: number | null
          from_user?: string | null
          id?: string
          idempotency_key?: string | null
          key_used?: string | null
          kind?: string
          note?: string | null
          receipt_code?: string | null
          status?: string
          to_balance_after?: number | null
          to_balance_before?: number | null
          to_user?: string | null
        }
        Update: {
          amount?: number
          auth_method?: string | null
          created_at?: string
          from_balance_after?: number | null
          from_balance_before?: number | null
          from_user?: string | null
          id?: string
          idempotency_key?: string | null
          key_used?: string | null
          kind?: string
          note?: string | null
          receipt_code?: string | null
          status?: string
          to_balance_after?: number | null
          to_balance_before?: number | null
          to_user?: string | null
        }
        Relationships: []
      }
      lifepay_webauthn_challenges: {
        Row: {
          challenge: string
          created_at: string
          expires_at: string
          id: string
          purpose: string
          user_id: string
        }
        Insert: {
          challenge: string
          created_at?: string
          expires_at: string
          id?: string
          purpose: string
          user_id: string
        }
        Update: {
          challenge?: string
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          user_id?: string
        }
        Relationships: []
      }
      lifepay_webauthn_credentials: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          device_label: string
          id: string
          last_used_at: string | null
          public_key: string
          transports: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          device_label?: string
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          device_label?: string
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lp_beds: {
        Row: {
          code: string
          created_at: string
          id: string
          ward: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          ward: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          ward?: string
        }
        Relationships: []
      }
      lp_exams: {
        Row: {
          completed_at: string | null
          id: string
          kind: string
          patient_id: string
          requested_at: string
          result: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          kind: string
          patient_id: string
          requested_at?: string
          result?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          kind?: string
          patient_id?: string
          requested_at?: string
          result?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lp_exams_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "lp_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_notes: {
        Row: {
          author: string | null
          body: string
          created_at: string
          id: string
          patient_id: string
        }
        Insert: {
          author?: string | null
          body: string
          created_at?: string
          id?: string
          patient_id: string
        }
        Update: {
          author?: string | null
          body?: string
          created_at?: string
          id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lp_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "lp_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_patients: {
        Row: {
          allergies: string | null
          bed_id: string | null
          birth_date: string | null
          blood_type: string | null
          complaint: string | null
          created_at: string
          created_by: string | null
          doctor: string | null
          full_name: string
          id: string
          insurance: string | null
          is_simulated: boolean
          sex: string | null
          status: string
          triage: string
          updated_at: string
        }
        Insert: {
          allergies?: string | null
          bed_id?: string | null
          birth_date?: string | null
          blood_type?: string | null
          complaint?: string | null
          created_at?: string
          created_by?: string | null
          doctor?: string | null
          full_name: string
          id?: string
          insurance?: string | null
          is_simulated?: boolean
          sex?: string | null
          status?: string
          triage?: string
          updated_at?: string
        }
        Update: {
          allergies?: string | null
          bed_id?: string | null
          birth_date?: string | null
          blood_type?: string | null
          complaint?: string | null
          created_at?: string
          created_by?: string | null
          doctor?: string | null
          full_name?: string
          id?: string
          insurance?: string | null
          is_simulated?: boolean
          sex?: string | null
          status?: string
          triage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lp_patients_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "lp_beds"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_prescriptions: {
        Row: {
          administered_at: string | null
          created_at: string
          dose: string | null
          id: string
          medication: string
          patient_id: string
          schedule: string | null
        }
        Insert: {
          administered_at?: string | null
          created_at?: string
          dose?: string | null
          id?: string
          medication: string
          patient_id: string
          schedule?: string | null
        }
        Update: {
          administered_at?: string | null
          created_at?: string
          dose?: string | null
          id?: string
          medication?: string
          patient_id?: string
          schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lp_prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "lp_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_shift_tasks: {
        Row: {
          created_at: string
          done_at: string | null
          due_at: string | null
          failed: boolean
          id: string
          kind: string
          patient_id: string | null
          points: number
          shift_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          due_at?: string | null
          failed?: boolean
          id?: string
          kind: string
          patient_id?: string | null
          points?: number
          shift_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          done_at?: string | null
          due_at?: string | null
          failed?: boolean
          id?: string
          kind?: string
          patient_id?: string | null
          points?: number
          shift_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lp_shift_tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "lp_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lp_shift_tasks_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "lp_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_shifts: {
        Row: {
          difficulty: string
          ended_at: string | null
          id: string
          patients_seen: number
          score: number
          started_at: string
          tasks_done: number
          user_id: string
        }
        Insert: {
          difficulty: string
          ended_at?: string | null
          id?: string
          patients_seen?: number
          score?: number
          started_at?: string
          tasks_done?: number
          user_id: string
        }
        Update: {
          difficulty?: string
          ended_at?: string | null
          id?: string
          patients_seen?: number
          score?: number
          started_at?: string
          tasks_done?: number
          user_id?: string
        }
        Relationships: []
      }
      lp_vitals: {
        Row: {
          diastolic: number | null
          heart_rate: number | null
          id: string
          measured_at: string
          patient_id: string
          spo2: number | null
          systolic: number | null
          temperature: number | null
        }
        Insert: {
          diastolic?: number | null
          heart_rate?: number | null
          id?: string
          measured_at?: string
          patient_id: string
          spo2?: number | null
          systolic?: number | null
          temperature?: number | null
        }
        Update: {
          diastolic?: number | null
          heart_rate?: number | null
          id?: string
          measured_at?: string
          patient_id?: string
          spo2?: number | null
          systolic?: number | null
          temperature?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lp_vitals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "lp_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_messages: {
        Row: {
          attachments: Json
          cc_addresses: string[]
          created_at: string
          direction: string
          folder: string
          from_address: string
          from_name: string | null
          html_body: string | null
          id: string
          is_read: boolean
          is_starred: boolean
          mailbox_address: string
          provider_message_id: string | null
          received_at: string
          snippet: string
          subject: string
          text_body: string | null
          to_addresses: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attachments?: Json
          cc_addresses?: string[]
          created_at?: string
          direction?: string
          folder?: string
          from_address: string
          from_name?: string | null
          html_body?: string | null
          id?: string
          is_read?: boolean
          is_starred?: boolean
          mailbox_address: string
          provider_message_id?: string | null
          received_at?: string
          snippet?: string
          subject?: string
          text_body?: string | null
          to_addresses?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attachments?: Json
          cc_addresses?: string[]
          created_at?: string
          direction?: string
          folder?: string
          from_address?: string
          from_name?: string | null
          html_body?: string | null
          id?: string
          is_read?: boolean
          is_starred?: boolean
          mailbox_address?: string
          provider_message_id?: string | null
          received_at?: string
          snippet?: string
          subject?: string
          text_body?: string | null
          to_addresses?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      news_posts: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          published: boolean
          subtitle: string | null
          tag: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          published?: boolean
          subtitle?: string | null
          tag?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          published?: boolean
          subtitle?: string | null
          tag?: string
          title?: string
          updated_at?: string
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
      drive_file_permission: { Args: { _file: string }; Returns: string }
      drive_find_user: { Args: { _email: string }; Returns: string }
      drive_folder_permission: { Args: { _folder: string }; Returns: string }
      drive_object_readable: { Args: { _path: string }; Returns: boolean }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_lifepay_account: {
        Args: { _user_id: string }
        Returns: {
          account_type: string
          admin_notes: string | null
          balance: number
          closing_day: number
          created_at: string
          credit_limit: number
          credit_used: number
          department: string | null
          display_name: string
          due_day: number
          email: string | null
          first_access_done: boolean
          full_name: string | null
          is_admin: boolean
          is_worker: boolean
          job_title: string | null
          last_access_at: string | null
          must_change_password: boolean
          pin_hash: string | null
          pix_key: string
          salary_cents: number
          salary_day: number
          status: string
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "lifepay_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      form_accepts: { Args: { _form: string }; Returns: boolean }
      form_role: { Args: { _form: string }; Returns: string }
      has_lifepay_perm: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
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
      lifepay_card_action: {
        Args: { _action: string; _id: string }
        Returns: boolean
      }
      lifepay_counterparty_names: {
        Args: never
        Returns: {
          display_name: string
          pix_key: string
          user_id: string
        }[]
      }
      lifepay_create_card: {
        Args: { _label?: string; _limit?: number; _temporary?: boolean }
        Returns: string
      }
      lifepay_create_random_key: {
        Args: never
        Returns: {
          created_at: string
          deleted_at: string | null
          id: string
          key_type: string
          key_value: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "lifepay_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lifepay_gen_pan: { Args: never; Returns: string }
      lifepay_invoice_for: {
        Args: { _ref: string; _user: string }
        Returns: {
          closing_date: string
          created_at: string
          due_date: string
          id: string
          paid: number
          reference_month: string
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "lifepay_invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lifepay_pay_invoice: {
        Args: {
          _amount: number
          _auth_method: string
          _idem: string
          _invoice_id: string
        }
        Returns: {
          amount: number
          auth_method: string | null
          created_at: string
          from_balance_after: number | null
          from_balance_before: number | null
          from_user: string | null
          id: string
          idempotency_key: string | null
          key_used: string | null
          kind: string
          note: string | null
          receipt_code: string | null
          status: string
          to_balance_after: number | null
          to_balance_before: number | null
          to_user: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lifepay_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lifepay_purchase: {
        Args: {
          _amount: number
          _card_id: string
          _category: string
          _idem: string
          _installments: number
          _merchant: string
        }
        Returns: {
          amount: number
          card_id: string | null
          category: string
          created_at: string
          created_by: string | null
          id: string
          idempotency_key: string | null
          installments_count: number
          merchant: string
          purchased_at: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "lifepay_purchases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lifepay_resolve_key: {
        Args: { _key: string }
        Returns: {
          display_name: string
          key_type: string
          key_value: string
          status: string
          user_id: string
        }[]
      }
      lifepay_set_card_limit: {
        Args: { _id: string; _limit: number }
        Returns: boolean
      }
      lifepay_transfer_v2: {
        Args: {
          _amount: number
          _auth_method: string
          _idem: string
          _key: string
          _note: string
        }
        Returns: {
          amount: number
          auth_method: string | null
          created_at: string
          from_balance_after: number | null
          from_balance_before: number | null
          from_user: string | null
          id: string
          idempotency_key: string | null
          key_used: string | null
          kind: string
          note: string | null
          receipt_code: string | null
          status: string
          to_balance_after: number | null
          to_balance_before: number | null
          to_user: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lifepay_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lifepay_transfer_v3: {
        Args: {
          _amount: number
          _auth_method: string
          _card_id?: string
          _idem: string
          _installments?: number
          _key: string
          _note: string
          _source?: string
        }
        Returns: {
          amount: number
          auth_method: string | null
          created_at: string
          from_balance_after: number | null
          from_balance_before: number | null
          from_user: string | null
          id: string
          idempotency_key: string | null
          key_used: string | null
          kind: string
          note: string | null
          receipt_code: string | null
          status: string
          to_balance_after: number | null
          to_balance_before: number | null
          to_user: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lifepay_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lifepay_update_key: {
        Args: { _action: string; _id: string }
        Returns: boolean
      }
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
        | "lifepay"
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
        "lifepay",
      ],
    },
  },
} as const
