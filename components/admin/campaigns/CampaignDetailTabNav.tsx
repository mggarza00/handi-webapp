import Link from "next/link";

import {
  getVisibleCampaignDetailTabs,
  type CampaignAdminMode,
  type CampaignDetailTabKey,
} from "@/lib/campaigns/admin-config";
import { cn } from "@/lib/utils";

type Props = {
  campaignId: string;
  activeTab: CampaignDetailTabKey;
  mode: CampaignAdminMode;
  from?: string;
  to?: string;
};

export default function CampaignDetailTabNav({
  campaignId,
  activeTab,
  mode,
  from,
  to,
}: Props) {
  const visibleTabs = getVisibleCampaignDetailTabs(mode);
  const toggleModeHref = buildTabHref({
    campaignId,
    tab: activeTab,
    mode: mode === "advanced" ? "basic" : "advanced",
    from,
    to,
  });

  return (
    <nav className="space-y-3 overflow-x-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/10 px-4 py-3 text-sm">
        <div>
          <span className="font-medium">Admin mode:</span>{" "}
          <span className="text-muted-foreground">
            {mode === "advanced"
              ? "advanced surfaces visible"
              : "MVP surfaces only: overview, copy, and handoff"}
          </span>
        </div>
        <Link
          href={toggleModeHref}
          className="text-muted-foreground underline underline-offset-2"
        >
          {mode === "advanced" ? "Switch to basic mode" : "Open advanced mode"}
        </Link>
      </div>
      <div className="flex min-w-max gap-2 rounded-2xl border bg-muted/20 p-2">
        {visibleTabs.map((tab) => {
          const href = buildTabHref({ campaignId, tab: tab.key, from, to });
          const isActive = tab.key === activeTab;

          return (
            <Link
              key={tab.key}
              href={href}
              className={cn(
                "min-w-[180px] rounded-xl px-4 py-3 text-sm transition",
                isActive
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
              )}
            >
              <div className="font-medium">{tab.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {tab.description}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function buildTabHref(args: {
  campaignId: string;
  tab: CampaignDetailTabKey;
  mode?: CampaignAdminMode;
  from?: string;
  to?: string;
}) {
  const params = new URLSearchParams();
  params.set("tab", args.tab);
  if (args.mode) params.set("mode", args.mode);
  if (args.from) params.set("from", args.from);
  if (args.to) params.set("to", args.to);
  return `/admin/campaigns/${args.campaignId}?${params.toString()}`;
}
