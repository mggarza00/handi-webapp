"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MapboxModule = typeof import("mapbox-gl") & { accessToken: string };
type MapboxMap = import("mapbox-gl").Map;
type MapboxMarker = import("mapbox-gl").Marker;
type MapboxNavigationControl = import("mapbox-gl").NavigationControl;
type MapboxGeolocateControl = import("mapbox-gl").GeolocateControl;
type MapMouseEvent = import("mapbox-gl").MapMouseEvent;
type MapboxErrorEvent = import("mapbox-gl").ErrorEvent & { message?: unknown };

type MapboxContextFeature = {
  id?: string;
  text?: string;
};

type MapboxResultFeature = {
  center?: [number, number];
  place_name?: string;
  text?: string;
  id?: string;
  context?: MapboxContextFeature[];
};

type MapboxGeocoderEvent = {
  result?: MapboxResultFeature;
};

type MapboxGeocoderInstance = {
  onAdd: (map: MapboxMap) => HTMLElement;
  onRemove: (map: MapboxMap) => void;
  on: (event: "result", callback: (ev: MapboxGeocoderEvent) => void) => void;
};

type MapboxGeocoderConstructor = new (options: Record<string, unknown>) => MapboxGeocoderInstance;

export type MapboxContext = MapboxContextFeature[] | null;

type GeocodeResult = {
  lat?: number | null;
  lng?: number | null;
  address_line?: string | null;
  place_id?: string | null;
  city?: string | null;
  postcode?: string | null;
  state?: string | null;
  country?: string | null;
  context?: MapboxContext;
};

type ResolvedAddress = {
  address: string | null;
  place_id: string | null;
  city?: string | null;
  postcode?: string | null;
  state?: string | null;
  country?: string | null;
  context?: MapboxContext;
};

export type Payload = {
  address: string;
  lat: number;
  lng: number;
  city?: string;
  postcode?: string;
  state?: string;
  country?: string;
  place_id?: string;
  context?: MapboxContext;
};

type Initial = { lat?: number; lng?: number; address?: string };

type Props = {
  open: boolean;
  initial?: Initial;
  onClose: () => void;
  onConfirm: (payload: Payload) => void;
};

const mapboxglPromise = import("mapbox-gl");
const geocoderPromise = import("@mapbox/mapbox-gl-geocoder");

const logMapError = (error: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    console.error("[MapPickerModal]", error);
  }
};

