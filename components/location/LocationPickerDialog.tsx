"use client";

import * as React from "react";
import { MapPin } from "lucide-react";
import type { LatLngExpression, LeafletEvent, Marker as LeafletMarker } from "leaflet";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Coords = { lat: number; lon: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCoords?: Coords | null;
  initialAddress?: string | null;
  onConfirm: (lat: number, lon: number, address: string) => void;
};

type SuggestionAddress = Partial<Record<"city" | "town" | "village" | "municipality" | "state" | "postcode", string>>;
type Suggestion = { label: string; lat: number; lon: number; address: SuggestionAddress | null; city?: string | null };
type LeafletModule = typeof import("leaflet");
type ReactLeafletModule = typeof import("react-leaflet");
type LeafletDeps = {
  L: LeafletModule;
  MapContainer: ReactLeafletModule["MapContainer"];
  TileLayer: ReactLeafletModule["TileLayer"];
  Marker: ReactLeafletModule["Marker"];
  useMap: ReactLeafletModule["useMap"];
};

const makeCenterSetter = (useMapHook: ReactLeafletModule["useMap"]) =>
  function CenterSetter({ center }: { center: LatLngExpression }) {
    const map = useMapHook();
    React.useEffect(() => {
      try {
        map.setView(center, map.getZoom(), { animate: true });
      } catch (error) {
        logLocationError(error);
      }
    }, [center, map]);
    return null;
  };

const makeInvalidateOnOpen = (useMapHook: ReactLeafletModule["useMap"]) =>
  function InvalidateOnOpen({ open }: { open: boolean }) {
    const map = useMapHook();
    React.useEffect(() => {
      if (!open) return;
      let raf = 0;
      let frames = 0;
      const tick = () => {
        try {
          map.invalidateSize();
        } catch (error) {
          logLocationError(error);
        }
        frames += 1;
        if (frames < 6) raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
      const t1 = window.setTimeout(() => {
        try {
          map.invalidateSize();
        } catch (error) {
          logLocationError(error);
        }
      }, 150);
      const t2 = window.setTimeout(() => {
        try {
          map.invalidateSize();
          map.panTo(map.getCenter());
        } catch (error) {
          logLocationError(error);
        }
      }, 350);
      return () => {
        try {
          window.cancelAnimationFrame(raf);
        } catch (error) {
          logLocationError(error);
        }
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }, [open, map]);
    return null;
  };

function useDebounced<T extends (...args: unknown[]) => void>(fn: T, wait = 300) {
  const ref = React.useRef<number | null>(null);
  return React.useCallback((...args: Parameters<T>) => {
    if (ref.current) window.clearTimeout(ref.current);
    ref.current = window.setTimeout(() => {
      fn(...args);
    }, wait);
  }, [fn, wait]);
}

const defaultCenter: Coords = { lat: 25.6866, lon: -100.3161 };

const logLocationError = (error: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    console.error("[LocationPickerDialog]", error);
  }
};

const toSuggestionAddress = (value: unknown): SuggestionAddress | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const pick = (key: keyof SuggestionAddress) => {
    const raw = record[key as string];
    return typeof raw === "string" && raw.trim().length > 0 ? raw : undefined;
  };
  const meta: SuggestionAddress = {
    city: pick("city"),
    town: pick("town"),
    village: pick("village"),
    municipality: pick("municipality"),
    state: pick("state"),
    postcode: pick("postcode"),
  };
  if (Object.values(meta).every((entry) => !entry)) return null;
  return meta;
};

