import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ViewerRole = "customer" | "professional" | "guest" | "client" | "pro";

type NextStepsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewerRole: ViewerRole;
};

export default function NextStepsDialog({
  open,
  onOpenChange,
  viewerRole,
}: NextStepsDialogProps) {
  const isProfessional = viewerRole === "professional" || viewerRole === "pro";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Que sigue?</DialogTitle>
        </DialogHeader>
        {isProfessional ? (
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>
              🛠 Cuando termines el servicio debes marcar el trabajo como
              finalizado desde el chat o desde tu calendario de trabajos.
            </li>
            <li>📸 Sube fotos del trabajo si es relevante.</li>
            <li>Califica al cliente.</li>
            <li>
              💸 Cuando el cliente confirme que el trabajo se realizó
              correctamente, HANDI liberará el pago.
            </li>
          </ul>
        ) : (
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>
              🛠 El profesional realizará el servicio en la fecha y horario
              agendados.
            </li>
            <li>
              Cuando termine, el profesional deberá marcar el trabajo como
              finalizado.
            </li>
            <li>
              Después solo tendrás que confirmar que el trabajo se realizó y
              calificar al profesional.
            </li>
            <li>🎉 Y listo!</li>
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
