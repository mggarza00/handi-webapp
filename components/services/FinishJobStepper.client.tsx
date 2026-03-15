"use client";

import * as React from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import Stepper, { Step } from "@/components/react-bits/stepper/Stepper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const MAX_PHOTOS = 10;

type FinishJobStepperProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  requestTitle?: string | null;
  requestStatus?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  proId?: string | null;
  onCompleted?: () => void;
};

type ResolvedContext = {
  requestTitle: string | null;
  requestStatus: string | null;
  clientId: string | null;
  clientName: string | null;
  proId: string | null;
};

function normalizeStatus(value?: string | null): string | null {
  if (!value) return null;
  return String(value).toLowerCase();
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function FinishJobStepper({
  open,
  onOpenChange,
  requestId,
  requestTitle,
  requestStatus,
  clientId,
  clientName,
  proId,
  onCompleted,
}: FinishJobStepperProps) {
  const [stars, setStars] = React.useState(5);
  const [hover, setHover] = React.useState<number | null>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(1);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [context, setContext] = React.useState<ResolvedContext>({
    requestTitle: requestTitle ?? null,
    requestStatus: requestStatus ?? null,
    clientId: clientId ?? null,
    clientName: clientName ?? null,
    proId: proId ?? null,
  });

  const effectiveStars = typeof hover === "number" ? hover : stars;
  const previews = React.useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  React.useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  React.useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setFiles([]);
      setBusy(false);
      setStars(5);
      setHover(null);
      setComment("");
      return;
    }
    let cancelled = false;
    (async () => {
      const nextContext: ResolvedContext = {
        requestTitle: requestTitle ?? context.requestTitle ?? null,
        requestStatus: requestStatus ?? context.requestStatus ?? null,
        clientId: clientId ?? context.clientId ?? null,
        clientName: clientName ?? context.clientName ?? null,
        proId: proId ?? context.proId ?? null,
      };

      if (!nextContext.proId) {
        const me = await fetchJson<{ user?: { id?: string | null } }>(
          "/api/me",
          { cache: "no-store", credentials: "include" },
        );
        if (!cancelled && me?.user?.id) {
          nextContext.proId = me.user.id ?? null;
        }
      }

      if (
        !nextContext.clientId ||
        !nextContext.requestStatus ||
        !nextContext.requestTitle
      ) {
        const req = await fetchJson<{
          ok?: boolean;
          data?: {
            created_by?: string | null;
            status?: string | null;
            title?: string | null;
          };
        }>(`/api/requests/${encodeURIComponent(requestId)}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!cancelled && req?.data) {
          nextContext.clientId =
            nextContext.clientId ?? req.data.created_by ?? null;
          nextContext.requestStatus =
            nextContext.requestStatus ?? req.data.status ?? null;
          nextContext.requestTitle =
            nextContext.requestTitle ?? req.data.title ?? null;
        }
      }

      if (!nextContext.clientName && nextContext.clientId) {
        const profile = await fetchJson<{
          data?: { full_name?: string | null };
        }>(`/api/profiles/${encodeURIComponent(nextContext.clientId)}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!cancelled) {
          nextContext.clientName =
            profile?.data?.full_name ?? nextContext.clientName ?? null;
        }
      }

      if (!cancelled) setContext(nextContext);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requestId]);

  const handleFiles = React.useCallback((incoming: FileList | null) => {
    const list = Array.from(incoming ?? []);
    if (!list.length) return;
    setFiles((prev) => {
      const merged = [...prev, ...list];
      if (merged.length > MAX_PHOTOS) {
        toast.error(`Selecciona hasta ${MAX_PHOTOS} fotos.`);
        return prev;
      }
      return merged;
    });
  }, []);

  const removeFileAt = React.useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const ensureInProcess = React.useCallback(async () => {
    const status = normalizeStatus(context.requestStatus);
    if (status !== "scheduled") return;
    try {
      await fetch(`/api/requests/${encodeURIComponent(requestId)}/status`, {
        method: "PATCH",
        headers: JSONH,
        credentials: "include",
        body: JSON.stringify({ nextStatus: "in_process" }),
      });
      setContext((prev) => ({ ...prev, requestStatus: "in_process" }));
    } catch {
      /* ignore */
    }
  }, [context.requestStatus, requestId]);

  const uploadPhotos = React.useCallback(async () => {
    if (!files.length) return;
    let proUserId = context.proId;
    if (!proUserId) {
      try {
        const meRes = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const meJson = await meRes.json().catch(() => ({}));
        if (meRes.ok && meJson?.user?.id) {
          proUserId = meJson.user.id as string;
          setContext((prev) => ({ ...prev, proId: proUserId }));
        }
      } catch {
        /* ignore */
      }
      if (!proUserId) {
        throw new Error("Falta el profesional asignado.");
      }
    }
    const keys: string[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const safeName = sanitizeFilename(file.name || `foto-${i + 1}`);
      const path = `${proUserId}/${requestId}/${Date.now()}-${i}-${safeName}`;
      const presignRes = await fetch("/api/storage/presign", {
        method: "POST",
        headers: JSONH,
        credentials: "include",
        body: JSON.stringify({ path }),
      });
      const presignJson = await presignRes.json().catch(() => ({}));
      if (!presignRes.ok || !presignJson?.url) {
        throw new Error(
          presignJson?.detail ||
            presignJson?.error ||
            "No se pudo preparar la carga de fotos.",
        );
      }
      const uploadRes = await fetch(presignJson.url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error("No se pudo subir una de las fotos.");
      }
      keys.push(path);
    }
    const res = await fetch(
      `/api/requests/${encodeURIComponent(requestId)}/photos`,
      {
        method: "POST",
        headers: JSONH,
        credentials: "include",
        body: JSON.stringify({ keys }),
      },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      throw new Error(
        json?.detail || json?.error || "No se pudieron guardar las fotos",
      );
    }
  }, [context.proId, files, requestId]);

  const submitReview = React.useCallback(async () => {
    if (!context.clientId) throw new Error("Falta el cliente a calificar.");
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: JSONH,
      credentials: "include",
      body: JSON.stringify({
        requestId,
        reviewerRole: "pro",
        rating: stars,
        clientId: context.clientId,
        comment: comment.trim() || undefined,
      }),
    });
    if (res.ok) return;
    const json = await res.json().catch(() => ({}));
    if (json?.error === "DUPLICATE_REVIEW") return;
    throw new Error(
      json?.detail || json?.error || "No se pudo guardar la reseña",
    );
  }, [comment, context.clientId, requestId, stars]);

  const notifyFinish = React.useCallback(async () => {
    const res = await fetch(
      `/api/requests/${encodeURIComponent(requestId)}/finish`,
      {
        method: "POST",
        headers: JSONH,
        credentials: "include",
        body: JSON.stringify({
          clientId: context.clientId,
          proId: context.proId,
        }),
      },
    );
    if (res.ok) return;
    const json = await res.json().catch(() => ({}));
    throw new Error(
      json?.detail || json?.error || "No se pudo notificar al cliente",
    );
  }, [context.clientId, context.proId, requestId]);

  const handleSubmit = React.useCallback(async () => {
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      toast.error("Selecciona una calificación válida (1 a 5).");
      return false;
    }
    if (files.length > MAX_PHOTOS) {
      toast.error(`Selecciona hasta ${MAX_PHOTOS} fotos.`);
      return false;
    }
    setBusy(true);
    try {
      await ensureInProcess();
      if (files.length > 0) {
        await uploadPhotos();
      }
      await submitReview();
      await notifyFinish();
      toast.success("Trabajo finalizado. El cliente ya puede confirmar.");
      onOpenChange(false);
      onCompleted?.();
      setFiles([]);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo finalizar";
      toast.error(msg);
      return false;
    } finally {
      setBusy(false);
    }
  }, [
    ensureInProcess,
    files,
    notifyFinish,
    onCompleted,
    onOpenChange,
    stars,
    submitReview,
    uploadPhotos,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Trabajo finalizado</DialogTitle>
          <DialogDescription>
            Registra la calificación y las evidencias para cerrar el trabajo.
          </DialogDescription>
        </DialogHeader>
        <Stepper
          stepCircleContainerClassName="max-w-2xl border border-border bg-background"
          contentClassName="px-6 py-6"
          footerClassName="px-6 pb-8"
          initialStep={1}
          currentStepOverride={currentStep}
          onStepChange={setCurrentStep}
          nextButtonText="Siguiente"
          backButtonText="Atrás"
          finalButtonText={busy ? "Procesando..." : "Finalizar"}
          onBeforeNextStep={() => {
            if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
              toast.error("Selecciona una calificación válida.");
              return false;
            }
            return true;
          }}
          onBeforeComplete={handleSubmit}
          disableStepIndicators={busy}
          nextButtonProps={{ disabled: busy }}
          backButtonProps={{ disabled: busy }}
        >
          <Step label="Calificación">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-700">Califica a</p>
                <p className="text-lg font-semibold text-slate-900">
                  {context.clientName || "Cliente"}
                </p>
              </div>
              <div className="select-none text-3xl leading-none">
                {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={
                      (effectiveStars >= n
                        ? "text-amber-500"
                        : "text-slate-300") +
                      " cursor-pointer align-middle transition-colors"
                    }
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setStars(n)}
                    aria-label={`Elegir ${n} estrella${n > 1 ? "s" : ""}`}
                  >
                    {effectiveStars >= n ? "\u2605" : "\u2606"}
                  </button>
                ))}
                <span className="ml-2 align-middle text-sm text-slate-600">
                  {effectiveStars} / 5
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Esta calificación solo la verá el cliente.
              </p>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">
                  Comentarios (opcional)
                </p>
                <Textarea
                  placeholder="Ej. Detalles del trabajo realizado"
                  maxLength={400}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
                <div className="text-xs text-slate-500">
                  {comment.length} / 400
                </div>
              </div>
            </div>
          </Step>
          <Step label="Fotos">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Sube fotos del trabajo
                </p>
                <p className="text-xs text-slate-500">
                  Máximo {MAX_PHOTOS} imágenes.
                </p>
              </div>
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept="image/*"
                multiple
                disabled={busy}
                onChange={(e) => {
                  handleFiles(e.currentTarget.files);
                  e.currentTarget.value = "";
                }}
                data-testid="finish-job-photos"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  Subir fotos
                </Button>
                {!files.length ? (
                  <span className="text-xs text-slate-500">
                    No has subido fotos (opcional).
                  </span>
                ) : null}
              </div>
              {previews.length ? (
                <div className="flex flex-wrap gap-2">
                  {previews.map((p, idx) => (
                    <div
                      key={`${p.file.name}-${p.file.lastModified}-${idx}`}
                      className="group relative h-20 w-20 overflow-hidden rounded-md border border-slate-200 bg-white"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={p.file.name}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeFileAt(idx)}
                        className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        title="Eliminar foto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </Step>
        </Stepper>
      </DialogContent>
    </Dialog>
  );
}
