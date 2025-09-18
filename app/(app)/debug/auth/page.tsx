import Link from "next/link";
import { cookies, headers } from "next/headers";

import { getAuthContext } from "@/lib/_supabase-server";
import { env } from "@/lib/env";
import ClientSessionProbe from "./probe.client";

export const dynamic = "force-dynamic";

export default async function DebugAuthPage() {
  const cookieStore = cookies();
  const headerList = headers();
  const host = headerList.get("host") ?? "unknown";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";

  const cookieNames = cookieStore.getAll().map((c) => c.name);

  let serverUser: { id: string; email?: string | null } | null = null;
  let serverError: { message: string } | null = null;
  try {
    const { user } = await getAuthContext();
    serverUser = user ? { id: user.id, email: user.email } : null;
  } catch (e) {
    serverError = { message: e instanceof Error ? e.message : String(e) };
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Debug Auth</h1>

      <section className="p-4 border rounded-xl space-y-3">
        <h2 className="text-lg font-medium">Server</h2>
        <p
          data-testid="server-user"
          className={serverUser ? "text-green-700" : "text-red-700"}
        >
          {serverUser
            ? "Server sees user"
            : "Server does not see user"}
        </p>
        <div className="grid gap-1 text-sm">
          <div>
            Host: <code>{host}</code>
          </div>
          <div>
            Protocol: <code>{protocol}</code>
          </div>
          <div>
            APP_URL: <code>{env.appUrl}</code>
          </div>
          <div>
            Server user ID: <code>{serverUser?.id ?? "-"}</code>
          </div>
          <div>
            Server email: <code>{serverUser?.email ?? "-"}</code>
          </div>
          {serverError ? (
            <div className="text-red-600">
              Error: <code>{serverError.message}</code>
            </div>
          ) : null}
        </div>
      </section>

      <section className="p-4 border rounded-xl space-y-2">
        <h2 className="text-lg font-medium">Cookies</h2>
        <p className="text-sm text-muted-foreground">
          Cookie names seen on this request (values hidden):
        </p>
        <ul className="text-sm list-disc pl-5 space-y-1" data-testid="cookie-names">
          {cookieNames.length === 0 ? <li>None</li> : cookieNames.map((name) => <li key={name}>{name}</li>)}
        </ul>
      </section>

      <ClientSessionProbe
        cookieNames={cookieNames}
        serverUserId={serverUser?.id ?? null}
        serverUserEmail={serverUser?.email ?? null}
      />

      <section className="p-4 border rounded-xl space-y-2">
        <h2 className="text-lg font-medium">Tools</h2>
        <Link className="text-blue-600 underline" href="/auth/callback?code=dummy">
          Test callback (/auth/callback?code=dummy)
        </Link>
      </section>
    </div>
  );
}
