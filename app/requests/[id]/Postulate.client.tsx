"use client";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = { requestId: string };

export default function PostulateClient({ requestId }: Props) {
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ request_id: requestId, note: note.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error || json?.detail || "No fue posible postularse";
        toast.error(msg);
        return;
      }
      toast.success("Te postulaste a la solicitud");
      setNote("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "UNKNOWN";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="space-y-1.5">
        <Label>Nota para el cliente (opcional)</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Hola, tengo experiencia en trabajos similares…"
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Enviando…" : "Postularme"}
      </Button>
    </form>
  );
}

