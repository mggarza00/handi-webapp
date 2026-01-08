"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useFormDraft } from "@/hooks/useFormDraft";
import {
  readDraft,
  writeDraft,
  clearDraft,
  isPendingAutoSubmit,
  setPendingAutoSubmit,
  setReturnTo,
  clearGatingFlags,
  draftsEnabled,
  purgeAllDrafts,
} from "@/lib/drafts";
import { CITIES } from "@/lib/cities";
import { buildStorageKey, buildUltraSafeKey } from "@/lib/storage-sanitize";
import { track } from "@/lib/telemetry";

type ClassificationSuggestion = {
  category?: string | null;
  subcategory?: string | null;
  confidence?: number | null;
  label?: string | null;
};

type AddressSuggestion = {
  id?: string;
  address: string;
  city?: string | null;
  lat?: number | null;
  lon?: number | null;
  postal_code?: string | null;
  label?: string | null;
  place_id?: string | null;
};

const isProd = process.env.NODE_ENV === "production";

function logFormError(scope: string, error: unknown) {
  if (isProd) return;
  // eslint-disable-next-line no-console
  console.error(`[useCreateRequestForm] ${scope}`, error);
}

type RequestDraftSnapshot = {
  title: string;
  description: string;
  city: string;
  category: string;
  subcategory: string;
  budget: number | "";
  required_at: string;
  conditions: string;
  address_line: string;
  address_lat: number | null;
  address_lng: number | null;
};

function toAddressSuggestion(value: unknown): AddressSuggestion | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const address =
    typeof obj.address === "string"
      ? obj.address.trim()
      : typeof obj.address_line === "string"
        ? obj.address_line.trim()
        : "";
  if (!address) return null;
  return {
    id: typeof obj.id === "string" ? obj.id : undefined,
    address,
    city: typeof obj.city === "string" ? obj.city : null,
    lat: typeof obj.lat === "number" ? obj.lat : null,
    lon:
      typeof obj.lon === "number"
        ? obj.lon
        : typeof obj.lng === "number"
          ? obj.lng
          : null,
    postal_code: typeof obj.postal_code === "string" ? obj.postal_code : null,
    label: typeof obj.label === "string" ? obj.label : null,
    place_id:
      typeof obj.place_id === "string"
        ? obj.place_id
        : typeof obj.address_place_id === "string"
          ? obj.address_place_id
          : null,
  };
}

export type CreateRequestFormValues = {
  title: string;
  description: string;
  city: string;
  category: string;
  subcategory: string;
  budget: number | "";
  requiredAt: string;
  conditionsText: string;
  files: File[];
  address: string;
};

export type Subcat = { id: string | null; name: string; icon: string | null };

export type CreateRequestFormState = {
  values: CreateRequestFormValues;
  errors: Record<string, string | undefined>;
  submitting: boolean;
  uploading: boolean;
  me: User | null;
  catMap: Record<string, Subcat[]>;
  loadingCats: boolean;
  cityTouched: boolean;
  isAutoCategorizing: boolean;
  // Address helpers
  addressLine: string;
  addressLat: number | null;
  addressLng: number | null;
  openMap: boolean;
  addrOpen: boolean;
  addrResolveBusy: boolean;
  addrSuggestions: AddressSuggestion[];
  recentAddrs: AddressSuggestion[];
  coords: { lat: number; lon: number } | null;
  savedAddrs: AddressSuggestion[];
  shouldSaveAddress: boolean;
  isAddressSaved: boolean;
  placeId: string | null;
  defaultAddressId: string | null;
};

export type CreateRequestFormApi = {
  state: CreateRequestFormState;
  // setters
  setTitle: (v: string) => void;
  setDescription: (v: string) => void;
  setCity: (v: string) => void;
  setCityTouched: (v: boolean) => void;
  detectCityNow: () => Promise<void>;
  setCategory: (v: string) => void;
  setSubcategory: (v: string) => void;
  setBudget: (v: number | "") => void;
  setRequiredAt: (v: string) => void;
  setConditionsText: (v: string) => void;
  setFiles: (files: File[]) => void;
  addFiles: (files: File[]) => void;
  removeFileAt: (index: number) => void;
  setOpenMap: (v: boolean) => void;
  setAddress: (v: string) => void;
  pickAddress: (it: {
    address: string;
    city?: string | null;
    lat?: number | null;
    lon?: number | null;
    place_id?: string | null;
  }) => void;
  debouncedFetchAddr: (q: string) => void;
  categoriesList: string[];
  subcatOptions: { value: string; label: string; icon: string | null }[];
  setAddrOpen: (v: boolean) => void;
  handleSubmit: (opts?: {
    onSuccess?: (newId?: string) => void;
  }) => Promise<void>;
  setShouldSaveAddress: (v: boolean) => void;
  setPlaceId: (v: string | null) => void;
  saveAddressNow: () => Promise<boolean>;
};

