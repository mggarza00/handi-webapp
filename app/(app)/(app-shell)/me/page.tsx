import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { normalizeAvatarUrl } from "@/lib/avatar";
import type { Database } from "@/types/supabase";
import createClient from "@/utils/supabase/server";

type ProfileSelection = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "full_name"
  | "avatar_url"
  | "role"
  | "city"
  | "bio"
  | "categories"
  | "subcategories"
  | "is_client_pro"
>;

type ProfessionalSelection = Pick<
  Database["public"]["Tables"]["professionals"]["Row"],
  | "headline"
  | "years_experience"
  | "city"
  | "categories"
  | "subcategories"
  | "avatar_url"
  | "bio"
>;

type AgreementRow = Database["public"]["Tables"]["agreements"]["Row"];
type RequestRow = Database["public"]["Tables"]["requests"]["Row"];
type ProfessionalRow = Database["public"]["Tables"]["professionals"]["Row"];
type AgreementWithRelations = AgreementRow & {
  request?: Pick<
    RequestRow,
    "id" | "title" | "city" | "category" | "required_at"
  > | null;
  professional?: Pick<ProfessionalRow, "id" | "full_name"> | null;
};

export default async function MePage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/auth/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, avatar_url, role, city, bio, categories, subcategories, is_client_pro",
    )
    .eq("id", user.id)
    .maybeSingle<ProfileSelection>();

  const { data: pro } = await supabase
    .from("professionals")
    .select(
      "headline, years_experience, city, categories, subcategories, avatar_url, bio",
    )
    .eq("id", user.id)
    .maybeSingle<ProfessionalSelection>();

  const { data: agreementsData } = await supabase
    .from("agreements")
    .select(
      `
        id,
        amount,
        status,
        created_at,
        request:requests (
          id,
          title,
          city,
          category,
          required_at
        ),
        professional:professionals (
          id,
          full_name
        )
      `,
    )
    .order("created_at", { ascending: false })
    .limit(10);

  const fullName =
    profile?.full_name ?? user.user_metadata?.full_name ?? "Usuario";
  const avatarUrl = normalizeAvatarUrl(
    profile?.avatar_url ??
      pro?.avatar_url ??
      (user.user_metadata?.avatar_url as string | null) ??
      null,
  );
  const role = (profile?.role ?? null) as null | "client" | "pro" | "admin";
  const roleLabel =
    role === "pro"
      ? "Profesional"
      : role === "admin"
        ? "Administrador"
        : "Cliente";

  const city = pro?.city ?? profile?.city ?? null;
  const skills =
    (pro?.categories as unknown as Array<{ name: string }> | null) ??
    (profile?.categories as unknown as Array<{ name: string }>) ??
    null;
  const subcats =
    (pro?.subcategories as unknown as Array<{ name: string }> | null) ??
    (profile?.subcategories as unknown as Array<{ name: string }>) ??
    null;
  const bio = pro?.bio ?? profile?.bio ?? null;
  const years = pro?.years_experience ?? null;

  const categoriesLabel =
    skills && skills.length > 0
      ? skills
          .map((x) => x?.name)
          .filter(Boolean)
          .join(", ")
      : "—";
  const subcategoriesLabel =
    subcats && subcats.length > 0
      ? subcats
          .map((x) => x?.name)
          .filter(Boolean)
          .join(", ")
      : "—";

  const agreements = Array.isArray(agreementsData)
    ? (agreementsData as unknown as AgreementWithRelations[])
    : [];
  const totalJobs = agreements.length;
  const completedJobs = agreements.filter(
    (a) => a.status === "completed",
  ).length;
  const activeOrders = agreements.filter(
    (a) => a.status !== "completed" && a.status !== "cancelled",
  );
  const completedOrders = agreements.filter((a) => a.status === "completed");

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <HeroSection
        avatarUrl={avatarUrl}
        fullName={fullName}
        roleLabel={roleLabel}
        years={years}
      />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[280px,minmax(0,1fr)]">
        <div className="space-y-4">
          <InfoCard
            email={user.email ?? null}
            city={city}
            categoriesLabel={categoriesLabel}
            subcategoriesLabel={subcategoriesLabel}
          />
          <SummaryCard bio={bio} />
          <StatsCard total={totalJobs} completed={completedJobs} />
        </div>

        <div className="space-y-4">
          <OrdersCard active={activeOrders} completed={completedOrders} />

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Portafolio</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Próximamente: tu galería de trabajos aparecerá aquí.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Reseñas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Empieza a escribir reseñas y compártelas con la comunidad.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function HeroSection({
  avatarUrl,
  fullName,
  roleLabel,
  years,
}: {
  avatarUrl: string | null;
  fullName: string;
  roleLabel: string;
  years: number | null;
}) {
  return (
    <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl || "/avatar.png"}
          alt={fullName}
          className="h-20 w-20 rounded-full border object-cover"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          loading="lazy"
          decoding="async"
        />
        <div>
          <h1 className="text-2xl font-semibold leading-tight">{fullName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{roleLabel}</Badge>
            {typeof years === "number" ? (
              <span className="text-sm text-muted-foreground">
                {years} años de experiencia
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-start gap-2 text-xs text-muted-foreground md:items-end">
        <Button asChild>
          <a href="/profile/setup">Editar</a>
        </Button>
        <span className="md:text-right">
          Ajusta tu información y solicita cambios.
        </span>
      </div>
    </section>
  );
}

function InfoCard({
  email,
  city,
  categoriesLabel,
  subcategoriesLabel,
}: {
  email: string | null;
  city: string | null;
  categoriesLabel: string;
  subcategoriesLabel: string;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle>Información general</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2 text-sm text-muted-foreground">
          <InfoRow label="Email" value={email ?? "-"} />
          <InfoRow label="Ciudad" value={city ?? "—"} />
          <InfoRow label="Categorías" value={categoriesLabel || "—"} />
          <InfoRow label="Subcategorías" value={subcategoriesLabel || "—"} />
        </dl>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-foreground">{value || "—"}</dd>
    </div>
  );
}

function SummaryCard({ bio }: { bio: string | null }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle>Resumen</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {bio && bio.trim().length > 0 ? bio : "Aún no agregas una bio."}
        </p>
      </CardContent>
    </Card>
  );
}

function StatsCard({ total, completed }: { total: number; completed: number }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle>Estadísticas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 text-center text-sm">
          <div className="flex flex-col items-center justify-center rounded-xl border bg-white px-3 py-3 text-slate-600">
            <span className="text-xl font-semibold text-slate-900">
              {total}
            </span>
            <span className="mt-1 text-xs underline">Trabajos totales</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl bg-slate-900 px-3 py-3 text-white">
            <span className="text-xl font-semibold">{completed}</span>
            <span className="mt-1 text-xs">Completados</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrdersCard({
  active,
  completed,
}: {
  active: AgreementWithRelations[];
  completed: AgreementWithRelations[];
}) {
  const activeOrders = active.map(toOrderCardItem);
  const completedOrders = completed.map(toOrderCardItem);
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Mis Órdenes</CardTitle>
            <CardDescription>
              Gestiona tus trabajos activos y realizados.
            </CardDescription>
          </div>
          <div className="inline-flex overflow-hidden rounded-lg border bg-slate-50">
            <TabBadge label="Activas" count={activeOrders.length} active />
            <TabBadge label="Completadas" count={completedOrders.length} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <input
            type="radio"
            name="orders-tab"
            id="orders-tab-active"
            className="peer/orders-active sr-only"
            defaultChecked
          />
          <input
            type="radio"
            name="orders-tab"
            id="orders-tab-completed"
            className="peer/orders-completed sr-only"
          />

          <div className="flex items-center justify-center">
            <div className="inline-flex w-full max-w-sm items-center rounded-full bg-slate-100 p-1">
              <label
                htmlFor="orders-tab-active"
                className="flex-1 cursor-pointer rounded-full px-3 py-1.5 text-center text-sm font-medium text-slate-700 transition peer-checked/orders-active:bg-white peer-checked/orders-active:shadow-sm"
              >
                Activas ({activeOrders.length})
              </label>
              <label
                htmlFor="orders-tab-completed"
                className="flex-1 cursor-pointer rounded-full px-3 py-1.5 text-center text-sm font-medium text-slate-600 transition peer-checked/orders-completed:bg-white peer-checked/orders-completed:text-slate-900 peer-checked/orders-completed:shadow-sm"
              >
                Completadas ({completedOrders.length})
              </label>
            </div>
          </div>

          <div className="hidden space-y-4 peer-checked/orders-active:block">
            <OrderSection
              title="Activas"
              orders={activeOrders}
              emptyLabel="No tienes órdenes activas."
            />
          </div>
          <div className="hidden space-y-4 peer-checked/orders-completed:block">
            <OrderSection
              title="Completadas"
              orders={completedOrders}
              emptyLabel="Aún no tienes órdenes completadas."
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TabBadge({
  label,
  count,
  active,
}: {
  label: string;
  count: number;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1 px-3 py-1.5 text-sm ${
        active ? "bg-white font-medium text-slate-900" : "text-slate-600"
      }`}
    >
      <span>{label}</span>
      <span className="rounded-full bg-slate-200 px-2 text-xs text-slate-700">
        {count}
      </span>
    </div>
  );
}

type OrderCardItem = {
  id: string;
  requestId: string | null;
  title: string;
  professionalName: string;
  category: string;
  price: string;
  date: string;
  statusLabel: string;
  statusVariant: "default" | "secondary" | "destructive" | "outline";
};

function OrderSection({
  title,
  orders,
  emptyLabel,
}: {
  title: string;
  orders: OrderCardItem[];
  emptyLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title} ({orders.length})
      </div>
      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: OrderCardItem }) {
  const href = order.requestId ? `/requests/${order.requestId}` : "#";
  return (
    <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-tight text-slate-900">
              {order.title}
            </h3>
            <Badge variant="outline" className="bg-slate-50 text-slate-700">
              {order.category || "General"}
            </Badge>
            <Badge variant={order.statusVariant}>{order.statusLabel}</Badge>
          </div>
          <div className="text-sm text-slate-600">
            Con {order.professionalName}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{order.price}</span>
            <span className="text-slate-400">•</span>
            <span>{order.date}</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Button variant="outline" size="sm" asChild>
            <a
              href={href}
              aria-disabled={!order.requestId}
              className={
                !order.requestId ? "pointer-events-none opacity-60" : undefined
              }
            >
              Ver detalles
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function toOrderCardItem(agr: AgreementWithRelations): OrderCardItem {
  const statusMeta = normalizeOrderStatus(agr.status);
  return {
    id: agr.id,
    requestId: agr.request?.id ?? null,
    title: agr.request?.title ?? "Trabajo sin título",
    professionalName: agr.professional?.full_name ?? "Profesional asignado",
    category: agr.request?.category ?? "General",
    price: formatCurrency(agr.amount),
    date: formatDate(agr.request?.required_at ?? agr.created_at),
    statusLabel: statusMeta.label,
    statusVariant: statusMeta.variant,
  };
}

function normalizeOrderStatus(
  status: AgreementRow["status"] | null | undefined,
): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  switch (status) {
    case "completed":
      return { label: "Completado", variant: "secondary" };
    case "in_progress":
      return { label: "En progreso", variant: "default" };
    case "accepted":
      return { label: "Programado", variant: "outline" };
    case "cancelled":
      return { label: "Cancelado", variant: "destructive" };
    case "paid":
      return { label: "Pagado", variant: "secondary" };
    case "negotiating":
      return { label: "En negociación", variant: "outline" };
    case "disputed":
      return { label: "En disputa", variant: "destructive" };
    default:
      return { label: "Sin estado", variant: "outline" };
  }
}

function formatCurrency(value: number | null | undefined): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric ?? NaN)) return "— MXN";
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0,
    }).format(numeric as number);
  } catch {
    return `${numeric} MXN`;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Fecha por definir";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha por definir";
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
