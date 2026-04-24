import type { TrackingContract } from "@/lib/analytics/schemas";
import type { ResolvedPlacementCopy } from "@/lib/campaigns/placement-copy";
import { labelPlacementCopySource } from "@/lib/campaigns/workflow";
import type {
  CreativePlacementDefinition,
  PlacementReadinessReport,
} from "@/lib/creative/placements";

function sanitizePaidFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildPaidPlacementWarnings(args: {
  placement: CreativePlacementDefinition;
  readiness: PlacementReadinessReport;
  copy: ResolvedPlacementCopy;
}) {
  const warnings = [
    ...args.readiness.warnings,
    ...args.readiness.missing,
    ...args.copy.warnings,
  ];

  if (args.copy.inheritedFromChannel) {
    warnings.push(
      `${args.placement.label} is still inheriting channel-level copy. Review whether a tighter placement-specific version is needed before paid trafficking.`,
    );
  }

  if (!args.readiness.isExact && args.readiness.selectedAsset) {
    warnings.push(
      `${args.placement.label} is using fallback visual coverage instead of the preferred exact format.`,
    );
  }

  if (!args.readiness.selectedAsset) {
    warnings.push(
      `${args.placement.label} does not yet have an approved visual asset selected for handoff.`,
    );
  }

  return Array.from(new Set(warnings.filter(Boolean)));
}

function buildPaidPlacementNotes(args: {
  placement: CreativePlacementDefinition;
  readiness: PlacementReadinessReport;
  copy: ResolvedPlacementCopy;
}) {
  const notes = [
    `${args.placement.platformLabel} / ${args.placement.operationalName}`,
    `Copy treatment: ${args.placement.copyStyle}. ${args.placement.copyGuidance}`,
    args.readiness.summary,
    args.copy.summary,
    ...args.placement.notes,
  ];

  return Array.from(new Set(notes.filter(Boolean)));
}

export type PaidPlacementHandoff = {
  isPaidPlacement: boolean;
  platformLabel: string;
  placementGroup: CreativePlacementDefinition["placementGroup"];
  operationalName: string;
  namingHint: string;
  recommendedFileStem: string;
  copyStyle: CreativePlacementDefinition["copyStyle"];
  copy: {
    source: ResolvedPlacementCopy["source"];
    sourceLabel: string;
    inheritedFromChannel: boolean;
    status: ResolvedPlacementCopy["status"];
    summary: string;
  };
  visual: {
    assetId: string | null;
    format: string | null;
    exact: boolean;
    selectionSource: PlacementReadinessReport["selectionSource"];
    summary: string;
  };
  readiness: {
    state: PlacementReadinessReport["state"];
    blocked: boolean;
    isReadyForPaidHandoff: boolean;
    warnings: string[];
  };
  tracking: TrackingContract;
  notes: string[];
  warnings: string[];
};

export function buildPaidPlacementHandoff(args: {
  campaignTitle: string;
  placement: CreativePlacementDefinition;
  readiness: PlacementReadinessReport;
  copy: ResolvedPlacementCopy;
  tracking: TrackingContract;
}) {
  const { campaignTitle, placement, readiness, copy, tracking } = args;
  const warnings = buildPaidPlacementWarnings({
    placement,
    readiness,
    copy,
  });
  const notes = buildPaidPlacementNotes({
    placement,
    readiness,
    copy,
  });
  const baseStem = sanitizePaidFilePart(
    `${campaignTitle}-${placement.platformLabel}-${placement.namingHint}`,
  );

  return {
    isPaidPlacement: placement.placementFamily === "paid",
    platformLabel: placement.platformLabel,
    placementGroup: placement.placementGroup,
    operationalName: placement.operationalName,
    namingHint: placement.namingHint,
    recommendedFileStem: `${baseStem}-paid-handoff`,
    copyStyle: placement.copyStyle,
    copy: {
      source: copy.source,
      sourceLabel: labelPlacementCopySource(copy.source),
      inheritedFromChannel: copy.inheritedFromChannel,
      status: copy.status,
      summary: copy.summary,
    },
    visual: {
      assetId: readiness.selectedAsset?.id || null,
      format: readiness.selectedAsset?.format || null,
      exact: readiness.isExact,
      selectionSource: readiness.selectionSource,
      summary: readiness.selectedAsset
        ? readiness.isExact
          ? `${placement.label} is using exact visual coverage.`
          : `${placement.label} is using fallback visual coverage.`
        : `${placement.label} has no approved visual selected yet.`,
    },
    readiness: {
      state: readiness.state,
      blocked: readiness.isBlocked,
      isReadyForPaidHandoff:
        !readiness.isBlocked &&
        Boolean(readiness.selectedAsset) &&
        Boolean(copy.content),
      warnings,
    },
    tracking,
    notes,
    warnings,
  } satisfies PaidPlacementHandoff;
}
