"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import FinishJobStepper from "@/components/services/FinishJobStepper.client";

type FinishJobTriggerProps = {
  requestId: string;
  requestTitle?: string | null;
  requestStatus?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  proId?: string | null;
  buttonLabel?: string;
  buttonVariant?: "default" | "outline" | "secondary" | "ghost";
  buttonClassName?: string;
  disabled?: boolean;
  onCompleted?: () => void;
};

export default function FinishJobTrigger({
  requestId,
  requestTitle,
  requestStatus,
  clientId,
  clientName,
  proId,
  buttonLabel = "Trabajo finalizado",
  buttonVariant = "default",
  buttonClassName,
  disabled,
  onCompleted,
}: FinishJobTriggerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        className={buttonClassName}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        {buttonLabel}
      </Button>
      <FinishJobStepper
        open={open}
        onOpenChange={setOpen}
        requestId={requestId}
        requestTitle={requestTitle}
        requestStatus={requestStatus}
        clientId={clientId}
        clientName={clientName}
        proId={proId}
        onCompleted={onCompleted}
      />
    </>
  );
}

