"use client";

import * as React from "react";

import ClientFeeDialog from "@/components/payments/ClientFeeDialog";

export type CommissionNoticeModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  amount?: number | null;
  currency?: string;
  onConfirm: () => void;
  confirmLabel?: string;
};

export default function CommissionNoticeModal({
  isOpen,
  onOpenChange,
  amount = null,
  currency = "MXN",
  onConfirm,
  confirmLabel = "Continuar al pago",
}: CommissionNoticeModalProps) {
  return (
    <ClientFeeDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      amount={amount ?? 0}
      currency={currency}
      onConfirm={onConfirm}
      confirmLabel={confirmLabel}
    />
  );
}
