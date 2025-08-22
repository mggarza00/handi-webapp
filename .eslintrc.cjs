module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react", "import"], // <- sin "react-hooks"
  extends: [
    "next/core-web-vitals",
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  parserOptions: {
    project: ["./tsconfig.json"],
    tsconfigRootDir: __dirname,
    sourceType: "module"
  },
  settings: {
    "import/resolver": {
      typescript: { project: ["./tsconfig.json"], alwaysTryTypes: true },
      node: { extensions: [".js", ".jsx", ".ts", ".tsx", ".d.ts"] }
    },
    react: { version: "detect" }
  },
  rules: {
    "import/order": ["error", { "newlines-between": "always" }],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    "no-empty": "error",
    // Estas reglas funcionan porque eslint-config-next carga el plugin react-hooks internamente
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react/jsx-uses-react": "off",
    "react/react-in-jsx-scope": "off"
  },
  overrides: [
    {
      files: ["app/api/**/route.ts", "app/(api)/**/route.ts"],
      rules: {
        "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
      }
    }
  ]
};