type FormValues = {
  title: string;
  description?: string;
  city: string;
  address: string;
  address_line: string;
  address_lat: number | null;
  address_lng: number | null;
  lat?: number;
  lng?: number;
  postcode?: string;
  state?: string;
  country?: string;
  place_id?: string;
  mapbox_context?: string;
};

export function useCreateRequestForm(): CreateRequestFormApi {
  const router = useRouter();

  // Values
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("Monterrey");
  const [category, setCategoryState] = useState("");
  const [cityTouched, setCityTouched] = useState(false);
  const [subcategory, setSubcategoryState] = useState("");
  const [budget, setBudget] = useState<number | "">("");
  const [requiredAt, setRequiredAt] = useState("");
  const [conditionsText, setConditionsText] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [me, setMe] = useState<User | null>(null);

  // react-hook-form (used for drafts sync and setValue helpers)
  const form = useForm<FormValues>({
    defaultValues: {
      city: "Monterrey",
      address: "",
      address_line: "",
      address_lat: null,
      address_lng: null,
    },
    mode: "onChange",
    shouldUnregister: false,
  });
  const { setValue, watch, reset } = form;
  // Drafts (purge if disabled on production host)
  useEffect(() => {
    try {
      if (!draftsEnabled()) purgeAllDrafts();
    } catch (error) {
      logFormError("drafts:purge", error);
    }
  }, []);

  const userId = me?.id ?? "anon";
  useFormDraft<FormValues>(`draft:requests/new:${userId}`, watch, reset, {
    debounceMs: 400,
  });

  // Auth session tracking
  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      setMe(data.session?.user ?? null);
      const { data: sub } = supabaseBrowser.auth.onAuthStateChange(
        (_e, session) => {
          setMe(session?.user ?? null);
        },
      );
      unsub = () => sub.subscription.unsubscribe();
    })();
    return () => {
      try {
        unsub?.();
      } catch (error) {
        logFormError("auth:unsubscribe", error);
      }
    };
  }, []);

  // City canonicalization helpers
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}+/gu, "")
      .toLowerCase()
      .trim();
  const CITIES_NORM = useMemo(
    () => new Map(CITIES.map((c) => [norm(c), c])),
    [],
  );
  const toCanon = useCallback(
    (raw?: string | null) => {
      const n = norm(String(raw ?? ""));
      const direct = CITIES_NORM.get(n);
      if (direct) return direct;
      if (n.includes("garza garcia")) return "San Pedro Garza García" as const;
      if (n.includes("san pedro")) return "San Pedro Garza García" as const;
      if (n.includes("san nicolas")) return "San Nicolás" as const;
      if (n.includes("general escobedo") || n.includes("escobedo"))
        return "Escobedo" as const;
      if (n.includes("santa catarina")) return "Santa Catarina" as const;
      if (n.includes("monterrey")) return "Monterrey" as const;
      if (n.includes("guadalupe")) return "Guadalupe" as const;
      if (n.includes("apodaca")) return "Apodaca" as const;
      if (n.includes("garcia")) return "García" as const;
      return null;
    },
    [CITIES_NORM],
  );

  const suggestCityUpdate = useCallback(
    (maybeCity?: string | null) => {
      const c = (maybeCity || "").toString().trim();
      if (!c) return;
      if (!(CITIES as ReadonlyArray<string>).includes(c)) return;
      if (c === city) return;
      try {
        toast.info(`Detectamos ${c}. ¿Actualizar ciudad?`, {
          action: {
            label: "Actualizar",
            onClick: () => {
              setCityTouched(true);
              setCity(c);
              try {
                setValue("city", c, { shouldDirty: true });
              } catch (error) {
                logFormError("set-city", error);
              }
            },
          },
        });
      } catch (error) {
        logFormError("toast-info", error);
        if (
          typeof window !== "undefined" &&
          window.confirm(`Detectamos ${c}. ¿Actualizar ciudad?`)
        ) {
          setCityTouched(true);
          setCity(c);
          try {
            setValue("city", c, { shouldDirty: true });
          } catch (err) {
            logFormError("set-city-confirm", err);
          }
        }
      }
    },
    [city, setValue],
  );

  // Address state
  const [address, setAddress] = useState<string>("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null,
  );
  const [addressLine, setAddressLine] = useState<string>("");
  const [addressLat, setAddressLat] = useState<number | null>(null);
  const [addressLng, setAddressLng] = useState<number | null>(null);
  const [openMap, setOpenMap] = useState(false);
  const [addrOpen, setAddrOpen] = useState(false);
  const addrResolveBusy = false;
  const [addrSuggestions, setAddrSuggestions] = useState<AddressSuggestion[]>(
    [],
  );
  const [recentAddrs] = useState<AddressSuggestion[]>([]);
  const [savedAddrs, setSavedAddrs] = useState<AddressSuggestion[]>([]);
  const [shouldSaveAddress, setShouldSaveAddress] = useState(false);
  const addrDebounceRef = useRef<number | null>(null);
  const addrTouchedRef = useRef(false);
  const savedAddressAppliedRef = useRef(false);
  const [defaultAddressId, setDefaultAddressId] = useState<string | null>(null);

  // Soft geolocation on mount -> suggest city update
  const detectCityNow = useCallback(async () => {
    if (!("geolocation" in navigator)) return;
    let pos: GeolocationPosition | null = null;
    try {
      pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        const id = window.setTimeout(
          () => reject(new Error("GEO_TIMEOUT")),
          5000,
        );
        navigator.geolocation.getCurrentPosition(
          (p) => {
            window.clearTimeout(id);
            resolve(p);
          },
          (error) => {
            window.clearTimeout(id);
            reject(error);
          },
          { enableHighAccuracy: false, timeout: 4000, maximumAge: 30000 },
        );
      });
    } catch (error) {
      logFormError("geo:detect", error);
    }
    if (!pos) return;
    const lat = Number(pos.coords.latitude);
    const lon = Number(pos.coords.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    setCoords({ lat, lon });
    try {
      const response = await fetch(
        `/api/geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lon))}`,
        {
          cache: "no-store",
          headers: { Accept: "application/json; charset=utf-8" },
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        city?: string;
      };
      if (data?.ok && typeof data.city === "string") {
        suggestCityUpdate(data.city);
      }
    } catch (error) {
      logFormError("geo:detect:reverse", error);
    }
  }, [suggestCityUpdate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (addrTouchedRef.current) return;
      if (address) return;
      if (cancelled) return;
      await detectCityNow();
    })();
    return () => {
      cancelled = true;
    };
    setShouldSaveAddress(false);
  }, [address, detectCityNow]);

  const normalizeAddress = useCallback((v: string | null | undefined) => {
    return (v || "").toString().trim().toLowerCase();
  }, []);

  const isAddressSaved = useMemo(() => {
    const norm = normalizeAddress(addressLine || address);
    const match = savedAddrs.some((it) => {
      const byPlace =
        placeId &&
        typeof it?.place_id === "string" &&
        it.place_id.trim() &&
        it.place_id.trim() === placeId;
      const byLine = normalizeAddress(it?.address) === norm;
      return byPlace || byLine;
    });
    return match;
  }, [address, addressLine, normalizeAddress, placeId, savedAddrs]);

  const saveAddress = useCallback(
    async (opts?: { force?: boolean; source?: "click" | "submit" }) => {
      const line = (addressLine || address || "").trim();
      const wantSave = opts?.force ?? shouldSaveAddress;
      if (!wantSave) return false;
      if (line.length < 5) return false;
      if (isAddressSaved) {
        setShouldSaveAddress(false);
        return true;
      }
      const toastError = (msg: string) => {
        toast.error(msg);
      };
      try {
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        if (!sessionData?.session) {
          toastError("Inicia sesión para guardar tu dirección.");
          return false;
        }
      } catch (error) {
        logFormError("save-address:getSession", error);
      }
      const canFallbackToRpc = false;
      const addLocal = (place: string | null, idFromApi?: string | null) => {
        setSavedAddrs((prev) => {
          const exists = prev.some((it) => {
            const byPlace =
              place &&
              typeof it?.place_id === "string" &&
              it.place_id.trim() === place;
            const byLine =
              normalizeAddress(it?.address) === normalizeAddress(line);
            return byPlace || byLine;
          });
          if (exists) return prev;
          const entry: AddressSuggestion = {
            id: idFromApi && idFromApi.trim() ? idFromApi : place || line,
            address: line,
            city,
            lat: addressLat,
            lon: addressLng,
            label: null,
            place_id: place,
          };
          if (entry.id) setDefaultAddressId(entry.id);
          return [entry, ...prev];
        });
      };

      const place = placeId?.trim() || null;
      try {
        const res = await fetch("/api/addresses/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          credentials: "include",
          body: JSON.stringify({
            address_line: line,
            address_place_id: placeId,
            lat: addressLat,
            lng: addressLng,
            label: null,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.ok === false) {
          const errCode = (json?.error || json?.detail || "").toString();
          if (res.status === 401 || errCode === "unauthorized") {
            toastError("Inicia sesión para guardar tu dirección.");
            return false;
          }
          if (errCode === "address_line_required") {
            toastError("Escribe una dirección para guardarla.");
            return false;
          }
          if (!canFallbackToRpc) {
            const detail = (json?.detail || json?.message || "")
              .toString()
              .trim();
            toastError(
              errCode
                ? detail
                  ? `No se pudo guardar la dirección (${errCode}: ${detail}).`
                  : `No se pudo guardar la dirección (${errCode}).`
                : "No se pudo guardar la dirección. Intenta de nuevo.",
            );
            return false;
          }
          // fallback a Supabase directo (solo en dev/local con Supabase URL válida)
          const { data, error } = await supabaseBrowser.rpc(
            "upsert_user_address",
            {
              address_line: line,
              address_place_id: placeId,
              lat: addressLat,
              lng: addressLng,
              label: null,
            },
          );
          if (error) {
            const msg =
              (error as { message?: string; code?: string })?.message || "";
            if (msg.includes("not_authenticated")) {
              toastError("Inicia sesión para guardar tu dirección.");
            } else {
              toastError("No se pudo guardar la dirección. Intenta de nuevo.");
            }
            return false;
          }
          addLocal(place, (data as string | null) ?? null);
          setShouldSaveAddress(false);
          return true;
        }
        addLocal(place, (json?.id as string | null) ?? null);
        setShouldSaveAddress(false);
        return true;
      } catch (error) {
        logFormError("save-address", error);
        toastError("No se pudo guardar la dirección. Intenta de nuevo.");
        return false;
      }
    },
    [
      address,
      addressLat,
      addressLng,
      addressLine,
      isAddressSaved,
      normalizeAddress,
      placeId,
      shouldSaveAddress,
      city,
    ],
  );

  // Load saved addresses for default detection
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/addresses/saved", {
          cache: "no-store",
          headers: { Accept: "application/json; charset=utf-8" },
          credentials: "include",
        });
        if (!res.ok) return;
        const json = await res.json().catch(() => ({}));
        const list = Array.isArray(json?.data)
          ? (json.data as AddressSuggestion[])
          : [];
        if (!cancelled) {
          const mapped = list
            .map((it) => toAddressSuggestion(it)!)
            .filter(Boolean);
          setSavedAddrs(mapped);
          const first = mapped[0];
          if (first?.id) setDefaultAddressId(first.id);
        }
      } catch (error) {
        logFormError("load-saved-addresses", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (savedAddressAppliedRef.current) return;
    if (addrTouchedRef.current) return;
    if (address.trim()) return;
    if (!savedAddrs.length) return;
    const first = savedAddrs[0];
    const line = (first?.address || "").trim();
    if (!line) return;
    savedAddressAppliedRef.current = true;
    const lat =
      typeof first.lat === "number"
        ? first.lat
        : typeof first.lon === "number"
          ? first.lon
          : null;
    const lon =
      typeof (first as { lng?: number }).lng === "number"
        ? (first as { lng: number }).lng
        : typeof first.lon === "number"
          ? first.lon
          : null;
    pickAddress({
      address: line,
      city: first.city ?? null,
      lat,
      lon,
      place_id: first.place_id ?? null,
    });
    setShouldSaveAddress(false);
  }, [address, pickAddress, savedAddrs]);

  // Categories
  const [catMap, setCatMap] = useState<Record<string, Subcat[]>>({});
  const [loadingCats, setLoadingCats] = useState(false);
  const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);
  useEffect(() => {
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
              tmp[cat].push({ id: null, name: sub, icon });
          });
          map = tmp;
        } catch (error) {
          logFormError("categories:http", error);
          try {
            const { data, error: dbError } = await supabaseBrowser
              .from("categories_subcategories")
              .select(
                '"categories_subcategories_id","Categoría","Subcategoría","Activa","ícono","Emoji"',
              );
            if (dbError) throw dbError;
            const tmp: Record<string, Subcat[]> = {};
            const isActive = (v: unknown) => {
              const s = (v ?? "").toString().trim().toLowerCase();
              return [
                "sí",
                "si",
                "true",
                "1",
                "activo",
                "activa",
                "x",
              ].includes(s);
            };
            (data || []).forEach((row: Record<string, unknown>) => {
              if (!isActive(row?.["Activa"])) return;
              const cat = (row?.["Categoría"] ?? "").toString().trim();
              const sub = (row?.["Subcategoría"] ?? "").toString().trim();
              const id = (row?.["categories_subcategories_id"] ?? null) as
                | string
                | null;
              const icon = (row?.["Emoji"] ?? "").toString().trim() || null;
              if (!cat) return;
              if (!tmp[cat]) tmp[cat] = [];
              if (sub && !tmp[cat].some((x) => x.name === sub))
                tmp[cat].push({ id, name: sub, icon });
            });
            map = tmp;
          } catch (dbError) {
            logFormError("categories:supabase", dbError);
            toast.error("No fue posible cargar categorías");
            map = {};
          }
        }
        if (!cancelled) setCatMap(map ?? {});
      } catch (error) {
        logFormError("categories:set", error);
        if (!cancelled) setCatMap({});
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categoriesList = useMemo(() => {
    const entries = Object.keys(catMap);
    return entries.sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" }),
    );
  }, [catMap]);

  const subcatOptions = useMemo(() => {
    const list = catMap[category] ?? [];
    if (list.length === 0) return [];
    return list
      .slice()
      .sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
      )
      .map((item) => ({ value: item.name, label: item.name, icon: item.icon }));
  }, [catMap, category]);

  // Autoclasificación (wrapper simplificado: usa endpoint "classify-request")
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const classifyAbortRef = useRef<AbortController | null>(null);
  const classifyTimeoutRef = useRef<number | null>(null);
  const classifyRequestIdRef = useRef(0);

  const clearClassifyTimeout = useCallback(() => {
    if (classifyTimeoutRef.current) {
      window.clearTimeout(classifyTimeoutRef.current);
      classifyTimeoutRef.current = null;
    }
  }, []);

  const runAutoClassification = useCallback(
    async (t: string, d: string, token: number) => {
      try {
        classifyAbortRef.current?.abort();
        const controller = new AbortController();
        classifyAbortRef.current = controller;
        const response = await fetch("/api/classify-request", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ title: t, description: d }),
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as {
          best?: ClassificationSuggestion | null;
          alternatives?: ClassificationSuggestion[];
          model?: string | null;
        } | null;
        if (!response.ok || !payload)
          throw new Error("classify_request_failed");
        if (token !== classifyRequestIdRef.current) return;
        const best = payload.best ?? null;
        setAiConfidence(
          typeof best?.confidence === "number" ? best.confidence : null,
        );
        if (best?.category) {
          setCategoryState(best.category);
          setSubcategoryState(best.subcategory ?? "");
        }
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
        if (token === classifyRequestIdRef.current) {
          setAiConfidence(null);
        }
        logFormError("classify-request", error);
      } finally {
        if (token === classifyRequestIdRef.current) {
          setIsAutoCategorizing(false);
        }
      }
    },
    [setCategoryState, setSubcategoryState],
  );

  useEffect(() => {
    const trimmedTitle = (title || "").trim();
    const trimmedDescription = (description || "").trim();
    const totalLength = (trimmedTitle + trimmedDescription).length;

    clearClassifyTimeout();
    classifyAbortRef.current?.abort();

    if (totalLength < 10) {
      classifyRequestIdRef.current += 1;
      setIsAutoCategorizing(false);
      setAiConfidence(null);
      return;
    }

    const token = ++classifyRequestIdRef.current;
    setIsAutoCategorizing(true);
    classifyTimeoutRef.current = window.setTimeout(() => {
      void runAutoClassification(trimmedTitle, trimmedDescription, token);
    }, 500);

    return () => {
      clearClassifyTimeout();
    };
  }, [title, description, runAutoClassification, clearClassifyTimeout]);

  useEffect(() => {
    return () => {
      classifyAbortRef.current?.abort();
      if (classifyTimeoutRef.current) {
        window.clearTimeout(classifyTimeoutRef.current);
      }
    };
  }, []);

  // Address suggestion fetch
  const fetchAddrSuggestions = useCallback(
    async (query: string) => {
      const qq = (query || "").trim();
      if (!qq) {
        setAddrSuggestions([]);
        return;
      }
      try {
        const params = new URLSearchParams();
        params.set("q", qq);
        if (city) params.set("city", city);
        params.set("limit", "5");
        const response = await fetch(
          `/api/addresses/suggest?${params.toString()}`,
          {
            cache: "no-store",
            headers: { Accept: "application/json" },
          },
        );
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          items?: unknown[];
        } | null;
        const parsed =
          payload?.ok && Array.isArray(payload.items)
            ? payload.items
                .map((item) => toAddressSuggestion(item))
                .filter((item): item is AddressSuggestion => Boolean(item))
            : [];
        setAddrSuggestions(parsed);
      } catch (error) {
        logFormError("address:suggest", error);
        setAddrSuggestions([]);
      }
    },
    [city],
  );

  const debouncedFetchAddr = useCallback(
    (query: string) => {
      if (addrDebounceRef.current) {
        window.clearTimeout(addrDebounceRef.current);
      }
      addrDebounceRef.current = window.setTimeout(() => {
        fetchAddrSuggestions(query);
      }, 250);
    },
    [fetchAddrSuggestions],
  );

  function pickAddress(it: AddressSuggestion) {
    const line = it.address || "";
    setAddressLine(line);
    setAddress(line);
    const lat = typeof it.lat === "number" ? it.lat : null;
    const lng = typeof it.lon === "number" ? it.lon : null;
    setPlaceId(it.place_id ?? null);
    setAddressLat(lat);
    setAddressLng(lng);
    if (typeof it.city === "string" && it.city) {
      const canon = toCanon(it.city);
      if (canon) {
        setCity(canon);
        try {
          setValue("city", canon, { shouldDirty: true });
        } catch (error) {
          logFormError("pickAddress:setCity", error);
        }
      }
    }
    try {
      setValue("address_line", line, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue("address_lat", lat ?? null, { shouldDirty: true });
      setValue("address_lng", lng ?? null, { shouldDirty: true });
    } catch (error) {
      logFormError("pickAddress:setAddress", error);
    }
    setAddrOpen(false);
  }

  // Zod schema (same as page)
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
    conditions: z
      .union([
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
      ])
      .optional(),
    address_line: z.string().min(5, "Ingresa una dirección válida").max(500),
    address_place_id: z.string().max(200).optional().or(z.literal("")),
    address_lat: z.number().nullable(),
    address_lng: z.number().nullable(),
  });

  // Submit logic
  async function handleSubmit(opts?: { onSuccess?: (newId?: string) => void }) {
    setSubmitting(true);
    setErrors({});
    try {
      // Auth gating
      try {
        const { data } = await supabaseBrowser.auth.getSession();
        const userNow = data.session?.user ?? me;
        if (!userNow) {
          const draftLat =
            coords && typeof coords.lat === "number" ? coords.lat : null;
          const draftLng =
            coords && typeof coords.lon === "number" ? coords.lon : null;
          const draftPayload: RequestDraftSnapshot = {
            title,
            description,
            city,
            category,
            subcategory,
            budget,
            required_at: requiredAt,
            conditions: conditionsText,
            address_line: address,
            address_lat: draftLat,
            address_lng: draftLng,
          };
          writeDraft("draft:create-service", draftPayload);
          setPendingAutoSubmit(true);
          try {
            setReturnTo(`${window.location.pathname}${window.location.search}`);
          } catch (error) {
            logFormError("auth:setReturnTo", error);
          }
          toast.info("Se requiere iniciar sesión para continuar.");
          setSubmitting(false);
          return;
        }
        setMe(userNow);
      } catch (error) {
        logFormError("auth:gating", error);
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
        address_line: address,
        address_place_id: "",
        address_lat: addressLat ?? null,
        address_lng: addressLng ?? null,
      });

      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        parsed.error.issues.forEach((i) => {
          const k = (i.path[0] as string) ?? "form";
          if (!fieldErrors[k]) fieldErrors[k] = i.message;
        });
        setErrors(fieldErrors);
        const hasAddressError = Object.prototype.hasOwnProperty.call(
          fieldErrors,
          "address_line",
        );
        toast.error(
          hasAddressError
            ? "Favor de indicar Dirección"
            : "Revisa los campos del formulario",
        );
        setSubmitting(false);
        return;
      }

      // Additional validation: category exists and subcategory selection
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

      // Upload attachments
      const attachments: Array<{
        url: string;
        mime: string;
        size: number;
        path?: string;
      }> = [];
      if (files.length > 0) {
        setUploading(true);
        try {
          try {
            await fetch("/api/storage/ensure?b=requests", { method: "POST" });
          } catch (error) {
            logFormError("storage:ensure", error);
          }
          const prefix = me?.id ?? "anon";
          for (const f of files) {
            const max = 5 * 1024 * 1024;
            if (f.size > max)
              throw new Error(`El archivo ${f.name} excede 5MB`);
            if (!/^image\//i.test(f.type))
              throw new Error(`Tipo inválido para ${f.name}`);
            const {
              url: uploadedUrl,
              path,
              mime,
            } = await uploadRequestFile(supabaseBrowser, prefix, f);
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

      // Geocode if address has no coords
      if (
        (address || "").trim().length > 0 &&
        (addressLat == null || addressLng == null)
      ) {
        try {
          const r = await fetch(
            `/api/geocode/search?q=${encodeURIComponent(address.trim())}`,
            {
              cache: "no-store",
              headers: { Accept: "application/json; charset=utf-8" },
            },
          );
          const j = (await r.json().catch(() => ({}))) as {
            data?: Array<Record<string, unknown>>;
          };
          const first =
            Array.isArray(j?.data) && j.data.length ? j.data[0] : null;
          if (first) {
            if (typeof first.lat === "number") setAddressLat(first.lat);
            if (typeof first.lon === "number") setAddressLng(first.lon);
            if (
              typeof first.city === "string" &&
              first.city.trim().length > 0
            ) {
              const canon = toCanon(first.city);
              if (canon) setCity(canon);
            }
            try {
              setValue("address_line", address.trim(), {
                shouldDirty: true,
                shouldValidate: true,
              });
              setValue(
                "address_lat",
                typeof first.lat === "number" ? first.lat : null,
                { shouldDirty: true },
              );
              setValue(
                "address_lng",
                typeof first.lon === "number" ? first.lon : null,
                { shouldDirty: true },
              );
            } catch (error) {
              logFormError("geocode:setValue", error);
            }
          }
        } catch (error) {
          logFormError("geocode:search", error);
        }
      }

      // Build payload
      const payload: Record<string, unknown> = {
        title: parsed.data.title,
        city: parsed.data.city,
      };
      if (parsed.data.description && parsed.data.description.length > 0)
        payload.description = parsed.data.description.trim();
      if (category) payload.category = category;
      if (subcategory) payload.subcategory = subcategory;
      if (budget !== "" && typeof budget === "number") payload.budget = budget;
      if (requiredAt) payload.required_at = requiredAt;
      if ((conditionsText || "").trim())
        payload.conditions = (conditionsText || "").trim();
      if ((address || "").trim()) payload.address_line = address.trim();
      if (addressLat != null && addressLng != null) {
        payload.address_lat = addressLat;
        payload.address_lng = addressLng;
      }
      if (attachments.length > 0) payload.attachments = attachments;

      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) {
        toast.error(
          j?.detail || j?.error || "No fue posible crear la solicitud",
        );
        setSubmitting(false);
        return;
      }
      const newId: string | undefined = j?.data?.id;

      try {
        await fetch("/api/profile/active-user-type", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ to: "cliente" }),
        });
      } catch (error) {
        logFormError("profile:active-user-type", error);
      }
      clearDraft("draft:create-service");
      clearGatingFlags();

      await saveAddress({ force: shouldSaveAddress });

      if (opts?.onSuccess) opts.onSuccess(newId);
      else if (newId) router.push(`/requests/${newId}`);
    } finally {
      setSubmitting(false);
    }
  }

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  // Autosubmit after login (pending flag)
  // We only want to attempt auto-submit once after login.
  useEffect(() => {
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
          address?: string;
          lat?: number;
          lon?: number;
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
        if (typeof d.category === "string") setCategoryState(d.category);
        if (typeof d.subcategory === "string")
          setSubcategoryState(d.subcategory);
        if (typeof d.budget !== "undefined") setBudget(d.budget as number | "");
        if (typeof d.required_at === "string") setRequiredAt(d.required_at);
        if (Array.isArray(d.conditions))
          setConditionsText(d.conditions.join(", "));
        else if (typeof d.conditions === "string")
          setConditionsText(d.conditions);
        await new Promise((r) => setTimeout(r, 50));
        try {
          await handleSubmitRef.current();
        } catch (error) {
          logFormError("autosubmit:handleSubmit", error);
        }
      } catch (error) {
        logFormError("autosubmit:prepare", error);
      }
    })();
  }, []);

  const addFiles = useCallback((incoming: File[]) => {
    if (!incoming || incoming.length === 0) return;
    setFiles((prev) => {
      const combined = [...prev];
      for (const f of incoming) {
        if (combined.length >= 5) break;
        const dup = combined.some(
          (x) => x.name === f.name && x.size === f.size,
        );
        if (!dup) combined.push(f);
      }
      if (prev.length + incoming.length > 5)
        toast.error("Solo puedes adjuntar hasta 5 imágenes.");
      return combined.slice(0, 5);
    });
  }, []);

  const removeFileAt = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    state: {
      values: {
        title,
        description,
        city,
        category,
        subcategory,
        budget,
        requiredAt,
        conditionsText,
        files,
        address,
      },
      errors,
      submitting,
      uploading,
      me,
      catMap,
      loadingCats,
      cityTouched,
      isAutoCategorizing,
      addressLine,
      addressLat,
      addressLng,
      openMap,
      addrOpen,
      addrResolveBusy,
      addrSuggestions,
      recentAddrs,
      coords,
      savedAddrs,
      shouldSaveAddress,
      isAddressSaved,
      placeId,
      defaultAddressId,
    },
    setTitle,
    setDescription,
    setCity: (value) => {
      setCity(value);
      try {
        setValue("city", value, { shouldDirty: true });
      } catch (error) {
        logFormError("setCity", error);
      }
    },
    setCityTouched,
    detectCityNow,
    setCategory: (value) => {
      setCategoryState(value);
      setSubcategoryState("");
      try {
        track("requests.auto_classified", {
          overridden: true,
          confidence: aiConfidence ?? null,
          alt_clicked: false,
          action: "category_manual",
        });
      } catch (error) {
        logFormError("setCategory:track", error);
      }
    },
    setSubcategory: (value) => {
      setSubcategoryState(value);
      try {
        track("requests.auto_classified", {
          overridden: true,
          confidence: aiConfidence ?? null,
          alt_clicked: false,
          action: "subcategory_manual",
        });
      } catch (error) {
        logFormError("setSubcategory:track", error);
      }
    },
    setBudget,
    setRequiredAt,
    setConditionsText,
    setFiles,
    addFiles,
    removeFileAt,
    setOpenMap,
    saveAddressNow: () => saveAddress({ force: true }),
    setAddress: (value) => {
      addrTouchedRef.current = true;
      setAddress(value);
      setAddressLine(value);
      setAddressLat(null);
      setAddressLng(null);
      setPlaceId(null);
      setShouldSaveAddress(false);
      try {
        setValue("address_line", value, {
          shouldDirty: true,
          shouldValidate: true,
        });
        setValue("address_lat", null, { shouldDirty: true });
        setValue("address_lng", null, { shouldDirty: true });
      } catch (error) {
        logFormError("setAddress", error);
      }
      const query = (value || "").trim();
      if (query.length >= 3) {
        setAddrOpen(true);
        debouncedFetchAddr(value);
      } else {
        setAddrSuggestions([]);
        setAddrOpen(false);
      }
    },
    pickAddress,
    debouncedFetchAddr,
    categoriesList,
    subcatOptions,
    setAddrOpen,
    handleSubmit,
    setShouldSaveAddress,
    setPlaceId,
  };
}

