import { readFileSync } from "fs";
import path from "path";

import { expect, test } from "vitest";

test("request detail labels are not mojibake", () => {
  const filePath = path.resolve(
    __dirname,
    "..",
    "app",
    "(site)",
    "(main-site)",
    "requests",
    "explore",
    "[id]",
    "page.tsx",
  );
  const contents = readFileSync(filePath, "utf8");
  expect(contents).toContain("Descripción");
  expect(contents).toContain("Categoría");
  expect(contents).toContain("Subcategoría");
  expect(contents).not.toMatch(/[Ãâ]/);
});
