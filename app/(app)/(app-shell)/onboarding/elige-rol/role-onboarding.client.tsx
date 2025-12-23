"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type RoleOption = "cliente" | "profesional";

type Props = {
  name: string;
  email: string | null;
  next: string;
  preselectedRole: RoleOption | null;
  toastKey?: string;
};

const OPTIONS: Array<{
  key: RoleOption;
  title: string;
  subtitle: string;
}> = [
  {
    key: "cliente",
    title: "Soy un cliente",
    subtitle: "busco solucionar un problema",
  },
  {
    key: "profesional",
    title: "Soy un profesional",
    subtitle: "quiero trabajar con Handi",
  },
];

function buildDestination(next: string, toastKey?: string | null) {
  if (typeof next !== "string" || !next.startsWith("/")) return "/";
  if (!toastKey) return next;
  try {
    const url = new URL(next, "http://handi.local");
    if (!url.searchParams.has("toast")) {
      url.searchParams.set("toast", toastKey);
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return next;
  }
}

export default function RoleOnboarding({
  name,
  email,
  next,
  preselectedRole,
  toastKey,
}: Props) {
  const [selected, setSelected] = useState<RoleOption>(
    preselectedRole || "cliente",
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!preselectedRole) return;
    setSelected(preselectedRole);
  }, [preselectedRole]);

  useEffect(() => {
    if (!toastKey) return;
    if (toastKey === "pro-apply") {
      toast.info('Selecciona "Profesional" para continuar con tu postulación.');
    } else if (toastKey === "new-request") {
      toast.info('Selecciona "Cliente" para crear tu solicitud.');
    }
  }, [toastKey]);

  const selectedCopy = useMemo(
    () =>
      selected === "cliente"
        ? "Usarás Handi como cliente"
        : "Usarás Handi como profesional",
    [selected],
  );

  async function handleContinue() {
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await fetch("/api/profile/active-user-type", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ to: selected }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.detail || j?.error || "No se pudo guardar tu rol");
      }
      try {
        document.cookie = "handi_pre_role=; path=/; max-age=0; samesite=lax";
      } catch {
        /* ignore cookie delete errors */
      }
      toast.success(selectedCopy);
      const destination = buildDestination(next, toastKey);
      router.replace(destination);
      setTimeout(() => {
        try {
          router.refresh();
        } catch {
          /* ignore refresh errors */
        }
      }, 80);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "No se pudo guardar tu rol";
      toast.error(message);
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[70vh] bg-slate-50 px-4 py-10 sm:px-6 sm:py-16 dark:bg-neutral-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-3xl border bg-white p-6 shadow-lg sm:p-8 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-900">
            Paso obligatorio
          </p>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            Elige cómo quieres usar Handi
          </h1>
          <p className="text-sm text-slate-600 sm:text-base dark:text-neutral-300">
            Cuéntanos si vienes a buscar ayuda o a ofrecer tus servicios. Podrás
            cambiarlo más tarde desde tu perfil.
          </p>
          {email ? (
            <p className="text-sm text-slate-500 dark:text-neutral-400">
              Hola {name.split(" ")[0] || name}, estás autenticado como{" "}
              <span className="font-semibold">{email}</span>
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {OPTIONS.map((opt) => {
            const isSelected = selected === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSelected(opt.key)}
                className={cn(
                  "flex h-full flex-col rounded-2xl border p-5 text-left shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#082877]",
                  isSelected
                    ? "border-[#082877] bg-[#082877]/5 shadow-md"
                    : "border-slate-200 bg-white hover:border-[#082877]/30 hover:bg-slate-50",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-300">
                    {isSelected && (
                      <span className="h-2.5 w-2.5 rounded-full bg-[#082877]" />
                    )}
                  </span>
                  <span className="space-y-1">
                    <span className="block font-sans text-base font-semibold text-[#024E61]">
                      {opt.title}
                    </span>
                    <span className="block text-sm text-slate-600 dark:text-neutral-300">
                      {opt.subtitle}
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
          <div className="text-sm text-slate-500 dark:text-neutral-300">
            {selectedCopy}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button asChild variant="ghost" className="justify-center">
              <a href="/auth/sign-out">Cerrar sesión</a>
            </Button>
            <Button
              type="button"
              onClick={handleContinue}
              disabled={submitting}
              className="justify-center bg-[#082877] hover:bg-[#061d58]"
            >
              {submitting ? (
                <>
                  <Spinner className="size-4 text-white" />
                  <span>Guardando</span>
                </>
              ) : (
                "Continuar"
              )}
            </Button>
          </div>
        </div>
        {errorMsg ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {errorMsg}
          </div>
        ) : null}
      </div>
    </div>
  );
}
