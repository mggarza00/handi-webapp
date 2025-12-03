"use client";

import * as React from "react";

import NewRequestStepperModal from "@/components/requests/NewRequestStepperModal";

export const OPEN_EVENT = "homaid:create-request";

export default function CreateRequestWizardRoot() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function handler() {
      setOpen(true);
    }
    window.addEventListener(OPEN_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(OPEN_EVENT, handler as EventListener);
    };
  }, []);

  return (
    <NewRequestStepperModal
      open={open}
      onOpenChange={setOpen}
    />
  );
}

export function openCreateRequestWizard() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}
