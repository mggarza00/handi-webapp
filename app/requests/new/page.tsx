// app/requests/new/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
// Date: usamos input nativo
import { z } from "zod";
import { toast } from "sonner";

import Breadcrumbs from "@/components/breadcrumbs";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabaseBrowser } from "@/lib/supabase-browser";
// Keep relative imports to avoid CI resolver edge-cases in this PR
import { buildStorageKey, buildUltraSafeKey } from "../../../lib/storage-sanitize";
// Inline container to avoid RSC/Client mismatches during build
import { CITIES, canonicalizeCityName, guessCityFromCoords } from "@/lib/cities";
// Keep relative imports to avoid CI resolver edge-cases in this PR
import ConditionsCombobox from "../../../components/requests/ConditionsCombobox";
import {
  readDraft,
  writeDraft,
  clearDraft,
  isPendingAutoSubmit,
  setPendingAutoSubmit,
  setReturnTo,
  getReturnTo,
  clearGatingFlags,
} from "@/lib/drafts";
import { useDebounced } from "./hooks/useClassify";
import MapPickerModal from "@/components/address/MapPickerModal";

type FormValues = {
  title: string;
  description?: string;
  city: string;
  address: string;
  lat?: number;
  lng?: number;
  postcode?: string;
  state?: string;
  country?: string;
  place_id?: string;
  mapbox_context?: string;
};

//

// Categorías y subcategorías vendrán de Supabase (tabla categories_subcategories)

