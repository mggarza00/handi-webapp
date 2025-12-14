"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const passwordRequirements = (value: string) => [
  { label: "Al menos 8 caracteres", pass: value.length >= 8 },
  { label: "Al menos 1 letra mayúscula", pass: /[A-Z]/.test(value) },
  { label: "Al menos 1 letra minúscula", pass: /[a-z]/.test(value) },
  { label: "Al menos 1 número", pass: /\d/.test(value) },
];

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "invalid">(
    "loading",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = useMemo(() => "/auth/sign-in?reset=1", []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        if (typeof window !== "undefined" && window.location.hash) {
          const hash = window.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          const type = params.get("type");

          if (type === "recovery" && access_token && refresh_token) {
            console.log("Setting session from recovery hash");
            const { error: setErr } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (setErr) {
              console.error(
                "Error setting session from recovery hash:",
                setErr,
              );
              setStatus("invalid");
              return;
            }

            router.replace("/auth/reset-password");
          }
        }

        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        if (!active) return;
        if (userError || !userData?.user) {
          console.error("No user found for reset-password:", userError);
          setStatus("invalid");
          return;
        }

        setStatus("ready");
      } catch (err) {
        console.error("Unexpected error in reset-password init:", err);
        setStatus("invalid");
      }
    };

    void init();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const reqs = passwordRequirements(password);
  const allPass = reqs.every((r) => r.pass);
  const match = password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== "ready") {
      setError("Tu enlace expiró o no es válido. Solicita uno nuevo.");
      return;
    }
    if (submitting) return;
    if (!allPass || !match) {
      setError("Verifica que la contraseña cumpla los requisitos y coincide.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      toast.success("Tu contraseña se ha actualizado correctamente.");
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No pudimos actualizar tu contraseña. Intenta de nuevo.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
          <Spinner />
          <p className="text-sm text-slate-600">
            Cargando / validando enlace...
          </p>
        </div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            Enlace no válido
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            No encontramos un enlace de recuperación válido. Vuelve a solicitar
            el cambio de contraseña.
          </p>
          <div className="mt-6">
            <Button
              className="w-full"
              onClick={() => router.push("/auth/sign-in")}
            >
              Volver a iniciar sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Restablecer contraseña
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Escribe tu nueva contraseña para tu cuenta Handi. Debe cumplir con los
          siguientes requisitos.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="password"
            >
              Nueva contraseña
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 shadow-sm focus-within:border-[#0b835e]">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent px-1 py-1 text-sm focus:outline-none"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="text-xs font-medium text-[#0b835e] hover:text-[#086545]"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="confirm"
            >
              Confirmar contraseña
            </label>
            <input
              id="confirm"
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-[#0b835e] focus:outline-none"
              autoComplete="new-password"
              required
            />
            {!match && confirm.length > 0 ? (
              <p className="text-xs text-red-600">
                Las contraseñas no coinciden.
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Requisitos
            </p>
            <ul className="space-y-1.5 text-sm">
              {reqs.map((req) => (
                <li
                  key={req.label}
                  className={`flex items-center gap-2 ${req.pass ? "text-[#0b835e]" : "text-slate-600"}`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                      req.pass
                        ? "border-[#0b835e] bg-[#0b835e]/10 text-[#0b835e]"
                        : "border-slate-300 bg-white text-slate-400"
                    }`}
                    aria-hidden
                  >
                    {req.pass ? "✓" : "•"}
                  </span>
                  <span>{req.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button
            type="submit"
            disabled={!allPass || !match || submitting}
            className="w-full rounded-xl py-3 font-semibold"
          >
            {submitting ? (
              <>
                <Spinner />
                <span className="ml-2">Actualizando...</span>
              </>
            ) : (
              "Actualizar contraseña"
            )}
          </Button>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
