import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  providerMetadataSchema,
  type ProviderMetadata,
} from "@/lib/ai/schemas";
import { getCampaignDetail } from "@/lib/campaigns/repository";
import type {
  CampaignWorkflowStatus,
  PublishChannel,
} from "@/lib/campaigns/workflow";
import { adaptCreativeAsset } from "@/lib/creative/adapt";
import { buildCreativeBrief } from "@/lib/creative/brief";
import {
  describeCreativeFormatTarget,
  getChannelSuitabilityForFormat,
  resolveCreativeTargetDimensions,
} from "@/lib/creative/formats";
import type { CreativeGeneratedAsset } from "@/lib/creative/provider";
import {
  generateCreativeImageProposal,
  regenerateCreativeImageProposal,
} from "@/lib/creative/generation";
import { toCreativeProviderMetadata } from "@/lib/creative/provider";
import {
  buildCreativeGenerationStatusFromFeedback,
  normalizeCreativeAssetFormat,
  normalizeCreativeAssetRole,
  normalizeCreativeAdaptationMethod,
  normalizeCreativeJobType,
  normalizeCreativeAssetType,
  normalizeCreativeFeedbackType,
  normalizeCreativeGenerationStatus,
  type CreativeAdaptationMethod,
  type CreativeAssetFeedbackRow,
  type CreativeAssetJobDetail,
  type CreativeAssetJobListItem,
  type CreativeAssetJobRow,
  type CreativeAssetRow,
  type CreativeDerivativeListItem,
  type CreativeAssetVersionRow,
  type CreativeAssetView,
  type CreativeAssetVersionView,
  type CreativeBriefPayload,
  type CreativeFeedbackType,
  type CreativeGenerationStatus,
} from "@/lib/creative/workflow";
import {
  buildCreativeAssetStoragePath,
  createCreativeAssetSignedUrl,
  downloadCreativeAssetBuffer,
  uploadCreativeAssetBuffer,
} from "@/lib/creative/storage";
import type { Database } from "@/types/supabase";

type AdminSupabase = SupabaseClient<Database>;

type ListCreativeAssetJobFilters = {
  q?: string;
  status?: CreativeGenerationStatus | "";
  channel?: PublishChannel | "";
  provider?: string;
  campaignId?: string;
  page?: number;
  pageSize?: number;
};

type CreateCreativeAssetJobInput = {
  admin: AdminSupabase;
  campaignDraftId: string;
  campaignMessageId?: string | null;
  channel: PublishChannel;
  format?: string | null;
  notes?: string | null;
  variantCount?: number;
  createdBy: string | null;
};

type UpdateCreativeAssetJobStatusInput = {
  admin: AdminSupabase;
  jobId: string;
  status: CreativeGenerationStatus;
  feedbackType: CreativeFeedbackType;
  feedbackNote?: string | null;
  createdBy: string | null;
};

type RegenerateCreativeAssetInput = {
  admin: AdminSupabase;
  creativeAssetId: string;
  feedbackNote?: string | null;
  createdBy: string | null;
};

type AdaptCreativeAssetInput = {
  admin: AdminSupabase;
  sourceCreativeAssetId: string;
  targetChannel?: PublishChannel | null;
  format: string;
  width?: number | null;
  height?: number | null;
  adaptationMethod?: CreativeAdaptationMethod | null;
  feedbackNote?: string | null;
  createdBy: string | null;
};

type RegenerateCreativeAdaptationInput = {
  admin: AdminSupabase;
  creativeAssetId: string;
  targetChannel?: PublishChannel | null;
  format?: string | null;
  width?: number | null;
  height?: number | null;
  adaptationMethod?: CreativeAdaptationMethod | null;
  feedbackNote?: string | null;
  createdBy: string | null;
};

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readStringArray(value: unknown) {
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
  const parsed = providerMetadataSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string"
    ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    : false;
}

function actorIdOrNull(value: string | null | undefined) {
  return isUuid(value) ? value : null;
}

function mapCreativeBriefPayload(value: unknown): CreativeBriefPayload {
  const obj = readRecord(value);
  return {
    visualPrompt: readString(obj.visualPrompt),
    briefSummary: readString(obj.briefSummary),
    rationaleSummary: readString(obj.rationaleSummary),
    targetFormat: normalizeCreativeAssetFormat(obj.targetFormat),
    compositionNotes: Array.isArray(obj.compositionNotes)
      ? obj.compositionNotes.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    visualConstraints: Array.isArray(obj.visualConstraints)
      ? obj.visualConstraints.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    textOverlayGuidance: Array.isArray(obj.textOverlayGuidance)
      ? obj.textOverlayGuidance.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    references: Array.isArray(obj.references)
      ? obj.references.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    channel: readString(obj.channel) as PublishChannel,
    serviceCategory: readString(obj.serviceCategory),
    audience: readString(obj.audience),
    goal: readString(obj.goal),
  };
}

function mapCreativeAssetJobRow(
  value: Record<string, unknown>,
): CreativeAssetJobRow {
  return {
    id: readString(value.id),
    campaign_draft_id: readString(value.campaign_draft_id),
    campaign_message_id: readNullableString(value.campaign_message_id),
    channel: readString(value.channel) as PublishChannel,
    job_type: normalizeCreativeJobType(value.job_type),
    parent_creative_asset_id: readNullableString(
      value.parent_creative_asset_id,
    ),
    asset_type: normalizeCreativeAssetType(value.asset_type),
    generation_status: normalizeCreativeGenerationStatus(
      value.generation_status,
    ),
    provider_name: readString(value.provider_name),
    provider_mode:
      (readString(value.provider_mode) as ProviderMetadata["generationMode"]) ||
      "mock",
    brief_summary: readString(value.brief_summary),
    rationale_summary: readString(value.rationale_summary),
    brief_payload: mapCreativeBriefPayload(value.brief_payload),
    target_channel: readNullableString(
      value.target_channel,
    ) as PublishChannel | null,
    target_width:
      typeof value.target_width === "number" ? value.target_width : null,
    target_height:
      typeof value.target_height === "number" ? value.target_height : null,
    adaptation_method: normalizeCreativeAdaptationMethod(
      value.adaptation_method,
    ),
    provider_metadata: readProviderMetadata(value.provider_metadata),
    created_by: readNullableString(value.created_by),
    created_at: readString(value.created_at),
    updated_at: readString(value.updated_at),
  };
}

