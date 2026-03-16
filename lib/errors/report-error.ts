import * as Sentry from "@sentry/nextjs";

import type { NormalizedAppError } from "@/lib/errors/app-error";

type ReportErrorArgs = {
  error: unknown;
  normalized: NormalizedAppError;
  area: string;
  feature?: string;
  route?: string;
  userId?: string | null;
  userEmail?: string | null;
  blocking?: boolean;
  extra?: Record<string, unknown>;
};

export function reportError(args: ReportErrorArgs) {
  const err =
    args.error instanceof Error
      ? args.error
      : new Error(args.normalized.technicalMessage);
  Sentry.withScope((scope) => {
    scope.setTag("area", args.area);
    scope.setTag("error_code", args.normalized.code);
    scope.setTag("blocking", args.blocking ? "true" : "false");
    if (args.feature) scope.setTag("feature", args.feature);
    if (args.route) scope.setTag("route", args.route);
    if (typeof args.normalized.status === "number") {
      scope.setTag("http_status", String(args.normalized.status));
    }
    if (args.userId || args.userEmail) {
      scope.setUser({
        id: args.userId || undefined,
        email: args.userEmail || undefined,
      });
    }
    scope.setContext("app_error", {
      code: args.normalized.code,
      userMessage: args.normalized.userMessage,
      technicalMessage: args.normalized.technicalMessage,
      status: args.normalized.status,
      retryable: args.normalized.retryable,
      ...args.extra,
    });
    Sentry.captureException(err);
  });
}
