"use client";

import * as React from "react";

import AddressMapPickerModal, {
  type Payload as AddressMapPayload,
} from "@/components/address/MapPickerModal";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void | Promise<void>;
  withSearch?: boolean;
};

export default function MapPickerModal({
  open,
  onOpenChange,
  lat,
  lng,
  onPick,
  withSearch: _withSearch = true, // preserved for backward compatibility
}: Props) {
  if (!open) return null;

  const handleConfirm = async (payload: AddressMapPayload) => {
    await onPick(payload.lat, payload.lng);
    onOpenChange(false);
  };

  return (
    <AddressMapPickerModal
      open={open}
      onClose={() => onOpenChange(false)}
      initial={{
        lat: typeof lat === "number" ? lat : undefined,
        lng: typeof lng === "number" ? lng : undefined,
      }}
      onConfirm={handleConfirm}
    />
  );
}
