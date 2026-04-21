import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCampaignDetail } from "@/lib/campaigns/repository";
import { getAdminSupabase } from "@/lib/supabase/admin";

type Search = {
  searchParams: {
    from?: string;
  };
};

export const dynamic = "force-dynamic";

export default async function AdminCampaignNewPage({ searchParams }: Search) {
  const admin = getAdminSupabase();
  const sourceId = (searchParams.from || "").trim();
  const sourceCampaign = sourceId
    ? await getCampaignDetail(admin, sourceId).catch(() => null)
    : null;
  const sourceDraft = sourceCampaign?.draft || null;

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <Link
          href="/admin/campaigns"
          className="text-sm text-muted-foreground underline"
        >
          Back to campaigns
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">
            {sourceDraft ? "Duplicate campaign brief" : "New campaign brief"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Capture the campaign intent clearly, let the agents propose, and
            send the draft straight into admin review.
          </p>
        </div>
      </div>

      {sourceDraft ? (
        <Card>
          <CardHeader>
            <CardTitle>Source campaign</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This brief is prefilled from{" "}
            <Link
              href={`/admin/campaigns/${sourceDraft.id}`}
              className="underline underline-offset-2"
            >
              {sourceDraft.title}
            </Link>
            . Edit any field before generating the new draft.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Brief</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action="/api/campaigns/generate"
            method="post"
            className="grid gap-4 md:grid-cols-2"
          >
            {sourceDraft ? (
              <>
                <input
                  type="hidden"
                  name="sourceCampaignDraftId"
                  value={sourceDraft.id}
                />
                <input
                  type="hidden"
                  name="sourceCampaignTitle"
                  value={sourceDraft.title}
                />
              </>
            ) : null}

            <label className="grid gap-1 text-sm md:col-span-2">
              <span>Title</span>
              <Input
                name="title"
                defaultValue={
                  sourceDraft ? `${sourceDraft.title} copy` : undefined
                }
                placeholder="Example: Win back inactive homeowners before spring"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span>Audience</span>
              <select
                name="audience"
                defaultValue={sourceDraft?.audience || "client"}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="client">Client</option>
                <option value="professional">Professional</option>
                <option value="business">Business</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span>Goal</span>
              <select
                name="goal"
                defaultValue={sourceDraft?.goal || "acquisition"}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="awareness">Awareness</option>
                <option value="acquisition">Acquisition</option>
                <option value="activation">Activation</option>
                <option value="conversion">Conversion</option>
                <option value="retention">Retention</option>
                <option value="reactivation">Reactivation</option>
                <option value="upsell">Upsell</option>
                <option value="referral">Referral</option>
                <option value="education">Education</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm md:col-span-2">
              <span>Channels</span>
              <div className="flex flex-wrap gap-4 rounded-md border border-input px-3 py-2 text-sm">
                {["meta", "email", "whatsapp", "push", "landing"].map(
                  (value, index) => (
                    <label
                      key={value}
                      className="inline-flex items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        name="channels"
                        value={value}
                        defaultChecked={
                          sourceDraft
                            ? sourceDraft.channels.includes(
                                value as (typeof sourceDraft.channels)[number],
                              )
                            : index < 2
                        }
                      />
                      <span>{value}</span>
                    </label>
                  ),
                )}
              </div>
            </label>

            <label className="grid gap-1 text-sm">
              <span>Service category</span>
              <Input
                name="serviceCategory"
                defaultValue={
                  sourceDraft?.service_category || "Limpieza profunda"
                }
                required
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span>Offer</span>
              <Input
                name="offer"
                defaultValue={
                  sourceDraft?.offer ||
                  "Find reliable help for the job without extra friction."
                }
                required
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span>CTA</span>
              <Input
                name="cta"
                defaultValue={sourceDraft?.cta || "Get started"}
                required
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span>Journey trigger</span>
              <Input
                name="journeyTrigger"
                defaultValue={
                  sourceDraft?.journey_trigger || "manual_admin_brief"
                }
                required
              />
            </label>

            <label className="grid gap-1 text-sm md:col-span-2">
              <span>Tone preference</span>
              <Input
                name="tonePreference"
                placeholder="Optional. Example: Calm, modern, and reassuring"
              />
            </label>

            <label className="grid gap-1 text-sm md:col-span-2">
              <span>Notes</span>
              <Textarea
                name="notes"
                rows={6}
                defaultValue={
                  sourceDraft?.notes ||
                  "Keep the Handi voice clear, trustworthy, and useful. Avoid hype or aggressive urgency."
                }
              />
            </label>

            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">Generate campaign draft</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
