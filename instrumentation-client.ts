import * as Sentry from "@sentry/nextjs";

const environment =
  process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment,
  release: process.env.SENTRY_RELEASE,
  enabled: !!process.env.SENTRY_DSN,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
