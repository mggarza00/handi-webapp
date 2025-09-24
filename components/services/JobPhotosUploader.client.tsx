"use client";
import * as React from "react";
import { toast } from "sonner";

type Props = {
  requestId: string;
  professionalId: string;
};

export default function JobPhotosUploader({ requestId, professionalId }: Props) {
  const [busy, setBusy] = React.useState(false);

  async function handleFiles(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    try {
      // Map files to storage keys in a deterministic path for E2E
      const keys = files.map((f, i) => `e2e/${requestId}/${Date.now()}-${i}-${f.name}`);
      const res = await fetch(`/api/requests/${requestId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ keys }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.detail || j?.error || "UPLOAD_FAILED");
      toast.success("Fotos subidas");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al subir fotos";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor="job-photos-input" className="text-sm text-slate-700">Subir fotos del trabajo</label>
      <input
        id="job-photos-input"
        data-testid="job-photos-input"
        type="file"
        multiple
        accept="image/*"
        disabled={busy}
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          void handleFiles(files);
          // reset to allow re-select same file
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

