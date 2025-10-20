"use client";

import * as React from "react";
import MapPicker from "@/components/address/MapPicker";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void | Promise<void>;
  withSearch?: boolean;
};

export default function MapPickerModal({ open, onOpenChange, lat, lng, onPick, withSearch = true }: Props) {

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[96vw] max-w-3xl rounded-lg bg-white shadow-lg overflow-hidden">
        <MapPicker
          lat={lat}
          lng={lng}
          withSearch={withSearch}
          onPick={async ({ lat: la, lng: ln }) => { await onPick(la, ln); onOpenChange(false); }}
        />
        <div className="flex items-center justify-end gap-2 p-3 border-t">
          <button className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800" onClick={() => onOpenChange(false)}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
