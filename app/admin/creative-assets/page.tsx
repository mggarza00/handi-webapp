/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import StateBadge from "@/components/admin/state-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCreativeAssetJobs } from "@/lib/creative/repository";
import {
  labelCreativeAssetRole,
  normalizeCreativeGenerationStatus,
  labelCreativeFormat,
  labelCreativeJobType,
} from "@/lib/creative/workflow";
import { labelChannel } from "@/lib/campaigns/workflow";
import { getAdminSupabase } from "@/lib/supabase/admin";

type Search = {
  searchParams: {
    page?: string;
    q?: string;
    status?: string;
    channel?: string;
    provider?: string;
    campaignId?: string;
  };
};

export const dynamic = "force-dynamic";

export default async function AdminCreativeAssetsPage({
  searchParams,
}: Search) {
  const page = Math.max(1, Number(searchParams.page || 1));
  const q = (searchParams.q || "").toString();
  const status = (searchParams.status || "").toString();
  const channel = (searchParams.channel || "").toString();
  const provider = (searchParams.provider || "").toString();
  const campaignId = (searchParams.campaignId || "").toString();
  const admin = getAdminSupabase();
  const result = await listCreativeAssetJobs(admin, {
    page,
    pageSize: 20,
    q,
    status: status ? normalizeCreativeGenerationStatus(status) : "",
    channel: (channel || "") as
      | "meta"
      | "email"
      | "whatsapp"
      | "push"
      | "landing"
      | "google"
      | "",
    provider,
    campaignId: campaignId || undefined,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Creative assets</h1>
          <p className="text-sm text-muted-foreground">
            Review visual briefs, generated image variants, provider metadata,
            and approval status from the same internal campaign workflow.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/campaigns">Campaigns</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Creative queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 md:grid-cols-5">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search campaign title"
            />
            <select
              name="status"
              defaultValue={status}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="proposed">Proposed</option>
              <option value="changes_requested">Changes requested</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
            </select>
            <select
              name="channel"
              defaultValue={channel}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All channels</option>
              <option value="meta">Meta ads</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="push">Push</option>
              <option value="landing">Landing</option>
              <option value="google">Google ads</option>
            </select>
            <select
              name="provider"
              defaultValue={provider}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All providers</option>
              <option value="mock">Mock</option>
              <option value="image-provider">Image provider</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit" variant="outline">
                Filter
              </Button>
              {campaignId ? (
                <Button asChild variant="ghost">
                  <Link href="/admin/creative-assets">
                    Clear campaign filter
                  </Link>
                </Button>
              ) : null}
            </div>
            {campaignId ? (
              <input type="hidden" name="campaignId" value={campaignId} />
            ) : null}
          </form>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{result.total} results</span>
            <span>Sorted by updated_at</span>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preview</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.length ? (
                  result.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.current_asset_preview_url ? (
                          <img
                            src={item.current_asset_preview_url}
                            alt={item.brief_summary}
                            className="h-16 w-24 rounded-md border object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-24 items-center justify-center rounded-md border text-xs text-muted-foreground">
                            No preview
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="space-y-1">
                        <div className="font-medium">{item.campaign_title}</div>
                        <p className="text-xs text-muted-foreground">
                          {item.message_variant_name
                            ? `Linked to ${item.message_variant_name}`
                            : "Campaign-level visual brief"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {labelCreativeJobType(item.job_type)}
                          {item.current_asset_role
                            ? ` | ${labelCreativeAssetRole(item.current_asset_role)}`
                            : ""}
                          {item.current_asset_format
                            ? ` | ${labelCreativeFormat(item.current_asset_format)}`
                            : ""}
                        </p>
                        {item.last_feedback_note ? (
                          <p className="text-xs text-muted-foreground">
                            Last feedback: {item.last_feedback_note}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>{labelChannel(item.channel)}</TableCell>
                      <TableCell>
                        <StateBadge value={item.generation_status} />
                      </TableCell>
                      <TableCell className="space-y-1">
                        <Badge variant="outline">{item.provider_name}</Badge>
                        <p className="text-xs text-muted-foreground">
                          {item.provider_mode}
                        </p>
                        {item.provider_metadata?.model ? (
                          <p className="text-xs text-muted-foreground">
                            {item.provider_metadata.model}
                          </p>
                        ) : null}
                        {item.provider_metadata?.errorType ? (
                          <p className="text-xs text-muted-foreground">
                            {item.provider_metadata.errorType.replace(
                              /_/g,
                              " ",
                            )}
                          </p>
                        ) : null}
                        {item.provider_metadata?.fallbackReason ? (
                          <p className="text-xs text-amber-700">fallback</p>
                        ) : null}
                      </TableCell>
                      <TableCell>{item.asset_count}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(item.updated_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/creative-assets/${item.id}`}>
                            Review
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No creative asset jobs match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" disabled={page <= 1}>
                <Link
                  href={buildPageHref(page - 1, {
                    q,
                    status,
                    channel,
                    provider,
                    campaignId,
                  })}
                >
                  Previous
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
              >
                <Link
                  href={buildPageHref(page + 1, {
                    q,
                    status,
                    channel,
                    provider,
                    campaignId,
                  })}
                >
                  Next
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function buildPageHref(
  page: number,
  filters: {
    q: string;
    status: string;
    channel: string;
    provider: string;
    campaignId: string;
  },
) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.channel) params.set("channel", filters.channel);
  if (filters.provider) params.set("provider", filters.provider);
  if (filters.campaignId) params.set("campaignId", filters.campaignId);
  const query = params.toString();
  return query ? `/admin/creative-assets?${query}` : "/admin/creative-assets";
}
