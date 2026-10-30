import { fileURLToPath } from "node:url";

const dari = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Layer bersama (SPEC §5.2): komponen, composable, util, CSS, dan aset publik yang dipakai semua fitur.
export default defineNuxtConfig({
  css: [dari("./assets/css/globals.css"), dari("./assets/css/font.css")],
  postcss: {
    plugins: { tailwindcss: { config: dari("./tailwind.config.ts") }, autoprefixer: {} },
  },

  // Nama komponen tanpa awalan folder (<KpiStat>, bukan <UiKpiStat>), sama dengan nama React-nya.
  components: [{ path: dari("./components"), pathPrefix: false }],

  app: {
    head: {
      // Seperti next/font: subset latin dipreload.
      link: [{ rel: "preload", href: "/fonts/plus-jakarta-sans/636a5ac981f94f8b-s.p.woff2", as: "font", type: "font/woff2", crossorigin: "" }],
    },
  },
});
