/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { notFound } from "next/navigation";

import StateBadge from "@/components/admin/state-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  getCreativeAssetById,
  getCreativeAssetJobDetail,
  listCreativeAssetDerivatives,
} from "@/lib/creative/repository";
import { listCreativeFormatPresets } from "@/lib/creative/formats";
import {
  labelCreativeAdaptationMethod,
  labelCreativeAssetRole,
  labelCreativeFormat,
  labelCreativeFeedbackType,
  labelCreativeJobType,
} from "@/lib/creative/workflow";
import { labelChannel } from "@/lib/campaigns/workflow";
import { getAdminSupabase } from "@/lib/supabase/admin";

type Ctx = {
  params: { id: string };
};

export const dynamic = "force-dynamic";

export default async function AdminCreativeAssetDetailPage({ params }: Ctx) {
  const admin = getAdminSupabase();
  const detail = await getCreativeAssetJobDetail(admin, params.id);

  if (!detail) return notFound();

  const [parentAsset, derivativeEntries] = await Promise.all([
    detail.job.parent_creative_asset_id
      ? getCreativeAssetById(admin, detail.job.parent_creative_asset_id)
      : Promise.resolve(null),
    Promise.all(
      detail.assets.map(async (asset) => ({
        assetId: asset.id,
        items:
          asset.asset_role === "master"
            ? await listCreativeAssetDerivatives(admin, asset.id)
            : [],
      })),
    ),
  ]);
  const derivativesByAssetId = new Map(
    derivativeEntries.map((entry) => [entry.assetId, entry.items]),
  );
  const formatPresets = listCreativeFormatPresets();

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/admin/creative-assets"
            className="text-sm text-muted-foreground underline"
          >
            Back to creative assets
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">{detail.campaign_title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StateBadge value={detail.job.generation_status} />
              <Badge variant="outline">
                {labelChannel(detail.job.channel)}
              </Badge>
              <Badge variant="outline">
                {labelCreativeJobType(detail.job.job_type)}
              </Badge>
              <Badge variant="outline">{detail.job.provider_name}</Badge>
              <Badge variant="outline">{detail.job.provider_mode}</Badge>
              {detail.message_variant_name ? (
                <Badge variant="secondary">{detail.message_variant_name}</Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/campaigns/${detail.job.campaign_draft_id}`}>
              Open campaign
            </Link>
          </Button>
        </div>
      </div>

      {parentAsset ? (
        <Card>
          <CardHeader>
            <CardTitle>Approved master source</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[280px_1fr]">
            <div className="overflow-hidden rounded-lg border bg-muted/20">
              {parentAsset.preview_url ? (
                <img
                  src={parentAsset.preview_url}
                  alt={parentAsset.variant_label}
                  className="h-auto w-full object-cover"
                />
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  Preview unavailable
                </div>
              )}
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {labelCreativeAssetRole(parentAsset.asset_role)}
                </Badge>
                <Badge variant="outline">
                  {labelCreativeFormat(parentAsset.format)}
                </Badge>
                {parentAsset.target_width && parentAsset.target_height ? (
                  <Badge variant="outline">
                    {parentAsset.target_width}x{parentAsset.target_height}
                  </Badge>
                ) : null}
              </div>
              <div>
                <div className="font-medium">{parentAsset.variant_label}</div>
                <p className="text-muted-foreground">{parentAsset.rationale}</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/admin/creative-assets?campaignId=${detail.job.campaign_draft_id}`}
                >
                  Open campaign creative queue
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Visual brief</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="font-medium">Brief summary</div>
              <p className="mt-1 text-muted-foreground">
                {detail.job.brief_summary}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="font-medium">Rationale summary</div>
              <p className="mt-2 text-muted-foreground">
                {detail.job.rationale_summary}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <MetaLine
                label="Channel"
                value={labelChannel(detail.job.channel)}
              />
              <MetaLine label="Asset type" value={detail.job.asset_type} />
              <MetaLine
                label="Target format"
                value={labelCreativeFormat(
                  detail.job.brief_payload.targetFormat,
                )}
              />
              <MetaLine
                label="Campaign status"
                value={detail.campaign_status.replace(/_/g, " ")}
              />
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <BulletCard
                title="Composition notes"
                items={detail.job.brief_payload.compositionNotes}
              />
              <BulletCard
                title="Visual constraints"
                items={detail.job.brief_payload.visualConstraints}
              />
              <BulletCard
                title="Text overlay guidance"
                items={detail.job.brief_payload.textOverlayGuidance}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Review actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ActionForm
              action={`/api/admin/creative-assets/${detail.job.id}/approve`}
              title="Approve"
              description="Mark the current image set as approved."
              submitLabel="Approve creative set"
              redirectTo={`/admin/creative-assets/${detail.job.id}`}
            />
            <ActionForm
              action={`/api/admin/creative-assets/${detail.job.id}/request-changes`}
              title="Request changes"
              description="Keep the job in review and ask for another pass."
              submitLabel="Request changes"
              redirectTo={`/admin/creative-assets/${detail.job.id}`}
            />
            <ActionForm
              action={`/api/admin/creative-assets/${detail.job.id}/reject`}
              title="Reject"
              description="Reject the current asset set and preserve the history."
              submitLabel="Reject creative set"
              redirectTo={`/admin/creative-assets/${detail.job.id}`}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <MetaLine label="Provider" value={detail.job.provider_name} />
          <MetaLine label="Mode" value={detail.job.provider_mode} />
          <MetaLine
            label="Model"
            value={detail.job.provider_metadata?.model || "Not recorded"}
          />
          <MetaLine
            label="Generated at"
            value={
              detail.job.provider_metadata?.generatedAt
                ? new Date(
                    detail.job.provider_metadata.generatedAt,
                  ).toLocaleString()
                : "Not recorded"
            }
          />
          <MetaLine
            label="Request ID"
            value={detail.job.provider_metadata?.requestId || "Not recorded"}
          />
          <MetaLine
            label="Provider reference"
            value={
              detail.job.provider_metadata?.providerReferenceId ||
              "Not recorded"
            }
          />
          <MetaLine
            label="Fallback"
            value={
              detail.job.provider_metadata?.fallbackReason ||
              detail.job.provider_metadata?.note ||
              "No fallback"
            }
          />
          <MetaLine
            label="Error type"
            value={
              detail.job.provider_metadata?.errorType
                ? detail.job.provider_metadata.errorType.replace(/_/g, " ")
                : "Not recorded"
            }
          />
          <MetaLine
            label="Prompt summary"
            value={
              detail.job.provider_metadata?.promptSummary || "Not recorded"
            }
          />
          <MetaLine
            label="Output"
            value={
              detail.job.provider_metadata?.assetWidth &&
              detail.job.provider_metadata?.assetHeight
                ? `${detail.job.provider_metadata.assetWidth}x${detail.job.provider_metadata.assetHeight} ${detail.job.provider_metadata.outputFormat || ""}`.trim()
                : detail.job.provider_metadata?.outputFormat || "Not recorded"
            }
          />
          <MetaLine
            label="Quality"
            value={detail.job.provider_metadata?.quality || "Not recorded"}
          />
          <MetaLine
            label="Response summary"
            value={
              detail.job.provider_metadata?.responseSummary || "Not recorded"
            }
          />
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Asset variants</h2>
          <p className="text-sm text-muted-foreground">
            Preview the current asset, inspect the prompt and rationale, compare
            versions, and regenerate a variant with explicit feedback.
          </p>
        </div>

        {detail.assets.length ? (
          detail.assets.map((asset) => (
            <Card key={asset.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{asset.variant_label}</CardTitle>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StateBadge value={asset.status} />
                      <Badge variant="outline">
                        {labelCreativeFormat(asset.format)}
                      </Badge>
                      {asset.provider_metadata?.generationMode ? (
                        <Badge variant="outline">
                          {asset.provider_metadata.generationMode}
                        </Badge>
                      ) : null}
                      {asset.provider_metadata?.model ? (
                        <Badge variant="outline">
                          {asset.provider_metadata.model}
                        </Badge>
                      ) : null}
                      {asset.provider_metadata?.fallbackReason ? (
                        <Badge variant="outline">fallback</Badge>
                      ) : null}
                      <Badge variant="outline">
                        {asset.version_count} version
                        {asset.version_count === 1 ? "" : "s"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-lg border bg-muted/20">
                      {asset.preview_url ? (
                        <img
                          src={asset.preview_url}
                          alt={asset.variant_label}
                          className="h-auto w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
                          Preview unavailable
                        </div>
                      )}
                    </div>
                    {asset.original_version &&
                    asset.latest_version &&
                    asset.version_count > 1 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <VersionPreview
                          label={`Original v${asset.original_version.version_number}`}
                          previewUrl={
                            asset.versions.find(
                              (version) =>
                                version.version_number ===
                                asset.original_version?.version_number,
                            )?.preview_url || null
                          }
                          prompt={asset.original_version.prompt_text}
                          rationale={asset.original_version.rationale}
                        />
                        <VersionPreview
                          label={`Current v${asset.latest_version.version_number}`}
                          previewUrl={
                            asset.versions.find(
                              (version) =>
                                version.version_number ===
                                asset.latest_version?.version_number,
                            )?.preview_url || null
                          }
                          prompt={asset.latest_version.prompt_text}
                          rationale={asset.latest_version.rationale}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-lg border p-4 text-sm">
                      <div className="font-medium">Prompt</div>
                      <pre className="mt-2 whitespace-pre-wrap font-sans text-muted-foreground">
                        {asset.prompt_text}
                      </pre>
                    </div>
                    <div className="rounded-lg border p-4 text-sm">
                      <div className="font-medium">Rationale</div>
                      <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                        {asset.rationale}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4 text-sm">
                      <div className="font-medium">Asset metadata</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <MetaLine
                          label="Role"
                          value={labelCreativeAssetRole(asset.asset_role)}
                        />
                        <MetaLine
                          label="Adaptation method"
                          value={labelCreativeAdaptationMethod(
                            asset.adaptation_method,
                          )}
                        />
                        <MetaLine
                          label="Provider"
                          value={
                            asset.provider_metadata?.providerName ||
                            "Not recorded"
                          }
                        />
                        <MetaLine
                          label="Mode"
                          value={
                            asset.provider_metadata?.generationMode ||
                            "Not recorded"
                          }
                        />
                        <MetaLine
                          label="Model"
                          value={
                            asset.provider_metadata?.model || "Not recorded"
                          }
                        />
                        <MetaLine
                          label="Output"
                          value={
                            asset.target_width && asset.target_height
                              ? `${asset.target_width}x${asset.target_height} ${asset.format}`.trim()
                              : asset.provider_metadata?.assetWidth &&
                                  asset.provider_metadata?.assetHeight
                                ? `${asset.provider_metadata.assetWidth}x${asset.provider_metadata.assetHeight} ${asset.provider_metadata.outputFormat || ""}`.trim()
                                : asset.provider_metadata?.outputFormat ||
                                  "Not recorded"
                          }
                        />
                        <MetaLine
                          label="Suggested channel"
                          value={asset.target_channel || "Not recorded"}
                        />
                        <MetaLine
                          label="Reference"
                          value={
                            asset.provider_metadata?.providerReferenceId ||
                            asset.provider_metadata?.requestId ||
                            "Not recorded"
                          }
                        />
                        <MetaLine
                          label="Error type"
                          value={
                            asset.provider_metadata?.errorType
                              ? asset.provider_metadata.errorType.replace(
                                  /_/g,
                                  " ",
                                )
                              : "Not recorded"
                          }
                        />
                        <MetaLine
                          label="Prompt summary"
                          value={
                            asset.provider_metadata?.promptSummary ||
                            "Not recorded"
                          }
                        />
                        <MetaLine
                          label="Summary"
                          value={
                            asset.provider_metadata?.responseSummary ||
                            asset.provider_metadata?.note ||
                            "Not recorded"
                          }
                        />
                      </div>
                    </div>
                    <form
                      action="/api/creative/regenerate"
                      method="post"
                      className="space-y-3 rounded-lg border p-4"
                    >
                      <input
                        type="hidden"
                        name="creativeAssetId"
                        value={asset.id}
                      />
                      <input
                        type="hidden"
                        name="redirectTo"
                        value={`/admin/creative-assets/${detail.job.id}`}
                      />
                      <div>
                        <div className="font-medium">
                          Regenerate from feedback
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Ask for another variant while keeping the brand and
                          campaign brief intact.
                        </p>
                      </div>
                      <Textarea
                        name="feedbackNote"
                        rows={4}
                        placeholder="Example: make the CTA area clearer, reduce text overlay, and show a more practical in-home context."
                      />
                      <Button type="submit" variant="outline">
                        Regenerate variant
                      </Button>
                    </form>
                    {asset.asset_role === "master" ? (
                      <form
                        action="/api/creative/adapt"
                        method="post"
                        className="space-y-3 rounded-lg border p-4"
                      >
                        <input
                          type="hidden"
                          name="sourceCreativeAssetId"
                          value={asset.id}
                        />
                        <input
                          type="hidden"
                          name="redirectTo"
                          value={`/admin/creative-assets/${detail.job.id}`}
                        />
                        <div>
                          <div className="font-medium">Create adaptation</div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Derive another format from this approved master
                            asset.
                          </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <select
                            name="format"
                            defaultValue="story"
                            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                          >
                            {formatPresets.map((preset) => (
                              <option key={preset.format} value={preset.format}>
                                {preset.label} ({preset.width}x{preset.height})
                              </option>
                            ))}
                          </select>
                          <select
                            name="targetChannel"
                            defaultValue={
                              asset.target_channel || detail.job.channel
                            }
                            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                          >
                            {[
                              "meta",
                              "email",
                              "whatsapp",
                              "push",
                              "landing",
                              "google",
                            ].map((channel) => (
                              <option key={channel} value={channel}>
                                {labelChannel(channel as never)}
                              </option>
                            ))}
                          </select>
                          <select
                            name="adaptationMethod"
                            defaultValue=""
                            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                          >
                            <option value="">Auto method</option>
                            <option value="crop">Crop</option>
                            <option value="pad">Pad</option>
                            <option value="resize">Resize</option>
                            <option value="ai_extend">AI extend later</option>
                            <option value="provider_regenerate">
                              Provider regenerate later
                            </option>
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              name="width"
                              type="number"
                              min={1}
                              placeholder="Width"
                              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                            />
                            <input
                              name="height"
                              type="number"
                              min={1}
                              placeholder="Height"
                              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                            />
                          </div>
                        </div>
                        <Textarea
                          name="feedbackNote"
                          rows={3}
                          placeholder="Optional note for the derivative, for example: preserve the CTA safe area and avoid over-cropping the professional."
                        />
                        <Button
                          type="submit"
                          variant="outline"
                          disabled={asset.status !== "approved"}
                        >
                          Create derivative
                        </Button>
                      </form>
                    ) : (
                      <form
                        action="/api/creative/adapt-regenerate"
                        method="post"
                        className="space-y-3 rounded-lg border p-4"
                      >
                        <input
                          type="hidden"
                          name="creativeAssetId"
                          value={asset.id}
                        />
                        <input
                          type="hidden"
                          name="redirectTo"
                          value={`/admin/creative-assets/${detail.job.id}`}
                        />
                        <div>
                          <div className="font-medium">
                            Regenerate adaptation
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Re-run this derivative from the approved master with
                            a new framing note.
                          </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <select
                            name="format"
                            defaultValue={asset.format}
                            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                          >
                            {formatPresets.map((preset) => (
                              <option key={preset.format} value={preset.format}>
                                {preset.label} ({preset.width}x{preset.height})
                              </option>
                            ))}
                          </select>
                          <select
                            name="adaptationMethod"
                            defaultValue={asset.adaptation_method || ""}
                            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                          >
                            <option value="">Auto method</option>
                            <option value="crop">Crop</option>
                            <option value="pad">Pad</option>
                            <option value="resize">Resize</option>
                            <option value="ai_extend">AI extend later</option>
                            <option value="provider_regenerate">
                              Provider regenerate later
                            </option>
                          </select>
                        </div>
                        <Textarea
                          name="feedbackNote"
                          rows={3}
                          placeholder="Example: reduce crop on the CTA area and keep more negative space for mobile placements."
                        />
                        <Button type="submit" variant="outline">
                          Regenerate derivative
                        </Button>
                      </form>
                    )}
                  </div>
                </div>

                {asset.asset_role === "master" ? (
                  <div className="space-y-3">
                    <div className="font-medium">Derived formats</div>
                    {(derivativesByAssetId.get(asset.id) || []).length ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {(derivativesByAssetId.get(asset.id) || []).map(
                          (derivative) => (
                            <div
                              key={derivative.id}
                              className="rounded-lg border p-4 text-sm"
                            >
                              <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                                <div className="overflow-hidden rounded-md border bg-muted/20">
                                  {derivative.preview_url ? (
                                    <img
                                      src={derivative.preview_url}
                                      alt={derivative.variant_label}
                                      className="h-28 w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-28 items-center justify-center text-xs text-muted-foreground">
                                      No preview
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-2">
                                    <StateBadge
                                      value={derivative.generation_status}
                                    />
                                    <Badge variant="outline">
                                      {labelCreativeFormat(derivative.format)}
                                    </Badge>
                                    {derivative.target_width &&
                                    derivative.target_height ? (
                                      <Badge variant="outline">
                                        {derivative.target_width}x
                                        {derivative.target_height}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <div className="font-medium">
                                    {derivative.variant_label}
                                  </div>
                                  <p className="text-muted-foreground">
                                    {derivative.target_channel
                                      ? `Suggested for ${labelChannel(derivative.target_channel)}`
                                      : "No explicit channel"}
                                  </p>
                                  <Button asChild variant="outline" size="sm">
                                    <Link
                                      href={`/admin/creative-assets/${derivative.job_id}`}
                                    >
                                      Open derivative
                                    </Link>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No derivatives have been created from this master yet.
                      </p>
                    )}
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div className="font-medium">Version history</div>
                  {asset.versions.length ? (
                    asset.versions
                      .slice()
                      .reverse()
                      .map((version) => (
                        <div
                          key={version.id}
                          className="rounded-lg border p-4 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-medium">
                              Version {version.version_number}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(version.created_at).toLocaleString()}
                            </div>
                          </div>
                          <div className="mt-2 grid gap-4 md:grid-cols-[220px_1fr]">
                            <div>
                              {version.preview_url ? (
                                <img
                                  src={version.preview_url}
                                  alt={`Version ${version.version_number}`}
                                  className="h-36 w-full rounded-md border object-cover"
                                />
                              ) : (
                                <div className="flex h-36 items-center justify-center rounded-md border text-xs text-muted-foreground">
                                  Preview unavailable
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <div>
                                <div className="font-medium">Prompt</div>
                                <p className="whitespace-pre-wrap text-muted-foreground">
                                  {version.prompt_text}
                                </p>
                              </div>
                              <div>
                                <div className="font-medium">Rationale</div>
                                <p className="whitespace-pre-wrap text-muted-foreground">
                                  {version.rationale}
                                </p>
                              </div>
                              {version.edited_by ? (
                                <p className="text-xs text-muted-foreground">
                                  Updated by{" "}
                                  {detail.actor_names[version.edited_by] ||
                                    version.edited_by.slice(0, 8)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No versions recorded yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              This creative job does not have asset variants yet.
            </CardContent>
          </Card>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Feedback history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {detail.feedback.length ? (
            detail.feedback.map((item) => (
              <div key={item.id} className="rounded-lg border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {labelCreativeFeedbackType(item.feedback_type)}
                    </Badge>
                    <span className="text-muted-foreground">
                      {item.created_by
                        ? detail.actor_names[item.created_by] ||
                          item.created_by.slice(0, 8)
                        : "system"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  {item.feedback_note || "No note provided."}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No review feedback has been recorded yet.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-medium">{label}</div>
      <p className="mt-1 text-muted-foreground">{value}</p>
    </div>
  );
}

function BulletCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border p-4 text-sm">
      <div className="font-medium">{title}</div>
      {items.length ? (
        <div className="mt-2 space-y-2">
          {items.map((item) => (
            <p key={item} className="text-muted-foreground">
              {item}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-muted-foreground">No notes recorded.</p>
      )}
    </div>
  );
}

function ActionForm(args: {
  action: string;
  title: string;
  description: string;
  submitLabel: string;
  redirectTo: string;
}) {
  return (
    <form
      action={args.action}
      method="post"
      className="space-y-3 rounded-lg border p-4"
    >
      <div>
        <div className="font-medium">{args.title}</div>
        <p className="mt-1 text-sm text-muted-foreground">{args.description}</p>
      </div>
      <input type="hidden" name="redirectTo" value={args.redirectTo} />
      <Textarea
        name="feedbackNote"
        rows={3}
        placeholder="Optional note for the review history."
      />
      <Button type="submit" variant="outline">
        {args.submitLabel}
      </Button>
    </form>
  );
}

function VersionPreview(args: {
  label: string;
  previewUrl: string | null;
  prompt: string;
  rationale: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="font-medium">{args.label}</div>
      <div className="mt-3 overflow-hidden rounded-md border bg-muted/20">
        {args.previewUrl ? (
          <img
            src={args.previewUrl}
            alt={args.label}
            className="h-auto w-full object-cover"
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
            Preview unavailable
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{args.prompt}</p>
      <p className="mt-2 text-xs text-muted-foreground">{args.rationale}</p>
    </div>
  );
}
