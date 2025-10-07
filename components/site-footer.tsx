import Link from "next/link";
import Image from "next/image";

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Image src="/Logo-Homaid-v1.gif" alt="Homaid" width={28} height={28} />
              <span className="font-semibold">Homaid.mx</span>
            </div>
            <p className="text-sm text-slate-600">Conecta con expertos de confianza.</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Enlaces</p>
            <ul className="space-y-1 text-sm text-slate-600">
              <li>
                <Link href="/search" className="hover:text-slate-900">
                  Buscar profesionales
                </Link>
              </li>
              <li>
                <Link href="/pro-apply" className="hover:text-slate-900">
                  Ofrecer mis servicios
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-slate-900">
                  Aviso de privacidad
                </Link>
              </li>
              <li>
                <Link href="/politicas-facturacion" className="hover:text-slate-900">
                  Políticas de facturación
                </Link>
              </li>
            </ul>
          </div>
          <div id="preguntas">
            <p className="mb-2 text-sm font-medium">Soporte</p>
            <ul className="space-y-1 text-sm text-slate-600">
              <li>
                WhatsApp:{" "}
                <a href="https://wa.me/5218181611335" className="hover:text-slate-900">
                  +52 1 81 8161 1335
                </a>
              </li>
              <li>
                Email:{" "}
                <a href="mailto:hola@homaid.mx" className="hover:text-slate-900">
                  hola@homaid.mx
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Homaid.mx. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
