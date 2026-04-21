import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreativeAssetFormat } from "@/lib/creative/workflow";
import type { Database } from "@/types/supabase";

export const CREATIVE_ASSET_BUCKET = "campaign-creative-assets";

type AdminSupabase = SupabaseClient<Database>;

export async function ensureCreativeAssetBucket(admin: AdminSupabase) {
  const { data } = await admin.storage
    .getBucket(CREATIVE_ASSET_BUCKET)
    .catch(() => ({ data: null }));

  if (data) return;

  await admin.storage.createBucket(CREATIVE_ASSET_BUCKET, {
    public: false,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
    ],
  });
}

export function buildCreativeAssetStoragePath(args: {
  campaignId: string;
  jobId: string;
  assetId: string;
  versionNumber: number;
  format: CreativeAssetFormat;
  extension: string;
}) {
  return `campaigns/${args.campaignId}/creative/${args.jobId}/${args.assetId}/v${args.versionNumber}-${args.format}.${args.extension.replace(/^\./, "")}`;
}

export async function uploadCreativeAssetBuffer(args: {
  admin: AdminSupabase;
  path: string;
  buffer: Buffer;
  contentType: string;
}) {
  await ensureCreativeAssetBucket(args.admin);
  const { error } = await args.admin.storage
    .from(CREATIVE_ASSET_BUCKET)
    .upload(args.path, args.buffer, {
      contentType: args.contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(error.message || "failed to upload creative asset");
  }

  return args.path;
}

export async function createCreativeAssetSignedUrl(args: {
  admin: AdminSupabase;
  path: string;
  expiresIn?: number;
}) {
  const { data, error } = await args.admin.storage
    .from(CREATIVE_ASSET_BUCKET)
    .createSignedUrl(args.path, args.expiresIn || 60 * 60);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function downloadCreativeAssetBuffer(args: {
  admin: AdminSupabase;
  path: string;
}) {
  const { data, error } = await args.admin.storage
    .from(CREATIVE_ASSET_BUCKET)
    .download(args.path);

  if (error || !data) {
    throw new Error(error?.message || "failed to download creative asset");
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
