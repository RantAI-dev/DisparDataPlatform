// ESLint portal: hanya aturan pemisahan layer (SPEC §5.3), bukan gaya kode.
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";
import importPlugin from "eslint-plugin-import";

/** Layer fitur (SPEC §5.2). Layer baru wajib ditambahkan di sini. */
export const LAYER_FITUR = ["beranda", "dataset", "dashboard", "indikator", "atlas", "gmti", "spasial", "hotel-scraped", "docs"];

/**
 * Zona `import/no-restricted-paths`: fitur hanya boleh mengimpor dirinya sendiri dan `shared`;
 * `shared` tidak boleh mengimpor fitur mana pun. `root` = folder yang berisi `layers/`.
 */
export function aturanLayer(root, layers = LAYER_FITUR) {
  const zones = [
    ...layers.map((l) => ({ target: `${root}/layers/${l}`, from: `${root}/layers`, except: [`./${l}`, "./shared"], message: "Layer fitur tidak mengimpor layer fitur lain (SPEC §5.3)." })),
    { target: `${root}/layers/shared`, from: `${root}/layers`, except: ["./shared"], message: "Layer shared tidak mengimpor layer fitur (SPEC §5.3)." },
  ];
  return {
    files: ["**/*.{ts,mts,vue,js,mjs}"],
    languageOptions: { parser: vueParser, parserOptions: { parser: tseslint.parser, sourceType: "module", extraFileExtensions: [".vue"] } },
    plugins: { import: importPlugin },
    settings: {
      // Resolver TypeScript membaca alias Nuxt (`#layers/*`, `~~/*`); tanpa resolusi, aturan diam.
      "import/resolver": { typescript: { project: `${root}/.nuxt/tsconfig.app.json` }, node: { extensions: [".ts", ".vue", ".js", ".mjs"] } },
      "import/extensions": [".ts", ".vue", ".js", ".mjs"],
    },
    rules: { "import/no-restricted-paths": ["error", { zones }] },
  };
}

export default [
  { ignores: [".nuxt/**", ".output/**", "node_modules/**", "coverage/**", "test-results/**", "playwright-report/**"] },
  aturanLayer(fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "")),
];
