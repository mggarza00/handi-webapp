"use client";

import type React from "react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type RoleOption = "client" | "pro";

type RoleSelectionDialogProps = {
  triggerLabel?: string;
  triggerClassName?: string;
  triggerShowCircle?: boolean;
};

const ROLE_OPTIONS: Array<{
  key: RoleOption;
  title: string;
  subtitle: string;
}> = [
  {
    key: "client",
    title: "Soy un cliente",
    subtitle: "busco solucionar un problema",
  },
  {
    key: "pro",
    title: "Soy un profesional",
    subtitle: "quiero trabajar con Handi",
  },
];

export default function RoleSelectionDialog({
  triggerLabel = "Comenzar",
  triggerClassName,
  triggerShowCircle = false,
}: RoleSelectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleOption>("client");
  const router = useRouter();

  const handleSelect = useCallback((role: RoleOption) => {
    setSelectedRole(role);
  }, []);

  const handleContinue = useCallback(() => {
    const role = selectedRole;
    if (!role) return;

    try {
      document.cookie = `handi_pre_role=${role}; path=/; max-age=${60 * 60}; samesite=lax`;
    } catch {
      // Ignore cookie write errors
    }

    if (role === "pro") {
      router.push("/auth/sign-in?next=%2Fpro-apply&toast=pro-apply");
    } else {
      const search = new URLSearchParams({ role }).toString();
      router.push(`/auth/sign-in?${search}`);
    }
  }, [router, selectedRole]);

  const handleKeyDown = useCallback(
    (role: RoleOption) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        handleSelect(role);
      }
    },
    [handleSelect],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className={cn(triggerClassName)}>
          {triggerLabel}
          {triggerShowCircle && <span className="btn-circle" aria-hidden="true" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md w-full rounded-2xl p-6 sm:p-7">
        <DialogHeader className="gap-1">
          <DialogTitle className="text-[#024E61]">
            Elige cómo quieres usar Handi
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Cuéntanos si vienes a buscar ayuda o a ofrecer tus servicios.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ROLE_OPTIONS.map((option) => {
            const isSelected = selectedRole === option.key;
            return (
              <button
                key={option.key}
                type="button"
                className={cn(
                  "w-full text-left rounded-2xl border p-4 sm:p-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#082877] h-full",
                  isSelected
                    ? "border-[#082877] bg-[#082877]/5"
                    : "border-slate-200 bg-white hover:bg-slate-50",
                )}
                onClick={() => handleSelect(option.key)}
                onKeyDown={handleKeyDown(option.key)}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-300">
                    {isSelected && (
                      <span className="h-2.5 w-2.5 rounded-full bg-[#082877]" />
                    )}
                  </span>
                  <span className="space-y-1">
                    <span className="block font-sans text-base font-semibold text-[#024E61]">
                      {option.title}
                    </span>
                    <span className="block text-sm text-slate-600">
                      {option.subtitle}
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            type="button"
            className="h-11 w-full rounded-full bg-[#082877] text-sm font-semibold text-white hover:bg-[#061d58] sm:h-12"
            onClick={handleContinue}
          >
            {selectedRole === "client"
              ? "Crear una cuenta de cliente"
              : "Crear cuenta de profesional"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
