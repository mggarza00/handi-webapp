"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { Plus, Star } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

type Props = {
  proId: string;
  requestId: string;
  initial: boolean;
  onToggled?: (fav: boolean) => void;
};

export default function FavoriteButton({ proId: _proId, requestId, initial, onToggled }: Props) {
  const [isPending, startTransition] = useTransition();
  const [fav, setFav] = useState<boolean>(!!initial);

  function handleToggle() {
    const makeFav = !fav;
    // Optimistic update
    setFav(makeFav);
    onToggled?.(makeFav);
    startTransition(async () => {
      try {
        const res = await fetch('/api/pro/favorites/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          credentials: 'include',
          body: JSON.stringify({ requestId, favorite: makeFav }),
        });
        if (!res.ok) {
          setFav(!makeFav);
          onToggled?.(!makeFav);
          return;
        }
        const j = await res.json().catch(() => null);
        if (!j?.ok) {
          setFav(!makeFav);
          onToggled?.(!makeFav);
        }
      } catch {
        setFav(!makeFav);
        onToggled?.(!makeFav);
      }
    });
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-pressed={fav}
            aria-label={fav ? "Favorito" : "Agregar a favoritos"}
            className={[
              "rounded-full w-9 h-9 p-0 border",
              fav ? "bg-yellow-50 text-yellow-600 border-yellow-500" : "text-slate-500 border-slate-300",
            ].join(" ")}
            onClick={handleToggle}
            disabled={isPending}
          >
            {fav ? <Star className="size-5" /> : <Plus className="size-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{fav ? "Favorito" : "Agregar a favoritos"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