function mapCreativeAssetRow(value: Record<string, unknown>): CreativeAssetRow {
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
    target_width:
      typeof value.target_width === "number" ? value.target_width : null,
    target_height:
      typeof value.target_height === "number" ? value.target_height : null,
    adaptation_method: normalizeCreativeAdaptationMethod(
      value.adaptation_method,
    ),
    channel_suitability: readStringArray(
      value.channel_suitability,
    ) as PublishChannel[],
    storage_path: readString(value.storage_path),
    prompt_text: readString(value.prompt_text),
    rationale: readString(value.rationale),
    status: normalizeCreativeGenerationStatus(value.status),
    is_current: value.is_current === true,
    provider_metadata: readProviderMetadata(value.provider_metadata),
    created_at: readString(value.created_at),
    updated_at: readString(value.updated_at),
  };
}

function mapCreativeAssetVersionRow(
  value: Record<string, unknown>,
): CreativeAssetVersionRow {
  return {
    id: readString(value.id),
    creative_asset_id: readString(value.creative_asset_id),
    version_number:
      typeof value.version_number === "number" ? value.version_number : 1,
    format: normalizeCreativeAssetFormat(value.format),
    target_channel: readNullableString(
      value.target_channel,
    ) as PublishChannel | null,
    target_width:
      typeof value.target_width === "number" ? value.target_width : null,
    target_height:
      typeof value.target_height === "number" ? value.target_height : null,
    adaptation_method: normalizeCreativeAdaptationMethod(
      value.adaptation_method,
    ),
    channel_suitability: readStringArray(
      value.channel_suitability,
    ) as PublishChannel[],
    storage_path: readString(value.storage_path),
    prompt_text: readString(value.prompt_text),
    rationale: readString(value.rationale),
    edited_by: readNullableString(value.edited_by),
    created_at: readString(value.created_at),
  };
}

function mapCreativeAssetFeedbackRow(
  value: Record<string, unknown>,
): CreativeAssetFeedbackRow {
  return {
    id: readString(value.id),
    creative_asset_job_id: readString(value.creative_asset_job_id),
    creative_asset_id: readNullableString(value.creative_asset_id),
    feedback_type: normalizeCreativeFeedbackType(value.feedback_type),
    feedback_note: readNullableString(value.feedback_note),
    created_by: readNullableString(value.created_by),
    created_at: readString(value.created_at),
  };
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/svg+xml") return "svg";
  return "png";
}

function mergeProviderMetadata(
  base: ProviderMetadata,
  override?: Partial<ProviderMetadata> | null,
): ProviderMetadata {
  return {
    ...base,
    ...(override || {}),
  };
}

async function uploadVariantToStorage(args: {
  admin: AdminSupabase;
  campaignId: string;
  jobId: string;
  assetId: string;
  versionNumber: number;
  variant: CreativeGeneratedAsset;
}) {
  const storagePath = buildCreativeAssetStoragePath({
    campaignId: args.campaignId,
    jobId: args.jobId,
    assetId: args.assetId,
    versionNumber: args.versionNumber,
    format: args.variant.format,
    extension: extensionForMimeType(args.variant.mimeType),
  });

  await uploadCreativeAssetBuffer({
    admin: args.admin,
    path: storagePath,
    buffer: args.variant.buffer,
    contentType: args.variant.mimeType,
  });

  return storagePath;
}

async function getActorNames(admin: AdminSupabase, ids: string[]) {
  const uniqueIds = Array.from(
    new Set(
      ids.filter((value) => typeof value === "string" && value.length > 0),
    ),
  );
  if (!uniqueIds.length) return {} as Record<string, string>;

  const { data } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", uniqueIds);

  const names: Record<string, string> = {};
  (Array.isArray(data) ? data : []).forEach((row) => {
    const value = row as Record<string, unknown>;
    const id = readString(value.id);
    names[id] =
      readNullableString(value.full_name) ||
      readNullableString(value.email) ||
      id.slice(0, 8);
  });

  return names;
}

async function nextCreativeAssetVersionNumber(
  admin: AdminSupabase,
  creativeAssetId: string,
) {
  const { data } = await admin
    .from("creative_asset_versions")
    .select("version_number")
    .eq("creative_asset_id", creativeAssetId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    ((data as { version_number?: number } | null)?.version_number || 0) + 1
  );
}

async function insertCreativeAssetFeedback(input: {
  admin: AdminSupabase;
  creativeAssetJobId: string;
  creativeAssetId?: string | null;
  feedbackType: CreativeFeedbackType;
  feedbackNote?: string | null;
  createdBy: string | null;
}) {
  await input.admin.from("creative_asset_feedback").insert({
    creative_asset_job_id: input.creativeAssetJobId,
    creative_asset_id: input.creativeAssetId || null,
    feedback_type: input.feedbackType,
    feedback_note: input.feedbackNote || null,
    created_by: actorIdOrNull(input.createdBy),
  } as never);
}

async function buildCreativeAssetViews(args: {
  admin: AdminSupabase;
  assets: CreativeAssetRow[];
  versions: CreativeAssetVersionRow[];
}) {
  const versionMap = new Map<string, CreativeAssetVersionRow[]>();
  args.versions.forEach((version) => {
    const current = versionMap.get(version.creative_asset_id) || [];
    current.push(version);
    versionMap.set(version.creative_asset_id, current);
  });

  const assetViews = await Promise.all(
    args.assets.map(async (asset): Promise<CreativeAssetView> => {
      const versions = (versionMap.get(asset.id) || []).sort(
        (left, right) => left.version_number - right.version_number,
      );
      const versionViews = await Promise.all(
        versions.map(
          async (version): Promise<CreativeAssetVersionView> => ({
            ...version,
            preview_url: await createCreativeAssetSignedUrl({
              admin: args.admin,
              path: version.storage_path,
            }),
          }),
        ),
      );

      return {
        ...asset,
        preview_url: await createCreativeAssetSignedUrl({
          admin: args.admin,
          path: asset.storage_path,
        }),
        version_count: versions.length,
        original_version: versions[0] || null,
        latest_version: versions.at(-1) || null,
        versions: versionViews,
      };
    }),
  );

  return assetViews;
}

async function resolveGenerationContext(input: {
  admin: AdminSupabase;
  campaignDraftId: string;
  campaignMessageId?: string | null;
  channel: PublishChannel;
}) {
  const detail = await getCampaignDetail(input.admin, input.campaignDraftId);
  if (!detail) throw new Error("campaign draft not found");

  const message = input.campaignMessageId
    ? detail.messages.find((item) => item.id === input.campaignMessageId) ||
      null
    : detail.messages.find((item) => item.channel === input.channel) || null;

  if (input.campaignMessageId && !message) {
    throw new Error("campaign message not found for creative generation");
  }

  return { detail, message };
}

