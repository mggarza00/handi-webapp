"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";

export default function MobileProsAnchorButton({
  category,
  subcategory,
}: {
  category?: string | null;
  subcategory?: string | null;
}) {
  // Ícono inicial removido: mantenemos botón simple con texto.
  return (
    <div className="md:hidden flex justify-center mt-5">
      <Button asChild variant="default" size="sm">
        <a href="#available-professionals" className="inline-flex items-center">
          <span>Ver profesionales disponibles</span>
        </a>
      </Button>
    </div>
  );
}
