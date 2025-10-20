"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase-browser";

type AddressValue = {
  address_line: string;
  place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type Props = {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  placeholder?: string;
};

const MapPickerModal = dynamic(() => import("./MapPickerModal"), { ssr: false });

type Suggestion = AddressValue & { _source: "saved" | "geocode" };

function useDebounced<T extends (...args: any[]) => void>(fn: T, wait = 350) {
  const ref = React.useRef<number | null>(null);
  return React.useCallback((...args: Parameters<T>) => {
    if (ref.current) window.clearTimeout(ref.current);
    ref.current = window.setTimeout(() => {
      (fn as any)(...args as any);
    }, wait);
  }, [fn, wait]);
}

export default function AddressField({ value, onChange, placeholder = "Escribe tu dirección…" }: Props) {
  const [q, setQ] = React.useState<string>(value?.address_line || "");
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saved, setSaved] = React.useState<Suggestion[]>([]);
  const [results, setResults] = React.useState<Suggestion[]>([]);
  const [showList, setShowList] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Load recent saved addresses for the user
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabaseBrowser
          .from("user_saved_addresses")
          .select("id,label,address_line,address_place_id,lat,lng,last_used_at")
          .order("last_used_at", { ascending: false })
          .limit(5);
        if (!cancelled && !error) {
          const mapped: Suggestion[] = (data || []).map((r) => ({
            address_line: r.address_line,
            place_id: r.address_place_id,
            lat: r.lat,
            lng: r.lng,
            _source: "saved",
          }));
          setSaved(mapped);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Close suggestions when clicking outside
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!containerRef.current || !target) return;
      if (!containerRef.current.contains(target)) setShowList(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const geocode = React.useCallback(async (query: string) => {
    const qq = query.trim();
    if (!qq || qq.length < 3) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(qq)}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) { setResults([]); return; }
      const feats = Array.isArray(j?.results) ? j.results : [];
      const mapped: Suggestion[] = feats.map((f: any) => ({
        address_line: String(f?.address_line || ""),
        place_id: typeof f?.place_id === "string" ? f.place_id : null,
        lat: typeof f?.lat === "number" ? f.lat : null,
        lng: typeof f?.lng === "number" ? f.lng : null,
        _source: "geocode",
      }));
      setResults(mapped);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedGeocode = useDebounced(geocode, 350);

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
    onChange({ address_line: s.address_line || "", place_id: s.place_id || null, lat: s.lat ?? null, lng: s.lng ?? null });
    setShowList(false);
  }

  return (
    <div ref={containerRef} className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Input
            placeholder={placeholder}
            value={q}
            onFocus={() => setShowList(true)}
            onChange={(e) => {
              const v = e.target.value;
              setQ(v);
              onChange({ address_line: v, place_id: null, lat: null, lng: null });
              debouncedGeocode(v);
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
                      <span className="truncate" title={s.address_line}>{s.address_line}</span>
                    </div>
                  </li>
                ))}
                {loading ? <li className="px-3 py-2 text-slate-500">Buscando…</li> : null}
              </ul>
            </div>
          ) : null}
        </div>
        <Button type="button" variant="outline" onClick={() => setOpen(true)} title="Seleccionar en mapa">
          📍
        </Button>
      </div>
      <p className="text-xs text-slate-500">Protegemos tu privacidad: tu dirección solo se comparte con el profesional contratado cuando el servicio queda agendado.</p>
      {open ? (
        <MapPickerModal
          open={open}
          onOpenChange={setOpen}
          lat={value?.lat ?? null}
          lng={value?.lng ?? null}
          onPick={async (lat, lng) => {
            try {
              const res = await fetch(`/api/geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`, { cache: "no-store" });
              const j = await res.json().catch(() => ({}));
              const line = (j?.address_line || "") as string;
              const pid = (j?.place_id || null) as string | null;
              setQ(line);
              onChange({ address_line: line, place_id: pid, lat, lng });
              setOpen(false);
            } catch {
              onChange({ address_line: value?.address_line || "", place_id: value?.place_id ?? null, lat, lng });
              setOpen(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}
