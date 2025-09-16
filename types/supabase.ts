/**
 * Tipos mínimos de la BD (stub) según Documento Maestro V1.
 * Sustituye cuando generes los tipos oficiales con: supabase gen types typescript ...
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface Tables {
  profiles: {
    Row: {
      id: string;
      full_name: string | null;
      role: "client" | "pro" | "admin" | null;
      avatar_url: string | null;
      /** banderas auxiliares que existen en algunas migraciones */
      is_client_pro?: boolean | null;
      is_admin?: boolean | null;
      /** columnas varias que pueden existir por migraciones previas */
      created_at: string | null; // timestamptz ISO
    };
    Insert: Partial<Tables["profiles"]["Row"]> & { id: string };
    Update: Partial<Tables["profiles"]["Row"]>;
  };
  professionals: {
    Row: {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      headline: string | null;
      bio: string | null;
      years_experience: number | null;
      rating: number | null;
      is_featured: boolean | null;
      active: boolean | null;
      empresa?: boolean | null;
      city: string | null;
      cities: Json | null;
      categories: Json | null;
      subcategories: Json | null;
      last_active_at: string | null;
      created_at: string | null;
    };
    Insert: Partial<Tables["professionals"]["Row"]> & { id: string };
    Update: Partial<Tables["professionals"]["Row"]>;
  };
  requests: {
    Row: {
      id: string;
      title: string;
      description: string | null;
      city: string | null;
      category: string | null;
      subcategories: Json | null;
      budget: number | null;
      required_at: string | null; // date
      status: "active" | "in_process" | "completed" | "cancelled" | null;
      attachments: Json | null;
      created_by: string;
      created_at: string | null;
    };
    Insert: Partial<Tables["requests"]["Row"]> & {
      title: string;
      created_by: string;
    };
    Update: Partial<Tables["requests"]["Row"]>;
  };
  offers: {
    Row: {
      id: string;
      conversation_id: string;
      client_id: string;
      professional_id: string;
      title: string;
      description: string | null;
      service_date: string | null;
      currency: string;
      amount: number;
      status: 'sent' | 'accepted' | 'rejected' | 'expired' | 'canceled' | 'paid';
      reject_reason: string | null;
      checkout_url: string | null;
      payment_intent_id: string | null;
      metadata: Json;
      created_at: string;
      created_by: string;
      updated_at: string;
    };
    Insert: Partial<Omit<Tables['offers']['Row'], 'id' | 'created_at' | 'updated_at'>> & {
      conversation_id: string;
      client_id: string;
      professional_id: string;
      title: string;
      amount: number;
      created_by: string;
    };
    Update: Partial<Tables['offers']['Row']>;
  };
  applications: {
    Row: {
      id: string;
      request_id: string;
      professional_id: string;
      note: string | null;
      status: "applied" | "accepted" | "rejected" | "completed" | null;
      created_at: string | null;
      updated_at: string | null;
    };
    Insert: Partial<Tables["applications"]["Row"]> & {
      request_id: string;
      professional_id: string;
    };
    Update: Partial<Tables["applications"]["Row"]>;
  };
  pro_applications: {
    Row: {
      id: string;
      user_id: string;
      full_name: string;
      phone: string | null;
      email: string | null;
      empresa?: boolean | null;
      services_desc: string | null;
      cities: Json;
      categories: Json;
      years_experience: number | null;
      refs: Json | null;
      uploads: Json | null;
      status: "pending" | "accepted" | "rejected";
      created_at: string | null;
      updated_at: string | null;
    };
    Insert: Partial<Tables["pro_applications"]["Row"]> & { user_id: string; full_name: string; cities: Json; categories: Json };
    Update: Partial<Tables["pro_applications"]["Row"]>;
  };
  agreements: {
    Row: {
      id: string;
      request_id: string;
      professional_id: string;
      amount: number | null;
      status:
        | "negotiating"
        | "accepted"
        | "paid"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "disputed"
        | null;
      created_at: string | null;
      updated_at: string | null;
    };
    Insert: Partial<Tables["agreements"]["Row"]> & {
      request_id: string;
      professional_id: string;
    };
    Update: Partial<Tables["agreements"]["Row"]>;
  };
}

/** Tipo raíz de Supabase generado (interfaz esperada por @supabase/auth-helpers-nextjs) */
export type Database = {
  public: {
    Tables: Tables;
    Views: { [_: string]: never };
    Functions: { [_: string]: never };
    Enums: { [_: string]: never };
    CompositeTypes: { [_: string]: never };
  };
};
