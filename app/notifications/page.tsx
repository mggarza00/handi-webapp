import Link from "next/link";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supa = createServerComponentClient<Database>({ cookies });
  const { data: auth } = await supa.auth.getUser();
  const user = auth?.user;
  if (!user) return unauth();

  const { data } = await supa
    .from("user_notifications")
    .select("id, title, body, link, created_at, read_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Notificaciones</h1>
      <ul className="space-y-2">
        {(data || []).map((n) => (
          <li key={n.id} className={`rounded border p-3 ${!n.read_at ? "bg-orange-50" : "bg-white"}`}>
            <div className="font-medium">{n.title}</div>
            {n.body ? <div className="text-slate-700">{n.body}</div> : null}
            <div className="mt-1 flex items-center justify-between text-sm text-slate-500">
              <span>{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</span>
              {n.link ? <Link href={n.link} className="text-blue-600 hover:underline">Abrir</Link> : null}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

function unauth() {
  return <main className="mx-auto max-w-3xl px-4 py-12">Debes iniciar sesión.</main>;
}
