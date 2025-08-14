// app/(app)/me/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function MePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Mi sesión</h1>
      {error ? <p>Error: {error.message}</p> :
        user ? <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto">
          {JSON.stringify(user, null, 2)}
        </pre> : <p>No hay sesión.</p>}
    </div>
  );
}
