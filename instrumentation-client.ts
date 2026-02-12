import * as Sentry from "@sentry/nextjs";

const environment =
  process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";

const resolveRelease = () => {
  if (process.env.SENTRY_RELEASE) return process.env.SENTRY_RELEASE;
  if (process.env.VERCEL_GIT_COMMIT_SHA)
    return process.env.VERCEL_GIT_COMMIT_SHA;
  return environment === "development" ? "development" : undefined;
};

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment,
  release: resolveRelease(),
  enabled: !!process.env.SENTRY_DSN,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