export async function previewCreativeBrief(input: {
  admin: AdminSupabase;
  campaignDraftId: string;
  campaignMessageId?: string | null;
  channel: PublishChannel;
  format?: string | null;
  notes?: string | null;
}) {
  const { detail, message } = await resolveGenerationContext({
    admin: input.admin,
    campaignDraftId: input.campaignDraftId,
    campaignMessageId: input.campaignMessageId,
    channel: input.channel,
  });

  const brief = buildCreativeBrief({
    campaign: detail.draft,
    message,
    channel: input.channel,
    format: input.format ? normalizeCreativeAssetFormat(input.format) : null,
    notes: input.notes,
  });

  return {
    brief,
    campaignTitle: detail.draft.title,
    messageVariantName: message?.variant_name || null,
  };
}

export async function createCreativeAssetJob(
  input: CreateCreativeAssetJobInput,
) {
  const { detail, message } = await resolveGenerationContext({
    admin: input.admin,
    campaignDraftId: input.campaignDraftId,
    campaignMessageId: input.campaignMessageId,
    channel: input.channel,
  });
  const generationInput = {
    campaign: detail.draft,
    message,
    channel: input.channel,
    format: input.format ? normalizeCreativeAssetFormat(input.format) : null,
    notes: input.notes,
  } as const;

  const persistProposal = async (
    proposal: Awaited<ReturnType<typeof generateCreativeImageProposal>>,
  ) => {
    const providerMetadata = toCreativeProviderMetadata(proposal.provider);
    let createdJobId: string | null = null;

    try {
      const { data: jobRow, error: jobError } = await input.admin
        .from("creative_asset_jobs")
        .insert({
          campaign_draft_id: detail.draft.id,
          campaign_message_id: message?.id || null,
          channel: input.channel,
          job_type: "generation",
          parent_creative_asset_id: null,
          asset_type: "image",
          generation_status: "proposed",
          provider_name: proposal.provider.activeProvider,
          provider_mode: proposal.provider.generationMode,
          brief_summary: proposal.briefSummary,
          rationale_summary: proposal.rationaleSummary,
          brief_payload: proposal.brief,
          target_channel: input.channel,
          target_width:
            providerMetadata.assetWidth ??
            proposal.variants[0]?.providerMetadata?.assetWidth ??
            null,
          target_height:
            providerMetadata.assetHeight ??
            proposal.variants[0]?.providerMetadata?.assetHeight ??
            null,
          adaptation_method: null,
          provider_metadata: providerMetadata,
          created_by: actorIdOrNull(input.createdBy),
        } as never)
        .select("*")
        .single();

      if (jobError || !jobRow) {
        throw new Error(
          jobError?.message || "failed to create creative asset job",
        );
      }

      const job = mapCreativeAssetJobRow(jobRow as Record<string, unknown>);
      createdJobId = job.id;

      const assets: CreativeAssetRow[] = [];
      for (const variant of proposal.variants.slice(
        0,
        input.variantCount || 3,
      )) {
        const assetId = randomUUID();
        const storagePath = await uploadVariantToStorage({
          admin: input.admin,
          campaignId: detail.draft.id,
          jobId: job.id,
          assetId,
          versionNumber: 1,
          variant,
        });
        const assetMetadata = mergeProviderMetadata(
          providerMetadata,
          variant.providerMetadata,
        );

        const { data: assetRow, error: assetError } = await input.admin
          .from("creative_assets")
          .insert({
            id: assetId,
            creative_asset_job_id: job.id,
            asset_role: "master",
            parent_asset_id: null,
            variant_label: variant.label,
            format: variant.format,
            target_channel: input.channel,
            target_width:
              assetMetadata.assetWidth ?? providerMetadata.assetWidth ?? null,
            target_height:
              assetMetadata.assetHeight ?? providerMetadata.assetHeight ?? null,
            adaptation_method: null,
            channel_suitability: getChannelSuitabilityForFormat(
              variant.format,
              input.channel,
            ),
            storage_path: storagePath,
            prompt_text: variant.promptText,
            rationale: variant.rationale,
            status: "proposed",
            is_current: true,
            provider_metadata: assetMetadata,
          } as never)
          .select("*")
          .single();

        if (assetError || !assetRow) {
          throw new Error(
            assetError?.message || "failed to create creative asset",
          );
        }

        await input.admin.from("creative_asset_versions").insert({
          creative_asset_id: assetId,
          version_number: 1,
          format: variant.format,
          target_channel: input.channel,
          target_width:
            assetMetadata.assetWidth ?? providerMetadata.assetWidth ?? null,
          target_height:
            assetMetadata.assetHeight ?? providerMetadata.assetHeight ?? null,
          adaptation_method: null,
          channel_suitability: getChannelSuitabilityForFormat(
            variant.format,
            input.channel,
          ),
          storage_path: storagePath,
          prompt_text: variant.promptText,
          rationale: variant.rationale,
          edited_by: actorIdOrNull(input.createdBy),
        } as never);

        assets.push(mapCreativeAssetRow(assetRow as Record<string, unknown>));
      }

      return {
        job,
        assets,
        campaignTitle: detail.draft.title,
        campaignDraftId: detail.draft.id,
        campaignMessageId: message?.id || null,
        messageVariantName: message?.variant_name || null,
      };
    } catch (error) {
      if (createdJobId) {
        await input.admin
          .from("creative_asset_jobs")
          .delete()
          .eq("id", createdJobId);
      }
      throw error;
    }
  };

  const proposal = await generateCreativeImageProposal(generationInput);
  try {
    return await persistProposal(proposal);
  } catch (error) {
    const shouldFallback =
      proposal.provider.activeProvider === "openai" &&
      proposal.provider.generationMode === "live";

    if (!shouldFallback) {
      throw error;
    }

    console.error(
      "[creative][repository] createCreativeAssetJob fallback",
      error instanceof Error ? error.message : "unknown persistence error",
    );

    const fallbackProposal = await generateCreativeImageProposal(
      generationInput,
      "mock",
    );

    fallbackProposal.provider = {
      ...fallbackProposal.provider,
      requestedProvider: "image-provider",
      activeProvider: "mock",
      generationMode: "fallback",
      status: "fallback",
      model: proposal.provider.model,
      errorType: "storage_error",
      fallbackReason:
        error instanceof Error
          ? `Live asset persistence failed: ${error.message}`
          : "Live asset persistence failed before the asset could be stored.",
      note: "Mock creative asset used after live-provider persistence fallback.",
      promptSummary:
        fallbackProposal.variants[0]?.providerMetadata?.promptSummary ||
        proposal.variants[0]?.providerMetadata?.promptSummary ||
        null,
      responseSummary:
        "Live image generation fell back to a persisted mock asset.",
    };

    return persistProposal(fallbackProposal);
  }
}

