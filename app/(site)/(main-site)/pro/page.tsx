import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import localFont from "next/font/local";
import {
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Eye,
  MapPin,
  Settings,
  Star,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";

import createClient from "@/utils/supabase/server";
import SectionCard from "@/components/pro/SectionCard";
import EarningsPanel from "@/components/pro/EarningsPanel.client";
import SubcategoryChips from "@/components/pro/SubcategoryChips";
import KpiCard from "@/components/pro/KpiCard";
import {
  getProProfile,
  getTotals,
  getJobsInProgress,
  getJobsCompleted,
  getPotentialJobs,
  getEarningsSeries,
} from "@/lib/pro/stats";
import { buildGreetingText } from "@/lib/greeting";
import {
  ensureGreetingPreferenceForProfile,
  extractFirstName,
  type Profile,
} from "@/lib/profile";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const stackSansHeading = localFont({
  src: "../../../../public/fonts/Stack_Sans_Text/static/StackSansText-SemiBold.ttf",
  weight: "600",
  display: "swap",
});

const pickValue = (
  rec: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const val = rec?.[key];
    if (val === undefined || val === null) continue;
    const str = val.toString().trim();
    if (str.length > 0) return str;
  }
  return null;
};

const normalizeKey = (value: string | null | undefined) =>
  (value ?? "")
    .toString()
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

async function getSubcategoryColorMap() {
  type SubcatRow = {
    categories_subcategories_id?: string | null;
    Subcategoría?: string | null;
    Subcategoria?: string | null;
    subcategoría?: string | null;
    subcategoria?: string | null;
    subcategory?: string | null;
    Subcategory?: string | null;
    color?: string | null;
    Color?: string | null;
    COLOR?: string | null;
    color_hex?: string | null;
    "Color hex"?: string | null;
    colorHex?: string | null;
    ColorHex?: string | null;
  };
  try {
    const supa = getAdminSupabase();
    const { data, error } = await supa
      .from("categories_subcategories")
      .select("*");
    if (error) throw error;
    const map = new Map<string, string>();
    const colorKeys = [
      "color",
      "Color",
      "COLOR",
      "color_hex",
      "Color hex",
      "colorHex",
      "ColorHex",
    ];
    const rows = (data as SubcatRow[] | null | undefined) ?? [];
    rows.forEach((row) => {
      const rec = row as Record<string, unknown>;
      const name = pickValue(rec, [
        "Subcategoría",
        "Subcategoria",
        "subcategoría",
        "subcategoria",
        "subcategory",
        "Subcategory",
      ]);
      const color = pickValue(rec, colorKeys);
      const key = normalizeKey(name);
      const rawName = (name ?? "").toString().trim();
      const id = pickValue(rec, ["categories_subcategories_id"]);
      if (key) map.set(key, color || "");
      if (rawName) map.set(rawName, color || "");
      if (id) {
        const idKey = normalizeKey(id);
        if (idKey) map.set(idKey, color || "");
        map.set(id, color || "");
      }
    });
    return map;
  } catch {
    return new Map<string, string>();
  }
}

