import process from "node:process";

import { createClient } from "@supabase/supabase-js";

type Candidate = {
  id: string;
  email: string | null;
  fullName: string | null;
  reasons: Set<string>;
};

type Summary = {
  totalCandidates: number;
  dryRun: boolean;
  touchedProfilesOk: number;
  touchedProfessionalsOk: number;
  touchedApplicationsOk: number;
  userErrors: number;
};

const CONFIRM_FLAG = "--confirm-reset-all-professionals";
const HELP_FLAGS = new Set(["-h", "--help"]);

function hasArg(flag: string): boolean {
  return process.argv.includes(flag);
}

function printHelp() {
  console.log(`
Reset professional eligibility without deleting auth users.

Default mode is DRY RUN.
Use ${CONFIRM_FLAG} to execute writes.

Usage:
  npx tsx scripts/reset-professionals-role.ts
  npx tsx scripts/reset-professionals-role.ts ${CONFIRM_FLAG}

Required env vars:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
`);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = (raw ?? "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

async function fetchProfilesByFilter(
  supabase: ReturnType<typeof createClient>,
  filter: "role=pro" | "is_client_pro=true",
) {
  const query = supabase
    .from("profiles")
    .select("id,email,full_name,role,is_client_pro");
  if (filter === "role=pro") query.eq("role", "pro");
  if (filter === "is_client_pro=true") query.eq("is_client_pro", true);
  const { data, error } = await query;
  if (error) throw new Error(`profiles ${filter}: ${error.message}`);
  return (data ?? []) as Array<{
    id: string | null;
    email?: string | null;
    full_name?: string | null;
    role?: string | null;
    is_client_pro?: boolean | null;
  }>;
}

async function fetchProfessionals(
  supabase: ReturnType<typeof createClient>,
): Promise<
  Array<{ id: string; full_name: string | null; active: boolean | null }>
> {
  const withActive = await supabase
    .from("professionals")
    .select("id,full_name,active");
  if (!withActive.error) {
    return (
      (withActive.data ?? []) as Array<{
        id: string;
        full_name?: string | null;
        active?: boolean | null;
      }>
    ).map((row) => ({
      id: row.id,
      full_name: row.full_name ?? null,
      active: row.active ?? null,
    }));
  }

  const fallback = await supabase.from("professionals").select("id,full_name");
  if (fallback.error) {
    throw new Error(`professionals select: ${fallback.error.message}`);
  }
  return (
    (fallback.data ?? []) as Array<{ id: string; full_name?: string | null }>
  ).map((row) => ({
    id: row.id,
    full_name: row.full_name ?? null,
    active: null,
  }));
}

async function fetchApprovedApplications(
  supabase: ReturnType<typeof createClient>,
) {
  const { data, error } = await supabase
    .from("pro_applications")
    .select("id,user_id,status,updated_at")
    .in("status", ["accepted", "approved"]);
  if (error) throw new Error(`pro_applications: ${error.message}`);
  return (data ?? []) as Array<{
    id: string | null;
    user_id: string | null;
    status: string | null;
    updated_at: string | null;
  }>;
}

async function hydrateMissingProfileData(
  supabase: ReturnType<typeof createClient>,
  ids: string[],
) {
  if (!ids.length)
    return new Map<string, { email: string | null; fullName: string | null }>();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name")
    .in("id", ids);
  if (error) throw new Error(`hydrate profiles: ${error.message}`);
  const map = new Map<
    string,
    { email: string | null; fullName: string | null }
  >();
  for (const row of (data ?? []) as Array<{
    id: string | null;
    email?: string | null;
    full_name?: string | null;
  }>) {
    if (!row.id) continue;
    map.set(row.id, {
      email: row.email ?? null,
      fullName: row.full_name ?? null,
    });
  }
  return map;
}

function addCandidate(
  bag: Map<string, Candidate>,
  id: string,
  reason: string,
  email?: string | null,
  fullName?: string | null,
) {
  const existing = bag.get(id);
  if (existing) {
    existing.reasons.add(reason);
    if (!existing.email && email) existing.email = email;
    if (!existing.fullName && fullName) existing.fullName = fullName;
    return;
  }
  bag.set(id, {
    id,
    email: email ?? null,
    fullName: fullName ?? null,
    reasons: new Set([reason]),
  });
}

function describeCandidate(candidate: Candidate): string {
  const emailPart = candidate.email ? ` <${candidate.email}>` : "";
  const namePart = candidate.fullName
    ? `${candidate.fullName}`
    : "(sin nombre)";
  const reasons = Array.from(candidate.reasons).join(", ");
  return `- ${candidate.id} | ${namePart}${emailPart} | razones: ${reasons}`;
}

async function resetUserProfessionalSignals(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  let profilesOk = false;
  let professionalsOk = false;
  let applicationsOk = false;

  {
    const updateBoth = await supabase
      .from("profiles")
      .update({ role: null, is_client_pro: false })
      .eq("id", userId);

    if (!updateBoth.error) {
      profilesOk = true;
    } else {
      const updateRoleOnly = await supabase
        .from("profiles")
        .update({ role: null })
        .eq("id", userId);
      if (updateRoleOnly.error) {
        throw new Error(
          `profiles update failed for ${userId}: ${updateRoleOnly.error.message}`,
        );
      }
      profilesOk = true;
    }
  }

  {
    const updateProfessional = await supabase
      .from("professionals")
      .update({ active: false })
      .eq("id", userId);
    if (!updateProfessional.error) {
      professionalsOk = true;
    } else if (/column .*active/i.test(updateProfessional.error.message)) {
      professionalsOk = true;
    } else {
      throw new Error(
        `professionals update failed for ${userId}: ${updateProfessional.error.message}`,
      );
    }
  }

  {
    const updateApps = await supabase
      .from("pro_applications")
      .update({ status: "rejected" })
      .eq("user_id", userId)
      .in("status", ["accepted", "approved"]);
    if (updateApps.error) {
      throw new Error(
        `pro_applications update failed for ${userId}: ${updateApps.error.message}`,
      );
    }
    applicationsOk = true;
  }

  return { profilesOk, professionalsOk, applicationsOk };
}

async function main() {
  if (process.argv.some((arg) => HELP_FLAGS.has(arg))) {
    printHelp();
    process.exit(0);
  }

  const dryRun = !hasArg(CONFIRM_FLAG);
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "";

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing env vars. Required: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("=== Reset professional eligibility (safe mode) ===");
  console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "EXECUTION"}`);
  console.log("Will touch:");
  console.log("- public.profiles: role -> null, is_client_pro -> false");
  console.log("- public.professionals: active -> false (if column exists)");
  console.log("- public.pro_applications: accepted/approved -> rejected");
  console.log("- auth.users: untouched");
  console.log("");

  const candidates = new Map<string, Candidate>();

  const [rolePros, clientPros, professionals, approvedApps] = await Promise.all(
    [
      fetchProfilesByFilter(supabase, "role=pro"),
      fetchProfilesByFilter(supabase, "is_client_pro=true"),
      fetchProfessionals(supabase),
      fetchApprovedApplications(supabase),
    ],
  );

  for (const row of rolePros) {
    if (!row.id) continue;
    addCandidate(
      candidates,
      row.id,
      "profiles.role=pro",
      row.email,
      row.full_name,
    );
  }
  for (const row of clientPros) {
    if (!row.id) continue;
    addCandidate(
      candidates,
      row.id,
      "profiles.is_client_pro=true",
      row.email,
      row.full_name,
    );
  }
  for (const row of professionals) {
    addCandidate(
      candidates,
      row.id,
      row.active === false
        ? "professionals row (already inactive)"
        : "professionals row",
      null,
      row.full_name,
    );
  }
  for (const row of approvedApps) {
    if (!row.user_id) continue;
    addCandidate(
      candidates,
      row.user_id,
      `pro_applications.status=${row.status ?? "unknown"}`,
    );
  }

  const candidateIds = uniqueStrings(Array.from(candidates.keys()));
  const missingIds = candidateIds.filter((id) => {
    const candidate = candidates.get(id);
    return candidate ? !candidate.email || !candidate.fullName : false;
  });
  if (missingIds.length) {
    const hydrated = await hydrateMissingProfileData(supabase, missingIds);
    for (const id of missingIds) {
      const candidate = candidates.get(id);
      const extra = hydrated.get(id);
      if (!candidate || !extra) continue;
      if (!candidate.email) candidate.email = extra.email;
      if (!candidate.fullName) candidate.fullName = extra.fullName;
    }
  }

  console.log(`Detected users to reset: ${candidateIds.length}`);
  for (const id of candidateIds) {
    const candidate = candidates.get(id);
    if (!candidate) continue;
    console.log(describeCandidate(candidate));
  }
  console.log("");

  if (dryRun) {
    console.log(
      `Dry run complete. Re-run with ${CONFIRM_FLAG} to apply changes.`,
    );
    return;
  }

  const summary: Summary = {
    totalCandidates: candidateIds.length,
    dryRun: false,
    touchedProfilesOk: 0,
    touchedProfessionalsOk: 0,
    touchedApplicationsOk: 0,
    userErrors: 0,
  };

  for (const userId of candidateIds) {
    try {
      const result = await resetUserProfessionalSignals(supabase, userId);
      if (result.profilesOk) summary.touchedProfilesOk += 1;
      if (result.professionalsOk) summary.touchedProfessionalsOk += 1;
      if (result.applicationsOk) summary.touchedApplicationsOk += 1;
      console.log(`[ok] ${userId}`);
    } catch (error) {
      summary.userErrors += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[error] ${userId}: ${message}`);
    }
  }

  console.log("");
  console.log("=== Summary ===");
  console.log(`Candidates: ${summary.totalCandidates}`);
  console.log(`Profiles reset: ${summary.touchedProfilesOk}`);
  console.log(`Professionals deactivated: ${summary.touchedProfessionalsOk}`);
  console.log(
    `Pro applications downgraded (accepted/approved -> rejected): ${summary.touchedApplicationsOk}`,
  );
  console.log(`User-level errors: ${summary.userErrors}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Fatal error:", message);
  process.exit(1);
});
