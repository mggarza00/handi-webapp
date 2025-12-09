import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import ProApplyForm from "./pro-apply-form.client";

import type { Database } from "@/types/supabase";
import createClient from "@/utils/supabase/server";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const dynamic = "force-dynamic";

async function getLatestApplicationStatus(
  userId: string,
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("pro_applications")
    .select("status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ status: string | null }>();

  if (error) {
    console.error("Error fetching pro application status:", error);
    return null;
  }

  return data?.status ?? null;
}

async function getProfileDefaults(
  userId: string,
  supabase: SupabaseClient<Database>,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .maybeSingle<{ full_name: string | null; role: ProfileRow["role"] | null }>();

  if (error) {
    console.error("Error fetching profile defaults:", error);
    return { fullName: "", role: null };
  }

  return {
    fullName: data?.full_name ?? "",
    role: data?.role ?? null,
  };
}

export default async function ProApplyPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?next=/pro-apply");
  }

  const [{ fullName, role }, latestStatus] = await Promise.all([
    getProfileDefaults(user.id, supabase),
    getLatestApplicationStatus(user.id, supabase),
  ]);

  const approvedStatuses = new Set(["accepted", "approved"]);
  const isApproved =
    role === "pro" || (latestStatus && approvedStatuses.has(latestStatus));
  const isPending = !isApproved && latestStatus === "pending";

  if (isApproved) {
    return (
      <section className="mx-auto max-w-xl p-6 text-center">
        <h1 className="mb-3 text-2xl font-semibold">
          Tu postulaci&oacute;n ya ha sido aprobada
        </h1>
        <p className="mb-2">
          Si quieres solicitar cambios en tu postulaci&oacute;n ve a{" "}
          <Link href="/profile/setup" className="underline hover:opacity-80">
            /profile/setup
          </Link>
          .
        </p>
        <p className="text-sm text-muted-foreground">
          Si quieres ingresar una nueva solicitud desde otra cuenta sal de la cuenta actual.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      {isPending ? (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Estamos revisando tu postulación. Te avisaremos apenas la aprobemos.
        </div>
      ) : null}
      <ProApplyForm
        userId={user.id}
        userEmail={user.email ?? ""}
        defaultFullName={fullName}
      />
    </section>
  );
}
