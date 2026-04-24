import type { ReactNode } from "react";

import StateBadge from "@/components/admin/state-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  editorialStatus: string;
  publishStatus: string;
  visualReadinessLabel: string;
  nextBestAction: string;
  criticalWarnings: string[];
  readinessTone?: "good" | "warn" | "bad";
  actionSlot?: ReactNode;
};

export default function CampaignExecutiveOverview({
  editorialStatus,
  publishStatus,
  visualReadinessLabel,
  nextBestAction,
  criticalWarnings,
  readinessTone = "warn",
  actionSlot,
}: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Executive overview</CardTitle>
          <CardDescription>
            Start here before opening copy, creatives, handoff, or analytics.
          </CardDescription>
        </div>
        {actionSlot ? (
          <div className="flex flex-wrap gap-2">{actionSlot}</div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          <OverviewTile label="Editorial">
            <StateBadge value={editorialStatus} />
          </OverviewTile>
          <OverviewTile label="Publishing">
            <StateBadge value={publishStatus} />
          </OverviewTile>
          <OverviewTile label="Visual readiness">
            <Badge variant={toneToVariant(readinessTone)}>
              {visualReadinessLabel}
            </Badge>
          </OverviewTile>
          <OverviewTile label="Warnings">
            <Badge
              variant={criticalWarnings.length ? "destructive" : "secondary"}
            >
              {criticalWarnings.length
                ? `${criticalWarnings.length} active`
                : "No critical blockers"}
            </Badge>
          </OverviewTile>
        </div>

        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Next best action
          </div>
          <p className="mt-2 text-sm">{nextBestAction}</p>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Critical warnings</div>
          {criticalWarnings.length ? (
            <div className="space-y-2">
              {criticalWarnings.map((warning) => (
                <div
                  key={warning}
                  className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                >
                  {warning}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No critical warnings right now. Use the tabs for detailed review.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function toneToVariant(tone: "good" | "warn" | "bad") {
  switch (tone) {
    case "good":
      return "secondary" as const;
    case "bad":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}
