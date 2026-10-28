import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dari = (p: string) => fileURLToPath(new URL(p, import.meta.url));
// `exports` paket fontsource hanya membuka berkas .css, jadi folder paket dicari lewat LICENSE.
const fontLatin = join(
  dirname(createRequire(import.meta.url).resolve("@fontsource-variable/plus-jakarta-sans/LICENSE")),
  "files/plus-jakarta-sans-latin-wght-normal.woff2",
);

// Layer bersama (SPEC §5.2): komponen, composable, util, CSS, dan aset publik yang dipakai semua fitur.
export default defineNuxtConfig({
  modules: ["@nuxtjs/fontaine"],

  css: [
    "@fontsource-variable/plus-jakarta-sans/index.css",
    dari("./assets/css/globals.css"),
    dari("./assets/css/font.css"),
  ],
  postcss: {
    plugins: { tailwindcss: { config: dari("./tailwind.config.ts") }, autoprefixer: {} },
  },

  // Nama komponen tanpa awalan folder (<KpiStat>, bukan <UiKpiStat>), sama dengan nama React-nya.
  components: [{ path: dari("./components"), pathPrefix: false }],

  // Metrik dibaca dari berkas font (nama "… Variable" tidak ada di basis metrik bawaan fontaine).
  // inject:false — penyisipan otomatis fontaine membuang `var(--font-sans)` dari aturan body di
  // globals.css; nama fallback sudah ditulis sendiri di assets/css/font.css.
  fontMetrics: {
    inject: false,
    fonts: [{ family: "Plus Jakarta Sans Variable", src: fontLatin, fallbacks: ["Arial"] }],
  },
});
