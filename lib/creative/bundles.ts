import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import { createCreativeAssetSignedUrl } from "@/lib/creative/storage";
import {
  getCreativeFormatPreset,
  getDefaultCreativeFormatForChannel,
} from "@/lib/creative/formats";
import {
  labelCreativeFormat,
  normalizeCreativeAssetFormat,
  normalizeCreativeAssetRole,
  normalizeCreativeAdaptationMethod,
  normalizeCreativeGenerationStatus,
  normalizeCreativeBundleSelectionSource,
  normalizeCreativeBundleSuitabilityStatus,
  type CampaignCreativeBundleAssetView,
  type CampaignCreativeBundleRow,
  type CampaignCreativeBundleView,
  type CreativeBundleSelectionSource,
  type CreativeAssetFormat,
} from "@/lib/creative/workflow";
import type { ProviderMetadata } from "@/lib/ai/schemas";
import type { PublishChannel } from "@/lib/campaigns/workflow";

type AdminSupabase = SupabaseClient<Database>;

type ChannelCreativeRequirement = {
  channel: PublishChannel;
  requiredFormat: CreativeAssetFormat;
  acceptableFormats: CreativeAssetFormat[];
  allowMasterFallback: boolean;
  summary: string;
};

type CreativeBundleCandidate = CampaignCreativeBundleAssetView & {
  campaign_draft_id: string;
  job_channel: PublishChannel;
};

type SyncCampaignCreativeBundlesInput = {
  admin: AdminSupabase;
  campaignId: string;
  channels?: PublishChannel[];
};

type SelectCampaignCreativeBundleOverrideInput = {
  admin: AdminSupabase;
  campaignId: string;
  channel: PublishChannel;
  creativeAssetId: string;
  notes?: string | null;
};

