// app/requests/new/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import Breadcrumbs from "@/components/breadcrumbs";
import LocationPickerDialog from "@/components/location/LocationPickerDialog";
import ConditionsCombobox from "@/components/requests/ConditionsCombobox";
import { useCreateRequestForm } from "@/components/requests/useCreateRequestForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CITIES } from "@/lib/cities";

type CreateRequestFormApi = ReturnType<typeof useCreateRequestForm>;
type CreateRequestFormState = CreateRequestFormApi["state"];
type AddressSuggestion = CreateRequestFormState["addrSuggestions"][number];

function isUrl(v: string | null | undefined) {
  return !!v && (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/"));
}

export default function NewRequestPage() {
  const api = useCreateRequestForm();
  const { setAddress: setFormAddress, setCity, setCityTouched } = api;
  const { state } = api;
  const {
    values: { title, description, city, category, subcategory, budget, requiredAt, conditionsText, files, address: formAddress },
    errors,
    submitting,
    uploading,
    catMap,
    loadingCats,
    addrOpen,
    addrSuggestions,
    recentAddrs,
    coords,
    openMap,
  } = state;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [addressInput, setAddressInput] = useState(formAddress ?? "");
  const [_addressAutofillDirty, setAddressAutofillDirty] = useState(false);
  const ghostStreetRef = useRef<HTMLInputElement | null>(null);
  const ghostNeighborhoodRef = useRef<HTMLInputElement | null>(null);
  const ghostCityRef = useRef<HTMLInputElement | null>(null);
  const ghostStateRef = useRef<HTMLInputElement | null>(null);
  const ghostPostalRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const next = formAddress ?? "";
    setAddressInput((prev) => (prev === next ? prev : next));
  }, [formAddress]);

  useEffect(() => {
    const inputs = [ghostStreetRef.current, ghostNeighborhoodRef.current, ghostCityRef.current, ghostStateRef.current, ghostPostalRef.current].filter(
      Boolean,
    ) as HTMLInputElement[];
    if (inputs.length === 0) return undefined;

    const handler = () => {
      const street = ghostStreetRef.current?.value?.trim() ?? "";
      const neigh = ghostNeighborhoodRef.current?.value?.trim() ?? "";
      const cityGhost = ghostCityRef.current?.value?.trim() ?? "";
      const stateGhost = ghostStateRef.current?.value?.trim() ?? "";
      const postal = ghostPostalRef.current?.value?.trim() ?? "";
      if (!street && !neigh && !cityGhost && !stateGhost && !postal) return;

      const parts: string[] = [];
      if (street) parts.push(street);
      if (neigh) parts.push(neigh);
      if (cityGhost) parts.push(cityGhost);
      if (stateGhost) parts.push(stateGhost);
      if (postal) parts.push(postal);
      const full = parts.join(", ");

      setAddressInput((prev) => {
        if (prev === full) return prev;
        return full;
      });
      setFormAddress(full);
      setAddressAutofillDirty(true);
      if (!city && cityGhost) {
        setCity(cityGhost);
        setCityTouched(true);
      }
    };

    inputs.forEach((el) => {
      el.addEventListener("input", handler);
      el.addEventListener("change", handler);
    });
    return () => {
      inputs.forEach((el) => {
        el.removeEventListener("input", handler);
        el.removeEventListener("change", handler);
      });
    };
  }, [city, setCity, setCityTouched, setFormAddress]);

  const crumbs = [
    { label: "Inicio", href: "/" },
    { label: "Solicitudes", href: "/requests?mine=1" },
    { label: "Nueva" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={crumbs} />
        <h1 className="text-2xl font-bold mt-4 mb-4">Nueva solicitud</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void api.handleSubmit();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              data-testid="request-title"
              value={title}
              onChange={(e) => api.setTitle(e.target.value)}
              placeholder="ej. Reparación de fuga en baño"
              required
            />
            {errors?.title && <p className="text-xs text-red-600">{errors.title}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea
              data-testid="request-desc"
              rows={4}
              value={description}
              onChange={(e) => api.setDescription(e.target.value)}
              placeholder="Describe lo que necesitas…"
            />
            {errors?.description && <p className="text-xs text-red-600">{errors.description}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Ciudad</Label>
              </div>
              <Select value={city} onValueChange={(v) => { api.setCityTouched(true); api.setCity(v); }}>
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
              {errors?.city && <p className="text-xs text-red-600">{errors.city}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={category} onValueChange={(v) => api.setCategory(v)}>
                <SelectTrigger data-testid="request-category">
                  <SelectValue placeholder={loadingCats ? "Cargando…" : "Selecciona…"} />
                </SelectTrigger>
                <SelectContent>
                  {api.categoriesList.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors?.category && <p className="text-xs text-red-600">{errors.category}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Subcategoría</Label>
              <Select value={subcategory} onValueChange={(v) => api.setSubcategory(v)}>
                <SelectTrigger disabled={!category || (catMap[category]?.length ?? 0) === 0}>
                  <SelectValue
                    placeholder={!category ? "Elige una categoría primero" : (catMap[category]?.length ?? 0) > 0 ? "Selecciona…" : "Sin subcategorías"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {api.subcatOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="inline-flex items-center gap-2">
                        {s.icon ? (isUrl(s.icon) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.icon} alt="" className="h-4 w-4 object-contain" />
                        ) : (
                          <span className="text-base leading-none">{s.icon}</span>
                        )) : null}
                        <span>{s.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors?.subcategory && <p className="text-xs text-red-600">{errors.subcategory}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Presupuesto estimado</Label>
              <div className="relative w-[35%]">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
                <Input
                  type="number"
                  value={budget}
                  onChange={(e) => api.setBudget(e.target.value === "" ? "" : Number(e.target.value))}
                  min={0}
                  step={100}
                  placeholder="800"
                  className="pl-6 pr-14"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">MXN</span>
              </div>
              {errors?.budget && <p className="text-xs text-red-600">{errors.budget}</p>}
            </div>
          </div>

          {/* Dirección */}
          <div className="space-y-1.5">
            <Label>Dirección</Label>
            <div className="flex items-center gap-2">
              {/* Chrome needs autocomplete=street-address + neutral id/name (no "cp"/"postal") so it shows full address autofill without breaking place_changed events. */}
              <Input
                id="page-request-address"
                name="address"
                autoComplete="street-address"
                value={addressInput}
                onChange={(e) => {
                  setAddressInput(e.target.value);
                  setAddressAutofillDirty(true);
                  api.setAddress(e.target.value);
                }}
                placeholder="Calle y número, colonia, CP"
                aria-label="Dirección"
                className={"flex-1 " + (errors?.address_line ? "border-red-600 focus-visible:ring-red-600" : "")}
                aria-invalid={errors?.address_line ? true : undefined}
                onFocus={() => {
                  const q = (addressInput || "").trim();
                  if (q.length >= 3) {
                    api.setAddrOpen(true);
                    api.debouncedFetchAddr(addressInput || "");
                  }
                }}
                onBlur={() => {
                  setTimeout(() => api.setAddrOpen(false), 120);
                }}
              />
              <Button type="button" variant="outline" onClick={() => api.setOpenMap(true)} aria-label="Abrir mapa">
                <MapPin size={18} />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const q = (addressInput || "").trim();
                  if (!q) return;
                  try {
                    const r = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`, {
                      cache: "no-store",
                      headers: { Accept: "application/json; charset=utf-8", "Content-Type": "application/json; charset=utf-8" },
                    });
                    const j = await r.json().catch(() => ({}));
                    const first = Array.isArray(j?.data) && j.data.length ? j.data[0] : null;
                    if (first) {
                      const lat = typeof first.lat === "number" ? first.lat : null;
                      const lon = typeof first.lon === "number" ? first.lon : null;
                      if (lat != null && lon != null) {
                        api.pickAddress({ address: q, lat, lon });
                        setAddressInput(q);
                        setAddressAutofillDirty(true);
                      }
                    }
                  } catch {
                    /* ignore */
                  }
                }}
                aria-label="Usar esta dirección"
                className="text-xs"
                disabled={!addressInput.trim()}
                title="Usar esta dirección"
              >
                Usar esta dirección
              </Button>
            </div>
            {/* Hidden autofill mirrors. They stay off-screen so Chrome fills street/city/postal and we can combine them. */}
            <input
              ref={ghostStreetRef}
              id="af_street"
              name="af_street"
              type="text"
              autoComplete="address-line1"
              className="autofill-ghost"
              tabIndex={-1}
              aria-hidden="true"
            />
            <input
              ref={ghostNeighborhoodRef}
              id="af_neighborhood"
              name="af_neighborhood"
              type="text"
              autoComplete="address-line2"
              className="autofill-ghost"
              tabIndex={-1}
              aria-hidden="true"
            />
            <input
              ref={ghostCityRef}
              id="af_city"
              name="af_city"
              type="text"
              autoComplete="address-level2"
              className="autofill-ghost"
              tabIndex={-1}
              aria-hidden="true"
            />
            <input
              ref={ghostStateRef}
              id="af_state"
              name="af_state"
              type="text"
              autoComplete="address-level1"
              className="autofill-ghost"
              tabIndex={-1}
              aria-hidden="true"
            />
            <input
              ref={ghostPostalRef}
              id="af_postal"
              name="af_postal"
              type="text"
              autoComplete="postal-code"
              className="autofill-ghost"
              tabIndex={-1}
              aria-hidden="true"
            />
            {errors?.address_line ? (
              <p className="text-xs text-red-600 mt-1">Favor de indicar Dirección</p>
            ) : null}
            {addrOpen &&
            ((addressInput.trim().length >= 3 && addrSuggestions.length > 0) || (addressInput.trim().length === 0 && recentAddrs.length > 0)) ? (
              <div className="mt-2 w-full max-h-60 overflow-auto rounded-md border bg-white shadow-sm">
                {(addressInput.trim().length >= 3 ? addrSuggestions : recentAddrs).map((it: AddressSuggestion, idx: number) => {
                  const isSaved = Boolean(it.id);
                  const meta = [it.postal_code, it.city].filter(Boolean).join(', ');
                  return (
                    <div key={(it.id || it.address) + String(idx)} className="flex items-center gap-2 px-2 py-2 hover:bg-slate-50">
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          api.pickAddress(it);
                          setAddressInput(it.address);
                          setAddressAutofillDirty(true);
                        }}
                        className="flex-1 text-left truncate"
                        title={it.address}
                      >
                        <div className="min-w-0">
                          <div className="truncate">{it.address}</div>
                          {meta ? <div className="text-xs text-slate-500 truncate">{meta}</div> : null}
                        </div>
                      </button>
                      {isSaved ? (
                        <button type="button" className="ml-auto text-xs text-red-600 hover:underline px-1 py-1" onMouseDown={async (e) => { e.preventDefault(); try { if (!it.id) return; const del = await fetch(`/api/addresses/book/${encodeURIComponent(String(it.id))}`, { method: 'DELETE', credentials: 'include' }); if (del.ok) { /* local cleanup */ } } catch { /* ignore */ } }}>Quitar</button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
            <p className="text-xs text-slate-500">Puedes escribir la dirección o elegirla en el mapa.</p>
            {!addressInput && coords ? (
              <p className="text-xs text-slate-500">Se usará tu ubicación actual si no cambias la dirección.</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Condiciones</Label>
            <p className="text-xs text-slate-500">Selecciona o escribe condiciones relevantes (máx. 10).</p>
            <ConditionsCombobox value={conditionsText} onChange={(v) => api.setConditionsText(v)} />
            {errors?.conditions && <p className="text-xs text-red-600">{errors.conditions}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Fecha requerida</Label>
            <div className="w-[18ch] md:w-[16ch]">
              <Input type="date" value={requiredAt} onChange={(e) => api.setRequiredAt(e.target.value)} className="w-full text-center" />
            </div>
            {errors?.required_at && <p className="text-xs text-red-600">{errors.required_at}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Imágenes del sitio (máx 5 MB c/u)</Label>
            <p className="text-xs text-slate-500">Permite hasta 5 imágenes.</p>
            <input ref={fileInputRef} className="sr-only" type="file" accept="image/*" multiple onChange={(e) => { const incoming = Array.from(e.currentTarget.files ?? []); api.addFiles(incoming); e.currentTarget.value = ""; }} />
            <div className="flex flex-wrap gap-2">
              {files.map((f, idx) => (
                <div key={`${f.name}-${idx}`} className="relative h-20 w-20 overflow-hidden rounded border border-slate-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(f)} alt={f.name} className="h-full w-full object-cover" />
                  <button type="button" title="Quitar" className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white" onClick={() => api.removeFileAt(idx)}>×</button>
                </div>
              ))}
              {files.length < 5 && (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-20 w-20 items-center justify-center rounded border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50" title="Agregar imagen">+</button>
              )}
            </div>
          </div>

          <Button type="submit" disabled={submitting || uploading} data-testid="post-request">
            {submitting || uploading ? "Publicando…" : "Publicar solicitud"}
          </Button>
        </form>

        <LocationPickerDialog
          open={openMap}
          onOpenChange={api.setOpenMap}
          initialCoords={coords}
          initialAddress={formAddress || null}
          onConfirm={(lat, lon, addr) => {
            api.pickAddress({ address: addr, lat, lon });
            setAddressInput(addr);
            setAddressAutofillDirty(true);
            api.setOpenMap(false);
          }}
        />
      </div>
    </main>
  );
}
