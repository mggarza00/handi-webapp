"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";

type Coords = { lat: number; lon: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCoords?: Coords | null;
  initialAddress?: string | null;
  onConfirm: (lat: number, lon: number, address: string) => void;
};

type Suggestion = { label: string; lat: number; lon: number; address?: any; city?: string | null };

function useDebounced<T extends (...args: any[]) => void>(fn: T, wait = 300) {
  const ref = React.useRef<number | null>(null);
  return React.useCallback((...args: Parameters<T>) => {
    if (ref.current) window.clearTimeout(ref.current);
    ref.current = window.setTimeout(() => {
      (fn as any)(...args as any);
    }, wait);
  }, [fn, wait]);
}

function CenterSetter({ center }: { center: LatLngExpression }) {
  const map = useMap();
  React.useEffect(() => {
    try { map.setView(center as any, map.getZoom(), { animate: true }); } catch {}
  }, [center, map]);
  return null;
}

const defaultCenter: Coords = { lat: 25.6866, lon: -100.3161 };

// Lightweight div-based pin to avoid asset imports
const pinIcon = L.divIcon({
  className: "",
  html: '<div style="position:relative;transform:translate(-50%,-100%);">\
    <div style="width:22px;height:22px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3);"></div>\
    <div style="width:2px;height:8px;background:#ef4444;margin:0 auto;"></div>\
  </div>',
  iconSize: [22, 30],
  iconAnchor: [11, 30],
});

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

  React.useEffect(() => {
    if (!open) {
      // cleanup
      ac?.abort();
      setAc(null);
      return;
    }
    // sync on open with incoming props
    setQuery(initialAddress || "");
    setAddress(initialAddress || "");
    setCoords(initialCoords || defaultCenter);
  }, [open, initialAddress, initialCoords]);

  const search = React.useCallback(async (text: string) => {
    const q = (text || "").trim();
    if (!q) { setSuggestions([]); return; }
    ac?.abort();
    const ctrl = new AbortController();
    setAc(ctrl);
    setLoading(true);
    try {
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`, { method: "GET", cache: "no-store", signal: ctrl.signal, headers: { Accept: "application/json; charset=utf-8", "Content-Type": "application/json; charset=utf-8" } });
      const j = await res.json().catch(() => ({}));
      const items: Suggestion[] = Array.isArray(j?.data) ? j.data : [];
      if (!mounted.current) return;
      setSuggestions(items);
    } catch {
      if (!mounted.current) return;
      setSuggestions([]);
    } finally {
      if (!mounted.current) return;
      setLoading(false);
    }
  }, [ac]);

  const debouncedSearch = useDebounced(search, 300);

  const onPickSuggestion = React.useCallback((s: Suggestion) => {
    setCoords({ lat: s.lat, lon: s.lon });
    setAddress(s.label || "");
    setQuery(s.label || "");
    setSuggestions([]);
  }, []);

  const doReverse = React.useCallback(async (ll: Coords) => {
    setReverseBusy(true);
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(String(ll.lat))}&lon=${encodeURIComponent(String(ll.lon))}`, { cache: "no-store", headers: { Accept: "application/json; charset=utf-8", "Content-Type": "application/json; charset=utf-8" } });
      const j = await res.json().catch(() => ({}));
      if (!mounted.current) return;
      if (j && j.ok && typeof j.address === 'string') {
        setAddress(j.address);
        setQuery(j.address);
      }
    } catch {
      /* ignore */
    } finally {
      if (mounted.current) setReverseBusy(false);
    }
  }, []);

  const center: LatLngExpression = React.useMemo(() => [coords.lat, coords.lon] as any, [coords]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" aria-label="Selector de ubicación">
        <DialogHeader>
          <DialogTitle>Seleccionar ubicación</DialogTitle>
        </DialogHeader>

        {/* Search row */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Escribe una dirección..."
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              debouncedSearch(v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); search(query); }
            }}
            aria-label="Buscar dirección"
          />
          <Button type="button" variant="outline" onClick={() => search(query)} aria-label="Buscar">
            {loading ? 'Buscando…' : 'Buscar'}
          </Button>
        </div>
        {/* Suggestions list */}
        <div role="listbox" aria-label="Sugerencias de direcciones" className="max-h-48 overflow-auto rounded border bg-white shadow-sm" hidden={suggestions.length === 0}>
          {suggestions.map((s, idx) => {
            const sub = (() => {
              const a = s.address || {};
              const parts = [a.city || a.town || a.village || a.municipality, a.state, a.postcode].filter(Boolean);
              return parts.join(', ');
            })();
            return (
              <button
                type="button"
                key={`${s.lat},${s.lon},${idx}`}
                role="option"
                aria-selected={false}
                onClick={() => onPickSuggestion(s)}
                className="block w-full text-left px-3 py-2 hover:bg-slate-50"
                title={s.label}
              >
                <div className="text-sm text-slate-900 truncate">{s.label}</div>
                {sub ? <div className="text-xs text-slate-500 truncate">{sub}</div> : null}
              </button>
            );
          })}
        </div>

        {/* Map */}
        <div className="relative h-[55vh] min-h-[300px] rounded overflow-hidden border">
          <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }} aria-label="Mapa de selección de ubicación">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <CenterSetter center={center} />
            <Marker
              position={[coords.lat, coords.lon] as any}
              draggable
              icon={pinIcon}
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker<any>;
                  const ll = m.getLatLng();
                  const next = { lat: ll.lat, lon: ll.lng };
                  setCoords(next);
                  void doReverse(next);
                },
              }}
            />
          </MapContainer>
          {reverseBusy ? (
            <div className="absolute bottom-2 right-2 rounded bg-white/80 text-xs px-2 py-1 shadow">Resolviendo dirección…</div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2">
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
