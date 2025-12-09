"use client";
import * as React from "react";
import Link from "next/link";

import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Props = {
  href: string;
  label?: string;
  size?: "sm" | "lg" | "default";
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  className?: string;
  testId?: string;
};

export default function AntiFlashLoginButton({ href, label = "Iniciar sesión", size = "sm", variant = "outline", className, testId }: Props) {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createSupabaseBrowser();
        const { data } = await supabase.auth.getSession();
        const hasSession = !!data?.session;
        if (!active) return;
        // Mostrar el botón solo si NO hay sesión en el cliente
        setShow(!hasSession);
      } catch {
        // En caso de error, por seguridad mostramos el botón
        if (active) setShow(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!show) return null;
  return (
    <Button asChild size={size} variant={variant} className={className}>
      <Link href={href} data-testid={testId}>
        {label}
      </Link>
    </Button>
  );
}
