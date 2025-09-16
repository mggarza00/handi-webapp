import Link from "next/link";

import PageContainer from "@/components/page-container";

export default function NotFound() {
  return (
    <PageContainer>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Página no encontrada</h1>
        <p className="text-sm text-slate-600">
          La ruta que intentaste abrir no existe o fue movida.
        </p>
        <div className="text-sm">
          <Link className="underline" href="/">
            Volver al inicio
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
