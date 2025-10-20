"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type Payload = {
  address: string;
  lat: number;
  lng: number;
  city?: string;
  postcode?: string;
  state?: string;
  country?: string;
  place_id?: string;
  context?: any;
};

type Initial = { lat?: number; lng?: number; address?: string };

type Props = {
  open: boolean;
  initial?: Initial;
  onClose: () => void;
  onConfirm: (payload: Payload) => void;
};

// Safe dynamic module imports (avoid SSR of mapbox-gl)
const mapboxglPromise = import("mapbox-gl");
// Import the installed geocoder package only
const geocoderPromise: Promise<{ default: any }> = import("@mapbox/mapbox-gl-geocoder");

export default function MapPickerModal({ open, initial, onClose, onConfirm }: Props) {
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = React.useRef<any>(null);
  const markerRef = React.useRef<any>(null);
  const geocoderContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = React.useState<string>(initial?.address || "");
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [resolved, setResolved] = React.useState<{
    address: string | null;
    place_id: string | null;
    city?: string | null;
    postcode?: string | null;
    state?: string | null;
    country?: string | null;
    context?: any;
  } | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  const defaultCenter: [number, number] = React.useMemo(() => {
    // If initial lat/lng are provided, center will be built from them below.
    // Otherwise, default by common cities, using address hint if present.
    const hint = ((initial?.address as string | undefined) || "").toLowerCase();
    if (hint.includes("monterrey")) return [-100.3161, 25.6866];
    if (hint.includes("cdmx") || hint.includes("ciudad de méxico") || hint.includes("ciudad de mexico")) return [-99.1332, 19.4326];
    return [-100.3161, 25.6866];
  }, [initial?.address]);

  const center: [number, number] = React.useMemo(() => {
    const ilng = typeof initial?.lng === "number" ? (initial!.lng as number) : null;
    const ilat = typeof initial?.lat === "number" ? (initial!.lat as number) : null;
    if (typeof ilng === "number" && typeof ilat === "number") return [ilng, ilat];
    return defaultCenter;
  }, [initial?.lat, initial?.lng, defaultCenter]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        const [{ default: mapboxgl }, { default: MapboxGeocoder }]: [any, any] = await Promise.all([
          mapboxglPromise as unknown as Promise<{ default: any }>,
          geocoderPromise,
        ]);
        if (cancelled) return;
        mapboxgl.accessToken = token;
        const container = mapRef.current!;
        const map = new mapboxgl.Map({
          container,
          style: "mapbox://styles/mapbox/streets-v11",
          center: center,
          zoom: 14,
          attributionControl: true,
        });
        mapInstanceRef.current = map;

        // Zoom controls
        try {
          const nav = new (mapboxgl as any).NavigationControl({ showCompass: false, showZoom: true });
          map.addControl(nav, "top-right");
        } catch {}

        // Geolocate control and default location
        let geolocate: any = null;
        try {
          geolocate = new (mapboxgl as any).GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: false,
            showAccuracyCircle: false,
          });
          map.addControl(geolocate, "top-right");
          geolocate.on("geolocate", (e: any) => {
            const lat = Number(e?.coords?.latitude);
            const lng = Number(e?.coords?.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            try { map.flyTo({ center: [lng, lat], zoom: 15 }); } catch {}
            setMarker({ lng, lat });
            void reverseNow();
          });
        } catch {}

        // Create or move marker (default Mapbox pin, anchored at bottom)
        const setMarker = (ll: { lng: number; lat: number }) => {
          if (markerRef.current) {
            markerRef.current.setLngLat(ll);
          } else {
            const m = new (mapboxgl as any).Marker({ draggable: true, anchor: 'bottom' })
              .setLngLat(ll)
              .addTo(map);
            markerRef.current = m;
            m.on("dragend", () => void reverseNow());
          }
        };
        setMarker({ lng: center[0], lat: center[1] });
        // Reverse immediately for initial center so the field shows an address
        void reverseNow();

        // Add click handler to move marker
        map.on("click", (e: any) => {
          const ll = e?.lngLat || null;
          if (!ll) return;
          setMarker(ll);
          void reverseNow();
        });

        // Mount geocoder control if requested
        if (true) {
          const geocoder = new MapboxGeocoder({
            accessToken: token,
            mapboxgl,
            language: "es",
            marker: false,
            types: "address,place,locality,neighborhood,poi",
            countries: "mx",
            placeholder: "Buscar dirección…",
            limit: 5,
          });
          const mountNode = geocoderContainerRef.current;
          if (mountNode) {
            mountNode.innerHTML = "";
            mountNode.appendChild(geocoder.onAdd(map));
          } else {
            map.addControl(geocoder);
          }
          geocoder.on("result", (ev: any) => {
            try {
              const f = ev?.result || {};
              const center = Array.isArray(f?.center) ? f.center : null;
              const ll = center ? { lng: center[0], lat: center[1] } : null;
              if (ll) {
                map.flyTo({ center: [ll.lng, ll.lat], zoom: 15 });
                setMarker(ll);
              }
              const address_line = String(f?.place_name || f?.text || "");
              const place_id = String(f?.id || "");
              try {
                const ctx = Array.isArray(f?.context) ? f.context : [];
                const get = (p: string) => {
                  const it = ctx.find((c: any) => typeof c?.id === "string" && c.id.startsWith(p));
                  return (it?.text as string) || null;
                };
                const city = get("locality.") || get("place.") || get("region.");
                const postcode = get("postcode.");
                const state = get("region.");
                const country = get("country.");
                setResolved({ address: address_line || null, place_id: place_id || null, city, postcode, state, country, context: ctx });
              } catch {
                setResolved({ address: address_line || null, place_id: place_id || null });
              }
              try { setQuery(address_line || ""); } catch {}
            } catch {
              /* ignore */
            }
          });
        }

        // Ensure map resizes after mount
        const doResize = () => {
          try { map.resize(); } catch { /* ignore */ }
        };
        map.on("load", () => {
          if (cancelled) return;
          setIsLoaded(true);
          setLoadError(null);
          doResize();
          cleanupTimer = setTimeout(doResize, 100);
          // Attempt to geolocate once
          try { if (geolocate?.trigger) geolocate.trigger(); } catch {}
          try {
            if ("geolocation" in navigator) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const lat = Number(pos?.coords?.latitude);
                  const lng = Number(pos?.coords?.longitude);
                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                  try { map.flyTo({ center: [lng, lat], zoom: 15 }); } catch {}
                  setMarker({ lng, lat });
                  void reverseNow();
                },
                () => { /* ignore */ },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 300000 },
              );
            }
          } catch {}
        });
        map.once("idle", () => doResize());
        map.on("error", (ev: any) => {
          try { doResize(); } catch {}
          setIsLoaded(true);
          const msg = ev && (ev.error || ev.message) ? String(ev.error || ev.message) : "map_error";
          setLoadError(msg);
        });
      } catch (e) {
        setIsLoaded(true);
        setLoadError(e instanceof Error ? e.message : "load_failed");
      }
    })();
    return () => {
      cancelled = true;
      try { markerRef.current?.remove?.(); } catch {}
      try { mapInstanceRef.current?.remove?.(); } catch {}
      markerRef.current = null;
      mapInstanceRef.current = null;
      if (cleanupTimer) clearTimeout(cleanupTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function reverseNow() {
    try {
      const m = markerRef.current;
      const ll = m?.getLngLat?.();
      if (!ll) return;
      setBusy(true);
      const res = await fetch(`/api/geocode?lat=${encodeURIComponent(String(ll.lat))}&lng=${encodeURIComponent(String(ll.lng))}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      const next = {
        address: (typeof j?.address_line === 'string' ? (j.address_line as string) : null),
        place_id: (j?.place_id || null) as string | null,
        city: (j?.city ?? null) as string | null,
        postcode: (j?.postcode ?? null) as string | null,
        state: (j?.state ?? null) as string | null,
        country: (j?.country ?? null) as string | null,
        context: j?.context ?? null,
      };
      setResolved(next);
      try {
        if (next.address) setQuery(next.address);
      } catch {}
    } catch {
      setResolved(null);
    } finally {
      setBusy(false);
    }
  }

  // Forward geocode current query and update map/marker
  const forwardNow = React.useCallback(async () => {
    try {
      const q = (query || "").trim();
      if (!q) return;
      setBusy(true);
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      const f = Array.isArray(j?.results) && j.results.length ? j.results[0] : null;
      if (!f) return;
      const lat = typeof f?.lat === 'number' ? f.lat : null;
      const lng = typeof f?.lng === 'number' ? f.lng : null;
      const address = typeof f?.address_line === 'string' ? f.address_line : null;
      if (lat != null && lng != null && mapInstanceRef.current) {
        try { mapInstanceRef.current.flyTo({ center: [lng, lat], zoom: 15 }); } catch {}
        if (markerRef.current) markerRef.current.setLngLat({ lng, lat });
        else {
          try {
            const [{ default: mapboxgl }]: [any] = await Promise.all([mapboxglPromise as unknown as Promise<{ default: any }>] );
            const m = new (mapboxgl as any).Marker({ draggable: true, anchor: 'bottom' }).setLngLat({ lng, lat }).addTo(mapInstanceRef.current);
            markerRef.current = m;
            m.on("dragend", () => void reverseNow());
          } catch {}
        }
      }
      setResolved({
        address: address,
        place_id: typeof f?.place_id === 'string' ? f.place_id : null,
        city: typeof f?.city === 'string' ? f.city : null,
        postcode: typeof f?.postcode === 'string' ? f.postcode : null,
        state: typeof f?.state === 'string' ? f.state : null,
        country: typeof f?.country === 'string' ? f.country : null,
        context: f?.context ?? null,
      });
      setQuery(address || q);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }, [query]);

  async function confirm() {
    try {
      const m = markerRef.current;
      const ll = m?.getLngLat?.();
      if (!ll) return;
      // Ensure we have a resolved payload; if missing, reverse now
      let r = resolved;
      if (!r) {
        await reverseNow();
        r = resolved;
      }
      const payload: Payload = {
        address: (r?.address || initial?.address || "") as string,
        lat: ll.lat,
        lng: ll.lng,
        city: (r?.city ?? undefined) as string | undefined,
        postcode: (r?.postcode ?? undefined) as string | undefined,
        state: (r?.state ?? undefined) as string | undefined,
        country: (r?.country ?? undefined) as string | undefined,
        place_id: (r?.place_id ?? undefined) as string | undefined,
        context: r?.context,
      };
      onConfirm(payload);
      onClose();
    } catch {
      /* ignore */
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[96vw] max-w-3xl rounded-lg bg-white shadow-lg overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          <div className="text-sm font-medium">Seleccionar ubicación</div>
          <button className="text-sm text-slate-600 hover:text-slate-800" onClick={onClose}>Cerrar</button>
        </div>
        {/* Custom top address field */}
        <div className="px-3 pt-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Escribe una dirección…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void forwardNow(); } }}
            />
            <Button type="button" variant="outline" onClick={() => void forwardNow()} disabled={busy}>
              {busy ? 'Buscando…' : 'Buscar'}
            </Button>
          </div>
        </div>
        {/* Keep Mapbox geocoder mounted but hidden to avoid layout flicker if needed */}
        <div ref={geocoderContainerRef} className="hidden" />
        <div className="relative h-[60vh] min-h-[320px] w-full">
          <div ref={mapRef} className="h-full w-full" style={{ pointerEvents: isLoaded ? "auto" : "none" }} />
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
          <div className="text-sm text-slate-600 truncate" title={resolved?.address || undefined}>
            {resolved?.address || ""}
          </div>
          {!token ? (
            <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              Falta configurar NEXT_PUBLIC_MAPBOX_TOKEN
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-2 mt-2">
            <button className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" onClick={() => void confirm()} disabled={busy}>
              {busy ? "Resolviendo…" : "Usar esta ubicación"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
