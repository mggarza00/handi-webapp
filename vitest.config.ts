import path from "path";
import { fileURLToPath } from "url";

import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "."),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["__tests__/**/*.spec.ts"],
  },
});