type ClearCampaignCreativeBundleOverrideInput = {
  admin: AdminSupabase;
  campaignId: string;
  channel: PublishChannel;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readProviderMetadata(value: unknown): ProviderMetadata | null {
  return value && typeof value === "object"
    ? (value as ProviderMetadata)
    : null;
}

const CHANNEL_REQUIREMENTS: Record<PublishChannel, ChannelCreativeRequirement> =
  {
    email: {
      channel: "email",
      requiredFormat: "landscape",
      acceptableFormats: ["landscape", "custom"],
      allowMasterFallback: true,
      summary:
        "Email uses a wide header-style creative or an email-safe custom ratio.",
    },
    push: {
      channel: "push",
      requiredFormat: "square",
      acceptableFormats: ["square", "portrait"],
      allowMasterFallback: true,
      summary:
        "Push prefers compact square creatives and can fall back to portrait when composition remains legible.",
    },
    whatsapp: {
      channel: "whatsapp",
      requiredFormat: "portrait",
      acceptableFormats: ["portrait", "story", "square"],
      allowMasterFallback: true,
      summary:
        "WhatsApp works best with portrait compositions and can fall back to story or square when needed.",
    },
    meta: {
      channel: "meta",
      requiredFormat: "square",
      acceptableFormats: ["square", "portrait", "landscape", "story"],
      allowMasterFallback: true,
      summary:
        "Meta exports default to square, while portrait, landscape, and story remain valid fallback placements.",
    },
    landing: {
      channel: "landing",
      requiredFormat: "landscape",
      acceptableFormats: ["landscape", "custom"],
      allowMasterFallback: true,
      summary:
        "Landing payloads expect hero/banner-ready landscape creatives or a custom wide derivative.",
    },
    google: {
      channel: "google",
      requiredFormat: "landscape",
      acceptableFormats: ["landscape", "custom"],
      allowMasterFallback: true,
      summary:
        "Google exports expect wide display assets or a custom ad-safe derivative.",
    },
  };

function mapCampaignCreativeBundleRow(
  value: Record<string, unknown>,
): CampaignCreativeBundleRow {
  return {
    id: readString(value.id),
    campaign_draft_id: readString(value.campaign_draft_id),
    channel: readString(value.channel) as PublishChannel,
    selected_master_asset_id: readNullableString(
      value.selected_master_asset_id,
    ),
    selected_derivative_asset_id: readNullableString(
      value.selected_derivative_asset_id,
    ),
    required_format: normalizeCreativeAssetFormat(value.required_format),
    suitability_status: normalizeCreativeBundleSuitabilityStatus(
      value.suitability_status,
    ),
    selection_source: normalizeCreativeBundleSelectionSource(
      value.selection_source,
    ),
    notes: readNullableString(value.notes),
    created_at: readString(value.created_at),
    updated_at: readString(value.updated_at),
  };
}

function mapCandidate(value: Record<string, unknown>): CreativeBundleCandidate {
  return {
    id: readString(value.id),
    creative_asset_job_id: readString(value.creative_asset_job_id),
    asset_role: normalizeCreativeAssetRole(value.asset_role),
    parent_asset_id: readNullableString(value.parent_asset_id),
    variant_label: readString(value.variant_label),
    format: normalizeCreativeAssetFormat(value.format),
    target_channel: readNullableString(
      value.target_channel,
    ) as PublishChannel | null,
    target_width: readNumber(value.target_width),
    target_height: readNumber(value.target_height),
    adaptation_method: normalizeCreativeAdaptationMethod(
      value.adaptation_method,
    ),
    channel_suitability: readStringArray(
      value.channel_suitability,
    ) as PublishChannel[],
    storage_path: readString(value.storage_path),
    status: normalizeCreativeGenerationStatus(value.status),
    provider_metadata: readProviderMetadata(value.provider_metadata),
    updated_at: readString(value.updated_at),
    preview_url: null,
    campaign_draft_id: readString(value.campaign_draft_id),
    job_channel: readString(value.job_channel) as PublishChannel,
  };
}

async function hydrateCandidatePreview(
  admin: AdminSupabase,
  candidate: CreativeBundleCandidate,
): Promise<CreativeBundleCandidate> {
  return {
    ...candidate,
    preview_url: await createCreativeAssetSignedUrl({
      admin,
      path: candidate.storage_path,
    }),
  };
}

function getPublishableChannelsForCampaign(
  channels: string[],
): PublishChannel[] {
  const resolved = new Set<PublishChannel>(
    channels.filter(Boolean) as PublishChannel[],
  );
  if (resolved.has("meta") || resolved.has("landing")) {
    resolved.add("google");
  }
  return Array.from(resolved);
}

export function getCreativeRequirementForChannel(
  channel: PublishChannel,
): ChannelCreativeRequirement {
  return CHANNEL_REQUIREMENTS[channel];
}

export function listCreativeBundleRequirements() {
  return Object.values(CHANNEL_REQUIREMENTS);
}

async function loadCampaignChannels(
  admin: AdminSupabase,
  campaignId: string,
): Promise<PublishChannel[]> {
  const { data, error } = await admin
    .from("campaign_drafts")
    .select("channels")
    .eq("id", campaignId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "failed to load campaign channels");
  }

  return getPublishableChannelsForCampaign(
    readStringArray(readRecord(data).channels),
  );
}

async function listApprovedCreativeBundleCandidates(
  admin: AdminSupabase,
  campaignId: string,
): Promise<CreativeBundleCandidate[]> {
  const { data: jobRows, error: jobError } = await admin
    .from("creative_asset_jobs")
    .select("id, campaign_draft_id, channel, generation_status")
    .eq("campaign_draft_id", campaignId)
    .eq("generation_status", "approved");

  if (jobError) {
    throw new Error(
      jobError.message || "failed to load approved creative jobs",
    );
  }

  const jobs = Array.isArray(jobRows) ? jobRows : [];
  const jobMap = new Map(
    jobs.map((job) => [
      readString((job as Record<string, unknown>).id),
      {
        campaign_draft_id: readString(
          (job as Record<string, unknown>).campaign_draft_id,
        ),
        channel: readString(
          (job as Record<string, unknown>).channel,
        ) as PublishChannel,
      },
    ]),
  );
  const jobIds = Array.from(jobMap.keys()).filter(Boolean);
  if (!jobIds.length) return [];

  const { data: assetRows, error: assetError } = await admin
    .from("creative_assets")
    .select("*")
    .in("creative_asset_job_id", jobIds)
    .eq("status", "approved")
    .eq("is_current", true)
    .order("updated_at", { ascending: false });

  if (assetError) {
    throw new Error(
      assetError.message || "failed to load approved creative assets",
    );
  }

  const candidates = (Array.isArray(assetRows) ? assetRows : [])
    .map((row) => {
      const value = readRecord(row);
      const jobId = readString(value.creative_asset_job_id);
      const job = jobMap.get(jobId);
      if (!job) return null;
      return mapCandidate({
        ...value,
        campaign_draft_id: job.campaign_draft_id,
        job_channel: job.channel,
      });
    })
    .filter((item): item is CreativeBundleCandidate => Boolean(item));

  return Promise.all(
    candidates.map((candidate) => hydrateCandidatePreview(admin, candidate)),
  );
}

