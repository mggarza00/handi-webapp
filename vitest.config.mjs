import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/__tests__/**/*.{test,spec}.{ts,tsx,js,jsx}"],
    environment: "node",
    passWithNoTests: false,
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
    },
  },
});
