"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";

import NewRequestStepperModal from "@/components/requests/NewRequestStepperModal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Address = {
  label?: string | null;
  address_line: string;
  address_place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type HeroClientActionsProps = {
  ctaLabel?: string;
  addresses?: Address[];
  selectedAddress?: Address | null;
  onAddressChange?: (addr: Address | null) => void;
  triggerClassName?: string;
  addressPillClassName?: string;
  showButton?: boolean;
  showPill?: boolean;
};

export default function HeroClientActions({
  ctaLabel = "Solicitar un servicio",
  addresses = [],
  selectedAddress = null,
  onAddressChange,
  triggerClassName,
  addressPillClassName,
  showButton = true,
  showPill = true,
}: HeroClientActionsProps) {
  const [open, setOpen] = useState(false);
  const [addrOpen, setAddrOpen] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<Address | null>(
    selectedAddress ?? addresses[0] ?? null,
  );

  useEffect(() => {
    if (selectedAddress) {
      setCurrentAddress(selectedAddress);
      return;
    }
    if (!currentAddress && addresses.length > 0) {
      setCurrentAddress(addresses[0]);
    }
  }, [addresses, currentAddress, selectedAddress]);

  const initialAddressForStepper = useMemo(() => {
    if (!currentAddress) return undefined;
    return {
      address: currentAddress.address_line,
      lat: currentAddress.lat ?? null,
      lon: currentAddress.lng ?? null,
    };
  }, [currentAddress]);

  const pillLabel = currentAddress?.label?.trim()
    ? currentAddress.label
    : currentAddress?.address_line || "Agregar dirección";

  const hasAddresses = addresses.length > 0;

  const handleSelectAddress = (addr: Address) => {
    setCurrentAddress(addr);
    onAddressChange?.(addr);
    setAddrOpen(false);
  };

  return (
    <>
      {showButton ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <button
            type="button"
            className={cn(
              "btn-contratar whitespace-nowrap px-7 sm:px-8 md:px-10 !w-auto min-w-[200px] sm:min-w-[220px]",
              triggerClassName,
            )}
            onClick={() => setOpen(true)}
          >
            {ctaLabel}
            <span className="btn-circle" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {showPill && hasAddresses ? (
        <Popover open={addrOpen} onOpenChange={setAddrOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "group inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/70 px-4 py-2 text-sm font-medium text-[#0C2555] shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0C2555]",
                addressPillClassName,
              )}
            >
              <Image
                src="/icons/loc_icon.svg"
                alt=""
                width={18}
                height={18}
                className="h-4 w-4 [filter:brightness(0)_saturate(100%)_invert(14%)_sepia(80%)_saturate(1928%)_hue-rotate(200deg)_brightness(93%)_contrast(92%)]"
              />
              <span className="max-w-[12rem] truncate text-left sm:max-w-[16rem]">
                {pillLabel}
              </span>
              <ChevronDown className="h-4 w-4 text-[#0C2555]" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-2">
            <div className="space-y-1">
              {addresses.map((addr, idx) => (
                <button
                  key={`${addr.address_place_id || addr.address_line}-${idx}`}
                  type="button"
                  onClick={() => handleSelectAddress(addr)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition hover:bg-slate-50",
                    currentAddress?.address_line === addr.address_line
                      ? "bg-slate-100 text-slate-900"
                      : "",
                  )}
                >
                  <Image
                    src="/icons/loc_icon.svg"
                    alt=""
                    width={16}
                    height={16}
                    className="mt-0.5 h-4 w-4 [filter:brightness(0)_saturate(100%)_invert(14%)_sepia(80%)_saturate(1928%)_hue-rotate(200deg)_brightness(93%)_contrast(92%)]"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-900">
                      {addr.label || "Dirección guardada"}
                    </span>
                    <span className="text-xs text-slate-600">
                      {addr.address_line}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      <NewRequestStepperModal
        open={open}
        onOpenChange={setOpen}
        initialAddress={initialAddressForStepper}
      />
    </>
  );
}
