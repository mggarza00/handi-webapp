import Link from "next/link";
import Image from "next/image";
import createClient from "@/utils/supabase/server";

export default async function TopBar() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="w-full sticky top-0 z-40 border-b bg-white/80 dark:bg-neutral-900/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold">
          Handi
        </Link>

        {!user ? (
          <Link
            href="/auth/sign-in"
            className="rounded-2xl px-4 py-2 border shadow hover:shadow-md transition"
          >
            Iniciar sesión
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <Link href="/dashboard/pro" className="text-sm hover:underline">
              Dashboard
            </Link>
            <form action="/auth/sign-out" method="post">
              <button className="text-sm underline">Salir</button>
            </form>
            <Link href="/profile" className="flex items-center gap-2">
              <Image
                src={user.user_metadata?.avatar_url ?? "/avatar.png"}
                alt="Perfil"
                width={28}
                height={28}
                className="rounded-full border"
              />
              <span className="text-sm">
                {user.user_metadata?.full_name ?? "Perfil"}
              </span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