export default function MapPickerModal({ open, initial, onClose, onConfirm }: Props) {
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = React.useRef<MapboxMap | null>(null);
  const markerRef = React.useRef<MapboxMarker | null>(null);
  const selectionRef = React.useRef<{ lat: number; lng: number } | null>(null);
  const geocoderContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = React.useState<string>(initial?.address || "");
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [resolved, setResolved] = React.useState<ResolvedAddress | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  const initialAddress = initial?.address ?? "";
  const initialLat = typeof initial?.lat === "number" ? initial.lat : null;
  const initialLng = typeof initial?.lng === "number" ? initial.lng : null;

  const defaultCenter: [number, number] = React.useMemo(() => {
    // If initial lat/lng are provided, center will be built from them below.
    // Otherwise, default by common cities, using address hint if present.
    const hint = initialAddress.toLowerCase();
    if (hint.includes("monterrey")) return [-100.3161, 25.6866];
    if (hint.includes("cdmx") || hint.includes("ciudad de méxico") || hint.includes("ciudad de mexico")) return [-99.1332, 19.4326];
    return [-100.3161, 25.6866];
  }, [initialAddress]);

  const center: [number, number] = React.useMemo(() => {
    if (typeof initialLng === "number" && typeof initialLat === "number") return [initialLng, initialLat];
    return defaultCenter;
  }, [initialLat, initialLng, defaultCenter]);

  async function reverseNow(coords?: { lat: number; lng: number }) {
    const target =
      coords ??
      (() => {
        const map = mapInstanceRef.current;
        const ll = map?.getCenter?.();
        if (!ll) return null;
        return { lat: ll.lat, lng: ll.lng };
      })();
    if (!target) return null;
    selectionRef.current = target;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/geocode?lat=${encodeURIComponent(String(target.lat))}&lng=${encodeURIComponent(String(target.lng))}`,
        { cache: "no-store" },
      );
      const json = (await res.json().catch(() => ({}))) as GeocodeResult;
      const context = Array.isArray(json?.context) ? json.context : null;
      const next: ResolvedAddress = {
        address: typeof json?.address_line === "string" ? json.address_line : null,
        place_id: typeof json?.place_id === "string" ? json.place_id : null,
        city: typeof json?.city === "string" ? json.city : null,
        postcode: typeof json?.postcode === "string" ? json.postcode : null,
        state: typeof json?.state === "string" ? json.state : null,
        country: typeof json?.country === "string" ? json.country : null,
        context,
      };
      setResolved(next);
      if (next.address) {
        setQuery(next.address);
      }
      return next;
    } catch (error) {
      logMapError(error);
      setResolved(null);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function setSelection(lng: number, lat: number, resolvedHint?: ResolvedAddress | null) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    const ll = { lng, lat };
    selectionRef.current = ll;
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[MapPickerModal] setSelection", ll);
    }
    try {
      if (!markerRef.current) {
        const map = mapInstanceRef.current;
        if (!map) return null;
        const el = document.createElement("div");
        el.style.width = "28px";
        el.style.height = "28px";
        el.style.borderRadius = "50%";
        el.style.background = "#2563eb";
        el.style.border = "2px solid white";
        el.style.boxShadow = "0 6px 14px rgba(0,0,0,0.25)";
        markerRef.current = new mapboxgl.Marker({ draggable: true, element: el, anchor: "center" })
          .setLngLat([lng, lat])
          .addTo(map);
        const markerEl = markerRef.current.getElement();
        markerEl.style.cursor = "grab";
        markerRef.current.on("dragstart", () => {
          markerEl.style.cursor = "grabbing";
        });
        markerRef.current.on("dragend", () => {
          markerEl.style.cursor = "grab";
          const ll = markerRef.current?.getLngLat();
          if (ll) void setSelection(ll.lng, ll.lat);
        });
      }
      markerRef.current?.setLngLat([lng, lat]);
    } catch (error) {
      logMapError(error);
    }
    if (resolvedHint) {
      setResolved(resolvedHint);
      if (resolvedHint.address) {
        setQuery(resolvedHint.address);
      }
      return resolvedHint;
    }
    return reverseNow(ll);
  }

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let rafId: number | null = null;
    const resizeTimers: Array<ReturnType<typeof setTimeout>> = [];
    (async () => {
      try {
        const [rawMapbox, rawGeocoder] = await Promise.all([mapboxglPromise, geocoderPromise]);
        const { default: mapboxDefault } = rawMapbox as { default: unknown };
        const mapboxgl = mapboxDefault as MapboxModule;
        const { default: geocoderDefault } = rawGeocoder as { default: unknown };
        const MapboxGeocoder = geocoderDefault as MapboxGeocoderConstructor;
        if (cancelled) return;
        mapboxgl.accessToken = token;
        const container = mapRef.current;
        if (!container) return;
        const map = new mapboxgl.Map({
          container,
          style: "mapbox://styles/mapbox/streets-v11",
          center,
          zoom: 14,
          attributionControl: true,
        });
        mapInstanceRef.current = map;
        const initialCenter = { lng: center[0], lat: center[1] };
        selectionRef.current = initialCenter;
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.log("[MapPickerModal] initial center", initialCenter);
        }
        const scheduleResize = () => {
          try {
            map.resize();
          } catch (error) {
            logMapError(error);
          }
          if (typeof window !== "undefined") {
            rafId = window.requestAnimationFrame(() => {
              try {
                map.resize();
              } catch (error) {
                logMapError(error);
              }
            });
            resizeTimers.push(
              window.setTimeout(() => {
                try {
                  map.resize();
                  if (process.env.NODE_ENV !== "production") {
                    // eslint-disable-next-line no-console
                    console.log("[MapPickerModal] resize tick");
                  }
                } catch (error) {
                  logMapError(error);
                }
              }, 50),
            );
            resizeTimers.push(
              window.setTimeout(() => {
                try {
                  map.resize();
                } catch (error) {
                  logMapError(error);
                }
              }, 250),
            );
          }
        };

        try {
          const nav: MapboxNavigationControl = new mapboxgl.NavigationControl({ showCompass: false, showZoom: true });
          map.addControl(nav, "top-right");
        } catch (error) {
          logMapError(error);
        }

        let geolocate: MapboxGeolocateControl | null = null;
        try {
          geolocate = new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: false,
            showAccuracyCircle: false,
          });
          map.addControl(geolocate, "top-right");
          geolocate.on("geolocate", (event: GeolocationPosition) => {
            const latitude = Number(event?.coords?.latitude);
            const longitude = Number(event?.coords?.longitude);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
            try {
              map.flyTo({ center: [longitude, latitude], zoom: 15 });
            } catch (error) {
              logMapError(error);
            }
            void setSelection(longitude, latitude);
          });
        } catch (error) {
          logMapError(error);
        }

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
        map.on("click", (event: MapMouseEvent) => {
          const ll = event.lngLat;
          if (!ll) return;
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.log("[MapPickerModal] map click", ll);
          }
          void setSelection(ll.lng, ll.lat);
        });
        const mountNode = geocoderContainerRef.current;
        if (mountNode) {
          mountNode.innerHTML = "";
          mountNode.appendChild(geocoder.onAdd(map));
        } else {
          map.addControl(geocoder as unknown as mapboxgl.IControl);
        }
        geocoder.on("result", (event) => {
          const feature = event.result;
          if (!feature) return;
          const featureCenter = feature.center;
          const addressLine = String(feature.place_name || feature.text || "");
          const placeId = String(feature.id || "");
          const ctx: MapboxContextFeature[] = Array.isArray(feature.context) ? feature.context : [];
          const getContextValue = (prefix: string) => {
            const entry = ctx.find((item) => typeof item?.id === "string" && item.id.startsWith(prefix));
            return entry?.text ?? null;
          };
          const city = getContextValue("locality.") || getContextValue("place.") || getContextValue("region.");
          const postcode = getContextValue("postcode.");
          const state = getContextValue("region.");
          const country = getContextValue("country.");
          const resolvedPayload: ResolvedAddress = {
            address: addressLine || null,
            place_id: placeId || null,
            city,
            postcode,
            state,
            country,
            context: ctx,
          };
          if (Array.isArray(featureCenter)) {
            const [lng, lat] = featureCenter;
            if (process.env.NODE_ENV !== "production") {
              // eslint-disable-next-line no-console
              console.log("[MapPickerModal] geocoder result", { lng, lat });
            }
            try {
              map.flyTo({ center: [lng, lat], zoom: 16 });
            } catch (error) {
              logMapError(error);
            }
            void setSelection(lng, lat, resolvedPayload);
          }
          const ll = Array.isArray(featureCenter)
            ? { lat: featureCenter[1], lng: featureCenter[0] }
            : selectionRef.current ?? null;
          if (ll && !Array.isArray(featureCenter)) {
            void setSelection(ll.lng, ll.lat, resolvedPayload);
          }
          setQuery(addressLine || resolvedPayload.address || "");
        });

        map.on("load", () => {
          if (cancelled) return;
          setIsLoaded(true);
          setLoadError(null);

          scheduleResize();
          map.once("idle", scheduleResize);
          try {
            map.setCenter([initialCenter.lng, initialCenter.lat]);
            map.setZoom(15);
          } catch (error) {
            logMapError(error);
          }
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.log("[MapPickerModal] after load center", map.getCenter()?.toArray());
          }
          void setSelection(initialCenter.lng, initialCenter.lat);
          if (!initialLat && !initialLng && initialAddress.trim()) {
            void forwardNow(initialAddress);
          }
          if (geolocate?.trigger) {
            try {
              geolocate.trigger();
            } catch (error) {
              logMapError(error);
            }
          }
          try {
            if ("geolocation" in navigator) {
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  const latitude = Number(position?.coords?.latitude);
                  const longitude = Number(position?.coords?.longitude);
                  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                    return;
                  }
                  try {
                    map.flyTo({ center: [longitude, latitude], zoom: 15 });
                  } catch (error) {
                    logMapError(error);
                  }
                },
                () => undefined,
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 300000 },
              );
            }
          } catch (error) {
            logMapError(error);
          }
        });
        map.once("idle", scheduleResize);
        map.on("error", (event: MapboxErrorEvent) => {
          scheduleResize();
          setIsLoaded(true);
          const msg = event && (event.error || event.message) ? String(event.error || event.message) : "map_error";
          setLoadError(msg);
        });
      } catch (error) {
        setIsLoaded(true);
        setLoadError(error instanceof Error ? error.message : "load_failed");
      }
    })();
    return () => {
      cancelled = true;
      try {
        markerRef.current?.remove?.();
      } catch (error) {
        logMapError(error);
      }
      try {
        mapInstanceRef.current?.remove?.();
      } catch (error) {
        logMapError(error);
      }
      markerRef.current = null;
      mapInstanceRef.current = null;
      if (rafId && typeof window !== "undefined") {
        window.cancelAnimationFrame(rafId);
      }
      resizeTimers.forEach((t) => clearTimeout(t));
    };
  }, [center, open, token]);

  async function reverseNow(coords?: { lat: number; lng: number }) {
    const target =
      coords ??
      (() => {
        const map = mapInstanceRef.current;
        const ll = map?.getCenter?.();
        if (!ll) return null;
        return { lat: ll.lat, lng: ll.lng };
      })();
    if (!target) return null;
    selectionRef.current = target;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/geocode?lat=${encodeURIComponent(String(target.lat))}&lng=${encodeURIComponent(String(target.lng))}`,
        { cache: "no-store" },
      );
      const json = (await res.json().catch(() => ({}))) as GeocodeResult;
      const context = Array.isArray(json?.context) ? json.context : null;
      const next: ResolvedAddress = {
        address: typeof json?.address_line === "string" ? json.address_line : null,
        place_id: typeof json?.place_id === "string" ? json.place_id : null,
        city: typeof json?.city === "string" ? json.city : null,
        postcode: typeof json?.postcode === "string" ? json.postcode : null,
        state: typeof json?.state === "string" ? json.state : null,
        country: typeof json?.country === "string" ? json.country : null,
        context,
      };
      setResolved(next);
      if (next.address) {
        setQuery(next.address);
      }
      return next;
    } catch (error) {
      logMapError(error);
      setResolved(null);
      return null;
    } finally {
      setBusy(false);
    }
  }

  const forwardNow = React.useCallback(async (search?: string) => {
    try {
      const q = (search ?? query ?? "").trim();
      if (!q) return;
      setBusy(true);
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      const results = Array.isArray(json?.results) ? (json.results as GeocodeResult[]) : [];
      const feature = results.length > 0 ? results[0] : null;
      if (!feature) return;
      const lat = typeof feature.lat === "number" ? feature.lat : null;
      const lng = typeof feature.lng === "number" ? feature.lng : null;
      const address = typeof feature.address_line === "string" ? feature.address_line : null;
      const mapInstance = mapInstanceRef.current;
      if (lat != null && lng != null && mapInstance) {
        try {
          mapInstance.flyTo({ center: [lng, lat], zoom: 16 });
        } catch (error) {
          logMapError(error);
        }
      }
      const resolvedPayload: ResolvedAddress = {
        address,
        place_id: typeof feature.place_id === "string" ? feature.place_id : null,
        city: typeof feature.city === "string" ? feature.city : null,
        postcode: typeof feature.postcode === "string" ? feature.postcode : null,
        state: typeof feature.state === "string" ? feature.state : null,
        country: typeof feature.country === "string" ? feature.country : null,
        context: Array.isArray(feature.context) ? feature.context : null,
      };
      if (lat != null && lng != null) {
        void setSelection(lng, lat, resolvedPayload);
      }
      setQuery(address || q);
    } catch (error) {
      logMapError(error);
    } finally {
      setBusy(false);
    }
  }, [query]);

  async function confirm() {
    try {
      const marker = markerRef.current;
      const ll = marker?.getLngLat?.() ?? selectionRef.current;
      if (!ll) return;
      // Ensure we have a resolved payload; if missing, reverse now based on center
      let r = resolved;
      if (!r || !r.address) {
        r = await reverseNow(ll);
      }
      const addressInput = (r?.address || query || initial?.address || "").trim();
      const payload: Payload = {
        address: addressInput as string,
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
    } catch (error) {
      logMapError(error);
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
            <Button
              type="button"
              variant="outline"
              onClick={() => void confirm()}
              disabled={busy}
            >
              {busy ? "Resolviendo…" : "Aceptar"}
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
        </div>
      </div>
    </div>
  );
}