export default function NewRequestPage() {
  const router = useRouter();
  const _sp = useSearchParams();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("Monterrey");
  const [category, setCategory] = useState("");
  const [cityTouched, setCityTouched] = useState(false);
  const [subcategory, setSubcategory] = useState("");
  const [budget, setBudget] = useState<number | "">("");
  const [requiredAt, setRequiredAt] = useState("");
  const [conditionsText, setConditionsText] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Fecha requerida: input nativo type="date"
  const [uploading, setUploading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const didRefreshRef = useRef(false);
  const geoAskedRef = useRef(false);
  // Auth tracking to avoid false negatives on submit
  const [me, setMe] = useState<User | null>(null);
  // Dirección seleccionada
  const [addressLine, setAddressLine] = useState<string>("");
  const [addressPlaceId, setAddressPlaceId] = useState<string | null>(null);
  const [addressLat, setAddressLat] = useState<number | null>(null);
  const [addressLng, setAddressLng] = useState<number | null>(null);
  const [addressPostcode, setAddressPostcode] = useState<string | null>(null);
  const [addressState, setAddressState] = useState<string | null>(null);
  const [addressCountry, setAddressCountry] = useState<string | null>(null);
  const [addressContext, setAddressContext] = useState<any>(null);
  const [openMap, setOpenMap] = useState(false);

  // react-hook-form: valores por defecto mínimos para integración
  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({
    defaultValues: { city: "Monterrey", address: "" },
    mode: "onChange",
  });

  // 🔁 Selecciona ciudad en el <Select> real (ajusta IDs/values si tu selector usa otras opciones)
  const selectCityIfExists = (maybeCity?: string | null) => {
    const c = (maybeCity || "").toString().trim();
    if (!c) return;
    const canonical = canonicalizeCityName(c);
    if (canonical && CITIES.includes(canonical)) {
      setCity(canonical);
      try { setValue("city", canonical, { shouldDirty: true }); } catch { /* ignore */ }
    }
  };
  type Subcat = { name: string; icon: string | null };
  const [catMap, setCatMap] = useState<Record<string, Subcat[]>>({});
  const [loadingCats, setLoadingCats] = useState(false);
  // Autoclasificador: sugerencias + control de override
  const [, setClassifying] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const [_autoApplied, setAutoApplied] = useState(false);
  type AiSuggestion = {
    category: string;
    subcategory: string;
    confidence: number;
    source?: "keyword" | "heuristic";
  };
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);

  const categoriesList: string[] = useMemo(() => {
    return Object.keys(catMap).sort((a, b) => a.localeCompare(b));
  }, [catMap]);

  const subcatOptions = useMemo(() => {
    const list = (catMap[category] ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    return list.map(
      (s) =>
        ({ value: s.name, label: s.name, icon: s.icon }) as {
          value: string;
          label: string;
          icon: string | null;
        },
    );
  }, [category, catMap]);

  useEffect(() => {
    // Track auth once on mount so we don't mis-detect on submit
    let unsub: (() => void) | null = null;
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      setMe(data.session?.user ?? null);
      const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_e, session) => {
        setMe(session?.user ?? null);
      });
      unsub = () => sub.subscription.unsubscribe();
      setAuthChecked(true);
    })();
    return () => {
      try {
        unsub?.();
      } catch {
        /* no-op */
      }
    };
  }, []);

  // Auto-open sign-in modal if unauthenticated on entry
  useEffect(() => {
    if (!authChecked) return;
    if (!me) {
      try {
        setReturnTo(`${window.location.pathname}${window.location.search}`);
      } catch {
        /* noop */
      }
      setShowLoginModal(true);
    }
  }, [authChecked, me]);

  // Close modal and refresh page after login so user context is loaded
  useEffect(() => {
    if (me && !didRefreshRef.current) {
      didRefreshRef.current = true;
      if (showLoginModal) setShowLoginModal(false);
      try {
        router.refresh();
      } catch {
        // fallback if refresh not available
        try {
          if (typeof window !== 'undefined') window.location.reload();
        } catch {
          /* noop */
        }
      }
    }
  }, [me, showLoginModal, router]);

  useEffect(() => {
    // Load saved draft, if any
    try {
      const d = readDraft<{
        title?: string;
        description?: string;
        city?: string;
        category?: string;
        subcategory?: string;
        budget?: number | "";
        required_at?: string;
        conditions?: string | string[];
      }>("draft:create-service");
      if (d) {
        if (typeof d.title === "string") setTitle(d.title);
        if (typeof d.description === "string") setDescription(d.description);
        if (typeof d.city === "string") setCity(d.city);
        if (typeof d.category === "string") setCategory(d.category);
        if (typeof d.subcategory === "string") setSubcategory(d.subcategory);
        if (typeof d.budget !== "undefined") setBudget(d.budget as number | "");
        if (typeof d.required_at === "string") setRequiredAt(d.required_at);
        if (Array.isArray(d.conditions)) setConditionsText(d.conditions.join(", "));
        else if (typeof d.conditions === "string") setConditionsText(d.conditions);
      }
    } catch (_e) {
      void _e;
    }

    let cancelled = false;
    (async () => {
      setLoadingCats(true);
      try {
        let map: Record<string, Subcat[]> | null = null;
        try {
          const r = await fetch("/api/catalog/categories", {
            cache: "no-store",
          });
          const j = await r.json();
          if (!r.ok || j?.ok === false)
            throw new Error(j?.detail || j?.error || "fetch_failed");
          const rows: Array<{
            category?: string | null;
            subcategory?: string | null;
            icon?: string | null;
          }> = j?.data ?? [];
          const tmp: Record<string, Subcat[]> = {};
          (rows || []).forEach((row) => {
            const cat = (row?.category ?? "").toString().trim();
            const sub = (row?.subcategory ?? "").toString().trim();
            const icon = (row?.icon ?? "").toString().trim() || null;
            if (!cat) return;
            if (!tmp[cat]) tmp[cat] = [];
            if (sub && !tmp[cat].some((x) => x.name === sub))
              tmp[cat].push({ name: sub, icon });
          });
          map = tmp;
        } catch {
          // Fallback: intentar directo con el cliente público (si RLS lo permite)
          try {
            const { data, error } = await supabaseBrowser
              .from("categories_subcategories")
              .select('"Categoría","Subcategoría","Activa","Ícono"');
            if (error) throw error;
            const tmp: Record<string, Subcat[]> = {};
            const isActive = (v: unknown) => {
              const s = (v ?? "").toString().trim().toLowerCase();
              return (
                s === "sí" ||
                s === "si" ||
                s === "true" ||
                s === "1" ||
                s === "activo" ||
                s === "activa" ||
                s === "x"
              );
            };
            (data || []).forEach((row: Record<string, unknown>) => {
              if (!isActive(row?.["Activa"])) return;
              const cat = (row?.["Categoría"] ?? "").toString().trim();
              const sub = (row?.["Subcategoría"] ?? "").toString().trim();
              const icon = (row?.["Ícono"] ?? "").toString().trim() || null;
              if (!cat) return;
              if (!tmp[cat]) tmp[cat] = [];
              if (sub && !tmp[cat].some((x) => x.name === sub))
                tmp[cat].push({ name: sub, icon });
            });
            map = tmp;
          } catch (e2) {
            console.error("No fue posible cargar categorías:", e2);
            toast.error("No fue posible cargar categorías");
            map = {};
          }
        }
        if (!cancelled) setCatMap(map ?? {});
      } catch {
        if (!cancelled) setCatMap({});
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Preselect category/subcategory from URL search params
  useEffect(() => {
    try {
      const urlCat = (_sp?.get("category") || "").toString().trim();
      const urlSub = (_sp?.get("subcategory") || "").toString().trim();
      if (!urlCat && !urlSub) return;
      if (loadingCats) return; // wait until categories are loaded

      // Helper to apply selection safely
      const apply = (nextCat: string, nextSub?: string) => {
        if (!nextCat) return;
        if (!(nextCat in catMap)) return; // ignore unknown
        const subOk = nextSub
          ? (catMap[nextCat] || []).some((s) => s.name === nextSub)
          : false;
        if (category !== nextCat) setCategory(nextCat);
        if (subOk) setTimeout(() => setSubcategory(nextSub!), 0);
        setManualOverride(true);
        setIsDirty(true);
      };

      // 1) If category param exists and is valid, apply it; then subcategory if provided
      if (urlCat && urlCat in catMap) {
        apply(urlCat, urlSub || undefined);
        return;
      }

      // 2) If only subcategory provided, find its category and apply both
      if (urlSub) {
        const foundCat = Object.keys(catMap).find((c) =>
          (catMap[c] || []).some((s) => s.name === urlSub),
        );
        if (foundCat) apply(foundCat, urlSub);
      }
    } catch {
      /* noop */
    }
  }, [_sp, catMap, loadingCats, category]);

  // Solicitar geolocalización al entrar y actualizar ciudad + dirección + coords
  useEffect(() => {
    if (geoAskedRef.current) return;
    geoAskedRef.current = true;
    try {
      if (!("geolocation" in navigator)) return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          try {
            let j: any = {};
            try {
              const res = await fetch(`/api/geocode?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}`, { cache: "no-store" });
              j = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error("forward_reverse_failed");
            } catch {
              const res2 = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`, { cache: "no-store" });
              j = await res2.json().catch(() => ({}));
            }
            const detectedCity = typeof j?.city === "string" ? j.city : null;
            if (detectedCity) {
              selectCityIfExists(detectedCity);
            } else {
              const fallback = guessCityFromCoords(latitude, longitude);
              if (fallback) selectCityIfExists(fallback);
            }
            if (typeof j?.address_line === "string" && j.address_line.trim().length > 0) setAddressLine(j.address_line);
            if (typeof j?.place_id === "string" && j.place_id.trim().length > 0) setAddressPlaceId(j.place_id);
            setAddressLat(latitude);
            setAddressLng(longitude);
          } catch { /* ignore */ }
        },
        // On error (denied or unavailable), no-op
        () => { /* noop */ },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
      );
    } catch { /* ignore */ }
  }, []);

  // Autoclasiﬁcación (debounced) al escribir título/descrición (mín. 10 chars combinados)
  const doClassify = useCallback(async (t: string, d: string) => {
    try {
      setClassifying(true);
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ title: t, description: d }),
        cache: "no-store",
      });
      const j = await res.json();
      if (!res.ok || j?.ok === false) {
        setSuggestion(null);
        setAutoApplied(false);
        return;
      }
      const best = (j?.best ?? null) as
        | { category?: string; subcategory?: string; confidence?: number; source?: "keyword" | "heuristic" }
        | null;
      if (best && typeof best.category === "string") {
        setSuggestion({
          category: best.category,
          subcategory: String(best.subcategory ?? ""),
          confidence: Number(best.confidence ?? 0),
          source: best.source,
        });
      } else {
        setSuggestion(null);
        setAutoApplied(false);
      }
    } catch {
      setSuggestion(null);
      setAutoApplied(false);
    } finally {
      setClassifying(false);
    }
  }, []);

  const debouncedClassify = useDebounced((t: string, d: string) => doClassify(t, d), 500);

  useEffect(() => {
    const t = (title || "").trim();
    const d = (description || "").trim();
    const combinedLen = (t + " " + d).trim().length;
    if (combinedLen < 10) {
      setSuggestion(null);
      setAutoApplied(false);
      return;
    }
    debouncedClassify(t, d);
  }, [title, description, debouncedClassify]);

  // Aplicar automáticamente si confianza >= 0.80 y no hay override manual
  useEffect(() => {
    if (!suggestion) return;
    if (manualOverride) return;
    if (loadingCats) return;
    if (!suggestion || suggestion.confidence < 0.8) return;
    const catOk = Object.prototype.hasOwnProperty.call(catMap, suggestion.category);
    if (!catOk) return;
    const desiredSub = suggestion.subcategory || "";
    const normEq = (a: string, b: string) =>
      a?.normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase().trim() ===
      b?.normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase().trim();
    const options = (catMap[suggestion.category] || []).map((s) => s.name);
    const subOk = desiredSub
      ? options.some((n) => n === desiredSub || normEq(n, desiredSub))
      : true;
    const nextCat = suggestion.category;
    const nextSub = subOk ? desiredSub : "";
    // Solo cambiar si difiere
    const willChange = category !== nextCat || subcategory !== nextSub;
    if (willChange) {
      setCategory(nextCat);
      // Aplazar el set de subcategoría para respetar el recálculo de opciones
      setTimeout(() => {
        setSubcategory(nextSub);
      }, 0);
      setIsDirty(true);
      try {
        // Telemetría mínima
        console.info("ai.classify.applied", suggestion.confidence, nextCat, nextSub);
      } catch {}
    }
    setAutoApplied(true);
  }, [suggestion, manualOverride, loadingCats, catMap, category, subcategory]);

  // Geolocalización: intenta detectar ciudad y dirección si el usuario no la cambió manualmente
  useEffect(() => {
    if (cityTouched) return; // respeta selección manual
    // Solo intenta si ciudad no fue modificada y es una de las default o vacía
    const defaults = new Set<string>(["", "Monterrey"]);
    if (!defaults.has((city || "").trim())) return;
    let cancelled = false;
    const detect = async () => {
      try {
        if (!("geolocation" in navigator)) return;
        await new Promise<void>((resolve) => setTimeout(resolve, 300));
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            if (cancelled) return;
            const { latitude, longitude } = pos.coords;
            try {
              let j: any = {};
              try {
                const res = await fetch(`/api/geocode?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}`, { cache: "no-store" });
                j = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error("forward_reverse_failed");
              } catch {
                const res2 = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`, { cache: "no-store" });
                j = await res2.json().catch(() => ({}));
              }
              const detected = typeof j?.city === "string" ? j.city : null;
              if (detected) {
                selectCityIfExists(detected);
              } else {
                const fallback = guessCityFromCoords(latitude, longitude);
                if (fallback) selectCityIfExists(fallback);
              }
              // Actualiza dirección y coords desde geolocalización
              if (typeof j?.address_line === "string" && j.address_line.trim().length > 0) setAddressLine(j.address_line);
              if (typeof j?.place_id === "string" && j.place_id.trim().length > 0) setAddressPlaceId(j.place_id);
              setAddressLat(latitude);
              setAddressLng(longitude);
            } catch { /* noop */ }
          },
          () => { /* denied or error: ignore */ },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
        );
      } catch { /* noop */ }
    };
    detect();
    return () => { cancelled = true; };
  }, [cityTouched]);

  // (Removed) Acción manual para detectar ciudad ahora

  // Persist draft anytime fields change
  useEffect(() => {
    writeDraft("draft:create-service", {
      title,
      description,
      city,
      category,
      subcategory,
      budget,
      required_at: requiredAt,
      conditions: conditionsText,
    });
  }, [title, description, city, category, subcategory, budget, requiredAt, conditionsText]);

  // Warn before unload if dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const FormSchema = z.object({
    title: z.string().min(3, "Mínimo 3 caracteres").max(120),
    description: z
      .string()
      .min(10, "Mínimo 10 caracteres")
      .max(2000)
      .optional()
      .or(z.literal("")),
    city: z.string().min(2, "Ingresa una ciudad válida").max(80),
    category: z.string().min(2, "Selecciona una categoría").max(80),
    subcategory: z.string().min(1).max(80).optional().or(z.literal("")),
    budget: z
      .union([
        z.number().positive("Debe ser positivo").max(1_000_000),
        z.literal(""),
      ])
      .optional(),
    required_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD")
      .optional()
      .or(z.literal("")),
    conditions: z.union([
      z.string().max(240),
      z
        .array(
          z
            .string()
            .min(2)
            .max(40)
            .transform((s) => s.replace(/\s+/g, " ").trim()),
        )
        .max(10),
    ]).optional(),
    address_line: z.string().max(500).optional().or(z.literal("")),
    address_place_id: z.string().max(200).optional().or(z.literal("")),
    address_lat: z.number().optional(),
    address_lng: z.number().optional(),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    // Auth gating
    try {
  // Consulta directa de la sesión en este instante
  const { data } = await supabaseBrowser.auth.getSession();
  const userNow = data.session?.user ?? me;
  if (!userNow) {
        writeDraft("draft:create-service", {
          title,
          description,
          city,
          category,
          subcategory,
          budget,
          required_at: requiredAt,
          conditions: conditionsText,
        });
        setPendingAutoSubmit(true);
        setReturnTo(`${window.location.pathname}${window.location.search}`);
        setShowLoginModal(true);
        setSubmitting(false);
        toast.info("Se requiere iniciar sesión para continuar.");
        return;
      }
  // Mantén el estado actualizado
  setMe(userNow);
    } catch (_e) {
      void _e;
    }

    const parsed = FormSchema.safeParse({
      title,
      description,
      city,
      category,
      subcategory,
      budget,
      required_at: requiredAt,
      conditions: conditionsText,
      address_line: addressLine,
      address_place_id: addressPlaceId || "",
      address_lat: addressLat ?? undefined,
      address_lng: addressLng ?? undefined,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        const k = (i.path[0] as string) ?? "form";
        if (!fieldErrors[k]) fieldErrors[k] = i.message;
      });
      setErrors(fieldErrors);
      toast.error("Revisa los campos del formulario");
      setSubmitting(false);
      return;
    }

    // Validaciones adicionales dependientes de datos (categoría y subcategoría)
    const chosenCat = parsed.data.category;
    const availableCats = Object.keys(catMap);
    if (!availableCats.includes(chosenCat)) {
      setErrors((prev) => ({ ...prev, category: "Categoría inválida" }));
      toast.error("Selecciona una categoría válida");
      setSubmitting(false);
      return;
    }
    const subcats = catMap[chosenCat] ?? [];
    if (
      subcats.length > 0 &&
      (!subcategory || subcategory.trim().length === 0)
    ) {
      setErrors((prev) => ({
        ...prev,
        subcategory: "Selecciona una subcategoría",
      }));
      toast.error("Selecciona una subcategoría");
      setSubmitting(false);
      return;
    }

    // Subir adjuntos (opcional): validación 5MB y MIME imagen
    const attachments: Array<{
      url: string;
      mime: string;
      size: number;
      path?: string;
    }> = [];
    if (files.length > 0) {
      setUploading(true);
      try {
        // Asegurar bucket 'requests' en el servidor (idempotente)
        try {
          await fetch("/api/storage/ensure?b=requests", { method: "POST" });
        } catch {
          // ignore ensure errors; el upload puede seguir si ya existe
        }
        // Obtener userId para ruta de almacenamiento
  const userId: string | null = me?.id ?? null;
        const prefix = userId ?? "anon";
        for (const f of files) {
          const max = 5 * 1024 * 1024;
          if (f.size > max) throw new Error(`El archivo ${f.name} excede 5MB`);
          if (!/^image\//i.test(f.type))
            throw new Error(`Tipo inválido para ${f.name}`);
          const { url: uploadedUrl, path, mime } = await uploadRequestFile(supabaseBrowser, prefix, f);
          attachments.push({
            url: uploadedUrl,
            mime: mime,
            size: f.size,
            path,
          });
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Error al subir archivos";
        toast.error(msg);
        setSubmitting(false);
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    // Si el usuario escribió manual y no hay coords, resolver antes de enviar
    if ((addressLine || '').trim().length > 0 && (addressLat == null || addressLng == null)) {
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(addressLine.trim())}`, { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        const first = Array.isArray(j?.results) && j.results.length ? j.results[0] : null;
        if (first) {
          if (typeof first.lat === 'number') setAddressLat(first.lat);
          if (typeof first.lng === 'number') setAddressLng(first.lng);
          if (typeof first.place_id === 'string') setAddressPlaceId(first.place_id);
          if (typeof first.city === 'string' && first.city.trim().length > 0) selectCityIfExists(first.city);
          setAddressPostcode(typeof first.postcode === 'string' ? first.postcode : null);
          setAddressState(typeof first.state === 'string' ? first.state : null);
          setAddressCountry(typeof first.country === 'string' ? first.country : null);
          setAddressContext(first.context ?? null);
          try {
            setValue('lat', typeof first.lat === 'number' ? first.lat : undefined, { shouldDirty: true });
            setValue('lng', typeof first.lng === 'number' ? first.lng : undefined, { shouldDirty: true });
            setValue('place_id', typeof first.place_id === 'string' ? first.place_id : undefined, { shouldDirty: true });
            if (typeof first.city === 'string' && first.city.trim().length > 0) setValue('city', first.city, { shouldDirty: true });
            setValue('postcode', typeof first.postcode === 'string' ? first.postcode : undefined, { shouldDirty: true });
            setValue('state', typeof first.state === 'string' ? first.state : undefined, { shouldDirty: true });
            setValue('country', typeof first.country === 'string' ? first.country : undefined, { shouldDirty: true });
            setValue('mapbox_context', first.context ? JSON.stringify(first.context) : undefined, { shouldDirty: true });
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }

    // Construir payload según el schema del server (RequestCreateSchema)
    const payload: Record<string, unknown> = {
      title: parsed.data.title,
      city: parsed.data.city,
    };
    if (parsed.data.description && parsed.data.description.length > 0)
      payload.description = parsed.data.description.trim();
    if (parsed.data.category && parsed.data.category.length > 0)
      payload.category = parsed.data.category.trim();
    if (parsed.data.subcategory && parsed.data.subcategory.length > 0)
      payload.subcategories = [parsed.data.subcategory.trim()];
    if (parsed.data.budget !== "" && typeof parsed.data.budget === "number")
      payload.budget = parsed.data.budget;
    if (parsed.data.required_at && parsed.data.required_at.length > 0)
      payload.required_at = parsed.data.required_at;
    if (attachments.length > 0) payload.attachments = attachments;
    if (typeof parsed.data.conditions === "string") {
      const s = parsed.data.conditions.trim();
      if (s) payload.conditions = s;
    } else if (Array.isArray(parsed.data.conditions)) {
      payload.conditions = parsed.data.conditions;
    }
    if ((parsed.data.address_line || "").trim()) {
      payload.address_line = (parsed.data.address_line || "").trim();
      if ((parsed.data.address_place_id || "").trim()) payload.address_place_id = (parsed.data.address_place_id || "").trim();
      if (typeof parsed.data.address_lat === "number") payload.address_lat = parsed.data.address_lat;
      if (typeof parsed.data.address_lng === "number") payload.address_lng = parsed.data.address_lng;
      if (addressPostcode) payload.address_postcode = addressPostcode;
      if (addressState) payload.address_state = addressState;
      if (addressCountry) payload.address_country = addressCountry;
      if (addressContext != null) {
        payload.address_context = addressContext;
        try {
          // Opcional: incluir string serializado para trazas/depuración
          (payload as Record<string, unknown>).mapbox_context = JSON.stringify(addressContext);
        } catch { /* ignore */ }
      }
    }

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        console.error("Create request error", j);
        const detail =
          j?.detail || j?.error || "No fue posible guardar la solicitud";
        toast.error(detail);
        return;
      }
      toast.success("Solicitud creada");
      const newId = j?.data?.id as string | undefined;
      if (newId) {
        // Post-submit role transition: to client
        try {
          await fetch("/api/profile/active-user-type", {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({ to: "cliente" }),
          });
        } catch (_e) {
          void _e;
        }
        clearDraft("draft:create-service");
        clearGatingFlags();
  router.push(`/requests/${newId}`);
        return;
      }
      // opcional: limpiar formulario
      setTitle("");
      setDescription("");
      setCity("Monterrey");
      setCategory("");
      setSubcategory("");
          setBudget("");
          setRequiredAt("");
          setFiles([]);
          setAddressLine("");
          setAddressPlaceId(null);
          setAddressLat(null);
          setAddressLng(null);
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-submit after login if pending
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isPendingAutoSubmit()) return;
        const { data } = await supabaseBrowser.auth.getUser();
        if (!data?.user) return;
        const d = readDraft<{
          title?: string;
          description?: string;
          city?: string;
          category?: string;
          subcategory?: string;
          budget?: number | "";
          required_at?: string;
          conditions?: string | string[];
        }>("draft:create-service");
        if (!d) {
          toast.message(
            "Tu sesión está iniciada. Por favor revisa y envía de nuevo.",
          );
          clearGatingFlags();
          return;
        }
        if (typeof d.title === "string") setTitle(d.title);
        if (typeof d.description === "string") setDescription(d.description);
        if (typeof d.city === "string") setCity(d.city);
        if (typeof d.category === "string") setCategory(d.category);
        if (typeof d.subcategory === "string") setSubcategory(d.subcategory);
        if (typeof d.budget !== "undefined") setBudget(d.budget as number | "");
        if (typeof d.required_at === "string") setRequiredAt(d.required_at);
        if (Array.isArray(d.conditions)) setConditionsText(d.conditions.join(", "));
        else if (typeof d.conditions === "string") setConditionsText(d.conditions);
        setTimeout(() => {
          if (!cancelled) {
            try {
              formRef.current?.requestSubmit();
              toast.info("Enviando tu solicitud…");
            } catch (_e2) {
              void _e2;
            }
          }
        }, 50);
      } catch (_e) {
        void _e;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const crumbs = [
    { label: "Inicio", href: "/" },
    { label: "Solicitudes", href: "/requests?mine=1" },
    { label: "Nueva" },
  ];

  const isUrl = (v: string | null | undefined) =>
    !!v &&
    (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/"));

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={crumbs} />
        <h1 className="text-2xl font-bold mt-4 mb-4">Nueva solicitud</h1>

        <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              data-testid="request-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setIsDirty(true);
              }}
              placeholder="ej. Reparación de fuga en baño"
              required
            />
            {errors.title && (
              <p className="text-xs text-red-600">{errors.title}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea
              data-testid="request-desc"
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setIsDirty(true);
              }}
              placeholder="Describe lo que necesitas…"
            />
            {errors.description && (
              <p className="text-xs text-red-600">{errors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Ciudad</Label>
              </div>
              <Select
                value={city}
                onValueChange={(v) => {
                  setCity(v);
                  try { setValue("city", v, { shouldDirty: true }); } catch { /* ignore */ }
                  setCityTouched(true);
                  setIsDirty(true);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona ciudad" />
                </SelectTrigger>
                <SelectContent>
                  {CITIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.city && (
                <p className="text-xs text-red-600">{errors.city}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Presupuesto estimado</Label>
              <div className="relative w-[35%]">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                  $
                </span>
                <Input
                  type="number"
                  value={budget}
                  onChange={(e) => {
                    setBudget(
                      e.target.value === "" ? "" : Number(e.target.value),
                    );
                    setIsDirty(true);
                  }}
                  min={0}
                  step={100}
                  placeholder="800"
                  className="pl-6 pr-14"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                  MXN
                </span>
              </div>
              {errors.budget && (
                <p className="text-xs text-red-600">{errors.budget}</p>
              )}
            </div>
          </div>

          {/* Dirección + mapa */}
          <div className="space-y-1.5">
            <Label>Dirección</Label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Escribe tu dirección o elige en el mapa…"
                value={addressLine}
                onChange={(e) => {
                  setAddressLine(e.target.value);
                  setAddressPlaceId(null);
                  setAddressLat(null);
                  setAddressLng(null);
                  try { setValue("address", e.target.value, { shouldDirty: true }); } catch { /* ignore */ }
                  setIsDirty(true);
                }}
              />
              <Button type="button" variant="outline" onClick={() => setOpenMap(true)} title="Seleccionar en mapa">
                <MapPin size={18} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Protegemos tu privacidad: tu dirección solo se comparte con el profesional contratado cuando el servicio queda agendado.
            </p>
            {openMap ? (
              <MapPickerModal
                open={openMap}
                initial={{
                  lat: typeof addressLat === 'number' ? addressLat : undefined,
                  lng: typeof addressLng === 'number' ? addressLng : undefined,
                  address: addressLine || undefined,
                }}
                onClose={() => setOpenMap(false)}
                onConfirm={(p) => {
                  setAddressLine(p.address || "");
                  setAddressPlaceId(p.place_id || null);
                  setAddressLat(typeof p.lat === 'number' ? p.lat : null);
                  setAddressLng(typeof p.lng === 'number' ? p.lng : null);
                  setAddressPostcode(typeof p.postcode === 'string' ? p.postcode : null);
                  setAddressState(typeof p.state === 'string' ? p.state : null);
                  setAddressCountry(typeof p.country === 'string' ? p.country : null);
                  setAddressContext(p.context ?? null);
                  selectCityIfExists(p.city);
                  try {
                    setValue("address", p.address ?? "", { shouldDirty: true });
                    setValue("place_id", p.place_id ?? undefined, { shouldDirty: true });
                    setValue("lat", p.lat, { shouldDirty: true });
                    setValue("lng", p.lng, { shouldDirty: true });
                    setValue("postcode", p.postcode ?? undefined, { shouldDirty: true });
                    setValue("state", p.state ?? undefined, { shouldDirty: true });
                    setValue("country", p.country ?? undefined, { shouldDirty: true });
                    setValue("mapbox_context", p.context ? JSON.stringify(p.context) : undefined, { shouldDirty: true });
                  } catch { /* ignore */ }
                  setIsDirty(true);
                }}
              />
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v);
                  setSubcategory("");
                  setIsDirty(true);
                  setManualOverride(true);
                  setAutoApplied(false);
                }}
              >
                <SelectTrigger data-testid="request-category">
                  <SelectValue
                    placeholder={loadingCats ? "Cargando…" : "Selecciona…"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {categoriesList.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-xs text-red-600">{errors.category}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Subcategoría</Label>
              <Select
                value={subcategory}
                onValueChange={(v) => {
                  setSubcategory(v);
                  setIsDirty(true);
                  setManualOverride(true);
                  setAutoApplied(false);
                }}
              >
                <SelectTrigger
                  disabled={!category || (catMap[category]?.length ?? 0) === 0}
                >
                  <SelectValue
                    placeholder={
                      !category
                        ? "Elige una categoría primero"
                        : (catMap[category]?.length ?? 0) > 0
                          ? "Selecciona…"
                          : "Sin subcategorías"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {subcatOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="inline-flex items-center gap-2">
                        {s.icon ? (
                          isUrl(s.icon) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.icon}
                              alt=""
                              className="h-4 w-4 object-contain"
                            />
                          ) : (
                            <span className="text-base leading-none">
                              {s.icon}
                            </span>
                          )
                        ) : null}
                        <span>{s.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.subcategory && (
                <p className="text-xs text-red-600">{errors.subcategory}</p>
              )}
            </div>

            {!loadingCats && categoriesList.length === 0 && (
              <div className="md:col-span-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                No hay categorías disponibles. Verifica la tabla{" "}
                <code>categories_subcategories</code> o tu configuración.
              </div>
            )}
          </div>

          {/* Sugerencia AI: no se muestra UI; autoselección silenciosa si alta confianza. */}

          <div className="space-y-1.5">
            <Label>Condiciones</Label>
            <p className="text-xs text-slate-500">Selecciona o escribe condiciones relevantes (máx. 10).</p>
            <ConditionsCombobox
              value={conditionsText}
              onChange={(v) => {
                setConditionsText(v);
                setIsDirty(true);
              }}
            />
            {errors.conditions && (
              <p className="text-xs text-red-600">{errors.conditions}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Fecha requerida</Label>
            <div className="w-[18ch] md:w-[16ch]">
              <Input
                type="date"
                value={requiredAt}
                onChange={(e) => {
                  setRequiredAt(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full text-center"
              />
            </div>
            {errors.required_at && (
              <p className="text-xs text-red-600">{errors.required_at}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Imágenes del sitio (máx 5 MB c/u)</Label>
            <p className="text-xs text-slate-500">Permite hasta 5 imágenes.</p>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const incoming = Array.from(e.currentTarget.files ?? []);
                if (incoming.length === 0) return;
                setFiles((prev) => {
                  const combined = [...prev];
                  for (const f of incoming) {
                    if (combined.length >= 5) break;
                    // evitar duplicados por nombre+size
                    const dup = combined.some(
                      (x) => x.name === f.name && x.size === f.size,
                    );
                    if (!dup) combined.push(f);
                  }
                  if (prev.length + incoming.length > 5) {
                    toast.error("Solo puedes adjuntar hasta 5 imágenes.");
                  }
                  setIsDirty(true);
                  return combined.slice(0, 5);
                });
                // Limpia el valor para permitir volver a seleccionar el mismo archivo
                e.currentTarget.value = "";
              }}
            />
            <div className="flex flex-wrap gap-2">
              {files.map((f, idx) => (
                <div
                  key={`${f.name}-${idx}`}
                  className="relative h-20 w-20 overflow-hidden rounded border border-slate-200 bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(f)}
                    alt={f.name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    title="Quitar"
                    className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                    onClick={() => {
                      setFiles((prev) => prev.filter((x, i) => i !== idx));
                      setIsDirty(true);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {files.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-20 w-20 items-center justify-center rounded border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50"
                  title="Agregar imagen"
                >
                  +
                </button>
              )}
            </div>
          </div>

          <Button type="submit" disabled={submitting || uploading} data-testid="post-request">
            {submitting || uploading ? "Publicando…" : "Publicar solicitud"}
          </Button>
        </form>
        {showLoginModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div role="dialog" aria-modal="true" className="w-[96vw] max-w-lg overflow-hidden rounded-xl border bg-white shadow-lg">
              <iframe
                title="Inicia sesión para crear una solicitud"
                src={`/auth/sign-in?next=${encodeURIComponent(getReturnTo() || (typeof window !== 'undefined' ? window.location.pathname : '/requests/new'))}`}
                className="h-[80vh] w-full"
              />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

// Helper: sube un archivo al bucket "requests" con key segura y fallback ultra-conservador.
async function uploadRequestFile(
  supabase: SupabaseClient,
  ownerPrefix: string,
  file: File,
): Promise<{ url: string; path: string; mime: string }> {
  const bucket = "requests";
  const owner = (ownerPrefix || "anon").trim();
  const contentType = file.type || "application/octet-stream";

  // Key segura estándar (ASCII, preserva extensión, sin bucket, sin "/" inicial)
  let key = buildStorageKey(owner, file.name, { allowUnicode: false, maxNameLength: 180 });
  let { data, error } = await supabase.storage
    .from(bucket)
    .upload(key, file, { cacheControl: "3600", upsert: false, contentType });

  // Retry con key ultra-conservadora ante Invalid key / 400
  if (error && /invalid key/i.test(String(error.message || ""))) {
    const ultraKey = buildUltraSafeKey(owner, file.name);
    const retry = await supabase.storage
      .from(bucket)
      .upload(ultraKey, file, { cacheControl: "3600", upsert: false, contentType });
    if (!retry.error) {
      key = ultraKey;
      data = retry.data;
      error = null;
    } else {
      error = retry.error;
    }
  }

  // Último recurso: subir vía endpoint server (Service Role) si aún falla
  if (error) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("path", key);
      fd.append("bucket", bucket);
      const r = await fetch("/api/storage/upload", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({} as any));
      if (r.ok && j?.ok && typeof j?.url === "string") {
        return { url: j.url as string, path: key, mime: contentType };
      }
    } catch {
      // ignore
    }
    throw error;
  }
  const pub = supabase.storage.from(bucket).getPublicUrl(key);
  return { url: pub.data.publicUrl, path: key, mime: contentType };
}
