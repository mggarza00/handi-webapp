import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import createClient from "@/utils/supabase/server";
import SectionCard from "@/components/pro/SectionCard";
import EarningsPanel from "@/components/pro/EarningsPanel.client";
import KpiCard from "@/components/pro/KpiCard";
import { getProProfile, getTotals, getJobsInProgress, getJobsCompleted, getPotentialJobs, getEarningsSeries } from "@/lib/pro/stats";

export const dynamic = "force-dynamic";

function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={["h-4 w-full rounded bg-slate-200 animate-pulse", className].filter(Boolean).join(" ")} />;
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border p-4 bg-white">
          <SkeletonBar className="w-16" />
          <SkeletonBar className="mt-2 h-6 w-24" />
        </div>
      ))}
    </div>
  );
}

async function HeaderGreeting({ userId }: { userId: string }) {
  const profile = await getProProfile(userId);
  const name = profile.full_name || "Profesional";
  return (
    <div className="flex items-baseline justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Hola, {name}</h1>
        <p className="text-xs text-slate-600">Panel profesional</p>
      </div>
    </div>
  );
}

async function Kpis({ userId }: { userId: string }) {
  const totals = await getTotals(userId);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      <KpiCard title="En proceso" value={totals.in_progress_count} />
      <KpiCard title="Completados" value={totals.completed_count} />
      <KpiCard title="Potenciales" value={totals.potential_available_count} />
      <KpiCard title="Calificación" value={Number(totals.avg_rating || 0).toFixed(1)} />
      <KpiCard title="$ Semana" value={Number(totals.earnings_week || 0).toLocaleString()} />
      <KpiCard title="$ Quincena" value={Number(totals.earnings_fortnight || 0).toLocaleString()} />
      <KpiCard title="$ Mes" value={Number(totals.earnings_month || 0).toLocaleString()} />
    </div>
  );
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <SectionCard title={title}>
      <SkeletonBar className="w-24" />
      <SkeletonBar className="mt-2" />
      <SkeletonBar className="mt-2" />
      <SkeletonBar className="mt-2" />
    </SectionCard>
  );
}

async function EarningsSection({ userId }: { userId: string }) {
  const [week, fortnight, month] = await Promise.all([
    getEarningsSeries(userId, "week"),
    getEarningsSeries(userId, "fortnight"),
    getEarningsSeries(userId, "month"),
  ]);
  return (
    <SectionCard title="Ingresos">
      <EarningsPanel week={week} fortnight={fortnight} month={month} />
    </SectionCard>
  );
}

async function InProgressSection({ userId }: { userId: string }) {
  const inProgress = await getJobsInProgress(userId, 5);
  return (
    <SectionCard title="En proceso" action={<Link href="/pro/calendar" className="text-xs hover:underline">Ver calendario</Link>}>
      {inProgress.length === 0 ? (
        <div className="text-sm text-slate-600">Sin servicios en proceso.</div>
      ) : (
        <ul className="divide-y">
          {inProgress.map((j) => (
            <li key={j.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{j.title}</div>
                <div className="text-xs text-slate-600">{j.status ?? "en curso"}</div>
              </div>
              <Link href={`/services/${j.id}`} className="text-xs hover:underline">Ver</Link>
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
    <SectionCard title="Realizados" action={<Link href="/applied" className="text-xs hover:underline">Ver historial</Link>}>
      {completed.length === 0 ? (
        <div className="text-sm text-slate-600">Aún no has finalizado trabajos.</div>
      ) : (
        <ul className="divide-y">
          {completed.map((j) => (
            <li key={j.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{j.title}</div>
                <div className="text-xs text-slate-600">{j.completed_at ? new Date(j.completed_at).toLocaleDateString() : ""}</div>
              </div>
              <Link href={`/services/${j.id}`} className="text-xs hover:underline">Ver</Link>
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
    <SectionCard title="Potenciales" action={<Link href="/requests/explore" className="text-xs hover:underline">Ver más</Link>}>
      {potentials.length === 0 ? (
        <div className="text-sm text-slate-600">No hay trabajos disponibles según tu perfil.</div>
      ) : (
        <ul className="divide-y">
          {potentials.map((p) => (
            <li key={p.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{p.title}</div>
                <div className="text-xs text-slate-600">{[p.category, p.city].filter(Boolean).join(" · ")}</div>
              </div>
              <Link href={`/requests/explore/${p.id}`} className="text-xs hover:underline">Ver</Link>
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
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <Suspense fallback={<SkeletonBar className="h-7 w-48" />}>
        {/* Header greeting */}
        <HeaderGreeting userId={uid} />
      </Suspense>

      {/* KPIs */}
      <Suspense fallback={<KpiSkeleton />}>
        <Kpis userId={uid} />
      </Suspense>

      {/* Earnings chart */}
      <Suspense fallback={<SectionSkeleton title="Ingresos" />}>
        <EarningsSection userId={uid} />
      </Suspense>

      {/* Lists */}
      <div className="grid md:grid-cols-3 gap-4">
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
  );
}
