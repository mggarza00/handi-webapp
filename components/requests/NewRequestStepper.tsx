"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

import Stepper, { Step } from "@/components/react-bits/stepper/Stepper";
import AddressMapPickerModal from "@/components/address/MapPickerModal";
import ConditionsCombobox from "@/components/requests/ConditionsCombobox";
import useCreateRequestForm from "@/components/requests/useCreateRequestForm";
import { Badge } from "@/components/ui/badge";
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
import { CITIES } from "@/lib/cities";
import { cn } from "@/lib/utils";

type CreateRequestFormApi = ReturnType<typeof useCreateRequestForm>;
type CreateRequestFormState = CreateRequestFormApi["state"];
type AddressSuggestion = CreateRequestFormState["addrSuggestions"][number];

const TOTAL_STEPS = 3;
const STEP_ERROR_GROUPS: Array<{
  step: number;
  fields: Array<keyof CreateRequestFormState["errors"] | string>;
}> = [
  { step: 1, fields: ["title", "description", "category", "subcategory"] },
  { step: 2, fields: ["city", "address_line"] },
  { step: 3, fields: ["budget", "required_at", "conditions"] },
];

function isUrl(v: string | null | undefined) {
  return (
    !!v &&
    (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/"))
  );
}

export type NewRequestStepperProps = {
  className?: string;
  onSuccess?: (newId?: string) => void;
  showStatus?: boolean;
  initialAddress?: {
    address: string;
    lat?: number | null;
    lon?: number | null;
    city?: string | null;
  };
};

export default function NewRequestStepper({
  className,
  onSuccess,
  showStatus = true,
  initialAddress,
}: NewRequestStepperProps) {
  const router = useRouter();
  const {
    state,
    setTitle,
    setDescription,
    setCity,
    setCityTouched,
    setCategory,
    setSubcategory,
    setBudget,
    setRequiredAt,
    setConditionsText,
    addFiles,
    removeFileAt,
    setOpenMap,
    setAddress,
    pickAddress,
    debouncedFetchAddr,
    setAddrOpen,
    categoriesList,
    subcatOptions,
    handleSubmit,
    setShouldSaveAddress,
  } = useCreateRequestForm();

  const {
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
    loadingCats,
    catMap,
    isAutoCategorizing,
    addrOpen,
    addrSuggestions,
    recentAddrs,
    coords,
    openMap,
    shouldSaveAddress,
    isAddressSaved,
  } = state;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const availableSubcategories = useMemo(() => subcatOptions, [subcatOptions]);
  const [currentStep, setCurrentStep] = useState(1);
  const [status, setStatus] = useState("Ningún evento todavía.");
  const [needsErrorFocus, setNeedsErrorFocus] = useState(false);
  const showCategoriesWarning = !loadingCats && categoriesList.length === 0;
  const errorFieldClass = "border-red-600 focus-visible:ring-red-600";
  const fieldBaseClass =
    "bg-slate-100 border-slate-300 focus-visible:ring-slate-400 focus-visible:ring-offset-0 placeholder:text-slate-500 shadow-none";
  const categoryTriggerClass = cn(
    fieldBaseClass,
    errors?.category && errorFieldClass,
    isAutoCategorizing && "opacity-60",
  );
  const subcategoryDisabled =
    isAutoCategorizing || !category || (catMap[category]?.length ?? 0) === 0;
  const subcategoryTriggerClass = cn(
    fieldBaseClass,
    errors?.subcategory && errorFieldClass,
    isAutoCategorizing && "opacity-60",
  );
  const initialAddressAppliedRef = useRef(false);

  useEffect(() => {
    if (!initialAddress || initialAddressAppliedRef.current) return;
    const addrLine = (initialAddress.address || "").toString().trim();
    if (!addrLine) return;
    initialAddressAppliedRef.current = true;
    setAddress(addrLine);
    pickAddress({
      address: addrLine,
      city: initialAddress.city ?? null,
      lat: initialAddress.lat ?? null,
      lon: initialAddress.lon ?? null,
    });
  }, [initialAddress, pickAddress, setAddress]);

  useEffect(() => {
    if (!needsErrorFocus) return;
    if (!errors) {
      setNeedsErrorFocus(false);
      return;
    }
    for (const group of STEP_ERROR_GROUPS) {
      if (
        group.fields.some((field) =>
          Boolean((errors as Record<string, string | undefined>)[field]),
        )
      ) {
        setCurrentStep(group.step);
        break;
      }
    }
    setNeedsErrorFocus(false);
  }, [errors, needsErrorFocus]);

  return (
    <div className={cn("w-full", className)}>
      <Stepper
        className="w-full"
        stepCircleContainerClassName="max-w-4xl border border-border bg-background"
        contentClassName="px-6 py-6"
        footerClassName="px-6 pb-8"
        initialStep={1}
        currentStepOverride={currentStep}
        backButtonText="Atras"
        nextButtonText="Continuar"
        finalButtonText="Enviar solicitud"
        completionContent={
          <div
            className="flex flex-col items-center gap-4 px-6 py-10 text-center"
            role="status"
            aria-live="polite"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-[#0B6149]">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            </div>
            <p className="text-base font-semibold text-slate-900">
              Estamos creando tu solicitud de servicio
            </p>
          </div>
        }
        nextButtonProps={{
          className:
            "duration-350 flex items-center justify-center rounded-full bg-[#0B6149] px-3.5 py-1.5 font-medium tracking-tight text-white transition hover:bg-[#0a5841] active:bg-[#084b37]",
        }}
        onStepChange={(step) => {
          setCurrentStep(step);
          setStatus(`Cambio al paso ${step}`);
        }}
        onFinalStepCompleted={async () => {
          setCurrentStep(TOTAL_STEPS + 1);
          setStatus("Todos los pasos completados · Enviando solicitud");
          let ok = false;
          await handleSubmit({
            onSuccess: (newId) => {
              ok = true;
              setStatus("Solicitud creada correctamente");
              onSuccess?.(newId);
              if (newId) {
                router.push(`/requests/${newId}`);
              }
              toast.success("Solicitud de servicio creada");
            },
          });
          if (!ok) {
            setStatus(
              "No se pudo enviar la solicitud. Revisa los campos e intenta de nuevo.",
            );
            setNeedsErrorFocus(true);
          }
        }}
      >
        <Step label="Describe lo que necesitas">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Paso 1 - Describe lo que necesitas
              </h2>
              <p className="text-sm text-slate-600">
                Completa título, descripción y categoría para clasificar tu
                solicitud.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                data-testid="request-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ej. Reparación de fuga en baño"
                required
                aria-invalid={errors?.title ? true : undefined}
                className={cn(fieldBaseClass, errors?.title && errorFieldClass)}
              />
              {errors?.title ? (
                <p className="text-xs text-red-600">{errors.title}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                data-testid="request-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe lo que necesitas"
                aria-invalid={errors?.description ? true : undefined}
                className={cn(
                  fieldBaseClass,
                  errors?.description && errorFieldClass,
                )}
              />
              {errors?.description ? (
                <p className="text-xs text-red-600">{errors.description}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={category} onValueChange={(v) => setCategory(v)}>
                  <SelectTrigger
                    data-testid="request-category"
                    disabled={isAutoCategorizing}
                    className={categoryTriggerClass}
                    aria-invalid={errors?.category ? true : undefined}
                  >
                    <SelectValue
                      placeholder={loadingCats ? "Cargando..." : "Selecciona"}
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
                {errors?.category ? (
                  <p className="text-xs text-red-600">{errors.category}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label>Subcategoría</Label>
                <Select
                  value={subcategory}
                  onValueChange={(v) => setSubcategory(v)}
                >
                  <SelectTrigger
                    disabled={subcategoryDisabled}
                    className={subcategoryTriggerClass}
                    aria-invalid={errors?.subcategory ? true : undefined}
                  >
                    <SelectValue
                      placeholder={
                        !category
                          ? "Elige una categoría primero"
                          : (catMap[category]?.length ?? 0) > 0
                            ? "Selecciona"
                            : "Sin subcategorías"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubcategories.map((s) => (
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
                {errors?.subcategory ? (
                  <p className="text-xs text-red-600">{errors.subcategory}</p>
                ) : null}
              </div>
            </div>

            {isAutoCategorizing ? (
              <Badge
                variant="secondary"
                className="mt-2 inline-flex items-center gap-2 bg-slate-100 text-xs text-slate-600"
              >
                <Loader2
                  className="h-3.5 w-3.5 animate-spin text-slate-500"
                  aria-hidden
                />
                Calculando categoría y subcategoría en automático
              </Badge>
            ) : null}

            {showCategoriesWarning ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                No hay categorías disponibles. Revisa la tabla{" "}
                <code>categories_subcategories</code> en Supabase.
              </div>
            ) : null}
          </div>
        </Step>

        <Step label="Ubicación y contacto">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Paso 2 - Ubicación y contacto
              </h2>
              <p className="text-sm text-slate-600">
                Incluye la ciudad y la dirección usando la búsqueda o el mapa.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Ciudad</Label>
              <Select
                value={city}
                onValueChange={(v) => {
                  setCityTouched(true);
                  setCity(v);
                }}
              >
                <SelectTrigger
                  className={cn(
                    fieldBaseClass,
                    errors?.city && errorFieldClass,
                  )}
                  aria-invalid={errors?.city ? true : undefined}
                >
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
              {errors?.city && (
                <p className="text-xs text-red-600">{errors.city}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2 lg:flex-row">
                  {/* Force Chrome to treat this as a full street address (not CP-only) by using autocomplete=street-address and avoiding cp/zip keywords in id/name so native autofill + place_changed keep working. */}
                  <Input
                    id="request-address"
                    name="address"
                    autoComplete="street-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Calle y número, colonia, CP"
                    className={cn(
                      "flex-1",
                      fieldBaseClass,
                      errors?.address_line && errorFieldClass,
                    )}
                    aria-invalid={errors?.address_line ? true : undefined}
                    onFocus={() => {
                      const q = (address || "").trim();
                      if (q.length >= 3) {
                        setAddrOpen(true);
                        debouncedFetchAddr(address || "");
                      }
                    }}
                    onBlur={() =>
                      window.setTimeout(() => setAddrOpen(false), 120)
                    }
                  />
                  {!isAddressSaved ? (
                    <div className="flex items-center">
                      <Button
                        type="button"
                        variant={shouldSaveAddress ? "default" : "outline"}
                        size="sm"
                        className="text-xs"
                        onClick={() => setShouldSaveAddress(true)}
                      >
                        {shouldSaveAddress ? "Guardada" : "Guardar dirección"}
                      </Button>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpenMap(true)}
                      aria-label="Abrir mapa"
                    >
                      <MapPin size={18} />
                    </Button>
                  </div>
                </div>
                {errors?.address_line ? (
                  <p className="text-xs text-red-600">{errors.address_line}</p>
                ) : null}
              </div>

              {addrOpen &&
              ((address.trim().length >= 3 && addrSuggestions.length > 0) ||
                (address.trim().length === 0 && recentAddrs.length > 0)) ? (
                <div className="mt-2 max-h-60 w-full overflow-auto rounded-md border bg-white shadow-sm">
                  {(address.trim().length >= 3
                    ? addrSuggestions
                    : recentAddrs
                  ).map((item: AddressSuggestion, idx) => {
                    const meta = [item.postal_code, item.city]
                      .filter(Boolean)
                      .join(", ");
                    const saved = Boolean(item.id);
                    return (
                      <div
                        key={(item.id || item.address) + String(idx)}
                        className="flex items-center gap-2 px-2 py-2 hover:bg-slate-50"
                      >
                        <button
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            pickAddress({
                              address: item.address,
                              lat: item.lat ?? null,
                              lon: item.lon ?? null,
                            });
                            setAddress(item.address);
                            setAddrOpen(false);
                          }}
                          className="flex-1 truncate text-left"
                          title={item.address}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {item.address}
                            </p>
                            {meta ? (
                              <p className="truncate text-xs text-slate-500">
                                {meta}
                              </p>
                            ) : null}
                          </div>
                        </button>
                        {saved ? (
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:underline px-1 py-1"
                            onMouseDown={async (event) => {
                              event.preventDefault();
                              try {
                                if (!item.id) return;
                                await fetch(
                                  `/api/addresses/book/${encodeURIComponent(String(item.id))}`,
                                  {
                                    method: "DELETE",
                                    credentials: "include",
                                  },
                                );
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            Quitar
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <p className="text-xs text-slate-500">
                Puedes escribir la dirección, usar la búsqueda o elegirla en el
                mapa.
              </p>
              {!address && coords ? (
                <p className="text-xs text-slate-500">
                  Se usará tu ubicación actual si no cambias la dirección.
                </p>
              ) : null}
            </div>
          </div>
        </Step>

        <Step label="Datos adicionales">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Paso 3 - Datos adicionales
              </h2>
              <p className="text-sm text-slate-600">
                Completa presupuesto, fecha, condiciones y adjunta imágenes del
                sitio.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 md:gap-6 justify-between">
              <div className="space-y-1.5 flex-1 min-w-[150px] max-w-[150px]">
                <Label>Fecha requerida</Label>
                <Input
                  type="date"
                  value={requiredAt}
                  onChange={(e) => setRequiredAt(e.target.value)}
                  className={cn(
                    "w-full text-center",
                    fieldBaseClass,
                    errors?.required_at && errorFieldClass,
                  )}
                  aria-invalid={errors?.required_at ? true : undefined}
                />
                {errors?.required_at && (
                  <p className="text-xs text-red-600">{errors.required_at}</p>
                )}
              </div>

              <div className="space-y-1.5 flex-1 min-w-[150px] max-w-[150px]">
                <Label>Presupuesto estimado</Label>
                <div className="relative w-full">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                    $
                  </span>
                  <Input
                    type="number"
                    value={budget}
                    onChange={(e) =>
                      setBudget(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    min={0}
                    step={100}
                    className={cn(
                      "pl-6 pr-14",
                      fieldBaseClass,
                      errors?.budget && errorFieldClass,
                    )}
                    aria-invalid={errors?.budget ? true : undefined}
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    MXN
                  </span>
                </div>
                {errors?.budget && (
                  <p className="text-xs text-red-600">{errors.budget}</p>
                )}
              </div>

              <div className="space-y-1.5 flex-1 min-w-[150px] max-w-[150px]">
                <Label>Condiciones</Label>
                <div
                  className={cn(
                    "rounded-md border border-transparent",
                    errors?.conditions && "border-red-600",
                  )}
                  aria-invalid={errors?.conditions ? true : undefined}
                >
                  <ConditionsCombobox
                    value={conditionsText}
                    onChange={(v) => setConditionsText(v)}
                    triggerClassName={cn(
                      "w-full justify-start text-left",
                      fieldBaseClass,
                    )}
                  />
                </div>
                {errors?.conditions ? (
                  <p className="text-xs text-red-600">{errors.conditions}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Imágenes del sitio (max 5 MB c/u)</Label>
              <p className="text-xs text-slate-500">
                Permite hasta 5 imágenes.
              </p>
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const incoming = Array.from(e.currentTarget.files ?? []);
                  addFiles(incoming);
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
                      onClick={() => removeFileAt(idx)}
                    >
                      x
                    </button>
                  </div>
                ))}
                {files.length < 5 ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-20 w-20 items-center justify-center rounded border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50"
                    title="Agregar imagen"
                  >
                    +
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </Step>
      </Stepper>

      {showStatus ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <span className="font-medium text-slate-900">Actividad:</span>{" "}
          {status}
        </div>
      ) : null}

      <AddressMapPickerModal
        open={openMap}
        onClose={() => setOpenMap(false)}
        initial={{
          lat: coords?.lat ?? undefined,
          lng: coords?.lon ?? undefined,
          address: address || undefined,
        }}
        onConfirm={(payload) => {
          setAddress(payload.address);
          pickAddress({
            address: payload.address,
            lat: payload.lat,
            lon: payload.lng,
            city: payload.city ?? null,
          });
          setOpenMap(false);
        }}
      />
    </div>
  );
}
