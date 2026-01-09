"use client";
import * as React from "react";

import { Button } from "@/components/ui/button";

type Props = {
  category?: string | null;
  subcategory?: string | null;
};

export default function MobileProsAnchorButton(_props: Props) {
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
