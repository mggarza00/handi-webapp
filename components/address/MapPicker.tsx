"use client";

import * as React from "react";
// For default Mapbox styles, import its CSS in your global stylesheet or layout if desired:
// import 'mapbox-gl/dist/mapbox-gl.css';

type Props = {
  lat: number | null;
  lng: number | null;
  city?: string; // default center when no coords
  withSearch?: boolean;
  onPick: (args: { address_line: string | null; place_id: string | null; lat: number; lng: number }) => void | Promise<void>;
};

export default function MapPicker({ lat, lng, city = "Monterrey", withSearch = true, onPick }: Props) {
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const markerRef = React.useRef<any>(null);
  const mapboxRef = React.useRef<any>(null);
  const mapRefInstance = React.useRef<any>(null);
  const [q, setQ] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [resolved, setResolved] = React.useState<{ address_line: string | null; place_id: string | null } | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  const defaultCenter: [number, number] = React.useMemo(() => {
    // Defaults by city (Monterrey fallback)
    const cityLower = (city || "").toLowerCase();
    if (cityLower.includes("monterrey")) return [-100.3161, 25.6866];
    if (cityLower.includes("cdmx") || cityLower.includes("ciudad de méxico") || cityLower.includes("ciudad de mexico")) return [-99.1332, 19.4326];
    return [-100.3161, 25.6866];
  }, [city]);

  const initial: [number, number] = React.useMemo(() => {
    if (typeof lng === "number" && typeof lat === "number") return [lng, lat];
    return defaultCenter;
  }, [lat, lng, defaultCenter]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default as any;
        if (cancelled) return;
        mapboxgl.accessToken = token;
        mapboxRef.current = mapboxgl;
        // Espera a que el contenedor tenga tamaño > 0 antes de montar el mapa
        const ensureSize = async () => {
          for (let i = 0; i < 30; i++) {
            if (cancelled) return true;
            const el = mapRef.current;
            const rect = el?.getBoundingClientRect?.();
            if (rect && rect.width > 0 && rect.height > 0) return true;
            await new Promise((r) => requestAnimationFrame(r));
          }
          return true;
        };
        await ensureSize();

        const map = new mapboxgl.Map({
          container: mapRef.current!,
          style: "mapbox://styles/mapbox/streets-v11",
          center: Array.isArray(initial) && initial.length === 2 && Number.isFinite(initial[0]) && Number.isFinite(initial[1])
            ? initial
            : ([-100.3161, 25.6866] as [number, number]),
          zoom: 14,
        });
        mapRefInstance.current = map;
        // Fallback timer: if 'load' never fires (e.g., token/style issue), stop spinner
        const loadTimer = setTimeout(() => { if (!cancelled) setIsLoaded(true); }, 2500);
        // @ts-ignore
        map.__loadTimer = loadTimer;
        const doResize = () => { try { map.resize(); } catch { /* ignore */ } };
        map.on("load", () => {
          if (cancelled) return;
          const m = new mapboxgl.Marker({ draggable: true })
            .setLngLat(initial)
            .addTo(map);
          markerRef.current = m;
          m.on("dragend", () => void reverseNow());
          doResize();
          setTimeout(doResize, 50);
          setTimeout(doResize, 200);
          setIsLoaded(true);
          setLoadError(null);
          const hasInitial = Array.isArray(initial) && initial.length === 2 && Number.isFinite(initial[0]) && Number.isFinite(initial[1]);
          if (hasInitial) void reverseNow();
        });
        map.once('idle', () => { doResize(); if (!cancelled) setIsLoaded(true); });
        // Resize observer to keep map transform in sync with container
        const el = mapRef.current;
        let observer: ResizeObserver | null = null;
        if (typeof window !== 'undefined' && 'ResizeObserver' in window && el) {
          observer = new ResizeObserver(() => { doResize(); });
          observer.observe(el);
        }
        map.on("click", (e: any) => {
          const ll = (e && (e.lngLat || e.lnglat)) || null;
          if (!ll) return;
          const m = markerRef.current;
          if (m) m.setLngLat(ll);
          else {
            const mm = new mapboxRef.current.Marker({ draggable: true }).setLngLat(ll).addTo(map);
            markerRef.current = mm;
          }
          void reverseNow();
        });
        map.on('error', (ev: any) => {
          try { doResize(); } catch {}
          setIsLoaded(true);
          const msg = ev && (ev.error || ev.message) ? String(ev.error || ev.message) : 'map_error';
          setLoadError(msg);
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      try { markerRef.current?.remove?.(); } catch {}
      try { 
        // clear fallback timer if present
        // @ts-ignore
        if (mapRefInstance.current && mapRefInstance.current.__loadTimer) clearTimeout(mapRefInstance.current.__loadTimer);
        mapRefInstance.current?.remove?.();
      } catch {}
      markerRef.current = null;
      mapRefInstance.current = null;
      try {
        const el = mapRef.current;
        // @ts-ignore
        if (el && el.__ro) { /* noop legacy */ }
      } catch {}
    };
  }, [token, initial]);

  async function reverseNow() {
    try {
      const m = markerRef.current;
      const ll = m?.getLngLat?.();
      if (!ll) return;
      const res = await fetch(`/api/geocode?lat=${encodeURIComponent(String(ll.lat))}&lng=${encodeURIComponent(String(ll.lng))}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      setResolved({ address_line: (j?.address_line || null) as string | null, place_id: (j?.place_id || null) as string | null });
    } catch {
      setResolved(null);
    }
  }

  async function searchNow() {
    const qq = q.trim();
    if (!qq) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(qq)}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      const first = Array.isArray(j?.results) && j.results.length ? j.results[0] : null;
      if (first && typeof first.lat === "number" && typeof first.lng === "number") {
        const ll = { lng: first.lng, lat: first.lat } as any;
        if (markerRef.current) markerRef.current.setLngLat(ll);
        if (mapRefInstance.current) mapRefInstance.current.flyTo({ center: [first.lng, first.lat], zoom: 15 });
        setResolved({ address_line: (first?.address_line || null) as string | null, place_id: (first?.place_id || null) as string | null });
      }
    } catch {
      /* ignore */
    } finally {
      setSearching(false);
    }
  }

  async function confirm() {
    const m = markerRef.current;
    const ll = m?.getLngLat?.();
    if (!ll) return;
    const addr = resolved || null;
    await onPick({ address_line: addr?.address_line ?? null, place_id: addr?.place_id ?? null, lat: ll.lat, lng: ll.lng });
  }

  return (
    <div className="w-full">
      {withSearch ? (
        <div className="flex items-center gap-2 p-3">
          <input
            type="text"
            placeholder="Buscar dirección…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void searchNow(); } }}
            className="flex-1 rounded border px-2 py-1 text-sm"
          />
          <button className="px-3 py-1.5 text-sm rounded bg-slate-700 text-white disabled:opacity-50" onClick={() => void searchNow()} disabled={searching}>
            {searching ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      ) : null}
      <div className="relative h-[60vh] min-h-[300px] w-full">
        <div
          ref={mapRef}
          className="h-full w-full"
          style={{ pointerEvents: isLoaded ? 'auto' : 'none' }}
        />
        {!isLoaded ? (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-xs text-slate-600 bg-white/10">
            Cargando mapa…
          </div>
        ) : null}
        {loadError ? (
          <div className="absolute bottom-2 right-2 rounded bg-amber-50 text-amber-800 text-[11px] px-2 py-1 border border-amber-200">
            No se pudo cargar el mapa
          </div>
        ) : null}
      </div>
      <div className="p-3">
        <div className="text-sm text-slate-600 truncate" title={resolved?.address_line || undefined}>
          {resolved?.address_line || ''}
        </div>
        <div className="flex items-center justify-end gap-2 mt-2">
          <button className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => void confirm()}>Usar esta ubicación</button>
        </div>
      </div>
    </div>
  );
}
