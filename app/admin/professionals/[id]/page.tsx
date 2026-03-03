"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  rating: number | null;
  categories: string[];
  cities: string[];
};

type KPI = {
  inProgressCount: number;
  completedCount: number;
  totalEarnings: number;
  paymentsCount: number;
  ratingAvg: number;
  reviewsCount: number;
};

type JobInProgress = {
  request_id: string;
  title: string;
  status: string | null;
  updated_at: string | null;
};

type JobCompleted = {
  request_id: string;
  title: string;
  status: string | null;
  completed_at: string | null;
};

type Payload = {
  profile: Profile;
  kpis: KPI;
  inProgress: JobInProgress[];
  completed: JobCompleted[];
};

type ApiResponse = {
  ok: boolean;
  data?: Payload;
  error?: string;
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function shortId(id: string) {
  return id ? id.slice(0, 8) : "-";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("es-MX");
}

function renderBadges(items: string[]) {
  if (!items.length) return "-";
  const visible = items.slice(0, 4);
  const hidden = items.length - visible.length;
  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((item) => (
        <span
          key={item}
          className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
        >
          {item}
        </span>
      ))}
      {hidden > 0 ? (
        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          +{hidden}
        </span>
      ) : null}
    </div>
  );
}

export default function AdminProfessionalDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/professionals/${params.id}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json?.data) {
        throw new Error(json?.error || "request_failed");
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Error al cargar: {error}
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">No encontrado</div>;
  }

  const { profile, kpis, inProgress, completed } = data;
  const title = profile.full_name || "Profesional";

  const copyValue = async (value: string, label: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
        toast("Copiado", { description: label });
      }
    } catch {
      toast("No se pudo copiar");
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        <Link href="/admin" className="hover:underline">
          Admin
        </Link>{" "}
        /{" "}
        <Link href="/admin/professionals" className="hover:underline">
          Profesionales
        </Link>{" "}
        / <span className="text-slate-900">{title}</span>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
            <div>
              <span className="opacity-70">Correo: </span>
              {profile.email || "-"}
            </div>
            <div>
              <span className="opacity-70">Telefono: </span>
              {profile.phone || "-"}
            </div>
            <div>
              <span className="opacity-70">Rating: </span>
              {typeof profile.rating === "number" ? profile.rating : "-"}
            </div>
            <div>
              <span className="opacity-70">ID: </span>
              {profile.id}
            </div>
            <div className="md:col-span-2">
              <span className="opacity-70">Ciudades: </span>
              {renderBadges(profile.cities)}
            </div>
            <div className="md:col-span-2">
              <span className="opacity-70">Categorias: </span>
              {renderBadges(profile.categories)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyValue(profile.id, "ID")}
          >
            Copiar ID
          </Button>
          {profile.email ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyValue(profile.email || "", "Correo")}
            >
              Copiar correo
            </Button>
          ) : null}
          {profile.phone ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyValue(profile.phone || "", "Telefono")}
            >
              Copiar telefono
            </Button>
          ) : null}
          <Link href="/admin/professionals">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">
            Solicitudes en proceso
          </div>
          <div className="text-2xl font-semibold">{kpis.inProgressCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">
            Solicitudes finalizadas
          </div>
          <div className="text-2xl font-semibold">{kpis.completedCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pagos / ingresos</div>
          <div className="text-2xl font-semibold">
            {formatMoney(kpis.totalEarnings)}
          </div>
          <div className="text-xs text-muted-foreground">
            {kpis.paymentsCount} pagos
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Rating promedio</div>
          <div className="text-2xl font-semibold">{kpis.ratingAvg || 0}</div>
          <div className="text-xs text-muted-foreground">
            {kpis.reviewsCount} resenas
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 text-sm font-medium">En proceso (Ultimas 5)</div>
          {inProgress.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2">ID</th>
                  <th className="pb-2">Titulo</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {inProgress.map((item) => (
                  <tr key={item.request_id} className="border-t">
                    <td className="py-2">
                      <Link
                        href={`/admin/requests/${item.request_id}`}
                        className="text-primary"
                      >
                        {shortId(item.request_id)}
                      </Link>
                    </td>
                    <td className="py-2">{item.title || "-"}</td>
                    <td className="py-2">{item.status || "-"}</td>
                    <td className="py-2">{formatDate(item.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-sm text-muted-foreground">
              Sin trabajos en proceso.
            </div>
          )}
        </Card>
        <Card className="p-4">
          <div className="mb-3 text-sm font-medium">
            Finalizadas (Ultimas 5)
          </div>
          {completed.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2">ID</th>
                  <th className="pb-2">Titulo</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {completed.map((item) => (
                  <tr key={item.request_id} className="border-t">
                    <td className="py-2">
                      <Link
                        href={`/admin/requests/${item.request_id}`}
                        className="text-primary"
                      >
                        {shortId(item.request_id)}
                      </Link>
                    </td>
                    <td className="py-2">{item.title || "-"}</td>
                    <td className="py-2">{item.status || "-"}</td>
                    <td className="py-2">{formatDate(item.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-sm text-muted-foreground">
              Sin trabajos finalizados.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
