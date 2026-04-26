"use client";

import { type CSSProperties, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, MessageSquareMore } from "lucide-react";
import { toast } from "sonner";

import PreviewChipSection, {
  type PreviewChipItem,
} from "@/components/profiles/PreviewChipSection.client";
import { openCreateRequestWizard } from "@/components/requests/CreateRequestWizardRoot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trackContactIntent } from "@/lib/analytics/track";
import type { ColoredTag } from "@/lib/profiles/data";
import { cn } from "@/lib/utils";

type RequestOption = {
  id: string;
  title: string;
  city: string | null;
  category: string | null;
  subcategory: string | null;
  status: string | null;
  createdAt: string | null;
};

type HireOptionsResponse = {
  ok: boolean;
  data?: {
    compatibleRequests: RequestOption[];
    professional: {
      id: string;
      name: string | null;
      cities: string[];
      categories: string[];
      subcategories: string[];
    };
  };
  error?: string;
};

type HireResponse = {
  ok: boolean;
  data?: {
    conversationId: string;
    redirectUrl: string;
  };
  error?: string;
};

type Props = {
  professionalId: string;
  professionalName: string;
  cities: string[];
  categories: string[];
  subcategories: string[];
  categoryTags?: ColoredTag[];
  subcategoryTags?: ColoredTag[];
  isAuthenticated: boolean;
  canHireAsClient: boolean;
  stickyMobile?: boolean;
  className?: string;
  buttonClassName?: string;
  label?: string;
};

type ActiveDialog =
  | "none"
  | "login"
  | "role"
  | "create-request"
  | "select-request";

const formatList = (items: string[]): string =>
  items.filter(Boolean).slice(0, 3).join(", ");

const normalizeList = (items: string[]): string[] =>
  Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const normalizeColor = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const parseHexColor = (
  color: string,
): { r: number; g: number; b: number } | null => {
  const clean = color.replace("#", "");
  if (![3, 4, 6, 8].includes(clean.length)) return null;
  const hex =
    clean.length === 3 || clean.length === 4
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) return null;
  return { r, g, b };
};

const parseRgbColor = (
  color: string,
): { r: number; g: number; b: number } | null => {
  const match = color.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1]
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value));
  if (parts.length < 3) return null;
  const [r, g, b] = parts;
  return { r, g, b };
};

const luminance = ({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}): number => {
  const srgb = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
};

const getReadableText = (bgColor: string | null | undefined): string => {
  const bg = normalizeColor(bgColor);
  if (!bg) return "#334155";
  const rgb = parseHexColor(bg) ?? parseRgbColor(bg);
  if (!rgb) return "#334155";
  return luminance(rgb) > 0.62 ? "#0f172a" : "#f8fafc";
};

const getTagStyle = (tag: ColoredTag): CSSProperties => {
  const bg = normalizeColor(tag.bgColor) ?? "#f1f5f9";
  const border = normalizeColor(tag.borderColor) ?? "rgba(15, 23, 42, 0.08)";
  const text = normalizeColor(tag.textColor) ?? getReadableText(bg);
  return {
    backgroundColor: bg,
    borderColor: border,
    color: text,
  };
};

const toColoredPreviewItems = (
  tags: ColoredTag[] | undefined,
  fallbackItems: string[],
  fallbackClassName: string,
): PreviewChipItem[] => {
  const normalizedTags = Array.from(
    new Map(
      (tags ?? [])
        .filter((tag) => typeof tag.name === "string" && tag.name.trim().length)
        .map((tag) => {
          const name = tag.name.trim();
          return [
            `${tag.type}:${name.toLowerCase()}`,
            {
              key: `${tag.type}:${name.toLowerCase()}`,
              label: name,
              className: "border-transparent bg-slate-50 text-slate-700",
              style: getTagStyle(tag),
            } satisfies PreviewChipItem,
          ];
        }),
    ).values(),
  );

  if (normalizedTags.length) return normalizedTags;

  return normalizeList(fallbackItems).map((item) => ({
    key: item.toLowerCase(),
    label: item,
    className: fallbackClassName,
  }));
};

const toNeutralPreviewItems = (
  items: string[],
  className = "border-slate-200 bg-slate-50 text-slate-700",
): PreviewChipItem[] =>
  normalizeList(items).map((item) => ({
    key: item.toLowerCase(),
    label: item,
    className,
  }));

