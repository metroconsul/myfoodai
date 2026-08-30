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
      audit_logs: {
        Row: {
          action: string
          actor_label: string | null
          company_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json
          unit_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_label?: string | null
          company_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json
          unit_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_label?: string | null
          company_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json
          unit_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          active: boolean
          brand: string | null
          category: string | null
          colors: string[]
          company_id: string
          created_at: string
          description: string | null
          id: string
          item_type: Database["public"]["Enums"]["item_type"]
          maximum_stock: number | null
          minimum_stock: number
          name: string
          photo_url: string | null
          quantity_per_delivery: number
          replacement_period: string
          requires_color: boolean
          requires_return: boolean
          requires_size: boolean
          sizes: string[]
          sku: string | null
          status: string
          storage_location: string | null
          unit_cost: number | null
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category?: string | null
          colors?: string[]
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          maximum_stock?: number | null
          minimum_stock?: number
          name: string
          photo_url?: string | null
          quantity_per_delivery?: number
          replacement_period?: string
          requires_color?: boolean
          requires_return?: boolean
          requires_size?: boolean
          sizes?: string[]
          sku?: string | null
          status?: string
          storage_location?: string | null
          unit_cost?: number | null
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          category?: string | null
          colors?: string[]
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          maximum_stock?: number | null
          minimum_stock?: number
          name?: string
          photo_url?: string | null
          quantity_per_delivery?: number
          replacement_period?: string
          requires_color?: boolean
          requires_return?: boolean
          requires_size?: boolean
          sizes?: string[]
          sku?: string | null
          status?: string
          storage_location?: string | null
          unit_cost?: number | null
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          accent_color: string
          brand_logo_url: string | null
          brand_name: string | null
          created_at: string
          document: string | null
          id: string
          is_demo: boolean
          name: string
          primary_color: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          brand_logo_url?: string | null
          brand_name?: string | null
          created_at?: string
          document?: string | null
          id?: string
          is_demo?: boolean
          name: string
          primary_color?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          brand_logo_url?: string | null
          brand_name?: string | null
          created_at?: string
          document?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          primary_color?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_rules: {
        Row: {
          active: boolean
          catalog_item_id: string
          company_id: string
          created_at: string
          default_color: string | null
          default_size: string | null
          employee_id: string | null
          ends_on: string | null
          id: string
          mandatory: boolean
          quantity: number
          replacement_period: string
          role_id: string | null
          starts_on: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          catalog_item_id: string
          company_id: string
          created_at?: string
          default_color?: string | null
          default_size?: string | null
          employee_id?: string | null
          ends_on?: string | null
          id?: string
          mandatory?: boolean
          quantity?: number
          replacement_period?: string
          role_id?: string | null
          starts_on?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          catalog_item_id?: string
          company_id?: string
          created_at?: string
          default_color?: string | null
          default_size?: string | null
          employee_id?: string | null
          ends_on?: string | null
          id?: string
          mandatory?: boolean
          quantity?: number
          replacement_period?: string
          role_id?: string | null
          starts_on?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_rules_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_rules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_rules_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_rules_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_item_deliveries: {
        Row: {
          catalog_item_id: string
          company_id: string
          condition: string | null
          created_at: string
          delivered_at: string
          delivered_by: string | null
          employee_id: string
          id: string
          notes: string | null
          quantity: number
          return_notes: string | null
          returned_at: string | null
          signature_url: string | null
          size: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          catalog_item_id: string
          company_id: string
          condition?: string | null
          created_at?: string
          delivered_at?: string
          delivered_by?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          quantity?: number
          return_notes?: string | null
          returned_at?: string | null
          signature_url?: string | null
          size?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          catalog_item_id?: string
          company_id?: string
          condition?: string | null
          created_at?: string
          delivered_at?: string
          delivered_by?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          quantity?: number
          return_notes?: string | null
          returned_at?: string | null
          signature_url?: string | null
          size?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_item_deliveries_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_item_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_item_deliveries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_item_deliveries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          avatar_url: string | null
          company_id: string
          cpf: string
          created_at: string
          email: string | null
          employee_code: string | null
          employment_status: Database["public"]["Enums"]["employment_status"]
          full_name: string
          hire_date: string | null
          id: string
          phone: string | null
          portal_failed_attempts: number
          portal_locked_until: string | null
          portal_pin_hash: string | null
          portal_pin_set_at: string | null
          role_id: string | null
          team_id: string | null
          unit_id: string | null
          updated_at: string
          whatsapp_phone: string | null
          work_regime_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id: string
          cpf: string
          created_at?: string
          email?: string | null
          employee_code?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          full_name: string
          hire_date?: string | null
          id?: string
          phone?: string | null
          portal_failed_attempts?: number
          portal_locked_until?: string | null
          portal_pin_hash?: string | null
          portal_pin_set_at?: string | null
          role_id?: string | null
          team_id?: string | null
          unit_id?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
          work_regime_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string
          cpf?: string
          created_at?: string
          email?: string | null
          employee_code?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          full_name?: string
          hire_date?: string | null
          id?: string
          phone?: string | null
          portal_failed_attempts?: number
          portal_locked_until?: string | null
          portal_pin_hash?: string | null
          portal_pin_set_at?: string | null
          role_id?: string | null
          team_id?: string | null
          unit_id?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
          work_regime_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_work_regime_id_fkey"
            columns: ["work_regime_id"]
            isOneToOne: false
            referencedRelation: "work_regimes"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_count_items: {
        Row: {
          count_id: string
          counted_quantity: number | null
          created_at: string
          difference: number | null
          expected_quantity: number | null
          id: string
          inventory_item_id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          count_id: string
          counted_quantity?: number | null
          created_at?: string
          difference?: number | null
          expected_quantity?: number | null
          id?: string
          inventory_item_id: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          count_id?: string
          counted_quantity?: number | null
          created_at?: string
          difference?: number | null
          expected_quantity?: number | null
          id?: string
          inventory_item_id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_items_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          closed_at: string | null
          company_id: string
          created_at: string
          id: string
          name: string | null
          started_by: string | null
          status: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          company_id: string
          created_at?: string
          id?: string
          name?: string | null
          started_by?: string | null
          status?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string | null
          started_by?: string | null
          status?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          active: boolean
          allow_negative: boolean
          batch: string | null
          catalog_item_id: string | null
          category: string | null
          company_id: string
          created_at: string
          expires_on: string | null
          id: string
          item_type: Database["public"]["Enums"]["item_type"]
          last_movement_at: string | null
          maximum_stock: number | null
          minimum_stock: number
          name: string
          notes: string | null
          photo_url: string | null
          quantity: number
          supplier_id: string | null
          unit_cost: number | null
          unit_id: string
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          allow_negative?: boolean
          batch?: string | null
          catalog_item_id?: string | null
          category?: string | null
          company_id: string
          created_at?: string
          expires_on?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          last_movement_at?: string | null
          maximum_stock?: number | null
          minimum_stock?: number
          name: string
          notes?: string | null
          photo_url?: string | null
          quantity?: number
          supplier_id?: string | null
          unit_cost?: number | null
          unit_id: string
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          allow_negative?: boolean
          batch?: string | null
          catalog_item_id?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          expires_on?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          last_movement_at?: string | null
          maximum_stock?: number | null
          minimum_stock?: number
          name?: string
          notes?: string | null
          photo_url?: string | null
          quantity?: number
          supplier_id?: string | null
          unit_cost?: number | null
          unit_id?: string
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      item_deliveries: {
        Row: {
          accepted_at: string | null
          attachment_path: string | null
          batch_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          company_id: string
          created_at: string
          delivered_at: string
          divergence_notes: string | null
          employee_id: string
          expires_at: string | null
          id: string
          notes: string | null
          published_at: string | null
          reason: Database["public"]["Enums"]["item_delivery_reason"]
          refusal_reason: string | null
          refused_at: string | null
          responsible_label: string | null
          responsible_user_id: string | null
          status: Database["public"]["Enums"]["item_delivery_status"]
          unit_id: string
          updated_at: string
          version: number
        }
        Insert: {
          accepted_at?: string | null
          attachment_path?: string | null
          batch_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          company_id: string
          created_at?: string
          delivered_at?: string
          divergence_notes?: string | null
          employee_id: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          published_at?: string | null
          reason?: Database["public"]["Enums"]["item_delivery_reason"]
          refusal_reason?: string | null
          refused_at?: string | null
          responsible_label?: string | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["item_delivery_status"]
          unit_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          accepted_at?: string | null
          attachment_path?: string | null
          batch_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          company_id?: string
          created_at?: string
          delivered_at?: string
          divergence_notes?: string | null
          employee_id?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          published_at?: string | null
          reason?: Database["public"]["Enums"]["item_delivery_reason"]
          refusal_reason?: string | null
          refused_at?: string | null
          responsible_label?: string | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["item_delivery_status"]
          unit_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_deliveries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_deliveries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      item_delivery_events: {
        Row: {
          actor_id: string | null
          actor_label: string | null
          actor_type: string
          company_id: string
          created_at: string
          delivery_id: string | null
          event_type: string
          id: string
          metadata: Json
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: string
          company_id: string
          created_at?: string
          delivery_id?: string | null
          event_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: string
          company_id?: string
          created_at?: string
          delivery_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "item_delivery_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_delivery_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "item_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      item_delivery_evidence: {
        Row: {
          accuracy_meters: number | null
          consent_version: string | null
          created_at: string
          delivery_id: string
          device_metadata: Json
          face_asset_path: string | null
          face_provider: string | null
          face_provider_reference: string | null
          face_status: string
          face_validated_at: string | null
          id: string
          integrity_hash: string | null
          ip_masked: string | null
          latitude: number | null
          liveness_status: string | null
          location_captured_at: string | null
          location_status: string
          longitude: number | null
          signature_path: string | null
          signature_type: string | null
          signature_typed_name: string | null
          terms_version: string | null
          updated_at: string
        }
        Insert: {
          accuracy_meters?: number | null
          consent_version?: string | null
          created_at?: string
          delivery_id: string
          device_metadata?: Json
          face_asset_path?: string | null
          face_provider?: string | null
          face_provider_reference?: string | null
          face_status?: string
          face_validated_at?: string | null
          id?: string
          integrity_hash?: string | null
          ip_masked?: string | null
          latitude?: number | null
          liveness_status?: string | null
          location_captured_at?: string | null
          location_status?: string
          longitude?: number | null
          signature_path?: string | null
          signature_type?: string | null
          signature_typed_name?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Update: {
          accuracy_meters?: number | null
          consent_version?: string | null
          created_at?: string
          delivery_id?: string
          device_metadata?: Json
          face_asset_path?: string | null
          face_provider?: string | null
          face_provider_reference?: string | null
          face_status?: string
          face_validated_at?: string | null
          id?: string
          integrity_hash?: string | null
          ip_masked?: string | null
          latitude?: number | null
          liveness_status?: string | null
          location_captured_at?: string | null
          location_status?: string
          longitude?: number | null
          signature_path?: string | null
          signature_type?: string | null
          signature_typed_name?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_delivery_evidence_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: true
            referencedRelation: "item_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      item_delivery_items: {
        Row: {
          catalog_item_id: string
          color: string | null
          created_at: string
          delivery_id: string
          id: string
          inventory_item_id: string | null
          item_name: string
          lot: string | null
          quantity: number
          returned_quantity: number
          size: string | null
          unit_cost_snapshot: number | null
        }
        Insert: {
          catalog_item_id: string
          color?: string | null
          created_at?: string
          delivery_id: string
          id?: string
          inventory_item_id?: string | null
          item_name: string
          lot?: string | null
          quantity?: number
          returned_quantity?: number
          size?: string | null
          unit_cost_snapshot?: number | null
        }
        Update: {
          catalog_item_id?: string
          color?: string | null
          created_at?: string
          delivery_id?: string
          id?: string
          inventory_item_id?: string | null
          item_name?: string
          lot?: string | null
          quantity?: number
          returned_quantity?: number
          size?: string | null
          unit_cost_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_delivery_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "item_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_delivery_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["delivery_channel"]
          company_id: string
          created_at: string
          employee_id: string | null
          error: string | null
          event_type: string
          id: string
          idempotency_key: string
          payload: Json
          recipient: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          template: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel?: Database["public"]["Enums"]["delivery_channel"]
          company_id: string
          created_at?: string
          employee_id?: string | null
          error?: string | null
          event_type: string
          id?: string
          idempotency_key: string
          payload?: Json
          recipient?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          template?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["delivery_channel"]
          company_id?: string
          created_at?: string
          employee_id?: string | null
          error?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string
          payload?: Json
          recipient?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          template?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      point_card_deliveries: {
        Row: {
          attempt: number
          channel: Database["public"]["Enums"]["delivery_channel"]
          company_id: string
          created_at: string
          error: string | null
          expires_at: string | null
          id: string
          point_card_id: string
          recipient: string
          sent_at: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          token_hash: string | null
          updated_at: string
        }
        Insert: {
          attempt?: number
          channel: Database["public"]["Enums"]["delivery_channel"]
          company_id: string
          created_at?: string
          error?: string | null
          expires_at?: string | null
          id?: string
          point_card_id: string
          recipient: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          token_hash?: string | null
          updated_at?: string
        }
        Update: {
          attempt?: number
          channel?: Database["public"]["Enums"]["delivery_channel"]
          company_id?: string
          created_at?: string
          error?: string | null
          expires_at?: string | null
          id?: string
          point_card_id?: string
          recipient?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          token_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_card_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_card_deliveries_point_card_id_fkey"
            columns: ["point_card_id"]
            isOneToOne: false
            referencedRelation: "point_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      point_card_events: {
        Row: {
          actor_id: string | null
          actor_label: string | null
          actor_type: string
          batch_id: string | null
          card_id: string | null
          company_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          period_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: string
          batch_id?: string | null
          card_id?: string | null
          company_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          period_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: string
          batch_id?: string | null
          card_id?: string | null
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          period_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "point_card_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "timesheet_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_card_events_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "point_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_card_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_card_events_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "timesheet_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      point_card_evidence: {
        Row: {
          accuracy_meters: number | null
          card_id: string
          card_version: number
          company_id: string
          consent_version: string | null
          created_at: string
          device_metadata: Json
          face_provider: string | null
          face_provider_reference: string | null
          face_status: string
          face_validated_at: string | null
          id: string
          integrity_hash: string | null
          ip_masked: string | null
          latitude: number | null
          liveness_status: string | null
          location_captured_at: string | null
          location_status: string
          longitude: number | null
          signature_path: string | null
          signature_typed_name: string | null
          signed_at: string
          terms_version: string | null
        }
        Insert: {
          accuracy_meters?: number | null
          card_id: string
          card_version?: number
          company_id: string
          consent_version?: string | null
          created_at?: string
          device_metadata?: Json
          face_provider?: string | null
          face_provider_reference?: string | null
          face_status?: string
          face_validated_at?: string | null
          id?: string
          integrity_hash?: string | null
          ip_masked?: string | null
          latitude?: number | null
          liveness_status?: string | null
          location_captured_at?: string | null
          location_status?: string
          longitude?: number | null
          signature_path?: string | null
          signature_typed_name?: string | null
          signed_at?: string
          terms_version?: string | null
        }
        Update: {
          accuracy_meters?: number | null
          card_id?: string
          card_version?: number
          company_id?: string
          consent_version?: string | null
          created_at?: string
          device_metadata?: Json
          face_provider?: string | null
          face_provider_reference?: string | null
          face_status?: string
          face_validated_at?: string | null
          id?: string
          integrity_hash?: string | null
          ip_masked?: string | null
          latitude?: number | null
          liveness_status?: string | null
          location_captured_at?: string | null
          location_status?: string
          longitude?: number | null
          signature_path?: string | null
          signature_typed_name?: string | null
          signed_at?: string
          terms_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "point_card_evidence_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "point_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_card_evidence_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      point_cards: {
        Row: {
          absence_days: number
          acknowledged_at: string | null
          balance_minutes: number
          batch_id: string | null
          company_id: string
          created_at: string
          deadline_at: string | null
          employee_id: string
          generated_by: string | null
          id: string
          late_minutes: number
          missing_punches: number
          overtime_minutes: number
          period_end: string
          period_id: string | null
          period_start: string
          planned_minutes: number
          publish_error: string | null
          published_at: string | null
          reopen_reason: string | null
          reopened_at: string | null
          signature_url: string | null
          signed_at: string | null
          status: string
          summary: Json
          unit_id: string
          updated_at: string
          version: number
          viewed_at: string | null
          worked_minutes: number
        }
        Insert: {
          absence_days?: number
          acknowledged_at?: string | null
          balance_minutes?: number
          batch_id?: string | null
          company_id: string
          created_at?: string
          deadline_at?: string | null
          employee_id: string
          generated_by?: string | null
          id?: string
          late_minutes?: number
          missing_punches?: number
          overtime_minutes?: number
          period_end: string
          period_id?: string | null
          period_start: string
          planned_minutes?: number
          publish_error?: string | null
          published_at?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          signature_url?: string | null
          signed_at?: string | null
          status?: string
          summary?: Json
          unit_id: string
          updated_at?: string
          version?: number
          viewed_at?: string | null
          worked_minutes?: number
        }
        Update: {
          absence_days?: number
          acknowledged_at?: string | null
          balance_minutes?: number
          batch_id?: string | null
          company_id?: string
          created_at?: string
          deadline_at?: string | null
          employee_id?: string
          generated_by?: string | null
          id?: string
          late_minutes?: number
          missing_punches?: number
          overtime_minutes?: number
          period_end?: string
          period_id?: string | null
          period_start?: string
          planned_minutes?: number
          publish_error?: string | null
          published_at?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          signature_url?: string | null
          signed_at?: string | null
          status?: string
          summary?: Json
          unit_id?: string
          updated_at?: string
          version?: number
          viewed_at?: string | null
          worked_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "point_cards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_cards_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_cards_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "timesheet_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_cards_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      point_policies: {
        Row: {
          accuracy_tolerance_meters: number
          block_outside_radius: boolean
          company_id: string
          created_at: string
          employee_message: string | null
          geolocation_required: boolean
          id: string
          location_retention_days: number
          require_signature: boolean
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          accuracy_tolerance_meters?: number
          block_outside_radius?: boolean
          company_id: string
          created_at?: string
          employee_message?: string | null
          geolocation_required?: boolean
          id?: string
          location_retention_days?: number
          require_signature?: boolean
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          accuracy_tolerance_meters?: number
          block_outside_radius?: boolean
          company_id?: string
          created_at?: string
          employee_message?: string | null
          geolocation_required?: boolean
          id?: string
          location_retention_days?: number
          require_signature?: boolean
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_policies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_sessions: {
        Row: {
          created_at: string
          employee_id: string
          expires_at: string
          id: string
          ip: string | null
          revoked_at: string | null
          token_hash: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          expires_at: string
          id?: string
          ip?: string | null
          revoked_at?: string | null
          token_hash: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          expires_at?: string
          id?: string
          ip?: string | null
          revoked_at?: string | null
          token_hash?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_sessions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_unit_id: string | null
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          active_unit_id?: string | null
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          active_unit_id?: string | null
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_unit_id_fkey"
            columns: ["active_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_connections: {
        Row: {
          active: boolean
          adapter_type: string
          company_id: string
          config: Json
          created_at: string
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          provider: string
          status: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          adapter_type?: string
          company_id: string
          config?: Json
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          provider: string
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          adapter_type?: string
          company_id?: string
          config?: Json
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          provider?: string
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_connections_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_daily_metrics: {
        Row: {
          average_ticket: number | null
          cancellations: number
          company_id: string
          created_at: string
          discounts: number | null
          gross_amount: number
          id: string
          metric_date: string
          net_amount: number | null
          orders_count: number
          unit_id: string
          updated_at: string
        }
        Insert: {
          average_ticket?: number | null
          cancellations?: number
          company_id: string
          created_at?: string
          discounts?: number | null
          gross_amount?: number
          id?: string
          metric_date: string
          net_amount?: number | null
          orders_count?: number
          unit_id: string
          updated_at?: string
        }
        Update: {
          average_ticket?: number | null
          cancellations?: number
          company_id?: string
          created_at?: string
          discounts?: number | null
          gross_amount?: number
          id?: string
          metric_date?: string
          net_amount?: number | null
          orders_count?: number
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_daily_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_daily_metrics_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_import_jobs: {
        Row: {
          company_id: string
          connection_id: string | null
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          period_end: string | null
          period_start: string | null
          rows_imported: number
          started_at: string | null
          status: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          connection_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          rows_imported?: number
          started_at?: string | null
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          connection_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          rows_imported?: number
          started_at?: string | null
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_import_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_import_jobs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "sales_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_import_jobs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          id: string
          order_id: string
          product_name: string
          quantity: number
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          id?: string
          order_id: string
          product_name: string
          quantity?: number
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          id?: string
          order_id?: string
          product_name?: string
          quantity?: number
          total_price?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          channel: string | null
          company_id: string
          connection_id: string | null
          created_at: string
          discount_amount: number | null
          external_id: string | null
          gross_amount: number
          id: string
          is_cancelled: boolean
          net_amount: number | null
          ordered_at: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          channel?: string | null
          company_id: string
          connection_id?: string | null
          created_at?: string
          discount_amount?: number | null
          external_id?: string | null
          gross_amount?: number
          id?: string
          is_cancelled?: boolean
          net_amount?: number | null
          ordered_at: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          channel?: string | null
          company_id?: string
          connection_id?: string | null
          created_at?: string
          discount_amount?: number | null
          external_id?: string | null
          gross_amount?: number
          id?: string
          is_cancelled?: boolean
          net_amount?: number | null
          ordered_at?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "sales_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_blocks: {
        Row: {
          company_id: string
          created_at: string
          employee_id: string
          end_at: string
          id: string
          notes: string | null
          schedule_id: string
          shift_id: string | null
          start_at: string
          unit_id: string
          updated_at: string
          work_date: string
        }
        Insert: {
          company_id: string
          created_at?: string
          employee_id: string
          end_at: string
          id?: string
          notes?: string | null
          schedule_id: string
          shift_id?: string | null
          start_at: string
          unit_id: string
          updated_at?: string
          work_date: string
        }
        Update: {
          company_id?: string
          created_at?: string
          employee_id?: string
          end_at?: string
          id?: string
          notes?: string | null
          schedule_id?: string
          shift_id?: string | null
          start_at?: string
          unit_id?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_blocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_changes: {
        Row: {
          block_id: string | null
          change_type: string
          changed_by: string | null
          company_id: string
          created_at: string
          id: string
          new_data: Json | null
          previous_data: Json | null
          reason: string | null
          schedule_id: string
        }
        Insert: {
          block_id?: string | null
          change_type: string
          changed_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          new_data?: Json | null
          previous_data?: Json | null
          reason?: string | null
          schedule_id: string
        }
        Update: {
          block_id?: string | null
          change_type?: string
          changed_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          previous_data?: Json | null
          reason?: string | null
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_changes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_changes_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_template_items: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          shift_id: string
          team_id: string | null
          template_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          shift_id: string
          team_id?: string | null
          template_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          shift_id?: string
          team_id?: string | null
          template_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_template_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_template_items_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_template_items_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "schedule_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_templates: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          unit_id: string | null
          updated_at: string
          work_regime_id: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          unit_id?: string | null
          updated_at?: string
          work_regime_id?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          unit_id?: string | null
          updated_at?: string
          work_regime_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_work_regime_id_fkey"
            columns: ["work_regime_id"]
            isOneToOne: false
            referencedRelation: "work_regimes"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string | null
          period_end: string
          period_start: string
          published_at: string | null
          published_by: string | null
          source: string
          status: Database["public"]["Enums"]["schedule_status"]
          template_id: string | null
          unit_id: string
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name?: string | null
          period_end: string
          period_start: string
          published_at?: string | null
          published_by?: string | null
          source?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          template_id?: string | null
          unit_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string | null
          period_end?: string
          period_start?: string
          published_at?: string | null
          published_by?: string | null
          source?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          template_id?: string | null
          unit_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "schedule_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swap_requests: {
        Row: {
          block_id: string | null
          company_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          reason: string | null
          requester_employee_id: string
          status: string
          target_employee_id: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          block_id?: string | null
          company_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          reason?: string | null
          requester_employee_id: string
          status?: string
          target_employee_id?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          block_id?: string | null
          company_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          reason?: string | null
          requester_employee_id?: string
          status?: string
          target_employee_id?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_swap_requests_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "schedule_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_requester_employee_id_fkey"
            columns: ["requester_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_target_employee_id_fkey"
            columns: ["target_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          active: boolean
          color: string
          company_id: string
          created_at: string
          crosses_midnight: boolean
          end_time: string
          id: string
          name: string
          start_time: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string
          company_id: string
          created_at?: string
          crosses_midnight?: boolean
          end_time: string
          id?: string
          name: string
          start_time: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string
          company_id?: string
          created_at?: string
          crosses_midnight?: boolean
          end_time?: string
          id?: string
          name?: string
          start_time?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_alerts: {
        Row: {
          alert_type: string
          company_id: string
          created_at: string
          id: string
          inventory_item_id: string
          message: string | null
          resolved_at: string | null
          unit_id: string
        }
        Insert: {
          alert_type: string
          company_id: string
          created_at?: string
          id?: string
          inventory_item_id: string
          message?: string | null
          resolved_at?: string | null
          unit_id: string
        }
        Update: {
          alert_type?: string
          company_id?: string
          created_at?: string
          id?: string
          inventory_item_id?: string
          message?: string | null
          resolved_at?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          company_id: string
          created_at: string
          id: string
          inventory_item_id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          occurred_at: string
          performed_by: string | null
          quantity: number
          quantity_after: number | null
          quantity_before: number | null
          reason: string | null
          reference: string | null
          supplier_id: string | null
          target_unit_id: string | null
          unit_cost: number | null
          unit_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          inventory_item_id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          occurred_at?: string
          performed_by?: string | null
          quantity: number
          quantity_after?: number | null
          quantity_before?: number | null
          reason?: string | null
          reference?: string | null
          supplier_id?: string | null
          target_unit_id?: string | null
          unit_cost?: number | null
          unit_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          inventory_item_id?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          occurred_at?: string
          performed_by?: string | null
          quantity?: number
          quantity_after?: number | null
          quantity_before?: number | null
          reason?: string | null
          reference?: string | null
          supplier_id?: string | null
          target_unit_id?: string | null
          unit_cost?: number | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_target_unit_id_fkey"
            columns: ["target_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          company_id: string
          contact_name: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          contact_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          contact_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          active: boolean
          color: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          unit_id: string | null
          updated_at: string
          work_regime_id: string | null
        }
        Insert: {
          active?: boolean
          color?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          unit_id?: string | null
          updated_at?: string
          work_regime_id?: string | null
        }
        Update: {
          active?: boolean
          color?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          unit_id?: string | null
          updated_at?: string
          work_regime_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_work_regime_fk"
            columns: ["work_regime_id"]
            isOneToOne: false
            referencedRelation: "work_regimes"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          accuracy_meters: number | null
          approx_address: string | null
          company_id: string
          created_at: string
          device_info: string | null
          device_time: string | null
          distance_meters: number | null
          employee_id: string
          entry_type: Database["public"]["Enums"]["time_entry_type"]
          geo_status: Database["public"]["Enums"]["geo_status"]
          id: string
          latitude: number | null
          longitude: number | null
          schedule_block_id: string | null
          schedule_id: string | null
          server_time: string
          source: string
          unit_id: string
          updated_at: string
          user_agent: string | null
          validation_status: string
        }
        Insert: {
          accuracy_meters?: number | null
          approx_address?: string | null
          company_id: string
          created_at?: string
          device_info?: string | null
          device_time?: string | null
          distance_meters?: number | null
          employee_id: string
          entry_type: Database["public"]["Enums"]["time_entry_type"]
          geo_status?: Database["public"]["Enums"]["geo_status"]
          id?: string
          latitude?: number | null
          longitude?: number | null
          schedule_block_id?: string | null
          schedule_id?: string | null
          server_time?: string
          source?: string
          unit_id: string
          updated_at?: string
          user_agent?: string | null
          validation_status?: string
        }
        Update: {
          accuracy_meters?: number | null
          approx_address?: string | null
          company_id?: string
          created_at?: string
          device_info?: string | null
          device_time?: string | null
          distance_meters?: number | null
          employee_id?: string
          entry_type?: Database["public"]["Enums"]["time_entry_type"]
          geo_status?: Database["public"]["Enums"]["geo_status"]
          id?: string
          latitude?: number | null
          longitude?: number | null
          schedule_block_id?: string | null
          schedule_id?: string | null
          server_time?: string
          source?: string
          unit_id?: string
          updated_at?: string
          user_agent?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_schedule_block_id_fkey"
            columns: ["schedule_block_id"]
            isOneToOne: false
            referencedRelation: "schedule_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_reviews: {
        Row: {
          company_id: string
          created_at: string
          employee_id: string
          id: string
          reason: string | null
          request_type: string
          requested_entry_type:
            | Database["public"]["Enums"]["time_entry_type"]
            | null
          requested_time: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          time_entry_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          employee_id: string
          id?: string
          reason?: string | null
          request_type?: string
          requested_entry_type?:
            | Database["public"]["Enums"]["time_entry_type"]
            | null
          requested_time?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          time_entry_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          reason?: string | null
          request_type?: string
          requested_entry_type?:
            | Database["public"]["Enums"]["time_entry_type"]
            | null
          requested_time?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          time_entry_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_reviews_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_reviews_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_batches: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_summary: string | null
          failed_cards: number
          id: string
          period_id: string | null
          published_cards: number
          results: Json
          skipped_cards: number
          started_at: string | null
          status: string
          total_cards: number
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_summary?: string | null
          failed_cards?: number
          id?: string
          period_id?: string | null
          published_cards?: number
          results?: Json
          skipped_cards?: number
          started_at?: string | null
          status?: string
          total_cards?: number
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_summary?: string | null
          failed_cards?: number
          id?: string
          period_id?: string | null
          published_cards?: number
          results?: Json
          skipped_cards?: number
          started_at?: string | null
          status?: string
          total_cards?: number
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_batches_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "timesheet_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_batches_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_disputes: {
        Row: {
          attachment_path: string | null
          card_id: string
          card_version: number
          category: string
          company_id: string
          created_at: string
          description: string
          employee_id: string
          id: string
          manager_response: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          unit_id: string | null
          updated_at: string
          work_date: string | null
        }
        Insert: {
          attachment_path?: string | null
          card_id: string
          card_version?: number
          category?: string
          company_id: string
          created_at?: string
          description: string
          employee_id: string
          id?: string
          manager_response?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          unit_id?: string | null
          updated_at?: string
          work_date?: string | null
        }
        Update: {
          attachment_path?: string | null
          card_id?: string
          card_version?: number
          category?: string
          company_id?: string
          created_at?: string
          description?: string
          employee_id?: string
          id?: string
          manager_response?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          unit_id?: string | null
          updated_at?: string
          work_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_disputes_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "point_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_disputes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_disputes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_disputes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_entries: {
        Row: {
          absence_status: string | null
          alerts: string[]
          break_end: string | null
          break_start: string | null
          card_id: string
          clock_in: string | null
          clock_out: string | null
          company_id: string
          created_at: string
          delay_minutes: number
          id: string
          justification: string | null
          notes: string | null
          overtime_minutes: number
          planned_minutes: number
          source: string
          updated_at: string
          work_date: string
          worked_minutes: number
        }
        Insert: {
          absence_status?: string | null
          alerts?: string[]
          break_end?: string | null
          break_start?: string | null
          card_id: string
          clock_in?: string | null
          clock_out?: string | null
          company_id: string
          created_at?: string
          delay_minutes?: number
          id?: string
          justification?: string | null
          notes?: string | null
          overtime_minutes?: number
          planned_minutes?: number
          source?: string
          updated_at?: string
          work_date: string
          worked_minutes?: number
        }
        Update: {
          absence_status?: string | null
          alerts?: string[]
          break_end?: string | null
          break_start?: string | null
          card_id?: string
          clock_in?: string | null
          clock_out?: string | null
          company_id?: string
          created_at?: string
          delay_minutes?: number
          id?: string
          justification?: string | null
          notes?: string | null
          overtime_minutes?: number
          planned_minutes?: number
          source?: string
          updated_at?: string
          work_date?: string
          worked_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "point_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deadline_at: string | null
          id: string
          name: string | null
          period_end: string
          period_start: string
          status: string
          timezone: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deadline_at?: string | null
          id?: string
          name?: string | null
          period_end: string
          period_start: string
          status?: string
          timezone?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deadline_at?: string | null
          id?: string
          name?: string | null
          period_end?: string
          period_start?: string
          status?: string
          timezone?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_periods_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          company_id: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          point_radius_meters: number
          postal_code: string | null
          state: string | null
          type: Database["public"]["Enums"]["unit_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          point_radius_meters?: number
          postal_code?: string | null
          state?: string | null
          type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          point_radius_meters?: number
          postal_code?: string | null
          state?: string | null
          type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_units: {
        Row: {
          created_at: string
          id: string
          unit_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          unit_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      work_regimes: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          minimum_rest_minutes: number | null
          name: string
          regime_type: Database["public"]["Enums"]["regime_type"]
          updated_at: string
          weekly_hours_limit: number | null
          work_pattern_config: Json
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          minimum_rest_minutes?: number | null
          name: string
          regime_type?: Database["public"]["Enums"]["regime_type"]
          updated_at?: string
          weekly_hours_limit?: number | null
          work_pattern_config?: Json
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          minimum_rest_minutes?: number | null
          name?: string
          regime_type?: Database["public"]["Enums"]["regime_type"]
          updated_at?: string
          weekly_hours_limit?: number | null
          work_pattern_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "work_regimes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_all_units: { Args: never; Returns: boolean }
      current_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_unit_access: { Args: { _unit_id: string }; Returns: boolean }
      in_company: { Args: { _company_id: string }; Returns: boolean }
      is_company_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "unit_manager"
        | "hr"
        | "stock_manager"
        | "supervisor"
        | "staff"
      delivery_channel: "whatsapp" | "email" | "link"
      delivery_status:
        | "pendente"
        | "enviando"
        | "enviado"
        | "erro"
        | "cancelado"
      employment_status: "ativo" | "afastado" | "ferias" | "desligado"
      geo_status:
        | "dentro_do_raio"
        | "fora_do_raio"
        | "localizacao_indisponivel"
        | "revisao_necessaria"
      item_delivery_reason:
        | "admissao"
        | "troca"
        | "reposicao"
        | "perda"
        | "dano"
        | "mudanca_funcao"
        | "retorno"
        | "outro"
      item_delivery_status:
        | "rascunho"
        | "aguardando_aceite"
        | "em_validacao"
        | "assinado"
        | "recusado"
        | "divergente"
        | "expirado"
        | "cancelado"
      item_type:
        | "protecao_individual"
        | "uniforme"
        | "ingrediente"
        | "embalagem"
        | "limpeza"
        | "consumo"
      movement_type:
        | "entrada"
        | "saida"
        | "ajuste"
        | "perda"
        | "transferencia"
        | "inventario"
      regime_type: "6x1" | "5x2" | "12x36" | "custom"
      schedule_status: "rascunho" | "publicada" | "arquivada"
      time_entry_type:
        | "entrada"
        | "intervalo_saida"
        | "intervalo_retorno"
        | "saida"
      unit_type:
        | "restaurante"
        | "bar"
        | "cafeteria"
        | "lanchonete"
        | "padaria"
        | "cozinha"
        | "varejo"
        | "outro"
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
      app_role: [
        "owner",
        "admin",
        "unit_manager",
        "hr",
        "stock_manager",
        "supervisor",
        "staff",
      ],
      delivery_channel: ["whatsapp", "email", "link"],
      delivery_status: ["pendente", "enviando", "enviado", "erro", "cancelado"],
      employment_status: ["ativo", "afastado", "ferias", "desligado"],
      geo_status: [
        "dentro_do_raio",
        "fora_do_raio",
        "localizacao_indisponivel",
        "revisao_necessaria",
      ],
      item_delivery_reason: [
        "admissao",
        "troca",
        "reposicao",
        "perda",
        "dano",
        "mudanca_funcao",
        "retorno",
        "outro",
      ],
      item_delivery_status: [
        "rascunho",
        "aguardando_aceite",
        "em_validacao",
        "assinado",
        "recusado",
        "divergente",
        "expirado",
        "cancelado",
      ],
      item_type: [
        "protecao_individual",
        "uniforme",
        "ingrediente",
        "embalagem",
        "limpeza",
        "consumo",
      ],
      movement_type: [
        "entrada",
        "saida",
        "ajuste",
        "perda",
        "transferencia",
        "inventario",
      ],
      regime_type: ["6x1", "5x2", "12x36", "custom"],
      schedule_status: ["rascunho", "publicada", "arquivada"],
      time_entry_type: [
        "entrada",
        "intervalo_saida",
        "intervalo_retorno",
        "saida",
      ],
      unit_type: [
        "restaurante",
        "bar",
        "cafeteria",
        "lanchonete",
        "padaria",
        "cozinha",
        "varejo",
        "outro",
      ],
    },
  },
} as const