export async function listCreativeAssetJobs(
  admin: AdminSupabase,
  filters: ListCreativeAssetJobFilters = {},
) {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(filters.pageSize || 20, 100));
  const q = filters.q?.trim() || "";

  let campaignIds: string[] | null = null;
  if (q) {
    const { data } = await admin
      .from("campaign_drafts")
      .select("id")
      .ilike("title", `%${q}%`)
      .limit(100);

    campaignIds = (Array.isArray(data) ? data : [])
      .map((row) => readString((row as Record<string, unknown>).id))
      .filter(Boolean);

    if (!campaignIds.length) {
      return {
        items: [] as CreativeAssetJobListItem[],
        total: 0,
        page,
        pageSize,
      };
    }
  }

  let query = admin
    .from("creative_asset_jobs")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false });

  if (filters.status) {
    query = query.eq("generation_status", filters.status);
  }
  if (filters.channel) {
    query = query.eq("channel", filters.channel);
  }
  if (filters.provider?.trim()) {
    query = query.eq("provider_name", filters.provider.trim());
  }
  if (filters.campaignId) {
    query = query.eq("campaign_draft_id", filters.campaignId);
  }
  if (campaignIds) {
    query = query.in("campaign_draft_id", campaignIds);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message || "failed to load creative asset jobs");
  }

  const jobs = (Array.isArray(data) ? data : []).map((row) =>
    mapCreativeAssetJobRow(row as Record<string, unknown>),
  );
  if (!jobs.length) {
    return {
      items: [] as CreativeAssetJobListItem[],
      total: count || 0,
      page,
      pageSize,
    };
  }

  const jobIds = jobs.map((job) => job.id);
  const messageIds = jobs
    .map((job) => job.campaign_message_id)
    .filter((value): value is string => Boolean(value));
  const campaignDraftIds = jobs.map((job) => job.campaign_draft_id);

  const [campaignRows, messageRows, assetRows, feedbackRows, actorNames] =
    await Promise.all([
      admin
        .from("campaign_drafts")
        .select("id, title")
        .in("id", campaignDraftIds),
      messageIds.length
        ? admin
            .from("campaign_messages")
            .select("id, variant_name")
            .in("id", messageIds)
        : Promise.resolve({ data: [], error: null }),
      admin
        .from("creative_assets")
        .select("*")
        .in("creative_asset_job_id", jobIds)
        .eq("is_current", true)
        .order("created_at", { ascending: true }),
      admin
        .from("creative_asset_feedback")
        .select("*")
        .in("creative_asset_job_id", jobIds)
        .order("created_at", { ascending: false }),
      getActorNames(
        admin,
        jobs.map((job) => job.created_by || ""),
      ),
    ]);

  const campaignTitleById = new Map(
    (Array.isArray(campaignRows.data) ? campaignRows.data : []).map((row) => {
      const value = row as Record<string, unknown>;
      return [readString(value.id), readString(value.title)];
    }),
  );
  const messageVariantById = new Map(
    (Array.isArray(messageRows.data) ? messageRows.data : []).map((row) => {
      const value = row as Record<string, unknown>;
      return [readString(value.id), readString(value.variant_name)];
    }),
  );
  const assetsByJobId = new Map<string, CreativeAssetRow[]>();
  (Array.isArray(assetRows.data) ? assetRows.data : []).forEach((row) => {
    const asset = mapCreativeAssetRow(row as Record<string, unknown>);
    const current = assetsByJobId.get(asset.creative_asset_job_id) || [];
    current.push(asset);
    assetsByJobId.set(asset.creative_asset_job_id, current);
  });
  const latestFeedbackByJobId = new Map<string, CreativeAssetFeedbackRow>();
  (Array.isArray(feedbackRows.data) ? feedbackRows.data : []).forEach((row) => {
    const feedback = mapCreativeAssetFeedbackRow(
      row as Record<string, unknown>,
    );
    if (!latestFeedbackByJobId.has(feedback.creative_asset_job_id)) {
      latestFeedbackByJobId.set(feedback.creative_asset_job_id, feedback);
    }
  });

  const items = await Promise.all(
    jobs.map(async (job): Promise<CreativeAssetJobListItem> => {
      const currentAssets = assetsByJobId.get(job.id) || [];
      const currentAsset = currentAssets[0] || null;
      return {
        ...job,
        campaign_title:
          campaignTitleById.get(job.campaign_draft_id) || "Campaign",
        message_variant_name: job.campaign_message_id
          ? messageVariantById.get(job.campaign_message_id) || null
          : null,
        asset_count: currentAssets.length,
        current_asset_id: currentAsset?.id || null,
        current_asset_format: currentAsset?.format || null,
        current_asset_role: currentAsset?.asset_role || null,
        current_asset_preview_url: currentAsset
          ? await createCreativeAssetSignedUrl({
              admin,
              path: currentAsset.storage_path,
            })
          : null,
        last_feedback_note:
          latestFeedbackByJobId.get(job.id)?.feedback_note || null,
        created_by_label: job.created_by
          ? actorNames[job.created_by] || job.created_by.slice(0, 8)
          : null,
      };
    }),
  );

  return {
    items,
    total: count || 0,
    page,
    pageSize,
  };
}

export async function listCreativeAssetJobsByCampaign(
  admin: AdminSupabase,
  campaignId: string,
) {
  const result = await listCreativeAssetJobs(admin, {
    campaignId,
    page: 1,
    pageSize: 24,
  });

  return result.items;
}

