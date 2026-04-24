import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getInstrumentationAudit,
  getInstrumentationGaps,
} from "@/lib/analytics/instrumentation-audit";
import { getRuntimeInstrumentationHealthSnapshot } from "@/lib/analytics/runtime-health";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function renderCoverageVariant(status: "instrumented" | "partial" | "planned") {
  if (status === "instrumented") return "secondary" as const;
  if (status === "partial") return "outline" as const;
  return "destructive" as const;
}

function renderHealthVariant(
  status: "healthy" | "partial" | "stale" | "missing" | "unknown",
) {
  if (status === "healthy") return "secondary" as const;
  if (status === "partial") return "outline" as const;
  if (status === "stale") return "outline" as const;
  if (status === "missing") return "destructive" as const;
  return "outline" as const;
}

function formatTimestamp(value: string | null) {
  if (!value) return "Never observed";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminInstrumentationPage() {
  const audit = getInstrumentationAudit();
  const gaps = getInstrumentationGaps(audit.events);
  const runtimeHealth = await (async () => {
    try {
      return await getRuntimeInstrumentationHealthSnapshot(getAdminSupabase());
    } catch (error) {
      return {
        available: false,
        generatedAt: new Date().toISOString(),
        policy: {
          healthyWindowHours: 72,
          staleWindowDays: 14,
          persistenceModel: "latest_observation_rollup" as const,
        },
        summary: {
          totalInstrumentedEvents: audit.summary.totalEvents,
          healthyEvents: 0,
          partialEvents: 0,
          staleEvents: 0,
          missingEvents: 0,
          unknownEvents: audit.summary.totalEvents,
          browserEvents: audit.summary.browserEvents,
          serverEvents: audit.summary.serverEvents,
        },
        events: [],
        journeys: [],
        surfaces: [],
        error:
          error instanceof Error
            ? error.message
            : "runtime health client unavailable",
      };
    }
  })();

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Instrumentation Audit
          </h1>
          <p className="text-sm text-muted-foreground">
            Coverage view for GA4, Clarity, server-confirmed events, and
            Campaign OS context propagation.
          </p>
        </div>
        <Link
          href="/admin/system"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Volver a sistema
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Runtime health</CardDescription>
            <CardTitle>
              {runtimeHealth.summary.healthyEvents}/
              {runtimeHealth.summary.totalInstrumentedEvents}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            healthy event entries in the latest observation rollup
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Partial / stale</CardDescription>
            <CardTitle>
              {runtimeHealth.summary.partialEvents} partial /{" "}
              {runtimeHealth.summary.staleEvents} stale
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            recent but incomplete or aging runtime coverage
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Missing runtime signal</CardDescription>
            <CardTitle>{runtimeHealth.summary.missingEvents}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            catalog events not observed within the configured stale window
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recency policy</CardDescription>
            <CardTitle>
              {runtimeHealth.policy.healthyWindowHours}h /{" "}
              {runtimeHealth.policy.staleWindowDays}d
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            healthy window and stale window used for runtime coverage checks
          </CardContent>
        </Card>
      </section>

      {!runtimeHealth.available ? (
        <Card>
          <CardHeader>
            <CardTitle>Runtime Health Unavailable</CardTitle>
            <CardDescription>
              The static instrumentation audit is still available, but runtime
              observations could not be loaded in this environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {runtimeHealth.error || "Unknown runtime health error."}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Event catalog</CardDescription>
            <CardTitle>
              {audit.summary.instrumentedEvents}/{audit.summary.totalEvents}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            instrumented events
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Builder-backed surfaces</CardDescription>
            <CardTitle>
              {audit.summary.builderBackedSurfaces}/
              {audit.summary.totalSurfaces}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            central builder usage
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Event sources</CardDescription>
            <CardTitle>
              {audit.summary.browserEvents} browser /{" "}
              {audit.summary.serverEvents} server
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {audit.summary.hybridEvents} hybrid support entries
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Known gaps</CardDescription>
            <CardTitle>{gaps.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            planned or pending instrumentation items
          </CardContent>
        </Card>
      </section>

      {runtimeHealth.available ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Runtime Coverage</CardTitle>
              <CardDescription>
                Latest observed runtime signal per event, compared against the
                catalog and provider expectations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {runtimeHealth.events.map((event) => (
                <div key={event.name} className="rounded-lg border px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{event.name}</p>
                    <Badge variant={renderHealthVariant(event.status)}>
                      {event.status}
                    </Badge>
                    <Badge variant="outline">{event.source}</Badge>
                    <Badge variant="outline">{event.journey}</Badge>
                  </div>
                  <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                    <p>Last seen: {formatTimestamp(event.lastObservedAt)}</p>
                    <p>Last success: {formatTimestamp(event.lastSuccessAt)}</p>
                    <p>
                      Last route:{" "}
                      {event.lastRoutePath || event.lastSurfaceId || "n/a"}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {event.providerStates.map((providerState) => (
                      <Badge
                        key={`${event.name}-${providerState.providerTarget}`}
                        variant="outline"
                      >
                        {providerState.providerTarget}:
                        {providerState.dispatchStatus}
                      </Badge>
                    ))}
                  </div>
                  {event.notes.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {event.notes.map((note) => (
                        <li key={`${event.name}-${note}`}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Journey Health</CardTitle>
                <CardDescription>
                  Runtime coverage grouped by the canonical journeys in the
                  event catalog.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {runtimeHealth.journeys.map((journey) => (
                  <div
                    key={journey.journey}
                    className="rounded-lg border px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{journey.journey}</p>
                      <Badge variant={renderHealthVariant(journey.status)}>
                        {journey.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {journey.healthyEvents} healthy, {journey.partialEvents}{" "}
                      partial, {journey.staleEvents} stale,{" "}
                      {journey.missingEvents} missing
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Last seen: {formatTimestamp(journey.lastObservedAt)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Surface Runtime View</CardTitle>
                <CardDescription>
                  Static surface audit plus the latest runtime signal derived
                  from mapped events.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {runtimeHealth.surfaces.map((surface) => (
                  <div key={surface.id} className="rounded-lg border px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{surface.label}</p>
                      <Badge
                        variant={renderHealthVariant(surface.runtimeStatus)}
                      >
                        {surface.runtimeStatus}
                      </Badge>
                      <Badge
                        variant={renderCoverageVariant(surface.coverageStatus)}
                      >
                        {surface.coverageStatus}
                      </Badge>
                      <Badge variant="outline">{surface.builderStatus}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {surface.route}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Last seen: {formatTimestamp(surface.lastObservedAt)}
                    </p>
                    {surface.notes.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {surface.notes.slice(0, 3).map((note) => (
                          <li key={`${surface.id}-${note}`}>{note}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Builders</CardTitle>
          <CardDescription>
            Shared helpers that should replace manual query-string assembly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {audit.builders.map((builder) => (
            <div key={builder.name} className="rounded-lg border px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{builder.name}</p>
                <Badge variant="outline">{builder.file}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {builder.purpose}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Surface Coverage</CardTitle>
          <CardDescription>
            Owned surfaces and backend routes that already use central builders
            or still depend on partial/manual propagation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {audit.surfaces.map((surface) => (
            <div key={surface.id} className="rounded-lg border px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{surface.label}</p>
                <Badge variant={renderCoverageVariant(surface.coverageStatus)}>
                  {surface.coverageStatus}
                </Badge>
                <Badge variant="outline">{surface.builderStatus}</Badge>
                <Badge variant="outline">{surface.eventSource}</Badge>
                <Badge variant="outline">{surface.surfaceType}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {surface.route}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {surface.notes}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {surface.events.map((eventName) => (
                  <Badge key={eventName} variant="secondary">
                    {eventName}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event Catalog</CardTitle>
          <CardDescription>
            Canonical events, source of truth, and Campaign OS context usage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {audit.events.map((event) => (
            <div key={event.name} className="rounded-lg border px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{event.name}</p>
                <Badge variant={renderCoverageVariant(event.status)}>
                  {event.status}
                </Badge>
                <Badge variant="outline">{event.source}</Badge>
                <Badge variant="outline">{event.journey}</Badge>
                {event.usesCampaignContext ? (
                  <Badge variant="secondary">campaign-context</Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm">{event.businessGoal}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {event.notes}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {event.keyFields.map((field) => (
                  <Badge key={field} variant="outline">
                    {field}
                  </Badge>
                ))}
                {event.providers.map((provider) => (
                  <Badge key={provider} variant="outline">
                    {provider}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
