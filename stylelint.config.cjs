/**
 * Stylelint configuration for Handi (Tailwind v4)
 * - Uses standard rules + Tailwind-specific adjustments
 */
module.exports = {
  extends: ["stylelint-config-standard", "stylelint-config-tailwindcss"],
  ignoreFiles: [
    "**/node_modules/**",
    ".next/**",
    "out/**",
    "public/**",
    "artifacts/**",
    "playwright-report/**",
    "test-results/**",
  ],
  reportNeedlessDisables: true,
  rules: {
    // Tailwind & PostCSS features
    "at-rule-no-unknown": null,

    // Relax notations to avoid noise with Tailwind v4 tokens/colors
    "hue-degree-notation": null,
    "lightness-notation": null,

    // Requested adjustments
    "no-empty-source": null,
    "alpha-value-notation": "number",

    // Reduce formatting churn
    "rule-empty-line-before": null,
    "no-descending-specificity": null,
  },
};
