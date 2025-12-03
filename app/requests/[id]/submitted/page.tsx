import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

type Params = { params: { id: string } };

export const metadata: Metadata = {
  title: "Solicitud en revisión",
};

export default function RequestSubmittedPage({ params }: Params) {
  const { id } = params;
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mx-auto mb-6 h-16 w-16">
        <Image
          src="/images/LOGO_HANDI_DB.png"
          alt="Handi"
          width={64}
          height={64}
          className="mx-auto rounded"
        />
      </div>
      <h1 className="mb-3 text-2xl font-semibold tracking-tight">
        Tu solicitud está en revisión
      </h1>
      <p className="mx-auto mb-6 max-w-prose text-slate-600">
        Gracias por publicar en Handi. Nuestro equipo y la comunidad de
        profesionales podrán ver tu solicitud en cuanto sea revisada.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          href={`/requests/${id}`}
          className="rounded-xl bg-slate-900 px-4 py-2 text-white shadow-sm hover:bg-black"
        >
          Ver mi solicitud
        </Link>
        <Link
          href="/requests?mine=1"
          className="rounded-xl border border-slate-300 px-4 py-2 text-slate-900 shadow-sm hover:bg-slate-50"
        >
          Ir a mis solicitudes
        </Link>
      </div>
    </main>
  );
}
