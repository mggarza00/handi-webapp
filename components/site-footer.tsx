import Image from "next/image";
import Link from "next/link";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "soporte@handi.mx";

export default function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-[#112C74] bg-[#112C74] text-white">
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-4 md:pt-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <div className="mb-3 flex flex-col items-start space-y-4">
              <Image
                src="/images/LOGO_HPM_B.png"
                alt="Handi"
                width={166}
                height={166}
                className="h-32 w-32 object-contain"
                priority
              />
              <p className="text-sm text-white">
                Conecta con expertos de confianza.
              </p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-white">Enlaces</p>
            <ul className="space-y-1 text-sm text-white">
              <li>
                <Link
                  href="/professionals"
                  className="font-light text-white hover:text-[#F4571F]"
                >
                  Buscar profesionales
                </Link>
              </li>
              <li>
                <Link
                  href="/pro-apply"
                  className="font-light text-white hover:text-[#F4571F]"
                >
                  Ofrecer mis servicios
                </Link>
              </li>
              <li>
                <Link
                  href="/categorias"
                  className="font-light text-white hover:text-[#F4571F]"
                >
                  Categorias y subcategorias
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="font-light text-white hover:text-[#F4571F]"
                >
                  Aviso de privacidad
                </Link>
              </li>
              <li>
                <Link
                  href="/terms-and-conditions"
                  className="font-light text-white hover:text-[#F4571F]"
                >
                  Términos y Condiciones
                </Link>
              </li>
              <li>
                <Link
                  href="/politicas-facturacion"
                  className="font-light text-white hover:text-[#F4571F]"
                >
                  Políticas de facturación
                </Link>
              </li>
            </ul>
          </div>
          <div id="preguntas">
            <p className="mb-2 text-sm font-medium text-white">Soporte</p>
            <ul className="space-y-1 text-sm text-white">
              <li>
                WhatsApp:{" "}
                <a
                  href="https://wa.me/528130878691"
                  className="font-light text-white hover:text-[#F4571F]"
                >
                  81 3087 8691
                </a>
              </li>
              <li>
                Email:{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-light text-white hover:text-[#F4571F]"
                >
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li>
                <Link
                  href="/help"
                  className="font-light text-white hover:text-[#F4571F]"
                >
                  Centro de ayuda
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-white/20 pt-6 text-center text-xs text-white">
          © {new Date().getFullYear()} Handi. Todos los derechos reservados.
        </div>
      </div>
      <Image
        src="/images/FAVICON_FOOTER.png"
        alt="Handi decorative icon"
        width={512}
        height={512}
        className="pointer-events-none absolute -bottom-16 right-0 h-72 w-72 object-contain md:-bottom-20 md:h-96 md:w-96"
        aria-hidden="true"
        priority
      />
    </footer>
  );
}
