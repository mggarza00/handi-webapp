"use client";
import * as React from "react";

import ConfirmServiceButton from "@/components/services/ConfirmServiceButton";
import useCompletionReview from "@/app/(app)/_components/_hooks/useCompletionReview";
import type { Database } from "@/types/supabase";

type ServiceStatus = Database["public"]["Tables"]["agreements"]["Row"]["status"];

type Props = {
  agreementId: string;
  requestId: string;
  professionalId: string;
  clientId: string;
  viewerId: string;
  initialStatus: ServiceStatus | null;
  hasConfirmed: boolean;
  waitingFor: "cliente" | "profesional" | null;
  className?: string;
};

export default function ConfirmAndReview({
  agreementId,
  requestId,
  professionalId,
  clientId,
  viewerId,
  initialStatus,
  hasConfirmed,
  waitingFor,
  className,
}: Props) {
  const { modal, handleCompletionResponse } = useCompletionReview({
    requestId,
    reviewerRole: "pro",
    professionalId,
    clientId,
    status: initialStatus,
    viewerId,
  });

  return (
    <>
      <ConfirmServiceButton
        agreementId={agreementId}
        actor="pro"
        hasConfirmed={hasConfirmed}
        waitingFor={waitingFor}
        initialStatus={initialStatus}
        className={className}
        onCompleted={handleCompletionResponse}
      />
      {modal}
    </>
  );
}
