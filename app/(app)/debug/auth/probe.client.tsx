"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

import type { Session } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Props = {
  cookieNames: string[];
  serverUserId: string | null;
  serverUserEmail: string | null;
};

type SessionDetails = {
  expiresAt: number | null;
  expiresIn: number | null;
  userId: string | null;
};

export default function ClientSessionProbe({
  cookieNames,
  serverUserId,
  serverUserEmail,
}: Props) {
  const supabase = useMemo(() => createSupabaseBrowser<Database>(), []);
  const [origin, setOrigin] = useState<string>("");
  const [clientCookies, setClientCookies] = useState<string[]>([]);
  const [clientUserEmail, setClientUserEmail] = useState<string | null>(null);
  const [clientUserId, setClientUserId] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionDetails | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    setOrigin(window.location.origin);
    const names = document.cookie
      .split(";")
      .map((entry) => entry.trim().split("=")[0])
      .filter((name) => name.length > 0);
    setClientCookies(names);

    const syncFromSession = (session: Session | null) => {
      setClientUserEmail(session?.user?.email ?? null);
      setClientUserId(session?.user?.id ?? null);
      setSessionInfo({
        expiresAt: session?.expires_at ?? null,
        expiresIn: session?.expires_in ?? null,
        userId: session?.user?.id ?? null,
      });
      setStatus(session?.user ? "authenticated" : "unauthenticated");
    };

    supabase.auth.getSession().then(({ data }) => {
      syncFromSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") {
        console.info("[auth-debug] onAuthStateChange", event);
      }
      if (process.env.NODE_ENV !== "production" && session?.expires_at) {
        const drift = Math.abs(session.expires_at * 1000 - Date.now());
        if (drift > 120_000) {
          console.warn("[auth-debug] local time drift > 2 minutes", {
            driftMs: drift,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            expiresAt: session.expires_at,
          });
        }
      }
      syncFromSession(session);
    });

    return () => listener?.subscription.unsubscribe();
  }, [supabase]);

  const hasServer = Boolean(serverUserId);
  const hasClient = Boolean(clientUserId);
  const semaforoClass = hasServer && hasClient ? "text-green-700" : "text-red-700";
  const semaforoText = hasServer && hasClient
    ? "Server and client see a session"
    : "Session missing on server or client";

  const sessionJson = JSON.stringify(sessionInfo, null, 2);
  const effectiveCookies = clientCookies.length > 0 ? clientCookies : cookieNames;

  return (
    <section className="p-4 border rounded-xl space-y-3">
      <h2 className="text-lg font-medium">Client</h2>
      <p className={semaforoClass} data-testid="client-status">
        {semaforoText}
      </p>
      <div className="grid gap-1 text-sm">
        <div>
          Document origin: <code>{origin || "loading..."}</code>
        </div>
        <div>
          Server email (prop): <code>{serverUserEmail ?? "-"}</code>
        </div>
        <div>
          Client email: <code>{clientUserEmail ?? "-"}</code>
        </div>
        <div>
          Auth status: <code>{status}</code>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div>Session (sanitized):</div>
        <pre className="bg-muted rounded p-2 text-xs overflow-x-auto" data-testid="client-session">
          {sessionJson}
        </pre>
      </div>
      <div className="space-y-1 text-sm">
        <div>Cookie names (client view):</div>
        <ul className="list-disc pl-5">
          {effectiveCookies.length === 0 ? (
            <li>None</li>
          ) : (
            effectiveCookies.map((name) => <li key={`client-cookie-${name}`}>{name}</li>)
          )}
        </ul>
      </div>
    </section>
  );
}