function SkeletonBar({ className = "" }: { className?: string }) {
  return (
    <div
      className={["h-4 w-full rounded bg-slate-200 animate-pulse", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

function KpiSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
        >
          <div className="h-12 w-12 rounded-full bg-slate-100" />
          <div className="space-y-2 w-full">
            <SkeletonBar className="w-16" />
            <SkeletonBar className="h-6 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

async function HeaderGreeting({
  userId,
  fallbackName,
}: {
  userId: string;
  fallbackName?: string;
}) {
  const profile = await getProProfile(userId);
  const rawName = profile.full_name || fallbackName || "Profesional";
  const greetingName = profile.is_company
    ? rawName
    : extractFirstName(
        profile.first_name || profile.full_name || fallbackName || "",
      ) || rawName;
  const location =
    [profile.city, profile.state].filter(Boolean).join(", ") ||
    "Ubicación no disponible";
  const greetingPref = await ensureGreetingPreferenceForProfile({
    id: profile.id,
    full_name: profile.full_name,
    first_name: profile.first_name,
    greeting_preference: profile.greeting_preference ?? undefined,
  } as Profile);
  const greetingText = buildGreetingText(
    greetingPref === "neutral" ? "bienvenido" : greetingPref,
    greetingName,
  );
  const colorMap = await getSubcategoryColorMap();
  const getColor = (value: string) => {
    const norm = normalizeKey(value);
    const trimmed = value?.toString().trim() || "";
    return (
      colorMap.get(norm) ||
      colorMap.get(trimmed) ||
      colorMap.get(trimmed.toLowerCase()) ||
      null
    );
  };
  const subcategoryChips = (profile.subcategories || []).map((name) => {
    const label = name?.toString().trim() || "";
    return {
      name: label,
      color: getColor(label),
    };
  });

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <h1
                className={`${stackSansHeading.className} text-3xl font-semibold text-[#082877]`}
              >
                {greetingText.replace(/^(\s*Bienvenido)(\b)/i, "$1,")}
              </h1>
            </div>
            <p className="flex items-center gap-1 text-sm text-[#6B7280]">
              <MapPin size={16} />
              {location}
            </p>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-[#082877]">
                Especialidades
              </p>
              <div className="max-w-3xl rounded-xl bg-white px-3 py-2">
                <SubcategoryChips items={subcategoryChips} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/profiles/${userId}`}
            className="inline-flex items-center gap-2 rounded-full border border-[#082877] px-4 py-2 text-sm font-semibold text-[#082877] transition-colors hover:bg-[#082877]/5"
          >
            <Eye size={16} />
            Ver perfil público
          </Link>
          <Link
            href="/profile/setup"
            className="inline-flex items-center gap-2 rounded-full bg-[#082877] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition-colors hover:bg-[#061f5c]"
          >
            <Settings size={16} />
            Configuración de perfil
          </Link>
        </div>
      </div>
    </div>
  );
}

function formatCurrency(amount: number) {
  return amount.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });
}

async function Kpis({ userId }: { userId: string }) {
  const totals = await getTotals(userId);
  const cards = [
    {
      title: "En proceso",
      value: totals.in_progress_count,
      icon: <Clock3 size={20} />,
    },
    {
      title: "Completados",
      value: totals.completed_count,
      icon: <CheckCircle2 size={20} />,
    },
    {
      title: "Potenciales",
      value: totals.potential_available_count,
      icon: <Target size={20} />,
    },
    {
      title: "Calificación",
      value: Number(totals.avg_rating || 0).toFixed(1),
      icon: <Star size={20} />,
    },
    {
      title: "Semana",
      value: formatCurrency(Number(totals.earnings_week || 0)),
      icon: <Wallet size={20} />,
    },
    {
      title: "Quincena",
      value: formatCurrency(Number(totals.earnings_fortnight || 0)),
      icon: <CalendarRange size={20} />,
    },
    {
      title: "Mes",
      value: formatCurrency(Number(totals.earnings_month || 0)),
      icon: <BarChart3 size={20} />,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((card) => (
        <KpiCard
          key={card.title}
          title={card.title}
          value={card.value}
          icon={card.icon}
        />
      ))}
    </div>
  );
}

function SectionSkeleton({ title: _title }: { title: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
      <div className="mb-3 h-5 w-28 rounded bg-slate-200" />
      <div className="space-y-2">
        <SkeletonBar />
        <SkeletonBar />
        <SkeletonBar />
      </div>
    </div>
  );
}

async function EarningsSection({ userId }: { userId: string }) {
  const [week, fortnight, month] = await Promise.all([
    getEarningsSeries(userId, "week"),
    getEarningsSeries(userId, "fortnight"),
    getEarningsSeries(userId, "month"),
  ]);
  return (
    <SectionCard title="Ingresos" icon={<TrendingUp size={18} />}>
      <EarningsPanel week={week} fortnight={fortnight} month={month} />
    </SectionCard>
  );
}

async function InProgressSection({ userId }: { userId: string }) {
  const inProgress = await getJobsInProgress(userId, 5);
  return (
    <SectionCard
      title="En proceso"
      icon={<Clock3 size={18} />}
      action={
        <Link
          href="/pro/calendar"
          className="text-xs font-semibold text-[#082877] hover:underline"
        >
          Ver calendario
        </Link>
      }
    >
      {inProgress.length === 0 ? (
        <div className="text-sm text-[#6B7280]">Sin servicios en proceso.</div>
      ) : (
        <ul className="space-y-3">
          {inProgress.map((j) => (
            <li
              key={j.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-[rgba(8,40,119,0.05)] px-3 py-2"
            >
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[#082877]">
                  {j.title}
                </div>
                <div className="text-xs text-[#6B7280]">
                  {j.status ?? "En curso"}
                </div>
              </div>
              <Link
                href={`/services/${j.id}`}
                className="text-xs font-semibold text-[#082877] hover:underline"
              >
                Ver
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

async function CompletedSection({ userId }: { userId: string }) {
  const completed = await getJobsCompleted(userId, 5);
  return (
    <SectionCard
      title="Realizados"
      icon={<CheckCircle2 size={18} />}
      action={
        <Link
          href="/applied"
          className="text-xs font-semibold text-[#082877] hover:underline"
        >
          Ver historial
        </Link>
      }
    >
      {completed.length === 0 ? (
        <div className="text-sm text-[#6B7280]">
          Aún no has finalizado trabajos.
        </div>
      ) : (
        <ul className="space-y-3">
          {completed.map((j) => (
            <li
              key={j.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-[rgba(8,40,119,0.05)] px-3 py-2"
            >
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[#082877]">
                  {j.title}
                </div>
                <div className="text-xs text-[#6B7280]">
                  {j.completed_at
                    ? new Date(j.completed_at).toLocaleDateString()
                    : "Fecha no disponible"}
                </div>
              </div>
              <Link
                href={`/services/${j.id}`}
                className="text-xs font-semibold text-[#082877] hover:underline"
              >
                Ver
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

async function PotentialsSection({ userId }: { userId: string }) {
  const potentials = await getPotentialJobs(userId, 5);
  return (
    <SectionCard
      title="Potenciales"
      icon={<Target size={18} />}
      action={
        <Link
          href="/requests/explore"
          className="text-xs font-semibold text-[#082877] hover:underline"
        >
          Ver más
        </Link>
      }
    >
      {potentials.length === 0 ? (
        <div className="text-sm text-[#6B7280]">
          No hay trabajos disponibles según tu perfil.
        </div>
      ) : (
        <ul className="space-y-3">
          {potentials.map((p) => (
            <li
              key={p.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-[rgba(8,40,119,0.05)] px-3 py-2"
            >
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[#082877]">
                  {p.title}
                </div>
                <div className="text-xs text-[#6B7280]">
                  {[p.category, p.city].filter(Boolean).join(" · ")}
                </div>
              </div>
              <Link
                href={`/requests/explore/${p.id}`}
                className="text-xs font-semibold text-[#082877] hover:underline"
              >
                Ver
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export default async function ProHomePage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user ?? null;
  if (!user) redirect("/login");

  const uid = user.id;

  return (
    <div className="bg-[#F5F7FA]">
      <div className="mx-auto max-w-6xl space-y-10 px-6 pb-12 pt-16">
        <Suspense fallback={<SkeletonBar className="h-7 w-48" />}>
          <HeaderGreeting
            userId={uid}
            fallbackName={
              (user.user_metadata as { full_name?: string })?.full_name ||
              user.email ||
              undefined
            }
          />
        </Suspense>

        <Suspense fallback={<KpiSkeleton />}>
          <Kpis userId={uid} />
        </Suspense>

        <Suspense fallback={<SectionSkeleton title="Ingresos" />}>
          <EarningsSection userId={uid} />
        </Suspense>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Suspense fallback={<SectionSkeleton title="En proceso" />}>
            <InProgressSection userId={uid} />
          </Suspense>
          <Suspense fallback={<SectionSkeleton title="Realizados" />}>
            <CompletedSection userId={uid} />
          </Suspense>
          <Suspense fallback={<SectionSkeleton title="Potenciales" />}>
            <PotentialsSection userId={uid} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
