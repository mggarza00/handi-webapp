"use client";

import { useState } from "react";
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
  requestId: string;
  toUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: () => void;
  viewerRole: "pro" | "client";
};

const MAX_COMMENT = 400;
const RATING_OPTIONS = [5, 4, 3, 2, 1];

export default function RatingModal({
  requestId,
  toUserId,
  isOpen,
  onClose,
  onSubmit,
  viewerRole,
}: Props) {
  const [stars, setStars] = useState<number>(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      toast.error("Selecciona una calificaci�n v�lida.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          request_id: requestId,
          reviewer_role: viewerRole,
          rating: stars,
          comment: comment.trim() || undefined,
          // If reviewer is client, we must specify the pro being reviewed
          professional_id: viewerRole === "client" ? toUserId : undefined,
        }),
      });

      if (!res.ok) {
        toast.error("No se pudo guardar la calificación");
        return;
      }

      toast.success("Calificación enviada");
      onSubmit?.();
      setStars(5);
      setComment("");
      onClose();
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Error al intentar calificar.";
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Califica este servicio</DialogTitle>
          <DialogDescription>
            Comparte c�mo fue tu experiencia en este servicio.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="rating-select">Calificación (1 a 5 estrellas)</Label>
            <select
              id="rating-select"
              className="w-full rounded border px-2 py-2 text-sm"
              value={stars}
              onChange={(event) => setStars(Number(event.target.value))}
              disabled={loading}
            >
              {RATING_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value} estrella{value > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rating-comment">Comentario</Label>
            <Textarea
              id="rating-comment"
              value={comment}
              onChange={(event) => {
                const value = event.target.value;
                if (value.length <= MAX_COMMENT) {
                  setComment(value);
                }
              }}
              placeholder="¿Cómo fue tu experiencia?"
              rows={4}
              disabled={loading}
            />
            <div className="text-right text-xs text-slate-500">
              {comment.length}/{MAX_COMMENT}
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4 flex flex-col gap-2">
          <Button
            onClick={submit}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Enviando" : "Enviar calificación"}
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
