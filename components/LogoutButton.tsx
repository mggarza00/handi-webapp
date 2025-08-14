"use client";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function LogoutButton() {
  return (
    <button
      onClick={async () => { await supabaseBrowser.auth.signOut(); window.location.reload(); }}
      className="border rounded px-3 py-1"
    >
      Cerrar sesión
    </button>
  );
}
