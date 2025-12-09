"use client";
import * as React from "react";

import ReviewModal from "../ReviewModal";

type Opts = {
  requestId: string;
  reviewerRole: "client" | "pro";
  professionalId?: string | null;
  clientId?: string | null;
  status?: string | null; // cuando sea "completed" abre el modal una vez
  viewerId?: string | null; // para llave de localStorage
  storageKeyPrefix?: string; // default: reviewed
  openOnCompleted?: boolean; // default: true
  setCompletedOnSubmit?: boolean; // default: true
};

type UseCompletionReview = {
  modal: React.ReactNode;
  open: () => void;
  close: () => void;
  hasShown: boolean;
  handleCompletionResponse: (json: unknown) => void;
};

function getStatusFrom(json: unknown): string | null {
  if (json && typeof json === "object") {
    const r = json as { status?: unknown; data?: { status?: unknown } };
    if (typeof r.status === "string") return r.status;
    if (r.data && typeof r.data.status === "string") return r.data.status;
  }
  return null;
}

export default function useCompletionReview(opts: Opts): UseCompletionReview {
  const {
    requestId,
    reviewerRole,
    professionalId,
    clientId,
    status,
    viewerId,
    storageKeyPrefix = "reviewed",
    openOnCompleted = true,
    setCompletedOnSubmit = true,
  } = opts;

  const [open, setOpen] = React.useState(false);
  const [hasShown, setHasShown] = React.useState(false);

  const storageKey = React.useMemo(() => {
    if (!viewerId) return null;
    return `${storageKeyPrefix}-${requestId}-${viewerId}`;
  }, [requestId, storageKeyPrefix, viewerId]);

  // Anti-reopen: abre automáticamente cuando pase a completed si no se ha mostrado
  React.useEffect(() => {
    if (!openOnCompleted) return;
    if (hasShown) return;
    if (status !== "completed") return;
    const flagged = (() => {
      try {
        return storageKey && typeof window !== "undefined" && localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    })();
    if (!flagged) {
      setOpen(true);
      setHasShown(true);
    }
  }, [status, openOnCompleted, storageKey, hasShown]);

  const handleClose = React.useCallback(() => setOpen(false), []);
  const handleOpen = React.useCallback(() => {
    setOpen(true);
    setHasShown(true);
  }, []);

  const handleSubmitted = React.useCallback(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, "1");
      } catch {
        // ignore
      }
    }
    // Best-effort: marcar completado al enviar reseña
    if (setCompletedOnSubmit && requestId) {
      try {
        void fetch(`/api/requests/${encodeURIComponent(requestId)}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ nextStatus: 'completed' }),
          credentials: 'include',
        });
      } catch { /* ignore */ }
    }
    setOpen(false);
    setHasShown(true);
  }, [storageKey, requestId, setCompletedOnSubmit]);

  const handleCompletionResponse = React.useCallback(
    (json: unknown) => {
      const s = getStatusFrom(json);
      if (s !== "completed") return;
      const flagged = (() => {
        try {
          return storageKey && typeof window !== "undefined" && localStorage.getItem(storageKey);
        } catch {
          return null;
        }
      })();
      if (!hasShown && !flagged) {
        setOpen(true);
        setHasShown(true);
      }
    },
    [hasShown, storageKey],
  );

  const modal = (
    <ReviewModal
      isOpen={open}
      onClose={handleClose}
      requestId={requestId}
      reviewerRole={reviewerRole}
      professionalId={professionalId}
      clientId={clientId}
      onSubmitted={handleSubmitted}
    />
  );

  return { modal, open: handleOpen, close: handleClose, hasShown, handleCompletionResponse };
}