export async function getCreativeAssetJobDetail(
  admin: AdminSupabase,
  jobId: string,
): Promise<CreativeAssetJobDetail | null> {
  const { data: jobRow, error: jobError } = await admin
    .from("creative_asset_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) {
    throw new Error(jobError.message || "failed to load creative asset job");
  }
  if (!jobRow) return null;

  const job = mapCreativeAssetJobRow(jobRow as Record<string, unknown>);

  const [campaignRow, messageRow, assetRows, feedbackRows] = await Promise.all([
    admin
      .from("campaign_drafts")
      .select("id, title, status")
      .eq("id", job.campaign_draft_id)
      .maybeSingle(),
    job.campaign_message_id
      ? admin
          .from("campaign_messages")
          .select("id, variant_name")
          .eq("id", job.campaign_message_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin
      .from("creative_assets")
      .select("*")
      .eq("creative_asset_job_id", job.id)
      .order("created_at", { ascending: true }),
    admin
      .from("creative_asset_feedback")
      .select("*")
      .eq("creative_asset_job_id", job.id)
      .order("created_at", { ascending: false }),
  ]);

  const assets = (Array.isArray(assetRows.data) ? assetRows.data : []).map(
    (row) => mapCreativeAssetRow(row as Record<string, unknown>),
  );
  const assetIds = assets.map((asset) => asset.id);

  const { data: versionRows, error: versionsError } = assetIds.length
    ? await admin
        .from("creative_asset_versions")
        .select("*")
        .in("creative_asset_id", assetIds)
        .order("version_number", { ascending: true })
    : { data: [], error: null };

  if (versionsError) {
    throw new Error(
      versionsError.message || "failed to load creative asset versions",
    );
  }

  const feedback = (
    Array.isArray(feedbackRows.data) ? feedbackRows.data : []
  ).map((row) => mapCreativeAssetFeedbackRow(row as Record<string, unknown>));
  const versions = (Array.isArray(versionRows) ? versionRows : []).map((row) =>
    mapCreativeAssetVersionRow(row as Record<string, unknown>),
  );
  const actorNames = await getActorNames(admin, [
    job.created_by || "",
    ...feedback.map((item) => item.created_by || ""),
    ...versions.map((item) => item.edited_by || ""),
  ]);

  return {
    job,
    assets: await buildCreativeAssetViews({
      admin,
      assets,
      versions,
    }),
    feedback,
    actor_names: actorNames,
    campaign_title: readString(
      (campaignRow.data as Record<string, unknown> | null)?.title,
    ),
    campaign_status:
      (readString(
        (campaignRow.data as Record<string, unknown> | null)?.status,
      ) as CampaignWorkflowStatus) || "draft",
    message_variant_name: readNullableString(
      (messageRow.data as Record<string, unknown> | null)?.variant_name,
    ),
  };
}

export async function getCreativeAssetById(
  admin: AdminSupabase,
  creativeAssetId: string,
): Promise<CreativeAssetView | null> {
  const { data: assetRow, error: assetError } = await admin
    .from("creative_assets")
    .select("*")
    .eq("id", creativeAssetId)
    .maybeSingle();

  if (assetError) {
    throw new Error(assetError.message || "failed to load creative asset");
  }
  if (!assetRow) return null;

  const asset = mapCreativeAssetRow(assetRow as Record<string, unknown>);
  const { data: versionRows, error: versionError } = await admin
    .from("creative_asset_versions")
    .select("*")
    .eq("creative_asset_id", asset.id)
    .order("version_number", { ascending: true });

  if (versionError) {
    throw new Error(
      versionError.message || "failed to load creative asset versions",
    );
  }

  const views = await buildCreativeAssetViews({
    admin,
    assets: [asset],
    versions: (Array.isArray(versionRows) ? versionRows : []).map((row) =>
      mapCreativeAssetVersionRow(row as Record<string, unknown>),
    ),
  });

  return views[0] || null;
}

export async function listCreativeAssetDerivatives(
  admin: AdminSupabase,
  parentAssetId: string,
): Promise<CreativeDerivativeListItem[]> {
  const { data: assetRows, error: assetError } = await admin
    .from("creative_assets")
    .select("*")
    .eq("parent_asset_id", parentAssetId)
    .order("updated_at", { ascending: false });

  if (assetError) {
    throw new Error(
      assetError.message || "failed to load creative derivatives",
    );
  }

  const assets = (Array.isArray(assetRows) ? assetRows : []).map((row) =>
    mapCreativeAssetRow(row as Record<string, unknown>),
  );
  if (!assets.length) return [];

  const assetIds = assets.map((asset) => asset.id);
  const jobIds = Array.from(
    new Set(assets.map((asset) => asset.creative_asset_job_id)),
  );

  const [versionRows, jobRows] = await Promise.all([
    admin
      .from("creative_asset_versions")
      .select("*")
      .in("creative_asset_id", assetIds)
      .order("version_number", { ascending: true }),
    admin.from("creative_asset_jobs").select("*").in("id", jobIds),
  ]);

  const jobMap = new Map(
    (Array.isArray(jobRows.data) ? jobRows.data : []).map((row) => {
      const job = mapCreativeAssetJobRow(row as Record<string, unknown>);
      return [job.id, job];
    }),
  );
  const campaignIds = Array.from(
    new Set(Array.from(jobMap.values()).map((job) => job.campaign_draft_id)),
  );
  const campaignsResult = campaignIds.length
    ? await admin
        .from("campaign_drafts")
        .select("id, title")
        .in("id", campaignIds)
    : { data: [], error: null };
  if (campaignsResult.error) {
    throw new Error(
      campaignsResult.error.message || "failed to load derivative campaigns",
    );
  }
  const messageIds = Array.from(
    new Set(
      Array.from(jobMap.values())
        .map((job) => job.campaign_message_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const messagesResult = messageIds.length
    ? await admin
        .from("campaign_messages")
        .select("id, variant_name")
        .in("id", messageIds)
    : { data: [], error: null };
  if (messagesResult.error) {
    throw new Error(
      messagesResult.error.message || "failed to load derivative messages",
    );
  }

  const views = await buildCreativeAssetViews({
    admin,
    assets,
    versions: (Array.isArray(versionRows.data) ? versionRows.data : []).map(
      (row) => mapCreativeAssetVersionRow(row as Record<string, unknown>),
    ),
  });

  const campaignTitleById = new Map(
    (Array.isArray(campaignsResult.data) ? campaignsResult.data : []).map(
      (row) => {
        const value = row as Record<string, unknown>;
        return [readString(value.id), readString(value.title)];
      },
    ),
  );
  const messageVariantById = new Map(
    (Array.isArray(messagesResult.data) ? messagesResult.data : []).map(
      (row) => {
        const value = row as Record<string, unknown>;
        return [readString(value.id), readString(value.variant_name)];
      },
    ),
  );

  return views
    .map((asset) => {
      const job = jobMap.get(asset.creative_asset_job_id);
      if (!job) return null;

      return {
        ...asset,
        job_id: job.id,
        campaign_draft_id: job.campaign_draft_id,
        campaign_title:
          campaignTitleById.get(job.campaign_draft_id) || "Campaign",
        channel: job.channel,
        generation_status: job.generation_status,
        provider_name: job.provider_name,
        provider_mode: job.provider_mode,
        message_variant_name: job.campaign_message_id
          ? messageVariantById.get(job.campaign_message_id) || null
          : null,
      } satisfies CreativeDerivativeListItem;
    })
    .filter((item): item is CreativeDerivativeListItem => Boolean(item));
}

function buildAdaptationJobSummary(args: {
  sourceLabel: string;
  format: string;
  width: number;
  height: number;
  targetChannel?: PublishChannel | null;
}) {
  const target = describeCreativeFormatTarget({
    format: normalizeCreativeAssetFormat(args.format),
    width: args.width,
    height: args.height,
  });
  return {
    briefSummary: `Adapt ${args.sourceLabel} into ${target}`,
    rationaleSummary: args.targetChannel
      ? `Prepare ${target} for ${args.targetChannel} while preserving Handi hierarchy, CTA legibility, and trust cues.`
      : `Prepare ${target} while preserving Handi hierarchy, CTA legibility, and trust cues.`,
  };
}

export async function createCreativeAssetAdaptation(
  input: AdaptCreativeAssetInput,
) {
  const { data: sourceAssetRow, error: sourceAssetError } = await input.admin
    .from("creative_assets")
    .select("*")
    .eq("id", input.sourceCreativeAssetId)
    .maybeSingle();

  if (sourceAssetError || !sourceAssetRow) {
    throw new Error(
      sourceAssetError?.message || "source creative asset not found",
    );
  }

  const sourceAsset = mapCreativeAssetRow(
    sourceAssetRow as Record<string, unknown>,
  );
  const masterAsset =
    sourceAsset.asset_role === "derivative" && sourceAsset.parent_asset_id
      ? await getCreativeAssetById(input.admin, sourceAsset.parent_asset_id)
      : await getCreativeAssetById(input.admin, sourceAsset.id);

  if (!masterAsset) {
    throw new Error("approved master creative asset not found");
  }
  if (masterAsset.status !== "approved") {
    throw new Error(
      "source asset must be approved before creating adaptations",
    );
  }

  const { data: masterJobRow, error: masterJobError } = await input.admin
    .from("creative_asset_jobs")
    .select("*")
    .eq("id", masterAsset.creative_asset_job_id)
    .maybeSingle();

  if (masterJobError || !masterJobRow) {
    throw new Error(masterJobError?.message || "master creative job not found");
  }

  const masterJob = mapCreativeAssetJobRow(
    masterJobRow as Record<string, unknown>,
  );
  const targetFormat = normalizeCreativeAssetFormat(input.format);
  const targetChannel =
    input.targetChannel || masterJob.target_channel || masterJob.channel;
  const target = resolveCreativeTargetDimensions({
    format: targetFormat,
    width: input.width,
    height: input.height,
  });
  const sourceBuffer = await downloadCreativeAssetBuffer({
    admin: input.admin,
    path: masterAsset.storage_path,
  });
  const adapted = await adaptCreativeAsset({
    sourceBuffer,
    sourceFormat: masterAsset.format,
    sourceLabel: masterAsset.variant_label,
    targetFormat,
    targetChannel,
    width: input.width,
    height: input.height,
    adaptationMethod: input.adaptationMethod,
    feedbackNote: input.feedbackNote,
  });
  const summary = buildAdaptationJobSummary({
    sourceLabel: masterAsset.variant_label,
    format: targetFormat,
    width: target.width,
    height: target.height,
    targetChannel,
  });

  const { data: jobRow, error: jobError } = await input.admin
    .from("creative_asset_jobs")
    .insert({
      campaign_draft_id: masterJob.campaign_draft_id,
      campaign_message_id: masterJob.campaign_message_id,
      channel: targetChannel,
      job_type: "adaptation",
      parent_creative_asset_id: masterAsset.id,
      asset_type: "image",
      generation_status: "proposed",
      provider_name: adapted.providerMetadata.providerName,
      provider_mode: adapted.providerMetadata.generationMode,
      brief_summary: summary.briefSummary,
      rationale_summary: summary.rationaleSummary,
      brief_payload: masterJob.brief_payload,
      target_channel: targetChannel,
      target_width: adapted.width,
      target_height: adapted.height,
      adaptation_method: adapted.adaptationMethod,
      provider_metadata: adapted.providerMetadata,
      created_by: actorIdOrNull(input.createdBy),
    } as never)
    .select("*")
    .single();

  if (jobError || !jobRow) {
    throw new Error(jobError?.message || "failed to create adaptation job");
  }

  const job = mapCreativeAssetJobRow(jobRow as Record<string, unknown>);
  const assetId = randomUUID();
  const storagePath = await uploadCreativeAssetBuffer({
    admin: input.admin,
    path: buildCreativeAssetStoragePath({
      campaignId: masterJob.campaign_draft_id,
      jobId: job.id,
      assetId,
      versionNumber: 1,
      format: targetFormat,
      extension: "png",
    }),
    buffer: adapted.buffer,
    contentType: adapted.mimeType,
  });

  const assetMetadata = adapted.providerMetadata;
  const channelSuitability = adapted.channelSuitability;
  const { data: assetRow, error: assetError } = await input.admin
    .from("creative_assets")
    .insert({
      id: assetId,
      creative_asset_job_id: job.id,
      asset_role: "derivative",
      parent_asset_id: masterAsset.id,
      variant_label: `${masterAsset.variant_label} ${targetFormat}`,
      format: targetFormat,
      target_channel: targetChannel,
      target_width: adapted.width,
      target_height: adapted.height,
      adaptation_method: adapted.adaptationMethod,
      channel_suitability: channelSuitability,
      storage_path: storagePath,
      prompt_text: adapted.promptText,
      rationale: adapted.rationale,
      status: "proposed",
      is_current: true,
      provider_metadata: assetMetadata,
    } as never)
    .select("*")
    .single();

  if (assetError || !assetRow) {
    await input.admin.from("creative_asset_jobs").delete().eq("id", job.id);
    throw new Error(assetError?.message || "failed to create derivative asset");
  }

  await input.admin.from("creative_asset_versions").insert({
    creative_asset_id: assetId,
    version_number: 1,
    format: targetFormat,
    target_channel: targetChannel,
    target_width: adapted.width,
    target_height: adapted.height,
    adaptation_method: adapted.adaptationMethod,
    channel_suitability: channelSuitability,
    storage_path: storagePath,
    prompt_text: adapted.promptText,
    rationale: adapted.rationale,
    edited_by: actorIdOrNull(input.createdBy),
  } as never);

  return {
    job,
    asset: mapCreativeAssetRow(assetRow as Record<string, unknown>),
    campaignDraftId: masterJob.campaign_draft_id,
    creativeAssetId: assetId,
    creativeAssetJobId: job.id,
    parentCreativeAssetId: masterAsset.id,
    channel: targetChannel,
  };
}

export async function regenerateCreativeAssetAdaptation(
  input: RegenerateCreativeAdaptationInput,
) {
  const asset = await getCreativeAssetById(input.admin, input.creativeAssetId);
  if (!asset) {
    throw new Error("creative adaptation not found");
  }
  if (asset.asset_role !== "derivative" || !asset.parent_asset_id) {
    throw new Error("only derivative assets can be regenerated in this flow");
  }

  const masterAsset = await getCreativeAssetById(
    input.admin,
    asset.parent_asset_id,
  );
  if (!masterAsset) {
    throw new Error("master asset not found for derivative regeneration");
  }

  const { data: jobRow, error: jobError } = await input.admin
    .from("creative_asset_jobs")
    .select("*")
    .eq("id", asset.creative_asset_job_id)
    .maybeSingle();

  if (jobError || !jobRow) {
    throw new Error(jobError?.message || "creative adaptation job not found");
  }

  const job = mapCreativeAssetJobRow(jobRow as Record<string, unknown>);
  const targetFormat = input.format
    ? normalizeCreativeAssetFormat(input.format)
    : asset.format;
  const targetChannel =
    input.targetChannel || asset.target_channel || job.channel;
  const sourceBuffer = await downloadCreativeAssetBuffer({
    admin: input.admin,
    path: masterAsset.storage_path,
  });
  const adapted = await adaptCreativeAsset({
    sourceBuffer,
    sourceFormat: masterAsset.format,
    sourceLabel: masterAsset.variant_label,
    targetFormat,
    targetChannel,
    width: input.width ?? asset.target_width,
    height: input.height ?? asset.target_height,
    adaptationMethod: input.adaptationMethod || asset.adaptation_method,
    feedbackNote: input.feedbackNote,
  });
  const versionNumber = await nextCreativeAssetVersionNumber(
    input.admin,
    asset.id,
  );
  const storagePath = await uploadCreativeAssetBuffer({
    admin: input.admin,
    path: buildCreativeAssetStoragePath({
      campaignId: job.campaign_draft_id,
      jobId: job.id,
      assetId: asset.id,
      versionNumber,
      format: targetFormat,
      extension: "png",
    }),
    buffer: adapted.buffer,
    contentType: adapted.mimeType,
  });

  const { error: updateAssetError } = await input.admin
    .from("creative_assets")
    .update({
      format: targetFormat,
      target_channel: targetChannel,
      target_width: adapted.width,
      target_height: adapted.height,
      adaptation_method: adapted.adaptationMethod,
      channel_suitability: adapted.channelSuitability,
      storage_path: storagePath,
      prompt_text: adapted.promptText,
      rationale: adapted.rationale,
      status: "proposed",
      provider_metadata: adapted.providerMetadata,
    } as never)
    .eq("id", asset.id);

  if (updateAssetError) {
    throw new Error(
      updateAssetError.message || "failed to update derivative asset",
    );
  }

  await input.admin.from("creative_asset_versions").insert({
    creative_asset_id: asset.id,
    version_number: versionNumber,
    format: targetFormat,
    target_channel: targetChannel,
    target_width: adapted.width,
    target_height: adapted.height,
    adaptation_method: adapted.adaptationMethod,
    channel_suitability: adapted.channelSuitability,
    storage_path: storagePath,
    prompt_text: adapted.promptText,
    rationale: adapted.rationale,
    edited_by: actorIdOrNull(input.createdBy),
  } as never);

  await input.admin
    .from("creative_asset_jobs")
    .update({
      generation_status: "proposed",
      channel: targetChannel,
      provider_name: adapted.providerMetadata.providerName,
      provider_mode: adapted.providerMetadata.generationMode,
      brief_summary: `Adapt ${masterAsset.variant_label} into ${describeCreativeFormatTarget(
        {
          format: targetFormat,
          width: adapted.width,
          height: adapted.height,
        },
      )}`,
      rationale_summary: adapted.rationale,
      target_channel: targetChannel,
      target_width: adapted.width,
      target_height: adapted.height,
      adaptation_method: adapted.adaptationMethod,
      provider_metadata: adapted.providerMetadata,
    } as never)
    .eq("id", job.id);

  await insertCreativeAssetFeedback({
    admin: input.admin,
    creativeAssetJobId: job.id,
    creativeAssetId: asset.id,
    feedbackType: "regenerate",
    feedbackNote:
      input.feedbackNote ||
      "Derivative asset regenerated from approved master.",
    createdBy: input.createdBy,
  });

  return {
    campaignDraftId: job.campaign_draft_id,
    creativeAssetJobId: job.id,
    creativeAssetId: asset.id,
    parentCreativeAssetId: masterAsset.id,
    channel: targetChannel,
  };
}

export async function updateCreativeAssetJobStatus(
  input: UpdateCreativeAssetJobStatusInput,
) {
  const { data: jobRow, error: jobError } = await input.admin
    .from("creative_asset_jobs")
    .select("id, campaign_draft_id, job_type, parent_creative_asset_id")
    .eq("id", input.jobId)
    .maybeSingle();

  if (jobError || !jobRow) {
    throw new Error(jobError?.message || "creative asset job not found");
  }

  const { error: updateJobError } = await input.admin
    .from("creative_asset_jobs")
    .update({
      generation_status: input.status,
    } as never)
    .eq("id", input.jobId);

  if (updateJobError) {
    throw new Error(
      updateJobError.message || "failed to update creative asset job status",
    );
  }

  const { error: updateAssetsError } = await input.admin
    .from("creative_assets")
    .update({
      status: input.status,
    } as never)
    .eq("creative_asset_job_id", input.jobId);

  if (updateAssetsError) {
    throw new Error(
      updateAssetsError.message || "failed to update creative asset status",
    );
  }

  await insertCreativeAssetFeedback({
    admin: input.admin,
    creativeAssetJobId: input.jobId,
    feedbackType: input.feedbackType,
    feedbackNote: input.feedbackNote,
    createdBy: input.createdBy,
  });

  return {
    jobId: readString((jobRow as Record<string, unknown>).id),
    campaignDraftId: readString(
      (jobRow as Record<string, unknown>).campaign_draft_id,
    ),
    jobType: normalizeCreativeJobType(
      (jobRow as Record<string, unknown>).job_type,
    ),
    parentCreativeAssetId: readNullableString(
      (jobRow as Record<string, unknown>).parent_creative_asset_id,
    ),
  };
}

export async function regenerateCreativeAsset(
  input: RegenerateCreativeAssetInput,
) {
  const { data: assetRow, error: assetError } = await input.admin
    .from("creative_assets")
    .select("*")
    .eq("id", input.creativeAssetId)
    .maybeSingle();

  if (assetError || !assetRow) {
    throw new Error(assetError?.message || "creative asset not found");
  }

  const asset = mapCreativeAssetRow(assetRow as Record<string, unknown>);
  const { data: jobRow, error: jobError } = await input.admin
    .from("creative_asset_jobs")
    .select("*")
    .eq("id", asset.creative_asset_job_id)
    .maybeSingle();

  if (jobError || !jobRow) {
    throw new Error(jobError?.message || "creative asset job not found");
  }

  const job = mapCreativeAssetJobRow(jobRow as Record<string, unknown>);
  const { detail, message } = await resolveGenerationContext({
    admin: input.admin,
    campaignDraftId: job.campaign_draft_id,
    campaignMessageId: job.campaign_message_id,
    channel: job.channel,
  });

  const regenerationInput = {
    input: {
      campaign: detail.draft,
      message,
      channel: job.channel,
      format: asset.format,
      notes: input.feedbackNote,
    },
    previousPrompt: asset.prompt_text,
    previousRationale: asset.rationale,
    feedbackNote: input.feedbackNote,
  } as const;

  const persistRegeneratedVariant = async (
    proposal: Awaited<ReturnType<typeof regenerateCreativeImageProposal>>,
  ) => {
    const nextVariant = proposal.variants[0];
    if (!nextVariant) {
      throw new Error("creative provider returned no regenerated variant");
    }

    const versionNumber = await nextCreativeAssetVersionNumber(
      input.admin,
      asset.id,
    );
    const storagePath = await uploadVariantToStorage({
      admin: input.admin,
      campaignId: detail.draft.id,
      jobId: job.id,
      assetId: asset.id,
      versionNumber,
      variant: nextVariant,
    });
    const providerMetadata = mergeProviderMetadata(
      toCreativeProviderMetadata(proposal.provider),
      nextVariant.providerMetadata,
    );

    const { error: resetStatusesError } = await input.admin
      .from("creative_assets")
      .update({
        status: "proposed",
      } as never)
      .eq("creative_asset_job_id", job.id);

    if (resetStatusesError) {
      throw new Error(
        resetStatusesError.message || "failed to reset creative asset statuses",
      );
    }

    const { data: updatedAssetRow, error: updateAssetError } = await input.admin
      .from("creative_assets")
      .update({
        format: nextVariant.format,
        target_channel: asset.target_channel,
        target_width:
          nextVariant.providerMetadata?.assetWidth ??
          asset.target_width ??
          null,
        target_height:
          nextVariant.providerMetadata?.assetHeight ??
          asset.target_height ??
          null,
        adaptation_method: asset.adaptation_method,
        channel_suitability: asset.channel_suitability,
        storage_path: storagePath,
        prompt_text: nextVariant.promptText,
        rationale: nextVariant.rationale,
        status: buildCreativeGenerationStatusFromFeedback("regenerate"),
        is_current: true,
        provider_metadata: providerMetadata,
      } as never)
      .eq("id", asset.id)
      .select("*")
      .single();

    if (updateAssetError || !updatedAssetRow) {
      throw new Error(
        updateAssetError?.message || "failed to update creative asset",
      );
    }

    await input.admin.from("creative_asset_versions").insert({
      creative_asset_id: asset.id,
      version_number: versionNumber,
      format: nextVariant.format,
      target_channel: asset.target_channel,
      target_width:
        nextVariant.providerMetadata?.assetWidth ?? asset.target_width ?? null,
      target_height:
        nextVariant.providerMetadata?.assetHeight ??
        asset.target_height ??
        null,
      adaptation_method: asset.adaptation_method,
      channel_suitability: asset.channel_suitability,
      storage_path: storagePath,
      prompt_text: nextVariant.promptText,
      rationale: nextVariant.rationale,
      edited_by: actorIdOrNull(input.createdBy),
    } as never);

    const { error: updateJobError } = await input.admin
      .from("creative_asset_jobs")
      .update({
        generation_status: "proposed",
        provider_name: proposal.provider.activeProvider,
        provider_mode: proposal.provider.generationMode,
        brief_summary: proposal.briefSummary,
        rationale_summary: proposal.rationaleSummary,
        brief_payload: proposal.brief,
        provider_metadata: providerMetadata,
      } as never)
      .eq("id", job.id);

    if (updateJobError) {
      throw new Error(
        updateJobError.message || "failed to refresh creative asset job",
      );
    }

    await insertCreativeAssetFeedback({
      admin: input.admin,
      creativeAssetJobId: job.id,
      creativeAssetId: asset.id,
      feedbackType: "regenerate",
      feedbackNote: input.feedbackNote,
      createdBy: input.createdBy,
    });

    return {
      campaignDraftId: detail.draft.id,
      creativeAssetJobId: job.id,
      creativeAssetId: asset.id,
      campaignMessageId: job.campaign_message_id,
      channel: job.channel,
      asset: mapCreativeAssetRow(updatedAssetRow as Record<string, unknown>),
    };
  };

  const proposal = await regenerateCreativeImageProposal(regenerationInput);
  try {
    return await persistRegeneratedVariant(proposal);
  } catch (error) {
    const shouldFallback =
      proposal.provider.activeProvider === "openai" &&
      proposal.provider.generationMode === "live";

    if (!shouldFallback) {
      throw error;
    }

    console.error(
      "[creative][repository] regenerateCreativeAsset fallback",
      error instanceof Error ? error.message : "unknown persistence error",
    );

    const fallbackProposal = await regenerateCreativeImageProposal({
      ...regenerationInput,
      providerOverride: "mock",
    });
    fallbackProposal.provider = {
      ...fallbackProposal.provider,
      requestedProvider: "image-provider",
      activeProvider: "mock",
      generationMode: "fallback",
      status: "fallback",
      model: proposal.provider.model,
      errorType: "storage_error",
      fallbackReason:
        error instanceof Error
          ? `Live asset persistence failed: ${error.message}`
          : "Live asset persistence failed before the regenerated asset could be stored.",
      note: "Mock regenerated asset used after live-provider persistence fallback.",
      promptSummary:
        fallbackProposal.variants[0]?.providerMetadata?.promptSummary ||
        proposal.variants[0]?.providerMetadata?.promptSummary ||
        null,
      responseSummary:
        "Live regenerated image fell back to a persisted mock asset.",
    };

    return persistRegeneratedVariant(fallbackProposal);
  }
}
