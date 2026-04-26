"use client";

import { useMemo, useState } from "react";
import { Share2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  className?: string;
};

export default function ShareProfileButton({ title, className }: Props) {
  const pathname = usePathname();
  const [sharing, setSharing] = useState(false);
  const url = useMemo(() => {
    if (typeof window === "undefined") return pathname || "/";
    return new URL(pathname || "/", window.location.origin).toString();
  }, [pathname]);

  const onShare = async () => {
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: `Mira el perfil de ${title} en Handi`,
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado al portapapeles");
    } catch {
      toast.error("No pudimos compartir este perfil");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("h-11 rounded-full border-slate-300", className)}
      disabled={sharing}
      onClick={() => {
        void onShare();
      }}
    >
      <Share2 className="h-4 w-4" />
      Compartir perfil
    </Button>
  );
}
