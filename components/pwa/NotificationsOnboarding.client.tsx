"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { notificationsSupported } from "@/lib/pwa/install-detect";
import ensurePushSubscription from "@/lib/push";

const LS_KEY_SEEN = "handi:pwa:notify:onboarded";

type Props = {
  publicKey: string;
};

export default function NotificationsOnboarding({ publicKey }: Props) {
  const supported = useMemo(() => notificationsSupported(), []);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    try {
      const seen = localStorage.getItem(LS_KEY_SEEN) === "1";
      const perm = Notification.permission;
      if (!seen && perm === "default") setVisible(true);
    } catch {
      // If storage fails, still try to show once
      const perm = Notification.permission;
      if (perm === "default") setVisible(true);
    }
  }, [supported]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(LS_KEY_SEEN, "1"); } catch { /* ignore */ }
  }, []);

  const enable = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await ensurePushSubscription(publicKey);
      dismiss();
    } catch (err) {
      setError((err as Error)?.message || "No se pudo activar");
    } finally {
      setLoading(false);
    }
  }, [publicKey, dismiss]);

  if (!supported || !visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium">Activa las notificaciones</p>
          <p className="text-sm text-muted-foreground">Recibe avisos importantes aunque la app esté cerrada.</p>
        </div>
        <button aria-label="Cerrar" onClick={dismiss} className="ml-2 text-muted-foreground hover:text-foreground">×</button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={dismiss}>Más tarde</Button>
        <Button onClick={enable} disabled={loading}>{loading ? "Activando…" : "Activar"}</Button>
      </div>
    </div>
  );
}

