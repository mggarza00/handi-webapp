"use client";
import * as React from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
  reviewerRole: "client" | "pro";
  // Si el revisor es cliente, debe proveerse el profesional a calificar
  professionalId?: string | null;
  // Opcional: si el revisor es pro, se puede enviar el clientId (se valida contra la solicitud)
  clientId?: string | null;
  onSubmitted?: () => void;
};

const MAX_COMMENT = 400;

export default function ReviewModal({
  isOpen,
  onClose,
  requestId,
  reviewerRole,
  professionalId,
  clientId,
  onSubmitted,
}: Props) {
  const [stars, setStars] = React.useState<number>(5);
  const [hover, setHover] = React.useState<number | null>(null);
  const [comment, setComment] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(false);

  const effective = typeof hover === "number" ? hover : stars;

  async function handleSubmit() {
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      toast.error("Selecciona una calificación válida (1 a 5).");
      return;
    }
    if (reviewerRole === "client" && !professionalId) {
      toast.error("Falta el profesional a calificar.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          requestId,
          reviewerRole,
          rating: stars,
          comment: comment.trim() || undefined,
          professionalId: reviewerRole === "client" ? professionalId : undefined,
          clientId: reviewerRole === "pro" ? clientId ?? undefined : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        const msg = j?.detail || j?.error || "No se pudo guardar la reseña";
        toast.error(String(msg));
        return;
      }
      toast.success("¡Gracias por tu reseña!");
      onSubmitted?.();
      setStars(5);
      setHover(null);
      setComment("");
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al enviar la reseña";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Deja tu reseña</DialogTitle>
          <DialogDescription>
            Valora tu experiencia y deja un comentario opcional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Calificación</Label>
            <div className="select-none text-2xl leading-none">
              {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
                // eslint-disable-next-line jsx-a11y/interactive-supports-focus
                <span
                  key={n}
                  role="button"
                  aria-label={`Elegir ${n} estrella${n > 1 ? "s" : ""}`}
                  className={
                    (effective >= n ? "text-amber-500" : "text-slate-300") +
                    " cursor-pointer align-middle transition-colors"
                  }
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setStars(n)}
                >
                  {effective >= n ? "★" : "☆"}
                </span>
              ))}
              <span className="ml-2 align-middle text-sm text-slate-600">
                {effective} / 5
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-comment">Comentario (opcional)</Label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(e) => {
                const v = e.target.value;
                if (v.length <= MAX_COMMENT) setComment(v);
              }}
              rows={4}
              placeholder="¿Cómo fue tu experiencia?"
              disabled={loading}
            />
            <div className="text-right text-xs text-slate-500">
              {comment.length}/{MAX_COMMENT}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2 grid grid-cols-1 gap-2">
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? "Enviando…" : "Enviar reseña"}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="w-full"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

