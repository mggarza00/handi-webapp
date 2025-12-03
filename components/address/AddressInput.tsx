"use client";

import * as React from "react";
import { MapPin } from "lucide-react";

import MapPickerModal, { type Payload as MapPickerPayload } from "@/components/address/MapPickerModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AddressContext = MapPickerPayload["context"];

export type AddressValue = {
  address_line?: string | null;
  place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  postcode?: string | null;
  state?: string | null;
  country?: string | null;
  context?: AddressContext;
};

type Props = {
  value?: AddressValue | null;
  onChange: (address_line: string, place_id: string | null, lat: number | null, lng: number | null) => void;
  userId?: string | null;
  placeholder?: string;
  onDetails?: (meta: { city?: string | null; postcode?: string | null; state?: string | null; country?: string | null; context?: AddressContext }) => void;
  cityHint?: string;
};

type Suggestion = {
  address_line: string;
  place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  postcode?: string | null;
  state?: string | null;
  country?: string | null;
  context?: AddressContext;
  _source: "saved" | "geocode";
};

function useDebounced<T extends (...args: unknown[]) => void>(fn: T, wait = 350) {
  const ref = React.useRef<number | null>(null);
  return React.useCallback(
    (...args: Parameters<T>) => {
      if (ref.current) window.clearTimeout(ref.current);
      ref.current = window.setTimeout(() => {
        fn(...args);
      }, wait);
    },
    [fn, wait],
  );
}

