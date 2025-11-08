import Link from "next/link";
import PageContainer from "@/components/page-container";
import Breadcrumbs from "@/components/breadcrumbs";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function ProfileChangesRequestedPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Inicio", href: "/" },
            { label: "Perfil", href: "/profile/setup" },
            { label: "Cambios solicitados" },
          ]}
        />
        <Card className="p-6">
          <h1 className="mb-2 text-xl font-semibold">¡Listo! Solicitaste cambios a tu perfil</h1>
          <p className="text-sm text-slate-700">
            El equipo de Handi revisará tu solicitud y aplicará los cambios.
            Te avisaremos por notificación y correo cuando se actualicen.
          </p>
          <div className="mt-6">
            <Link href="/" className={cn(buttonVariants({ variant: "default" }))}>
              Volver al inicio
            </Link>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