export default useCreateRequestForm;

async function uploadRequestFile(
  supabase: SupabaseClient,
  ownerPrefix: string,
  file: File,
): Promise<{ url: string; path: string; mime: string }> {
  const bucket = "requests";
  const owner = (ownerPrefix || "anon").trim();
  const contentType = file.type || "application/octet-stream";
  let key = buildStorageKey(owner, file.name, {
    allowUnicode: false,
    maxNameLength: 180,
  });
  const upload = () =>
    supabase.storage
      .from(bucket)
      .upload(key, file, { cacheControl: "3600", upsert: false, contentType });
  let { data, error } = await upload();
  if (error && /invalid key/i.test(String(error.message || ""))) {
    const ultraKey = buildUltraSafeKey(owner, file.name);
    key = ultraKey;
    const retry = await upload();
    data = retry.data;
    error = retry.error;
  }
  if (error) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("path", key);
      fd.append("bucket", bucket);
      const response = await fetch("/api/storage/upload", {
        method: "POST",
        body: fd,
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        url?: string;
      } | null;
      if (response.ok && payload?.ok && typeof payload.url === "string") {
        return { url: payload.url, path: key, mime: contentType };
      }
    } catch (fallbackError) {
      logFormError("storage:fallback-upload", fallbackError);
    }
    throw error;
  }
  if (!data?.path) {
    throw new Error("Upload failed");
  }
  const pub = supabase.storage.from(bucket).getPublicUrl(key);
  return { url: pub.data.publicUrl, path: key, mime: contentType };
}
