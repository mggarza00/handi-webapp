"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase/client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcceptOffer: () => Promise<void> | void; // callback para aceptar la oferta tras confirmar cuenta
};

function onlyDigits(s: string): string { return (s || "").replace(/\D+/g, ""); }
function clabePretty(v: string) { return onlyDigits(v).slice(0, 18).replace(/(.)/g, "$1 ").trim(); }
function isValidClabe(input: string): boolean {
  const clabe = onlyDigits(input);
  if (!/^\d{18}$/.test(clabe)) return false;
  const weights = [3, 7, 1] as const;
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += ((clabe.charCodeAt(i) - 48) * weights[i % 3]) % 10;
  const dv = (10 - (sum % 10)) % 10;
  return dv === (clabe.charCodeAt(17) - 48);
}

export default function BankAccountGateModal({ open, onOpenChange, onAcceptOffer }: Props) {
  const supabaseAuth = createSupabaseBrowser();
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8" };
    try {
      const { data, error } = await supabaseAuth.auth.getSession();
      if (error) throw error;
      const token = data?.session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;
      const g = globalThis as unknown as { __sessionUser?: { id?: string } };
      if (!token && g.__sessionUser?.id) headers["x-user-id"] = g.__sessionUser.id!;
    } catch {
      const g = globalThis as unknown as { __sessionUser?: { id?: string } };
      if (g.__sessionUser?.id) headers["x-user-id"] = g.__sessionUser.id!;
    }
    return headers;
  }, [supabaseAuth]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [bankEdited, setBankEdited] = useState(false);
  const [rfc, setRfc] = useState("");
  const [clabe, setClabe] = useState("");
  const prefillDoneRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const headers: Record<string, string> = await getAuthHeaders();
        const res = await fetch("/api/me/bank-account", { cache: "no-store", credentials: "include", headers });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; account?: Record<string, unknown> | null; hasConfirmed?: boolean; error?: string };
        if (res.ok && json?.ok !== false) {
          setHasConfirmed(!!json?.hasConfirmed);
          const acc = json?.account as Record<string, unknown> | null;
          if (acc) {
            setName(String((acc as { account_holder_name?: unknown }).account_holder_name || ""));
            setBank(String((acc as { bank_name?: unknown }).bank_name || ""));
            setRfc(String((acc as { rfc?: unknown }).rfc || ""));
            setClabe(String((acc as { clabe?: unknown }).clabe || ""));
          }
        } else if (res.status !== 401) {
          // Si es UNAUTHORIZED (401), no bloquees: permite capturar datos.
          setError(json?.error || "No se pudo cargar la cuenta bancaria");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "network_error");
      } finally {
        setLoading(false);
      }
      // Prefill inteligente: nombre del perfil (una vez)
      if (!prefillDoneRef.current) {
        try {
          const headers: Record<string, string> = await getAuthHeaders();
          const rMe = await fetch("/api/me", { cache: "no-store", credentials: "include", headers });
          const jMe = (await rMe.json().catch(() => ({}))) as { user?: { id?: string } };
          const meId = jMe?.user?.id;
          if (meId) {
            const rProf = await fetch(`/api/users/${meId}`, { cache: "no-store", credentials: "include", headers });
            const jProf = (await rProf.json().catch(() => ({}))) as { data?: { full_name?: string | null } };
            const full = jProf?.data?.full_name;
            if (typeof full === "string" && full.trim().length) {
              setName((prev) => (prev.trim().length ? prev : full));
            }
          }
        } catch {
          /* ignore prefill errors */
        } finally {
          prefillDoneRef.current = true;
        }
      }
    })();
  }, [open, getAuthHeaders]);

  const clabeDigits = useMemo(() => onlyDigits(clabe), [clabe]);
  const clabeOk = useMemo(() => isValidClabe(clabe), [clabe]);
  const canSave = useMemo(() => name.trim().length > 0 && clabeOk, [name, clabeOk]);

  // Detección de banco por CLABE (primeros 3 dígitos)
  useEffect(() => {
    const prefix = clabeDigits.slice(0, 3);
    const bankMap: Record<string, string> = {
      "002": "Citibanamex",
      "006": "Banco del Bajío",
      "009": "BBVA",
      "012": "BBVA",
      "014": "Santander",
      "019": "BanRegio",
      "021": "HSBC",
      "030": "Banco del Bajío",
      "032": "IXE",
      "036": "Inbursa",
      "044": "Scotiabank",
      "058": "Banamex (old)",
      "059": "Invex",
      "062": "Afirme",
      "072": "Banorte",
      "127": "Azteca",
      "128": "Banamex (wallet)",
      "136": "Intercam",
      "137": "BanCoppel",
      "138": "BanCoppel",
    };
    const suggestion = bankMap[prefix] || "";
    // Autocompleta si el usuario no ha editado banco o si está vacío
    if (!bankEdited || bank.trim().length === 0) {
      setBank(suggestion);
    }
  }, [clabeDigits, bank, bankEdited]);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const headers: Record<string, string> = await getAuthHeaders();
      const res = await fetch("/api/me/bank-account", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ account_holder_name: name, bank_name: bank, rfc, clabe }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; account?: Record<string, unknown> | null };
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "No se pudo guardar la cuenta");
      }
      setHasConfirmed(true);
      // Aceptar oferta automáticamente
      try {
        await Promise.resolve(onAcceptOffer());
        toast.success("Cuenta añadida con éxito. Oferta de trabajo aceptada.");
        onOpenChange(false);
      } catch {
        /* si falla la aceptación, deja el modal abierto para reintento */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "save_failed");
    } finally {
      setSaving(false);
    }
  }

  

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Configura tu cuenta bancaria</DialogTitle>
          <DialogDescription>
            Para aceptar ofertas necesitas una cuenta bancaria confirmada para recibir pagos.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert className="rounded-md">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {hasConfirmed ? (
          <Alert className="rounded-md">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertTitle>Cuenta confirmada</AlertTitle>
            <AlertDescription>
              Tu cuenta bancaria está lista. Puedes aceptar la oferta ahora.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="acc-name">Nombre del titular</Label>
              <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre como aparece en la cuenta" disabled={loading || saving} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="acc-bank">Banco</Label>
              <Input id="acc-bank" value={bank} onChange={(e) => { setBankEdited(true); setBank(e.target.value); }} placeholder="Nombre del banco" disabled={loading || saving} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="acc-clabe">CLABE (18 dígitos)</Label>
              <Input
                id="acc-clabe"
                value={clabePretty(clabe)}
                onChange={(e) => setClabe(onlyDigits(e.target.value).slice(0, 18))}
                onPaste={(e) => {
                  const t = e.clipboardData.getData('text');
                  e.preventDefault();
                  setClabe(onlyDigits(t).slice(0, 18));
                }}
                placeholder="0000 0000 0000 0000 00"
                disabled={loading || saving}
                inputMode="numeric"
              />
              {clabeDigits.length > 0 && clabeDigits.length < 18 ? (
                <div className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> CLABE incompleta (18 dígitos requeridos).</div>
              ) : null}
              {clabeDigits.length === 18 && !clabeOk ? (
                <div className="text-xs text-rose-700 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> CLABE inválida (dígito verificador no coincide).</div>
              ) : null}
            </div>
            <div className="grid gap-1">
              <Label htmlFor="acc-rfc">RFC (opcional)</Label>
              <Input id="acc-rfc" value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} placeholder="RFC (si aplica)" disabled={loading || saving} />
            </div>
          </div>
        )}

        <DialogFooter className="mt-2 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <ShieldCheck className="h-4 w-4" />
            <span>
              Tus datos están protegidos. <Link href="/privacy" className="underline" target="_blank" rel="noreferrer">Política de Privacidad</Link>. Cifrado en tránsito. Nunca mostramos tu CLABE completa.
            </span>
          </div>
          {hasConfirmed ? (
            <Button onClick={() => { void onAcceptOffer(); }} data-testid="accept-offer-after-bank">
              Aceptar oferta
            </Button>
          ) : (
            <Button onClick={() => void save()} disabled={!canSave || loading || saving} data-testid="save-bank">
              {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…</>) : "Guardar cuenta y continuar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
