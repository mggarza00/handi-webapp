import type { SupabaseClient } from "@supabase/supabase-js";

import { UI_STATUS_LABELS, type RequestStatus } from "@/lib/request-status";
import { roundCurrency } from "@/lib/payments/fees";
import type { Database } from "@/types/supabase";

export const DEFAULT_PRO_COMMISSION_PERCENT = 5;

const FINALIZED_REQUEST_STATUSES = new Set([
  "completed",
  "finished",
  "finalizada",
]);
const PAID_PAYOUT_STATUSES = new Set(["paid"]);
const PENDING_PAYOUT_STATUS = "pending";

type JsonRecord = Record<string, unknown>;

type PayoutRow = {
  id: string;
  agreement_id: string | null;
  request_id: string | null;
  professional_id: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  paid_at: string | null;
  receipt_url: string | null;
  metadata: JsonRecord | null;
  created_at: string | null;
  payout_type?: string | null;
};

type ReceiptRow = {
  request_id: string | null;
  professional_id: string | null;
  service_amount_cents: number | null;
  created_at: string | null;
};

type AgreementRow = {
  id: string;
  request_id: string | null;
  professional_id: string | null;
  amount: number | null;
  status: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type RequestRow = {
  id: string;
  title: string | null;
  status: string | null;
};

type ProfessionalRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type CandidateKeyParts = {
  requestId: string;
  professionalId: string;
};

type BuildCandidatesArgs = {
  payouts: PayoutRow[];
  receipts: ReceiptRow[];
  agreements: AgreementRow[];
  requests: RequestRow[];
  professionals: ProfessionalRow[];
  commissionPercent?: number;
};

export type ManualPayoutCandidate = {
  candidateId: string;
  payoutId: string | null;
  requestId: string;
  agreementId: string | null;
  professionalId: string;
  requestTitle: string;
  professionalName: string;
  professionalEmail: string | null;
  grossAmount: number;
  amount: number;
  currency: string;
  requestStatus: string | null;
  requestStatusLabel: string;
  canCreate: boolean;
  blockReason: string | null;
  source: "existing_pending" | "inferred";
  receiptUrl: string | null;
  createdAt: string | null;
};

export type ProfessionalPayoutBreakdown = {
  grossAmount: number;
  commissionAmount: number;
  commissionPercent: number;
  netAmount: number;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeCommissionPercent = (value: unknown): number => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return DEFAULT_PRO_COMMISSION_PERCENT;
  return Math.max(0, Math.min(100, parsed));
};

const normalizeCurrency = (value: unknown): string =>
  normalizeString(value)?.toUpperCase() || "MXN";

const normalizeRequestStatus = (value: unknown): string | null =>
  normalizeString(value)?.toLowerCase() || null;

function buildCandidateKey({
  requestId,
  professionalId,
}: CandidateKeyParts): string {
  return `${requestId}::${professionalId}`;
}

function splitCandidateKey(key: string): CandidateKeyParts | null {
  const [requestId, professionalId] = key.split("::");
  if (!requestId || !professionalId) return null;
  return { requestId, professionalId };
}

function getMetadataRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function getMetadataNumber(
  metadata: JsonRecord | null,
  key: string,
): number | null {
  return toFiniteNumber(metadata?.[key]);
}

function getMetadataString(
  metadata: JsonRecord | null,
  key: string,
): string | null {
  return normalizeString(metadata?.[key]);
}

export function isManualPayoutEligibleStatus(status: unknown): boolean {
  const normalized = normalizeRequestStatus(status);
  return normalized ? FINALIZED_REQUEST_STATUSES.has(normalized) : false;
}

export function getManualPayoutBlockReason(status: unknown): string | null {
  if (isManualPayoutEligibleStatus(status)) return null;
  return "El servicio todavía no está finalizado.";
}

export function computeProfessionalPayoutBreakdown(
  grossAmount: number,
  commissionPercent = DEFAULT_PRO_COMMISSION_PERCENT,
): ProfessionalPayoutBreakdown {
  const safeGross =
    Number.isFinite(grossAmount) && grossAmount > 0 ? grossAmount : 0;
  const safeCommissionPercent = normalizeCommissionPercent(commissionPercent);
  const commissionAmount = roundCurrency(
    (safeGross * safeCommissionPercent) / 100,
  );
  const netAmount = roundCurrency(Math.max(0, safeGross - commissionAmount));
  return {
    grossAmount: safeGross,
    commissionAmount,
    commissionPercent: safeCommissionPercent,
    netAmount,
  };
}

function getStatusLabel(status: string | null): string {
  const normalized = normalizeRequestStatus(status);
  if (!normalized) return "Sin estatus";
  return UI_STATUS_LABELS[normalized as RequestStatus] || normalized;
}

function compareIsoDesc(left: string | null, right: string | null): number {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;
  return rightTime - leftTime;
}

function pickLatest<T extends { created_at: string | null }>(
  current: T | null,
  next: T,
): T {
  if (!current) return next;
  return compareIsoDesc(current.created_at, next.created_at) > 0
    ? next
    : current;
}

function deriveBreakdown(args: {
  payout: PayoutRow | null;
  receipt: ReceiptRow | null;
  agreement: AgreementRow | null;
  commissionPercent: number;
}): ProfessionalPayoutBreakdown {
  const { payout, receipt, agreement, commissionPercent } = args;
  const metadata = getMetadataRecord(payout?.metadata ?? null);
  const amountBasis = getMetadataString(metadata, "amount_basis");
  const payoutAmount = toFiniteNumber(payout?.amount);
  const receiptGross =
    receipt && typeof receipt.service_amount_cents === "number"
      ? roundCurrency(receipt.service_amount_cents / 100)
      : null;
  const agreementGross = toFiniteNumber(agreement?.amount);
  const metadataGross = getMetadataNumber(metadata, "gross_amount");

  if (amountBasis === "net" && payoutAmount !== null && payoutAmount > 0) {
    const grossFromMeta = metadataGross !== null ? metadataGross : payoutAmount;
    const commissionAmount =
      getMetadataNumber(metadata, "commission_pro_amount") ??
      roundCurrency(Math.max(0, grossFromMeta - payoutAmount));
    const effectiveCommission =
      getMetadataNumber(metadata, "commission_pro_percent") ??
      commissionPercent;
    return {
      grossAmount: grossFromMeta,
      commissionAmount,
      commissionPercent: normalizeCommissionPercent(effectiveCommission),
      netAmount: payoutAmount,
    };
  }

  const grossAmount =
    receiptGross ?? agreementGross ?? metadataGross ?? payoutAmount ?? 0;
  return computeProfessionalPayoutBreakdown(grossAmount, commissionPercent);
}

export function buildManualPayoutCandidates(
  args: BuildCandidatesArgs,
): ManualPayoutCandidate[] {
  const commissionPercent = normalizeCommissionPercent(args.commissionPercent);
  const requestById = new Map<string, RequestRow>();
  const professionalById = new Map<string, ProfessionalRow>();
  const latestReceiptByKey = new Map<string, ReceiptRow>();
  const latestAgreementByKey = new Map<string, AgreementRow>();
  const latestPendingPayoutByKey = new Map<string, PayoutRow>();
  const paidPayoutKeys = new Set<string>();
  const candidateKeys = new Set<string>();

  for (const request of args.requests) {
    requestById.set(request.id, request);
  }

  for (const professional of args.professionals) {
    professionalById.set(professional.id, professional);
  }

  for (const payout of args.payouts) {
    const payoutType =
      normalizeString((payout as { payout_type?: unknown }).payout_type) ||
      getMetadataString(getMetadataRecord(payout.metadata), "payout_type") ||
      "service_offer";
    if (payoutType === "onsite_quote") continue;
    const requestId = normalizeString(payout.request_id);
    const professionalId = normalizeString(payout.professional_id);
    if (!requestId || !professionalId) continue;
    const key = buildCandidateKey({ requestId, professionalId });
    const status = normalizeRequestStatus(payout.status);
    if (status && PAID_PAYOUT_STATUSES.has(status)) {
      paidPayoutKeys.add(key);
      continue;
    }
    if (status === PENDING_PAYOUT_STATUS) {
      latestPendingPayoutByKey.set(
        key,
        pickLatest(latestPendingPayoutByKey.get(key) ?? null, payout),
      );
      candidateKeys.add(key);
    }
  }

  for (const receipt of args.receipts) {
    const requestId = normalizeString(receipt.request_id);
    const professionalId = normalizeString(receipt.professional_id);
    if (!requestId || !professionalId) continue;
    const key = buildCandidateKey({ requestId, professionalId });
    latestReceiptByKey.set(
      key,
      pickLatest(latestReceiptByKey.get(key) ?? null, receipt),
    );
    candidateKeys.add(key);
  }

  for (const agreement of args.agreements) {
    const requestId = normalizeString(agreement.request_id);
    const professionalId = normalizeString(agreement.professional_id);
    if (!requestId || !professionalId) continue;
    const key = buildCandidateKey({ requestId, professionalId });
    latestAgreementByKey.set(
      key,
      pickLatest(latestAgreementByKey.get(key) ?? null, {
        ...agreement,
        created_at: agreement.updated_at ?? agreement.created_at,
      }),
    );
  }

  const candidates: ManualPayoutCandidate[] = [];

  for (const key of candidateKeys) {
    if (paidPayoutKeys.has(key)) continue;
    const parts = splitCandidateKey(key);
    if (!parts) continue;
    const request = requestById.get(parts.requestId);
    const professional = professionalById.get(parts.professionalId);
    const receipt = latestReceiptByKey.get(key) ?? null;
    const agreement = latestAgreementByKey.get(key) ?? null;
    const pendingPayout = latestPendingPayoutByKey.get(key) ?? null;
    const breakdown = deriveBreakdown({
      payout: pendingPayout,
      receipt,
      agreement,
      commissionPercent,
    });
    if (breakdown.netAmount <= 0) continue;

    const requestStatus = normalizeRequestStatus(request?.status ?? null);
    const blockReason = getManualPayoutBlockReason(requestStatus);
    const source: ManualPayoutCandidate["source"] = pendingPayout
      ? "existing_pending"
      : "inferred";
    const createdAt =
      pendingPayout?.created_at ??
      receipt?.created_at ??
      agreement?.updated_at ??
      agreement?.created_at ??
      null;

    candidates.push({
      candidateId: pendingPayout?.id
        ? `payout:${pendingPayout.id}`
        : `request:${parts.requestId}:professional:${parts.professionalId}`,
      payoutId: pendingPayout?.id ?? null,
      requestId: parts.requestId,
      agreementId: pendingPayout?.agreement_id ?? agreement?.id ?? null,
      professionalId: parts.professionalId,
      requestTitle: normalizeString(request?.title) ?? "Servicio",
      professionalName:
        normalizeString(professional?.full_name) ?? parts.professionalId,
      professionalEmail: normalizeString(professional?.email),
      grossAmount: breakdown.grossAmount,
      amount: breakdown.netAmount,
      currency: normalizeCurrency(pendingPayout?.currency),
      requestStatus,
      requestStatusLabel: getStatusLabel(requestStatus),
      canCreate: blockReason === null,
      blockReason,
      source,
      receiptUrl: normalizeString(pendingPayout?.receipt_url),
      createdAt,
    });
  }

  return candidates.sort((left, right) => {
    if (left.canCreate !== right.canCreate) {
      return left.canCreate ? -1 : 1;
    }
    return compareIsoDesc(left.createdAt, right.createdAt);
  });
}

export async function getProfessionalPayoutCommissionPercent(
  admin: SupabaseClient<Database>,
): Promise<number> {
  try {
    const { data } = await admin
      .from("config")
      .select("commission_pro")
      .eq("id", 1)
      .maybeSingle();
    const value =
      data && typeof data === "object"
        ? (data as { commission_pro?: unknown }).commission_pro
        : null;
    return normalizeCommissionPercent(value);
  } catch {
    return DEFAULT_PRO_COMMISSION_PERCENT;
  }
}

export async function getManualPayoutCandidates(
  admin: SupabaseClient<Database>,
): Promise<{
  commissionPercent: number;
  items: ManualPayoutCandidate[];
}> {
  const commissionPercent = await getProfessionalPayoutCommissionPercent(admin);

  const [payoutsRes, receiptsRes, agreementsRes] = await Promise.all([
    admin
      .from("payouts")
      .select(
        "id, agreement_id, request_id, professional_id, amount, currency, status, paid_at, receipt_url, metadata, created_at, payout_type",
      )
      .order("created_at", { ascending: false }),
    admin
      .from("receipts")
      .select("request_id, professional_id, service_amount_cents, created_at")
      .not("request_id", "is", null)
      .not("professional_id", "is", null)
      .order("created_at", { ascending: false }),
    admin
      .from("agreements")
      .select(
        "id, request_id, professional_id, amount, status, updated_at, created_at",
      )
      .not("request_id", "is", null)
      .not("professional_id", "is", null)
      .order("updated_at", { ascending: false, nullsFirst: false }),
  ]);

  const payouts = Array.isArray(payoutsRes.data)
    ? (payoutsRes.data as unknown as PayoutRow[])
    : [];
  const receipts = Array.isArray(receiptsRes.data)
    ? (receiptsRes.data as unknown as ReceiptRow[])
    : [];
  const agreements = Array.isArray(agreementsRes.data)
    ? (agreementsRes.data as unknown as AgreementRow[])
    : [];

  const requestIds = Array.from(
    new Set(
      [...payouts, ...receipts, ...agreements]
        .map((row) => normalizeString(row.request_id))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const professionalIds = Array.from(
    new Set(
      [...payouts, ...receipts, ...agreements]
        .map((row) => normalizeString(row.professional_id))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const [requestsRes, professionalsRes] = await Promise.all([
    requestIds.length
      ? admin.from("requests").select("id, title, status").in("id", requestIds)
      : Promise.resolve({ data: [] }),
    professionalIds.length
      ? admin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", professionalIds)
      : Promise.resolve({ data: [] }),
  ]);

  const requests = Array.isArray(requestsRes.data)
    ? (requestsRes.data as unknown as RequestRow[])
    : [];
  const professionals = Array.isArray(professionalsRes.data)
    ? (professionalsRes.data as unknown as ProfessionalRow[])
    : [];

  return {
    commissionPercent,
    items: buildManualPayoutCandidates({
      payouts,
      receipts,
      agreements,
      requests,
      professionals,
      commissionPercent,
    }),
  };
}