function getCandidateScore(args: {
  candidate: CreativeBundleCandidate;
  requirement: ChannelCreativeRequirement;
  channel: PublishChannel;
}): number {
  const { candidate, requirement, channel } = args;
  const exactFormat = candidate.format === requirement.requiredFormat;
  const acceptableFormat = requirement.acceptableFormats.includes(
    candidate.format,
  );
  const targetedChannel =
    candidate.target_channel === channel ||
    candidate.channel_suitability.includes(channel);

  let score = 0;
  if (candidate.asset_role === "derivative" && exactFormat) score += 100;
  else if (candidate.asset_role === "master" && exactFormat) score += 90;
  else if (candidate.asset_role === "derivative" && acceptableFormat)
    score += 80;
  else if (candidate.asset_role === "master" && acceptableFormat) score += 70;

  if (targetedChannel) score += 8;
  if (candidate.job_channel === channel) score += 4;
  if (candidate.format === getDefaultCreativeFormatForChannel(channel))
    score += 2;
  if (candidate.asset_role === "derivative" && candidate.parent_asset_id)
    score += 1;

  const updatedAtScore = Date.parse(candidate.updated_at || "") || 0;
  return score * 1_000_000_000_000 + updatedAtScore;
}

function chooseBestCandidate(args: {
  candidates: CreativeBundleCandidate[];
  requirement: ChannelCreativeRequirement;
  channel: PublishChannel;
}) {
  const ranked = [...args.candidates]
    .map((candidate) => ({
      candidate,
      score: getCandidateScore({
        candidate,
        requirement: args.requirement,
        channel: args.channel,
      }),
    }))
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.candidate || null;
}

function buildBundleSummary(args: {
  requirement: ChannelCreativeRequirement;
  candidate: CreativeBundleCandidate | null;
  suitabilityStatus: CampaignCreativeBundleRow["suitability_status"];
  selectionSource: CreativeBundleSelectionSource;
}) {
  if (!args.candidate) {
    return `Missing ${labelCreativeFormat(args.requirement.requiredFormat).toLowerCase()} creative coverage for ${args.requirement.channel}.`;
  }

  if (args.selectionSource === "manual") {
    return `Manual selection uses ${args.candidate.variant_label} for ${args.requirement.channel}.`;
  }

  if (args.suitabilityStatus === "ready") {
    return `Ready with ${args.candidate.asset_role} ${args.candidate.format} creative for ${args.requirement.channel}.`;
  }

  return `Partial coverage: using ${args.candidate.asset_role} ${args.candidate.format} creative for ${args.requirement.channel} until an exact derivative exists.`;
}

function inferBundleSelection(args: {
  requirement: ChannelCreativeRequirement;
  channel: PublishChannel;
  candidates: CreativeBundleCandidate[];
}) {
  const exactDerivative = chooseBestCandidate({
    requirement: args.requirement,
    channel: args.channel,
    candidates: args.candidates.filter(
      (candidate) =>
        candidate.asset_role === "derivative" &&
        candidate.format === args.requirement.requiredFormat,
    ),
  });
  if (exactDerivative) {
    return {
      candidate: exactDerivative,
      suitabilityStatus: "ready" as const,
      selectionSource: "inferred" as const,
    };
  }

  const exactMaster = chooseBestCandidate({
    requirement: args.requirement,
    channel: args.channel,
    candidates: args.candidates.filter(
      (candidate) =>
        candidate.asset_role === "master" &&
        candidate.format === args.requirement.requiredFormat,
    ),
  });
  if (exactMaster) {
    return {
      candidate: exactMaster,
      suitabilityStatus: "ready" as const,
      selectionSource: "channel_default" as const,
    };
  }

  const acceptableCandidates = args.candidates.filter((candidate) => {
    if (!args.requirement.acceptableFormats.includes(candidate.format)) {
      return false;
    }
    if (
      candidate.asset_role === "master" &&
      !args.requirement.allowMasterFallback
    ) {
      return false;
    }
    return true;
  });
  const acceptable = chooseBestCandidate({
    requirement: args.requirement,
    channel: args.channel,
    candidates: acceptableCandidates,
  });
  if (acceptable) {
    return {
      candidate: acceptable,
      suitabilityStatus: "partial" as const,
      selectionSource: "inferred" as const,
    };
  }

  return {
    candidate: null,
    suitabilityStatus: "missing" as const,
    selectionSource: "inferred" as const,
  };
}

