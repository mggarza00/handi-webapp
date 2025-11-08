"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function EmailNotificationsToggle() {
  const [enabled, setEnabled] = React.useState<boolean>(true);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [confirmOpen, setConfirmOpen] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState<boolean>(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me/email-notifications', { cache: 'no-store', credentials: 'include' });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; enabled?: boolean };
        if (!cancelled) setEnabled(Boolean(json?.enabled !== false));
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function apply(enabledNext: boolean) {
    setSaving(true);
    try {
      await fetch('/api/me/email-notifications', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ enabled: enabledNext }),
      });
      setEnabled(enabledNext);
    } catch { /* ignore */ }
    setSaving(false);
  }

  function onToggle() {
    if (loading || saving) return;
    if (enabled) {
      setConfirmOpen(true);
    } else {
      void apply(true);
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-medium">Notificaciones por correo</div>
        <div className="text-sm text-muted-foreground">Recibe correos cuando te escriban en el chat.</div>
      </div>
      <div>
        <Button onClick={onToggle} disabled={loading || saving} variant={enabled ? 'default' : 'outline'}>
          {enabled ? 'Activas' : 'Desactivadas'}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desactivar notificaciones por correo</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Dejarás de recibir notificaciones por correo cuando un usuario te escriba a través del chat. ¿Seguro que deseas desactivar?
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => { await apply(false); setConfirmOpen(false); }} disabled={saving}>
              {saving ? 'Desactivando…' : 'Desactivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

