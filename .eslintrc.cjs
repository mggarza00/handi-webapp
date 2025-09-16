// Conditionally enable Tailwind ESLint plugin: not compatible with Tailwind v4
let enableTailwindPlugin = false;
try {
  const twPkg = require("tailwindcss/package.json");
  const major = parseInt((twPkg.version || "0").split(".")[0], 10);
  enableTailwindPlugin = major < 4;
} catch (_) {
  enableTailwindPlugin = false;
}

module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: [
    "@typescript-eslint",
    "react",
    "import",
    ...(enableTailwindPlugin ? ["tailwindcss"] : []),
  ],
  extends: [
    "next/core-web-vitals",
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    ...(enableTailwindPlugin ? ["plugin:tailwindcss/recommended"] : []),
  ],
  ignorePatterns: [
    "node_modules/",
    ".next/",
    "out/",
    "public/",
    "artifacts/",
    "dist/",
    // Temporarily ignore due to TS parser issue on Windows newlines/BOM
    "app/page.tsx",
  ],
  parserOptions: {
    project: ["./tsconfig.json"],
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  settings: {
    "import/resolver": {
      typescript: { project: ["./tsconfig.json"], alwaysTryTypes: true },
      node: { extensions: [".js", ".jsx", ".ts", ".tsx", ".d.ts"] },
    },
    react: { version: "detect" },
  },
  rules: {
    "import/order": ["error", { "newlines-between": "always" }],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "no-empty": "error",
    // Estas reglas funcionan porque eslint-config-next carga el plugin react-hooks internamente
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react/jsx-uses-react": "off",
    "react/react-in-jsx-scope": "off",
    // Tailwind plugin: keep noise low; Prettier handles order
    ...(enableTailwindPlugin
      ? {
          "tailwindcss/classnames-order": "warn",
          "tailwindcss/no-custom-classname": "off",
        }
      : {}),
  },
  overrides: [
    {
      files: ["app/api/**/route.ts", "app/(api)/**/route.ts"],
      rules: {
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
      },
    },
  ],
};
