"use client";

import { useState } from "react";
import { Toaster, toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function UIPage() {
  const [name, setName] = useState("");

  return (
    <TooltipProvider>
      <div className="min-h-screen p-6 md:p-10 space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">UI Kit Homaid</h1>
          <Badge variant="secondary">v1 • shadcn/ui</Badge>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
              <CardDescription>Botones y notificaciones</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3 flex-wrap">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() =>
                      toast("Acción ejecutada", {
                        description: "Ejemplo con sonner",
                      })
                    }
                  >
                    Primario
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Botón primario</TooltipContent>
              </Tooltip>
              <Button variant="secondary">Secundario</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructivo</Button>
            </CardContent>
            <CardFooter>
              <Badge>Acciones</Badge>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Formulario</CardTitle>
              <CardDescription>Inputs y validaciones mínimas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Descripción</Label>
                <Textarea id="desc" placeholder="Escribe algo..." />
              </div>
              <Separator />
              <Alert>
                <AlertTitle>Nota</AlertTitle>
                <AlertDescription>
                  Usa este patrón para formularios rápidos.
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="gap-3">
              <Button disabled={!name}>Guardar</Button>
              <Button variant="outline" onClick={() => setName("")}>
                Limpiar
              </Button>
            </CardFooter>
          </Card>
        </section>

        <footer className="text-sm text-muted-foreground">
          Tip: copia estos patrones para Formularios, Listas y Flujos de pago.
        </footer>

        <Toaster position="top-right" />
      </div>
    </TooltipProvider>
  );
}
