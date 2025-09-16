// lib/usersMapper.ts
// Fuente de verdad: Supabase (tabla: users)

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type UserRow = {
  id?: number; // PK en Supabase
  user_id: string;
  nombre?: string;
  rol_actual?: "cliente" | "profesional";
  roles_permitidos?: string; // ej: "cliente,profesional"
  status_profesional?:
    | "no_iniciado"
    | "en_proceso"
    | "enviado"
    | "aprobado"
    | "rechazado";
  application_step?: number;
};

const TABLE = "users";

// Client admin (server-only)
let _supabase: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required (server)");
  _supabase = createClient(url, key);
  return _supabase!;
}

// ———————————————————————————————————————————————
// API compatible con el viejo mapper basado en Sheets
// rowIndex AHORA significa el ID (PK) de la fila en Supabase
// ———————————————————————————————————————————————

// Devuelve el ID de la fila o -1 si no existe
export async function findUserRow(userId: string): Promise<number> {
  const { data, error } = await sb()
    .from(TABLE)
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  return data?.id ?? -1;
}

// Lee por ID (rowIndex)
export async function readUser(rowIndex: number): Promise<UserRow> {
  const { data, error } = await sb()
    .from(TABLE)
    .select("*")
    .eq("id", rowIndex)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    // Devuelve shape vacío para no romper llamadas existentes
    return {
      user_id: "",
      nombre: "",
      rol_actual: undefined,
      roles_permitidos: "",
      status_profesional: undefined,
      application_step: undefined,
    };
  }
  return data;
}

// Actualiza por ID (rowIndex)
export async function writeUser(
  rowIndex: number,
  patch: Partial<UserRow>,
): Promise<void> {
  // Nunca permitas cambiar el id ni user_id aquí sin control explícito
  const { error } = await sb()
    .from(TABLE)
    .update({
      nombre: patch.nombre,
      rol_actual: patch.rol_actual,
      roles_permitidos: patch.roles_permitidos,
      status_profesional: patch.status_profesional,
      application_step: patch.application_step,
    })
    .eq("id", rowIndex);
  if (error) throw error;
}

// Inserta si no existe (por user_id). Si ya existe, retorna su ID.
export async function appendUser(row: UserRow): Promise<number> {
  // upsert por user_id para evitar duplicados
  const toInsert: UserRow = {
    user_id: row.user_id,
    nombre: row.nombre ?? "",
    rol_actual: row.rol_actual,
    roles_permitidos: row.roles_permitidos ?? "",
    status_profesional: row.status_profesional,
    application_step: row.application_step,
  };

  const { data, error } = await sb()
    .from(TABLE)
    .upsert(toInsert, { onConflict: "user_id" })
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    // Si por alguna razón no regresó ID, búscalo
    const id = await findUserRow(row.user_id);
    if (id === -1) throw new Error("appendUser: no se pudo obtener el ID");
    return id;
  }
  return data.id;
}