async function upsertCampaignCreativeBundle(args: {
  admin: AdminSupabase;
  campaignId: string;
  channel: PublishChannel;
  selectedMasterAssetId: string | null;
  selectedDerivativeAssetId: string | null;
  requiredFormat: CreativeAssetFormat;
  suitabilityStatus: CampaignCreativeBundleRow["suitability_status"];
  selectionSource: CreativeBundleSelectionSource;
  notes?: string | null;
}): Promise<CampaignCreativeBundleRow> {
  const { data, error } = await args.admin
    .from("campaign_creative_bundles")
    .upsert(
      {
        campaign_draft_id: args.campaignId,
        channel: args.channel,
        selected_master_asset_id: args.selectedMasterAssetId,
        selected_derivative_asset_id: args.selectedDerivativeAssetId,
        required_format: args.requiredFormat,
        suitability_status: args.suitabilityStatus,
        selection_source: args.selectionSource,
        notes: args.notes || null,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "campaign_draft_id,channel" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "failed to upsert creative bundle");
  }

  return mapCampaignCreativeBundleRow(data as Record<string, unknown>);
}

async function loadCampaignCreativeBundleRows(
  admin: AdminSupabase,
  campaignId: string,
  channels?: PublishChannel[],
): Promise<CampaignCreativeBundleRow[]> {
  let query = admin
    .from("campaign_creative_bundles")
    .select("*")
    .eq("campaign_draft_id", campaignId)
    .order("channel", { ascending: true });

  if (channels?.length) {
    query = query.in("channel", channels);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "failed to load creative bundles");
  }

  return (Array.isArray(data) ? data : []).map((row) =>
    mapCampaignCreativeBundleRow(row as Record<string, unknown>),
  );
}

function toBundleAssetView(
  candidate: CreativeBundleCandidate,
): CampaignCreativeBundleAssetView {
  return {
    id: candidate.id,
    creative_asset_job_id: candidate.creative_asset_job_id,
    asset_role: candidate.asset_role,
    parent_asset_id: candidate.parent_asset_id,
    variant_label: candidate.variant_label,
    format: candidate.format,
    target_channel: candidate.target_channel,
    target_width: candidate.target_width,
    target_height: candidate.target_height,
    adaptation_method: candidate.adaptation_method,
    channel_suitability: candidate.channel_suitability,
    storage_path: candidate.storage_path,
    status: candidate.status,
    provider_metadata: candidate.provider_metadata,
    updated_at: candidate.updated_at,
    preview_url: candidate.preview_url,
  };
}

function buildCampaignCreativeBundleView(args: {
  bundle: CampaignCreativeBundleRow;
  selectedAsset: CreativeBundleCandidate | null;
  selectedMasterAsset: CreativeBundleCandidate | null;
}) {
  const requirement = getCreativeRequirementForChannel(args.bundle.channel);
  return {
    ...args.bundle,
    selected_asset: args.selectedAsset
      ? toBundleAssetView(args.selectedAsset)
      : null,
    selected_master_asset: args.selectedMasterAsset
      ? toBundleAssetView(args.selectedMasterAsset)
      : null,
    summary: buildBundleSummary({
      requirement,
      candidate: args.selectedAsset,
      suitabilityStatus: args.bundle.suitability_status,
      selectionSource: args.bundle.selection_source,
    }),
  } satisfies CampaignCreativeBundleView;
}