export default function LocationPickerDialog({ open, onOpenChange, initialCoords, initialAddress, onConfirm }: Props) {
  const mounted = React.useRef(true);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const [query, setQuery] = React.useState<string>(initialAddress || "");
  const [address, setAddress] = React.useState<string>(initialAddress || "");
  const [coords, setCoords] = React.useState<Coords>(initialCoords || defaultCenter);
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [reverseBusy, setReverseBusy] = React.useState(false);
  const [ac, setAc] = React.useState<AbortController | null>(null);
  const [activeIndex, setActiveIndex] = React.useState<number>(-1);
  const [leafletDeps, setLeafletDeps] = React.useState<LeafletDeps | null>(null);

  React.useEffect(() => {
    if (leafletDeps) return undefined;
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      try {
        const [leafletModule, reactLeafletModule] = await Promise.all([
          import("leaflet"),
          import("react-leaflet"),
        ]);
        if (cancelled) return;
        const runtimeLeaflet = (leafletModule?.default ?? leafletModule) as LeafletModule;
        setLeafletDeps({
          L: runtimeLeaflet,
          MapContainer: reactLeafletModule.MapContainer,
          TileLayer: reactLeafletModule.TileLayer,
          Marker: reactLeafletModule.Marker,
          useMap: reactLeafletModule.useMap,
        });
      } catch (error) {
        logLocationError(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leafletDeps]);

  const CenterSetter = React.useMemo(() => (leafletDeps ? makeCenterSetter(leafletDeps.useMap) : null), [leafletDeps]);
  const InvalidateOnOpen = React.useMemo(
    () => (leafletDeps ? makeInvalidateOnOpen(leafletDeps.useMap) : null),
    [leafletDeps],
  );
  const pinIcon = React.useMemo(() => {
    if (!leafletDeps) return null;
    return leafletDeps.L.divIcon({
      className: "",
      html: '<div style="position:relative;transform:translate(-50%,-100%);">\
    <div style="width:22px;height:22px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3);"></div>\
    <div style="width:2px;height:8px;background:#ef4444;margin:0 auto;"></div>\
  </div>',
      iconSize: [22, 30],
      iconAnchor: [11, 30],
    });
  }, [leafletDeps]);

  React.useEffect(() => {
    if (!open) {
      ac?.abort();
      setAc(null);
    }
  }, [open, ac]);

  React.useEffect(() => {
    if (!open) return;
    setQuery(initialAddress || "");
    setAddress(initialAddress || "");
    setCoords(initialCoords || defaultCenter);
  }, [open, initialAddress, initialCoords]);

  const search = React.useCallback(
    async (text: string) => {
      const q = (text || "").trim();
      if (!q) {
        setSuggestions([]);
        return;
      }
      ac?.abort();
      const ctrl = new AbortController();
      setAc(ctrl);
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`, {
          method: "GET",
          cache: "no-store",
          signal: ctrl.signal,
          headers: { Accept: "application/json; charset=utf-8", "Content-Type": "application/json; charset=utf-8" },
        });
        const response = await res.json().catch(() => ({}));
        const rawItems = Array.isArray(response?.data) ? (response.data as Array<Record<string, unknown> | null>) : [];
        const items: Suggestion[] = rawItems
          .filter((value): value is Record<string, unknown> => value != null)
          .map<Suggestion | null>((item) => {
            const latValue = typeof item.lat === "number" ? item.lat : Number(item.lat ?? NaN);
            const lonValue = typeof item.lon === "number" ? item.lon : Number(item.lon ?? NaN);
            if (!Number.isFinite(latValue) || !Number.isFinite(lonValue)) return null;
            const label =
              typeof item.label === "string"
                ? item.label
                : typeof item.display_name === "string"
                  ? (item.display_name as string)
                  : typeof item.address === "string"
                    ? (item.address as string)
                    : null;
            return {
              label: (label && label.trim()) || "Ubicación sin nombre",
              lat: latValue,
              lon: lonValue,
              address: toSuggestionAddress(item.address),
              city: typeof item.city === "string" ? item.city : null,
            };
          })
          .filter((value): value is Suggestion => value !== null);
        if (!mounted.current) return;
        setSuggestions(items);
        setActiveIndex(items.length > 0 ? 0 : -1);
      } catch (error) {
        logLocationError(error);
        if (!mounted.current) return;
        setSuggestions([]);
        setActiveIndex(-1);
      } finally {
        if (mounted.current) {
          setLoading(false);
        }
      }
    },
    [ac],
  );

  const debouncedSearch = useDebounced(search, 300);

  const onPickSuggestion = React.useCallback((s: Suggestion) => {
    setCoords({ lat: s.lat, lon: s.lon });
    setAddress(s.label || "");
    setQuery(s.label || "");
    setSuggestions([]);
    setActiveIndex(-1);
  }, []);

  const doReverse = React.useCallback(async (ll: Coords) => {
    setReverseBusy(true);
    try {
      const res = await fetch(
        `/api/geocode/reverse?lat=${encodeURIComponent(String(ll.lat))}&lon=${encodeURIComponent(String(ll.lon))}`,
        { cache: "no-store", headers: { Accept: "application/json; charset=utf-8", "Content-Type": "application/json; charset=utf-8" } },
      );
      const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!mounted.current) return;
      const addressLine = typeof parsed.address === "string" ? parsed.address : null;
      if (parsed?.ok !== false && addressLine) {
        setAddress(addressLine);
        setQuery(addressLine);
      }
    } catch (error) {
      logLocationError(error);
    } finally {
      if (mounted.current) setReverseBusy(false);
    }
  }, []);

  const center: LatLngExpression = React.useMemo(
    () => [coords.lat, coords.lon],
    [coords.lat, coords.lon],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[min(96vw,900px)] overflow-hidden p-0 md:p-4" aria-label="Selector de ubicación">
        <div className="p-4 pb-2 md:pt-0">
          <DialogHeader>
            <DialogTitle>Seleccionar ubicación</DialogTitle>
          </DialogHeader>
        </div>

        {/* Search row */}
        <div className="px-4 md:px-4 flex items-center gap-2">
          <Input
            placeholder="Escribe una dirección..."
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              debouncedSearch(v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((prev) => {
                  const len = suggestions.length; if (len === 0) return -1;
                  return prev < 0 ? 0 : (prev + 1) % len;
                });
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((prev) => {
                  const len = suggestions.length; if (len === 0) return -1;
                  return prev <= 0 ? len - 1 : prev - 1;
                });
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                if (suggestions.length > 0 && activeIndex >= 0) {
                  const s = suggestions[activeIndex]!;
                  setCoords({ lat: s.lat, lon: s.lon });
                  setAddress(s.label || "");
                  setQuery(s.label || "");
                  setSuggestions([]);
                  setActiveIndex(-1);
                } else {
                  void search(query);
                }
              }
            }}
            aria-label="Buscar dirección"
            aria-controls="location-suggestions"
            aria-activedescendant={activeIndex >= 0 ? `location-suggestion-${activeIndex}` : undefined}
          />
          <Button type="button" variant="outline" onClick={() => search(query)} aria-label="Buscar">
            {loading ? 'Buscando…' : 'Buscar'}
          </Button>
        </div>
        {/* Suggestions list */}
        <div id="location-suggestions" role="listbox" aria-label="Sugerencias de direcciones" className="mx-4 mt-2 max-h-48 overflow-auto rounded border bg-white shadow-sm" hidden={suggestions.length === 0}>
          {suggestions.map((s, idx) => {
            const sub = (() => {
              const a: SuggestionAddress = s.address ?? {};
              const locality = a.city || a.town || a.village || a.municipality || s.city || null;
              const parts = [locality, a.state, a.postcode].filter((part): part is string => Boolean(part));
              return parts.join(", ");
            })();
            return (
              <button
                type="button"
                key={`${s.lat},${s.lon},${idx}`}
                id={`location-suggestion-${idx}`}
                role="option"
                aria-selected={activeIndex === idx}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => onPickSuggestion(s)}
                className={`block w-full text-left px-3 py-2 hover:bg-slate-50 ${activeIndex === idx ? 'bg-slate-50' : ''}`}
                title={s.label}
              >
                <div className="text-sm text-slate-900 truncate">{s.label}</div>
                {sub ? <div className="text-xs text-slate-500 truncate">{sub}</div> : null}
              </button>
            );
          })}
        </div>

        {/* Map */}
        <div className="relative m-4 mt-3 h-[50vh] max-h-[60vh] min-h-[320px] rounded overflow-hidden border">
          {leafletDeps && CenterSetter && InvalidateOnOpen ? (
            <>
              <leafletDeps.MapContainer
                center={center}
                zoom={15}
                style={{ height: "100%", width: "100%" }}
                className="w-full h-full block"
                aria-label="Mapa de seleccion de ubicacion"
              >
                <leafletDeps.TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <CenterSetter center={center} />
                <InvalidateOnOpen open={open} />
                <leafletDeps.Marker
                  position={center}
                  draggable
                  icon={pinIcon ?? undefined}
                  eventHandlers={{
                    dragend: (event: LeafletEvent) => {
                      const target = event.target as LeafletMarker | undefined;
                      if (!target?.getLatLng) return;
                      const ll = target.getLatLng();
                      const next = { lat: ll.lat, lon: ll.lng };
                      setCoords(next);
                      void doReverse(next);
                    },
                  }}
                />
              </leafletDeps.MapContainer>
              {reverseBusy ? (
                <div className="absolute bottom-2 right-2 rounded bg-white/80 text-xs px-2 py-1 shadow">Resolviendo direccion...</div>
              ) : null}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-50 text-xs text-slate-500">
              Cargando mapa...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 text-sm text-slate-700">
            <MapPin size={16} className="shrink-0 text-slate-500" />
            <span className="truncate" title={address}>{address}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} aria-label="Cerrar">Cerrar</Button>
            <Button
              type="button"
              onClick={() => onConfirm(coords.lat, coords.lon, address)}
              aria-label="Usar esta ubicación"
            >
              Usar esta ubicación
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
