import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Postulación en revisión" };

export default function ProApplySubmittedPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mx-auto mb-6 h-16 w-16">
        <Image
          src="/Logo-Homaid-v1.gif"
          alt="Handi"
          width={64}
          height={64}
          className="mx-auto rounded"
        />
      </div>
      <h1 className="mb-3 text-2xl font-semibold tracking-tight">
        Tu postulación está en revisión
      </h1>
      <p className="mx-auto mb-2 max-w-prose text-slate-700">
        Gracias por registrarte como profesional en Handi. Nuestro equipo
        revisará tu información y documentos.
      </p>
      <p className="mx-auto mb-6 max-w-prose text-slate-600">
        Te contactaremos muy pronto para darle seguimiento o confirmar la
        activación de tu perfil.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-slate-900 px-4 py-2 text-white shadow-sm hover:bg-black"
        >
          Ir al inicio
        </Link>
        <Link
          href="/me"
          className="rounded-xl border border-slate-300 px-4 py-2 text-slate-900 shadow-sm hover:bg-slate-50"
        >
          Ver mi cuenta
        </Link>
      </div>
    </main>
  );
}