export async function syncCampaignCreativeBundles(
  input: SyncCampaignCreativeBundlesInput,
): Promise<CampaignCreativeBundleView[]> {
  const channels =
    input.channels && input.channels.length
      ? input.channels
      : await loadCampaignChannels(input.admin, input.campaignId);
  const candidates = await listApprovedCreativeBundleCandidates(
    input.admin,
    input.campaignId,
  );
  const existingBundles = await loadCampaignCreativeBundleRows(
    input.admin,
    input.campaignId,
    channels,
  );
  const existingByChannel = new Map(
    existingBundles.map((bundle) => [bundle.channel, bundle]),
  );
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );

  const bundles: CampaignCreativeBundleView[] = [];
  for (const channel of channels) {
    const requirement = getCreativeRequirementForChannel(channel);
    const existing = existingByChannel.get(channel) || null;
    let selectedCandidate: CreativeBundleCandidate | null = null;
    let selectedMaster: CreativeBundleCandidate | null = null;
    let suitabilityStatus: CampaignCreativeBundleRow["suitability_status"] =
      "missing";
    let selectionSource: CreativeBundleSelectionSource = "inferred";
    let notes: string | null = null;

    if (existing?.selection_source === "manual") {
      const manualDerivative = existing.selected_derivative_asset_id
        ? candidateById.get(existing.selected_derivative_asset_id) || null
        : null;
      const manualMaster = existing.selected_master_asset_id
        ? candidateById.get(existing.selected_master_asset_id) || null
        : null;
      const manualCandidate = manualDerivative || manualMaster;

      if (manualCandidate) {
        selectedCandidate = manualCandidate;
        selectedMaster =
          manualCandidate.asset_role === "derivative" &&
          manualCandidate.parent_asset_id
            ? candidateById.get(manualCandidate.parent_asset_id) || manualMaster
            : manualMaster || manualCandidate;
        suitabilityStatus = "manual_override";
        selectionSource = "manual";
        notes = existing.notes;
      }
    }

    if (!selectedCandidate) {
      const inferred = inferBundleSelection({
        requirement,
        channel,
        candidates,
      });
      selectedCandidate = inferred.candidate;
      selectedMaster =
        inferred.candidate?.asset_role === "derivative" &&
        inferred.candidate.parent_asset_id
          ? candidateById.get(inferred.candidate.parent_asset_id) || null
          : inferred.candidate?.asset_role === "master"
            ? inferred.candidate
            : null;
      suitabilityStatus = inferred.suitabilityStatus;
      selectionSource = inferred.selectionSource;
      notes = null;
    }

    const persisted = await upsertCampaignCreativeBundle({
      admin: input.admin,
      campaignId: input.campaignId,
      channel,
      selectedMasterAssetId:
        selectedMaster?.asset_role === "master"
          ? selectedMaster.id
          : selectedCandidate?.asset_role === "master"
            ? selectedCandidate.id
            : selectedCandidate?.parent_asset_id || null,
      selectedDerivativeAssetId:
        selectedCandidate?.asset_role === "derivative"
          ? selectedCandidate.id
          : null,
      requiredFormat: requirement.requiredFormat,
      suitabilityStatus,
      selectionSource,
      notes,
    });

    bundles.push(
      buildCampaignCreativeBundleView({
        bundle: persisted,
        selectedAsset: selectedCandidate,
        selectedMasterAsset: selectedMaster,
      }),
    );
  }

  return bundles.sort((left, right) =>
    left.channel.localeCompare(right.channel),
  );
}

export async function listCampaignCreativeBundles(
  admin: AdminSupabase,
  campaignId: string,
  options: { syncIfMissing?: boolean; refresh?: boolean } = {},
): Promise<CampaignCreativeBundleView[]> {
  if (options.refresh) {
    return syncCampaignCreativeBundles({ admin, campaignId });
  }

  const rows = await loadCampaignCreativeBundleRows(admin, campaignId);
  if (!rows.length && options.syncIfMissing !== false) {
    return syncCampaignCreativeBundles({ admin, campaignId });
  }

  const candidateIds = Array.from(
    new Set(
      rows.flatMap((row) =>
        [row.selected_master_asset_id, row.selected_derivative_asset_id].filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        ),
      ),
    ),
  );
  const candidates = await listApprovedCreativeBundleCandidates(
    admin,
    campaignId,
  );
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );

  // Hydrate any selected asset that is not currently part of the approved-candidate set.
  const missingIds = candidateIds.filter((id) => !candidateById.has(id));
  if (missingIds.length) {
    const { data, error } = await admin
      .from("creative_assets")
      .select(
        "id, creative_asset_job_id, asset_role, parent_asset_id, variant_label, format, target_channel, target_width, target_height, adaptation_method, channel_suitability, storage_path, status, provider_metadata, updated_at",
      )
      .in("id", missingIds);

    if (error) {
      throw new Error(
        error.message || "failed to hydrate selected creative assets",
      );
    }

    const missingCandidates = await Promise.all(
      (Array.isArray(data) ? data : []).map(async (row) => {
        const candidate = mapCandidate({
          ...(row as Record<string, unknown>),
          campaign_draft_id: campaignId,
          job_channel: "meta",
        });
        return hydrateCandidatePreview(admin, candidate);
      }),
    );
    missingCandidates.forEach((candidate) =>
      candidateById.set(candidate.id, candidate),
    );
  }

  return rows.map((bundle) =>
    buildCampaignCreativeBundleView({
      bundle,
      selectedAsset:
        (bundle.selected_derivative_asset_id &&
          candidateById.get(bundle.selected_derivative_asset_id)) ||
        (bundle.selected_master_asset_id &&
          candidateById.get(bundle.selected_master_asset_id)) ||
        null,
      selectedMasterAsset:
        (bundle.selected_master_asset_id &&
          candidateById.get(bundle.selected_master_asset_id)) ||
        null,
    }),
  );
}