export default function HireProfessionalButton({
  professionalId,
  professionalName,
  cities,
  categories,
  subcategories,
  categoryTags,
  subcategoryTags,
  isAuthenticated,
  canHireAsClient,
  stickyMobile = false,
  className,
  buttonClassName,
  label = "Contratar",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>("none");
  const [loading, setLoading] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [compatibleRequests, setCompatibleRequests] = useState<RequestOption[]>(
    [],
  );

  const currentPath = useMemo(() => {
    const query = searchParams?.toString();
    return query ? `${pathname}?${query}` : pathname || "/";
  }, [pathname, searchParams]);
  const signInHref = `/auth/sign-in?next=${encodeURIComponent(currentPath)}`;
  const signUpHref = `${signInHref}&intent=signup`;
  const categorySummary = useMemo(
    () => formatList(categories) || "Sin categorías registradas",
    [categories],
  );
  const categoryPreviewItems = useMemo(
    () =>
      toColoredPreviewItems(
        categoryTags,
        categories,
        "border-slate-200 bg-slate-50 text-slate-700",
      ),
    [categories, categoryTags],
  );
  const subcategoryPreviewItems = useMemo(
    () =>
      toColoredPreviewItems(
        subcategoryTags,
        subcategories,
        "border-slate-200 bg-slate-50 text-slate-700",
      ),
    [subcategories, subcategoryTags],
  );
  const cityPreviewItems = useMemo(
    () => toNeutralPreviewItems(cities),
    [cities],
  );

  const closeDialog = () => setActiveDialog("none");

  const openCreateRequest = () => {
    closeDialog();
    openCreateRequestWizard();
  };

  const submitHire = async (requestId: string) => {
    setLoading(true);
    setPendingRequestId(requestId);
    try {
      const response = await fetch(
        `/api/profiles/${encodeURIComponent(professionalId)}/hire`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          credentials: "include",
          body: JSON.stringify({ requestId }),
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as HireResponse | null;

      if (response.status === 401) {
        setActiveDialog("login");
        return;
      }
      if (response.status === 403) {
        setActiveDialog("role");
        return;
      }
      if (!response.ok || !payload?.ok || !payload.data?.redirectUrl) {
        const errorCode = payload?.error ?? "HIRE_FAILED";
        if (errorCode === "REQUEST_NOT_COMPATIBLE") {
          setActiveDialog("create-request");
          return;
        }
        toast.error(
          "No pudimos abrir el chat para contratar a este profesional.",
        );
        return;
      }

      trackContactIntent({
        source_page: currentPath,
        user_type: "client",
        request_id: requestId,
        profile_id: professionalId,
        conversation_id: payload.data.conversationId,
        service_category: categories[0],
        service_subcategory: subcategories[0],
        city: cities[0],
        placement: "professional_profile_hire_cta",
      });
      closeDialog();
      router.push(payload.data.redirectUrl);
      router.refresh();
    } catch {
      toast.error("No pudimos iniciar la contratación. Intenta de nuevo.");
    } finally {
      setLoading(false);
      setPendingRequestId(null);
    }
  };

  const handleHireClick = async () => {
    if (!isAuthenticated) {
      setActiveDialog("login");
      return;
    }
    if (!canHireAsClient) {
      setActiveDialog("role");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/profiles/${encodeURIComponent(professionalId)}/hire-options`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as HireOptionsResponse | null;

      if (response.status === 401) {
        setActiveDialog("login");
        return;
      }
      if (response.status === 403) {
        setActiveDialog("role");
        return;
      }
      if (!response.ok || !payload?.ok || !payload.data) {
        toast.error(
          "No pudimos revisar tus solicitudes compatibles. Intenta de nuevo.",
        );
        return;
      }

      const matches = payload.data.compatibleRequests ?? [];
      setCompatibleRequests(matches);

      if (matches.length === 0) {
        setActiveDialog("create-request");
        return;
      }
      if (matches.length === 1) {
        await submitHire(matches[0].id);
        return;
      }
      setActiveDialog("select-request");
    } catch {
      toast.error(
        "No pudimos revisar tus solicitudes compatibles. Intenta de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  };

  const triggerButton = (
    <Button
      type="button"
      onClick={() => {
        void handleHireClick();
      }}
      disabled={loading}
      className={cn(
        "h-11 rounded-full bg-[#0B6149] px-6 text-sm font-semibold text-white shadow-[0_18px_40px_-24px_rgba(11,97,73,0.8)] hover:bg-[#09523e]",
        buttonClassName,
      )}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Revisando...
        </>
      ) : (
        <>
          <MessageSquareMore className="h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  );

  return (
    <>
      <div className={className}>{triggerButton}</div>

      {stickyMobile ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/96 px-4 py-3 shadow-[0_-10px_30px_-24px_rgba(15,23,42,0.45)] backdrop-blur md:hidden">
          <div className="pointer-events-auto mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {professionalName}
              </p>
              <p className="truncate text-xs text-slate-500">
                {categorySummary}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => {
                void handleHireClick();
              }}
              disabled={loading}
              className="h-11 min-w-[148px] rounded-full bg-[#0B6149] px-5 text-sm font-semibold text-white hover:bg-[#09523e]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Revisando...
                </>
              ) : (
                label
              )}
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={activeDialog === "login"}
        onOpenChange={(open) => setActiveDialog(open ? "login" : "none")}
      >
        <DialogContent className="max-w-md rounded-3xl border-0 p-0 shadow-2xl">
          <div className="rounded-3xl bg-white p-6 sm:p-7">
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle className="text-2xl font-semibold text-slate-950">
                Inicia sesión para contratar
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-slate-600">
                Necesitas una cuenta para elegir una solicitud compatible y
                continuar al chat con {professionalName}.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 flex-col gap-3 sm:flex-col sm:justify-stretch">
              <Button asChild className="h-11 rounded-full bg-[#082877]">
                <Link href={signInHref}>Iniciar sesión</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-full border-slate-300"
              >
                <Link href={signUpHref}>Crear cuenta</Link>
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeDialog === "role"}
        onOpenChange={(open) => setActiveDialog(open ? "role" : "none")}
      >
        <DialogContent className="max-w-md rounded-3xl border-0 p-0 shadow-2xl">
          <div className="rounded-3xl bg-white p-6 sm:p-7">
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle className="text-2xl font-semibold text-slate-950">
                Esta acción es solo para clientes
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-slate-600">
                Para contratar a un profesional necesitas usar una cuenta de
                cliente y tener una solicitud abierta compatible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full"
                onClick={closeDialog}
              >
                Entendido
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeDialog === "create-request"}
        onOpenChange={(open) =>
          setActiveDialog(open ? "create-request" : "none")
        }
      >
        <DialogContent className="max-w-2xl rounded-3xl border-0 p-0 shadow-2xl">
          <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-3xl bg-white">
            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <DialogHeader className="space-y-3 text-left">
                <DialogTitle className="text-2xl font-semibold text-slate-950">
                  Crea una solicitud para contratar
                </DialogTitle>
                <DialogDescription className="text-sm leading-6 text-slate-600">
                  Publica una solicitud compatible y empieza a chatear con este
                  profesional para cerrar la contratación.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5 rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] p-4 shadow-sm sm:p-5">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {professionalName}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Servicios disponibles para crear tu solicitud
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-lg font-semibold text-slate-950">
                      {categoryPreviewItems.length}
                    </p>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                      Categorías
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-lg font-semibold text-slate-950">
                      {cityPreviewItems.length}
                    </p>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                      Ciudades
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-lg font-semibold text-slate-950">
                      {subcategoryPreviewItems.length}
                    </p>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                      Subcategorías
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <PreviewChipSection
                    title="Categorías"
                    items={categoryPreviewItems}
                    emptyText="Sin categorías registradas"
                  />
                  <PreviewChipSection
                    title="Ciudades"
                    items={cityPreviewItems}
                    emptyText="Sin ciudades registradas"
                  />
                  <PreviewChipSection
                    title="Subcategorías"
                    items={subcategoryPreviewItems}
                    emptyText="Sin subcategorías registradas"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full"
                onClick={closeDialog}
              >
                Ahora no
              </Button>
              <Button
                type="button"
                className="h-11 rounded-full bg-[#0B6149] hover:bg-[#09523e]"
                onClick={openCreateRequest}
              >
                Crear solicitud
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeDialog === "select-request"}
        onOpenChange={(open) =>
          setActiveDialog(open ? "select-request" : "none")
        }
      >
        <DialogContent className="max-w-2xl rounded-3xl border-0 p-0 shadow-2xl">
          <div className="rounded-3xl bg-white p-6 sm:p-7">
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle className="text-2xl font-semibold text-slate-950">
                Elige una solicitud para contratar
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-slate-600">
                Encontramos varias solicitudes compatibles con{" "}
                {professionalName}. Elige con cuál quieres continuar al chat.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-3">
              {compatibleRequests.map((request) => {
                const isPending = pendingRequestId === request.id;
                return (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-950">
                          {request.title}
                        </p>
                        <p className="text-sm text-slate-600">
                          {request.city || "Ciudad no definida"}
                          {request.category ? ` · ${request.category}` : ""}
                          {request.subcategory
                            ? ` · ${request.subcategory}`
                            : ""}
                        </p>
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                          {request.status || "Sin estatus"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        className="h-10 rounded-full bg-[#0B6149] hover:bg-[#09523e]"
                        disabled={loading}
                        onClick={() => {
                          void submitHire(request.id);
                        }}
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Abriendo...
                          </>
                        ) : (
                          "Continuar al chat"
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
