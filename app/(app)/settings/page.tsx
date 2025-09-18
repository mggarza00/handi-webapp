"use client";

import { useEffect, useState } from "react";
import { Laptop, Moon, Sun } from "lucide-react";

import { useTheme } from "../_components/ThemeProvider";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const { theme, setTheme, isMounted, isDark } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl">Apariencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Por defecto, Handi usa el modo configurado en tu dispositivo. Aquí puedes forzar <strong>Light</strong> o <strong>Night</strong>.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <Button
              variant={theme === "system" ? "default" : "secondary"}
              onClick={() => setTheme("system")}
              className="justify-center"
              aria-pressed={theme === "system"}
              title="Usar configuración del sistema"
            >
              <Laptop className="mr-2 h-4 w-4" />
              Sistema
            </Button>

            <Button
              variant={!isDark && theme !== "system" ? "default" : "secondary"}
              onClick={() => setTheme("light")}
              className="justify-center"
              aria-pressed={!isDark && theme !== "system"}
              title="Light mode"
            >
              <Sun className="mr-2 h-4 w-4" />
              Light
            </Button>

            <Button
              variant={isDark && theme !== "system" ? "default" : "secondary"}
              onClick={() => setTheme("dark")}
              className="justify-center"
              aria-pressed={isDark && theme !== "system"}
              title="Night mode"
            >
              <Moon className="mr-2 h-4 w-4" />
              Night
            </Button>
          </div>

          {!ready || !isMounted ? (
            <p className="text-xs text-muted-foreground">Cargando preferencia</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Tema actual: <code>{theme}</code> {theme === "system" ? "(según dispositivo)" : ""}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
