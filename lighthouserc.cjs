/**
 * Lighthouse CI config for Handi UI Review
 * - Builds URLs from BASE_URL and LH_ROUTES ("," separated)
 * - Stores reports to artifacts/lhci (no upload)
 * - Uses warnings for assertions so review doesn't fail the run
 */
const BASE_URL =
  process.env.PREVIEW_URL || process.env.BASE_URL || "http://localhost:3000";
const ROUTES = (process.env.LH_ROUTES &&
  process.env.LH_ROUTES.split(",")
    .map((s) => s.trim())
    .filter(Boolean)) || ["/", "/design-check"];

/** @type {import('@lhci/cli/src/types/externals').LighthouseCiRc} */
module.exports = {
  ci: {
    collect: {
      url: ROUTES.map((r) => new URL(r, BASE_URL).toString()),
      numberOfRuns: 1,
      settings: {
        // Keep runs lightweight and deterministic
        formFactor: "desktop",
        screenEmulation: {
          mobile: false,
          width: 1366,
          height: 768,
          deviceScaleFactor: 1,
          disabled: false,
        },
        throttlingMethod: "simulate",
      },
      chromeFlags: "--headless=new",
    },
    assert: {
      // Do not fail the CI; surface warnings for visibility
      assertions: {
        "categories:performance": ["warn", { minScore: 0.75 }],
        "categories:accessibility": ["warn", { minScore: 0.85 }],
        "categories:best-practices": ["warn", { minScore: 0.85 }],
        "categories:seo": ["warn", { minScore: 0.85 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "artifacts/lhci",
      reportFilenamePattern: "lhci-%%PATHNAME%%-%%DATETIME%%.html",
    },
  },
};
