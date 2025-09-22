"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

function Button({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void | Promise<void>;
  variant?: "default" | "destructive" | "outline";
}) {
  const base =
    "inline-flex items-center gap-2 rounded-md border text-sm px-3 py-1.5";
  const styles =
    variant === "destructive"
      ? "border-red-600 text-white bg-red-600 hover:bg-red-700"
      : variant === "outline"
        ? "border-slate-300 text-slate-800 hover:bg-slate-50"
        : "border-slate-900 text-white bg-slate-900 hover:bg-slate-800";
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

async function getMe(): Promise<{ ok: boolean; user: { id: string; email?: string | null } | null }> {
  try {
    const res = await fetch("/api/me", { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, user: null } as const;
  }
}

type LatestAppOk = { ok: true; data: { id: string; status: string } | null };
type LatestAppErr = { ok: false; error: string };

async function getLatestApplication(userId: string): Promise<LatestAppOk | LatestAppErr> {
  try {
    const res = await fetch(`/api/admin/pro-applications/by-user/${userId}`, {
      cache: "no-store",
    });
    return (await res.json()) as never;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function setStatus(applicationId: string, status: "accepted" | "rejected"): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/pro-applications/${applicationId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function AdminProDecision({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [application, setApplication] = React.useState<{
    id: string;
    status: string;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      setError(null);
      const me = await getMe();
      if (!me.ok || !me.user) {
        if (!abort) setIsAdmin(false);
        setLoading(false);
        return;
      }
      const latest = await getLatestApplication(userId);
      if (!abort) {
        if (latest.ok) {
          setIsAdmin(true);
          setApplication(latest.data);
        } else {
          setIsAdmin(false);
        }
      }
      setLoading(false);
    })();
    return () => {
      abort = true;
    };
  }, [userId]);

  if (loading || !isAdmin) return null;
  if (!application) return null;
  if (application.status !== "pending") return null;

  async function onDecision(next: "accepted" | "rejected") {
    if (!application) return;
    setLoading(true);
    const ok = await setStatus(application.id, next);
    setLoading(false);
    if (ok) {
      setApplication({ ...application, status: next });
      router.refresh();
    } else {
      setError("No se pudo actualizar el estado. Intenta de nuevo.");
    }
  }

  return (
    <div className="rounded-md border bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm text-slate-700">Solicitud profesional en revisión</p>
          {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => onDecision("rejected")}>Rechazar solicitud</Button>
          <Button onClick={() => onDecision("accepted")}>Aceptar solicitud</Button>
        </div>
      </div>
    </div>
  );
}
