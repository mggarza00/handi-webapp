"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Database } from "@/types/supabase";

type ServiceStatus = Database["public"]["Tables"]["agreements"]["Row"]["status"];

type Props = {
  agreementId: string;
  actor?: "pro" | "client";
  hasConfirmed?: boolean;
  waitingFor?: "cliente" | "profesional" | null;
  initialStatus?: ServiceStatus | null;
  className?: string;
  onCompleted?: (json: {
    ok?: boolean;
    agreement?: Database["public"]["Tables"]["agreements"]["Row"] | null;
    waitingFor?: "cliente" | "profesional" | null;
    message?: string;
    actor?: "pro" | "client";
    alreadyConfirmed?: boolean;
    operation?: "complete" | "confirm";
    method?: "POST" | "PUT";
    error?: string;
    detail?: string;
  }) => void;
};

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Debes iniciar sesion para confirmar el servicio.",
  FORBIDDEN: "No tienes permisos para confirmar este servicio.",
  SERVICE_NOT_FOUND: "No encontramos el servicio.",
  STATUS_BLOCKED: "El servicio no admite confirmaciones en su estado actual.",
  UPDATE_FAILED: "No pudimos guardar la confirmacion.",
};

export default function ConfirmServiceButton({
  agreementId,
  actor = "pro",
  hasConfirmed = false,
  waitingFor = null,
  initialStatus = null,
  className,
  onCompleted,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(Boolean(hasConfirmed));
  const [status, setStatus] = useState<ServiceStatus | null>(
    initialStatus ?? null,
  );

  const disabled = pending || confirmed || status === "completed";

  const label = confirmed
    ? "Confirmado"
    : pending
      ? "Confirmando..."
      : "Confirmar servicio";

  const handleClick = () => {
    if (disabled) return;

    startTransition(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/services/${agreementId}/complete`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=utf-8",
            },
            body: JSON.stringify({ actor }),
            cache: "no-store",
          });
          const json = await res
            .json()
            .catch(() => ({ ok: false, error: "INVALID_RESPONSE" }));

          if (!res.ok || !json?.ok) {
            const code =
              json && typeof json.error === "string" ? json.error : null;
            const detail =
              (code && ERROR_MESSAGES[code]) ||
              "No se pudo confirmar el servicio.";
            toast.error(detail);
            return;
          }

          const agreement = json.agreement as
            | {
                status?: ServiceStatus | null;
                completed_by_pro?: boolean | null;
                completed_by_client?: boolean | null;
              }
            | null;

          const nextStatus =
            (agreement?.status as ServiceStatus | null) ?? status ?? null;
          const nextConfirmed = Boolean(
            actor === "pro"
              ? agreement?.completed_by_pro
              : agreement?.completed_by_client,
          );
          const rawWaiting = (json.waitingFor ?? null) as typeof waitingFor;
          const nextWaiting =
            nextStatus === "completed" ? null : rawWaiting ?? waitingFor;

          setStatus(nextStatus);
          setConfirmed(nextConfirmed);

          const responseMessage =
            typeof json.message === "string" && json.message.trim().length > 0
              ? json.message
              : nextWaiting
                ? `Esperando confirmacion del ${nextWaiting}.`
                : "Servicio finalizado por ambas partes.";

          toast.success(responseMessage);
          try {
            onCompleted?.(json as unknown as {
              ok?: boolean;
              agreement?: Database["public"]["Tables"]["agreements"]["Row"] | null;
              waitingFor?: "cliente" | "profesional" | null;
              message?: string;
              actor?: "pro" | "client";
              alreadyConfirmed?: boolean;
              operation?: "complete" | "confirm";
              method?: "POST" | "PUT";
              error?: string;
              detail?: string;
            });
          } catch {
            // ignore callback errors to not block UX
          }
          router.refresh();
        } catch {
          toast.error("Ocurrio un error al confirmar el servicio.");
        }
      })();
    });
  };

  return (
    <Button
      className={className}
      disabled={pending || confirmed}
      aria-busy={pending}
      onClick={handleClick}
      data-testid="mark-complete"
    >
      {label}
    </Button>
  );
}