export default function AddressInput({ value, onChange, userId, placeholder = "Escribe tu dirección…", onDetails, cityHint }: Props) {
  const [q, setQ] = React.useState<string>((value?.address_line || "") as string);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saved, setSaved] = React.useState<Suggestion[]>([]);
  const [results, setResults] = React.useState<Suggestion[]>([]);
  const [showList, setShowList] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const onChangeRef = React.useRef(onChange);
  const valueAddressRef = React.useRef(value?.address_line || "");
  const qRef = React.useRef(q);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    valueAddressRef.current = value?.address_line || "";
  }, [value?.address_line]);

  React.useEffect(() => {
    qRef.current = q;
  }, [q]);

  // Prefetch saved addresses for the current user
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/addresses/saved", { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        const list: Array<Record<string, unknown>> = Array.isArray(j?.data) ? j.data : [];
        if (!cancelled) {
          const mapped: Suggestion[] = list
            .map<Suggestion>((r) => ({
              address_line: String(r?.address_line || ""),
              place_id: typeof r?.address_place_id === "string" ? r.address_place_id : null,
              lat: typeof r?.lat === "number" ? r.lat : null,
              lng: typeof r?.lng === "number" ? r.lng : null,
              city: null,
              postcode: null,
              state: null,
              country: null,
              context: null,
              _source: "saved",
            }))
            .filter((s) => s.address_line.length > 0);
          setSaved(mapped);
          // Prefill with last used address if no value provided
          try {
            const current = (qRef.current || (valueAddressRef.current || "")).toString();
            if (!current && mapped.length > 0) {
              const first = mapped[0];
              setQ(first.address_line || "");
              onChangeRef.current(first.address_line || "", first.place_id || null, first.lat ?? null, first.lng ?? null);
            }
          } catch { /* ignore */ }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Outside click closes list
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!containerRef.current || !target) return;
      if (!containerRef.current.contains(target)) setShowList(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const suggest = React.useCallback(async (query: string) => {
    const qq = (query || "").trim();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (qq) params.set("q", qq);
      if (cityHint) params.set("city", cityHint);
      params.set("limit", "5");
      const res = await fetch(`/api/addresses/suggest?${params.toString()}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      const items: Array<{
        id?: string;
        address: string;
        city?: string | null;
        lat?: number | null;
        lon?: number | null;
        postal_code?: string | null;
        label?: string | null;
        _source?: string | null;
      }> = Array.isArray(j?.items) ? j.items : (Array.isArray(j?.data) ? j.data : []);

      const normalizeSource = (source?: string | null): Suggestion["_source"] =>
        source === "saved" ? "saved" : "geocode";

      const mapped: Suggestion[] = (items || [])
        .map<Suggestion>((it) => ({
          address_line: String(it.address || ""),
          place_id: typeof it.id === "string" ? it.id : null,
          lat: typeof it.lat === "number" ? it.lat : null,
          lng: typeof it.lon === "number" ? it.lon : null,
          city: typeof it.city === "string" ? it.city : null,
          postcode: typeof it.postal_code === "string" ? it.postal_code : null,
          state: null,
          country: null,
          context: null,
          _source: it.id ? "saved" : normalizeSource(it._source ?? null),
        }))
        .filter((x) => x.address_line.length > 0);
      setResults(mapped);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [cityHint]);

  const debouncedSuggest = useDebounced(suggest, 300);

  const merged = React.useMemo(() => {
    const out: Suggestion[] = [];
    const key = (s: Suggestion) => `${(s.place_id || "").toString()}|${(s.address_line || "").toString().toLowerCase()}`;
    const seen = new Set<string>();
    for (const s of saved) { const k = key(s); if (!seen.has(k)) { seen.add(k); out.push(s); } }
    for (const s of results) { const k = key(s); if (!seen.has(k)) { seen.add(k); out.push(s); } }
    return out;
  }, [saved, results]);

  function pick(s: Suggestion) {
    setQ(s.address_line || "");
    onChange(s.address_line || "", s.place_id || null, s.lat ?? null, s.lng ?? null);
    onDetails?.({ city: s.city ?? null, postcode: s.postcode ?? null, state: s.state ?? null, country: s.country ?? null, context: s.context ?? null });
    setShowList(false);
  }

  return (
    <div ref={containerRef} className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Input
            placeholder={placeholder}
            value={q}
            onFocus={() => {
              setShowList(true);
              // Prefetch suggested/recent addresses
              try { debouncedSuggest(q || ""); } catch { /* ignore */ }
            }}
            onChange={(e) => {
              const v = e.target.value;
              setQ(v);
              onChange(v, null, null, null);
              debouncedSuggest(v);
              setShowList(true);
            }}
          />
          {showList && (merged.length > 0 || loading) ? (
            <div className="absolute z-20 mt-1 w-full rounded-md border bg-white shadow">
              <ul className="max-h-64 overflow-auto text-sm">
                {saved.length > 0 ? (
                  <li className="px-3 py-1 text-[10px] uppercase tracking-wide text-slate-500">Usadas recientemente</li>
                ) : null}
                {merged.map((s, idx) => (
                  <li key={`${s._source}-${idx}`} className="px-3 py-2 hover:bg-slate-50 cursor-pointer" onClick={() => pick(s)}>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s._source === "saved" ? "#0ea5e9" : "#64748b" }} />
                      <span className="truncate" title={s.address_line || undefined}>{s.address_line}</span>
                    </div>
                  </li>
                ))}
                {loading ? <li className="px-3 py-2 text-slate-500">Buscando…</li> : null}
              </ul>
            </div>
          ) : null}
        </div>
        <Button type="button" variant="outline" onClick={() => setOpen(true)} title="Seleccionar en mapa">
          <MapPin size={18} />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Protegemos tu privacidad: tu dirección solo se comparte con el profesional contratado cuando el servicio queda agendado.
      </p>
      {open ? (
        <MapPickerModal
          open={open}
          initial={{
            lat: typeof value?.lat === "number" ? (value!.lat as number) : undefined,
            lng: typeof value?.lng === "number" ? (value!.lng as number) : undefined,
            address: ((value?.address_line || q || "") as string) || undefined,
          }}
          onClose={() => setOpen(false)}
          onConfirm={(payload: MapPickerPayload) => {
            const line = payload.address || "";
            const pid = payload.place_id || null;
            setQ(line);
            onChange(line, pid, payload.lat, payload.lng);
            onDetails?.({
              city: payload.city ?? null,
              postcode: payload.postcode ?? null,
              state: payload.state ?? null,
              country: payload.country ?? null,
              context: (payload.context as AddressContext) ?? null,
            });
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
