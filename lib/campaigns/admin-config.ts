export type CampaignAdminMode = "basic" | "advanced";

export type CampaignDetailTabKey =
  | "overview"
  | "copy"
  | "creatives"
  | "handoff"
  | "analytics"
  | "activity";

export const CAMPAIGN_DETAIL_TABS: Array<{
  key: CampaignDetailTabKey;
  label: string;
  description: string;
  advanced?: boolean;
}> = [
  {
    key: "overview",
    label: "Overview",
    description: "Status, next actions, and critical signals.",
  },
  {
    key: "copy",
    label: "Copy",
    description: "Variants, QA, rationale, and edits.",
  },
  {
    key: "handoff",
    label: "Export / Handoff",
    description: "Placements, bundles, publishing, and exports.",
  },
  {
    key: "creatives",
    label: "Creativos",
    description: "Creative jobs, assets, and derivatives.",
    advanced: true,
  },
  {
    key: "analytics",
    label: "Analytics",
    description: "Performance, learning signals, and trends.",
    advanced: true,
  },
  {
    key: "activity",
    label: "Activity",
    description: "Notes, approvals, and audit trail.",
    advanced: true,
  },
];

export function resolveCampaignAdminMode(
  requested?: string,
): CampaignAdminMode {
  if (requested === "advanced") return "advanced";
  if (requested === "basic") return "basic";
  return process.env.CAMPAIGN_OS_ADMIN_MODE === "advanced"
    ? "advanced"
    : "basic";
}

export function getVisibleCampaignDetailTabs(mode: CampaignAdminMode) {
  if (mode === "advanced") return CAMPAIGN_DETAIL_TABS;
  return CAMPAIGN_DETAIL_TABS.filter((tab) => !tab.advanced);
}

export function isCampaignDetailTabAvailable(
  tab: string | undefined,
  mode: CampaignAdminMode,
): tab is CampaignDetailTabKey {
  return getVisibleCampaignDetailTabs(mode).some((item) => item.key === tab);
}
