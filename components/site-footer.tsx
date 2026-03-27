import Image from "next/image";
import Link from "next/link";
import { Instagram } from "lucide-react";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "soporte@handi.mx";

export default function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-[#112C74] bg-[#112C74] text-white">
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-0 md:pt-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <div className="mb-3 flex flex-col items-start space-y-4">
              <Image
                src="/images/LOGO_HPM_B.png"
                alt="Handi"
                width={166}
                height={166}
                sizes="128px"
                quality={60}
                loading="lazy"
                decoding="async"
                className="h-32 w-32 object-contain"
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
                  +52 81 3087 8691
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
          <div>
            <p className="mb-2 text-sm font-medium text-white">Social</p>
            <ul className="space-y-1 text-sm text-white">
              <li>
                <a
                  href="https://www.instagram.com/handi_mx/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visitar Instagram de Handi"
                  className="inline-flex items-center gap-2 font-light text-white hover:text-[#F4571F]"
                >
                  <Instagram className="h-4 w-4" aria-hidden="true" />
                  <span>@handi_mx</span>
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/profile.php?id=61581037391411"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visitar Facebook de Handi"
                  className="inline-flex items-center gap-2 font-light text-white hover:text-[#F4571F]"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.88 3.77-3.88 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
                  </svg>
                  <span>Handi en Facebook</span>
                </a>
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
        alt=""
        width={512}
        height={512}
        sizes="(max-width: 768px) 288px, 384px"
        quality={55}
        loading="lazy"
        decoding="async"
        className="pointer-events-none absolute -bottom-16 right-0 h-72 w-72 object-contain md:-bottom-20 md:h-96 md:w-96"
        aria-hidden="true"
      />
    </footer>
  );
}
