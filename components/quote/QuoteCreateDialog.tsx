"use client";
import * as React from "react";
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "./CurrencyInput";
import { Trash2 } from "lucide-react";

const ItemSchema = z.object({
  description: z.string().min(2, "Escribe un concepto"),
  amount: z.number().min(0.01, "Monto > 0"),
});

const FormSchema = z.object({
  items: z.array(ItemSchema).min(1, "Agrega al menos un concepto"),
  details: z.string().optional(),
  includeVAT: z.boolean().default(false),
});

export type QuoteCreateValues = z.infer<typeof FormSchema> & { folio?: string };

export function QuoteCreateDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (values: QuoteCreateValues) => Promise<void> | void;
  defaultValues?: Partial<QuoteCreateValues>;
}) {
  const form = useForm<QuoteCreateValues>({
    resolver: zodResolver(FormSchema),
    mode: "onChange",
    defaultValues: {
      items: [{ description: "", amount: 0 }],
      details: "",
      includeVAT: false,
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const items = useWatch({ control: form.control, name: "items" }) as Array<{ description?: string; amount?: number }> | undefined;
  // VAT removed from UI; total equals subtotal
  const subtotal = (items || []).reduce((s, it) => s + (Number(it?.amount) || 0), 0);
  const total = subtotal;
  const fmt = React.useMemo(() => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }), []);

  const lastDescRef = React.useRef<HTMLInputElement | null>(null);
  const firstDescRef = React.useRef<HTMLInputElement | null>(null);
  function handleAdd() {
    append({ description: "", amount: 0 });
    requestAnimationFrame(() => lastDescRef.current?.focus());
  }

  function handleRemove(idx: number) {
    remove(idx);
  }

  async function handleSubmit(values: QuoteCreateValues) {
    await onSubmit({ ...values, folio });
    onOpenChange(false);
    form.reset({ items: [{ description: "", amount: 0 }], details: "", includeVAT: false });
  }

  const canSubmit = form.formState.isValid && total > 0 && !form.formState.isSubmitting;

  function nf(n: number) {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);
  }

  function handleFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void form.handleSubmit(handleSubmit)();
    }
  }

  React.useEffect(() => {
    if (open) {
      setTimeout(() => firstDescRef.current?.focus(), 0);
    }
  }, [open]);

  function genFolio(): string {
    const base = Date.now().toString(36).toUpperCase().slice(-6);
    const rand = Math.random().toString(36).toUpperCase().slice(2, 4);
    return `Q-${base}${rand}`;
  }

  const [folio, setFolio] = React.useState<string>("");
  React.useEffect(() => {
    if (open) setFolio(genFolio());
  }, [open]);

  const today = React.useMemo(() => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date()), [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-semibold tracking-tight">Cotización</DialogTitle>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Folio: {folio}</span>
            <span className="text-right">{today}</span>
          </div>
        </DialogHeader>
        <form
          className="space-y-5"
          onKeyDown={handleFormKeyDown}
          onSubmit={form.handleSubmit(async (v) => { await onSubmit(v); onOpenChange(false); })}
        >
          <div className="space-y-3">
            {fields.map((f, idx) => (
              <div key={f.id} className="grid grid-cols-1 sm:[grid-template-columns:1fr_170px_32px] gap-3 items-start">
                <div className="sm:col-span-1">
                  <Label className="sr-only" htmlFor={`desc-${idx}`}>Concepto</Label>
                  <Input
                    id={`desc-${idx}`}
                    placeholder="Concepto (ej. Mano de obra)"
                    aria-invalid={!!form.formState.errors.items?.[idx]?.description}
                    {...form.register(`items.${idx}.description` as const)}
                    ref={(el) => {
                      (form.register(`items.${idx}.description` as const).ref as any)?.(el);
                      if (idx === 0) firstDescRef.current = el as any;
                      if (idx === fields.length - 1) lastDescRef.current = el as any;
                    }}
                  />
                  {form.formState.errors.items?.[idx]?.description ? (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.items[idx]?.description?.message as string}</p>
                  ) : null}
                </div>
                <div className="sm:col-span-1">
                  <Label className="sr-only" htmlFor={`amount-${idx}`}>Monto</Label>
                  <Controller
                    name={`items.${idx}.amount` as const}
                    control={form.control}
                    render={({ field }) => (
                      <div className="flex items-center gap-2 sm:block">
                        <CurrencyInput
                          id={`amount-${idx}`}
                          placeholder="0.00"
                          value={typeof field.value === "number" ? field.value : undefined}
                          onValueChange={(n) => field.onChange(n)}
                          onBlur={field.onBlur}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const desc = form.getValues(`items.${idx}.description` as const);
                              if (typeof desc === 'string' && desc.trim().length > 1) {
                                handleAdd();
                              }
                            }
                          }}
                          aria-invalid={!!form.formState.errors.items?.[idx]?.amount}
                          className="flex-1"
                        />
                        {fields.length > 1 && idx > 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-800 hover:text-red-900 sm:hidden"
                            onClick={() => handleRemove(idx)}
                            aria-label="Eliminar concepto"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    )}
                  />
                  {form.formState.errors.items?.[idx]?.amount ? (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.items[idx]?.amount?.message as string}</p>
                  ) : null}
                </div>
                <div className="pt-2 sm:col-span-1 hidden sm:block">
                  {fields.length > 1 && idx > 0 ? (
                    <Button type="button" variant="ghost" className="h-8 w-8 p-0 text-red-800 hover:text-red-900" onClick={() => handleRemove(idx)} aria-label="Eliminar concepto">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => append({ description: "", amount: 0 })}>
              Agregar concepto
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Detalles y Condiciones</Label>
            <Textarea id="details" placeholder="Ej. Vigencia de la cotización, alcances, garantías y condiciones adicionales" rows={3} {...form.register("details")} />
          </div>

          <div className="rounded-xl border p-4 bg-muted/30 space-y-2">
            <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{nf(total)}</span></div>
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <span className="text-xs text-muted-foreground sm:mr-auto">Precio no incluye IVA ni comision.</span>
            <div className="flex gap-2 sm:ml-auto">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={!form.formState.isValid || total <= 0}>Enviar</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