export async function selectCampaignCreativeBundleOverride(
  input: SelectCampaignCreativeBundleOverrideInput,
): Promise<CampaignCreativeBundleView> {
  const candidates = await listApprovedCreativeBundleCandidates(
    input.admin,
    input.campaignId,
  );
  const candidate = candidates.find(
    (item) => item.id === input.creativeAssetId,
  );
  if (!candidate) {
    throw new Error(
      "selected creative asset must be approved and belong to the campaign",
    );
  }

  const requirement = getCreativeRequirementForChannel(input.channel);
  const selectedMaster =
    candidate.asset_role === "derivative" && candidate.parent_asset_id
      ? candidates.find((item) => item.id === candidate.parent_asset_id) || null
      : candidate.asset_role === "master"
        ? candidate
        : null;

  const bundle = await upsertCampaignCreativeBundle({
    admin: input.admin,
    campaignId: input.campaignId,
    channel: input.channel,
    selectedMasterAssetId:
      selectedMaster?.id || candidate.parent_asset_id || candidate.id,
    selectedDerivativeAssetId:
      candidate.asset_role === "derivative" ? candidate.id : null,
    requiredFormat: requirement.requiredFormat,
    suitabilityStatus: "manual_override",
    selectionSource: "manual",
    notes: input.notes,
  });

  return buildCampaignCreativeBundleView({
    bundle,
    selectedAsset: candidate,
    selectedMasterAsset: selectedMaster,
  });
}

export async function clearCampaignCreativeBundleOverride(
  input: ClearCampaignCreativeBundleOverrideInput,
): Promise<CampaignCreativeBundleView> {
  const { error } = await input.admin
    .from("campaign_creative_bundles")
    .delete()
    .eq("campaign_draft_id", input.campaignId)
    .eq("channel", input.channel)
    .eq("selection_source", "manual");

  if (error) {
    throw new Error(
      error.message || "failed to clear creative bundle override",
    );
  }

  const [bundle] = await syncCampaignCreativeBundles({
    admin: input.admin,
    campaignId: input.campaignId,
    channels: [input.channel],
  });

  if (!bundle) {
    throw new Error(
      "failed to rebuild creative bundle after clearing override",
    );
  }

  return bundle;
}

export function buildCreativeBundlePayload(
  bundle: CampaignCreativeBundleView | null,
) {
  if (!bundle) {
    return {
      suitabilityStatus: "missing",
      selectionSource: "inferred",
      requiredFormat: null,
      selectedAsset: null,
      notes: null,
    };
  }

  const selectedAsset = bundle.selected_asset;
  return {
    channel: bundle.channel,
    requiredFormat: bundle.required_format,
    requiredFormatLabel: labelCreativeFormat(bundle.required_format),
    requiredDimensions: getCreativeFormatPreset(bundle.required_format),
    suitabilityStatus: bundle.suitability_status,
    selectionSource: bundle.selection_source,
    notes: bundle.notes,
    summary: bundle.summary,
    selectedMasterAssetId: bundle.selected_master_asset_id,
    selectedDerivativeAssetId: bundle.selected_derivative_asset_id,
    selectedAsset: selectedAsset
      ? {
          id: selectedAsset.id,
          role: selectedAsset.asset_role,
          variantLabel: selectedAsset.variant_label,
          format: selectedAsset.format,
          targetChannel: selectedAsset.target_channel,
          width: selectedAsset.target_width,
          height: selectedAsset.target_height,
          adaptationMethod: selectedAsset.adaptation_method,
          channelSuitability: selectedAsset.channel_suitability,
          storagePath: selectedAsset.storage_path,
          previewUrl: selectedAsset.preview_url,
          providerMetadata: selectedAsset.provider_metadata,
        }
      : null,
  };
}
