import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // jsx-a11y/recommended: statyczna kontrola WCAG (docs/team/accessibility.md)
  ...compat.extends("next/core-web-vitals", "next/typescript", "plugin:jsx-a11y/recommended"),
  {
    rules: {
      // `autoFocus` to też prop naszego `AssistantChat`, nie tylko atrybut DOM
      "jsx-a11y/no-autofocus": ["error", { ignoreNonDOM: true }],
      "jsx-a11y/label-has-associated-control": [
        "error",
        { controlComponents: ["SectorSelect"] },
      ],
    },
  },
];

export default eslintConfig;
