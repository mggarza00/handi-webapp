"use client";

import * as React from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CurrencyInput } from "@/components/quote/CurrencyInput";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const ItemSchema = z.object({
  description: z.string().min(2, "Mínimo 2 caracteres"),
  amount: z.number({ required_error: "Monto requerido" }).min(0.01, "Monto mínimo $0.01"),
});

const QuoteSchema = z.object({
  items: z.array(ItemSchema).min(1, "Agrega al menos un concepto"),
  details: z.string().optional(),
  includeVAT: z.boolean().default(false),
});

type QuoteValues = z.infer<typeof QuoteSchema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string;
  onSubmitted?: () => void;
  onSubmit?: (values: QuoteValues & { folio?: string }) => Promise<void> | void;
};

export default function QuoteComposerDialog({ open, onOpenChange, conversationId, onSubmitted, onSubmit: onSubmitProp }: Props) {
  const form = useForm<QuoteValues>({
    resolver: zodResolver(QuoteSchema),
    mode: "onChange",
    defaultValues: {
      items: [{ description: "", amount: 0 }],
      details: "",
      includeVAT: false,
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const lastDescRef = React.useRef<HTMLInputElement | null>(null);
  const [folio, setFolio] = React.useState<string>("");
  function genFolio(): string {
    const base = Date.now().toString(36).toUpperCase().slice(-6);
    const rand = Math.random().toString(36).toUpperCase().slice(2, 4);
    return `Q-${base}${rand}`;
  }
  React.useEffect(() => { if (open) setFolio(genFolio()); }, [open]);
  const today = React.useMemo(
    () => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date()),
    [],
  );

  const watchItems = useWatch({ control: form.control, name: "items" }) as Array<{ description?: string; amount?: number }> | undefined;

  const subtotal = React.useMemo(() => {
    return (watchItems || []).reduce((acc, it) => acc + (typeof it?.amount === "number" ? it.amount : 0), 0);
  }, [watchItems]);
  const total = subtotal;
  const fmt = React.useMemo(() => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }), []);

  function handleAddConcept() {
    append({ description: "", amount: 0 });
    requestAnimationFrame(() => {
      lastDescRef.current?.focus();
    });
  }

  async function onSubmit(values: QuoteValues) {
    try {
      if (onSubmitProp) {
        await onSubmitProp({ ...values, folio });
      } else {
        const payloadItems = values.items.map((it) => ({ concept: it.description.trim(), amount: Number(it.amount) }))
          .filter((it) => it.concept.length > 0 && Number.isFinite(it.amount));
        const res = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          credentials: "include",
          body: JSON.stringify({
            conversation_id: conversationId,
            items: payloadItems,
            currency: "MXN",
            folio,
            notes: (values.details && values.details.trim().length) ? values.details.trim() : undefined,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.ok === false) throw new Error(json?.error || "No se pudo enviar la cotización");
        toast.success("Cotización enviada");
      }
      onOpenChange(false);
      form.reset({ items: [{ description: "", amount: 0 }], details: "", includeVAT: false });
      onSubmitted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void form.handleSubmit(onSubmit)();
    } else if ((e.altKey || (e.ctrlKey && e.shiftKey)) && (e.key.toLowerCase() === "n")) {
      e.preventDefault();
      handleAddConcept();
    }
  }

  const isValid = form.formState.isValid;
  const isSubmitting = form.formState.isSubmitting;
  const canSubmit = isValid && total > 0 && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cotización</DialogTitle>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Folio: {folio}</span>
            <span className="text-right">{today}</span>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={onKeyDown} className="space-y-4">
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                  <FormField
                    name={`items.${index}.description` as const}
                    render={({ field }) => {
                      const setRef = (el: HTMLInputElement | null) => {
                        field.ref(el);
                        if (index === fields.length - 1) {
                          lastDescRef.current = el;
                        }
                      };
                      return (
                      <FormItem className="col-span-12 sm:col-span-7">
                        <FormLabel>Concepto</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            ref={setRef}
                            placeholder="Concepto (ej. Mano de obra)"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                      );
                    }}
                  />
                  <FormField
                    name={`items.${index}.amount` as const}
                    render={({ field }) => (
                      <FormItem className="col-span-12 sm:col-span-4">
                        <FormLabel>Monto</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2 sm:block">
                            <CurrencyInput
                              value={typeof field.value === "number" ? field.value : undefined}
                              onValueChange={(v) => field.onChange(v)}
                              aria-label="Monto en MXN"
                              className="flex-1"
                            />
                            {fields.length > 1 && index > 0 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-800 hover:text-red-900 sm:hidden"
                                onClick={() => remove(index)}
                                aria-label="Eliminar concepto"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="col-span-12 sm:col-span-1 pt-6 hidden sm:block">
                    {fields.length > 1 && index > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-800 hover:text-red-900"
                        aria-label="Eliminar concepto"
                        title="Eliminar"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              <div>
                <Button type="button" variant="outline" onClick={handleAddConcept} aria-label="Agregar concepto">
                  Agregar concepto
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <FormLabel htmlFor="details">Detalles y Condiciones</FormLabel>
              <FormControl>
                <Textarea id="details" placeholder="Ej. Vigencia, alcances y condiciones" rows={3} {...form.register("details")} />
              </FormControl>
              <FormMessage />
            </div>

            <Separator />

            <div className="rounded-xl border p-4 bg-muted/30 space-y-2">
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Total</span>
                <span>{fmt.format(total)}</span>
              </div>
            </div>

            <DialogFooter className="gap-2 flex-col sm:flex-row">
              <span className="text-xs text-muted-foreground sm:mr-auto">Precio no incluye IVA ni comision.</span>
              <div className="flex gap-2 sm:ml-auto">
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={!canSubmit}>Enviar</Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
