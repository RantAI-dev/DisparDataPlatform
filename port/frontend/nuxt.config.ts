// https://nuxt.com/docs/api/configuration/nuxt-config
// Nuxt 4 (SPEC K-8). Layer fitur ditambahkan ke `extends` oleh plan 11–15.
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  extends: ["./layers/shared"],
  ssr: true,

  // Nuxt 4: `~` menunjuk app/; CSS layer memakai path relatif layer (SPEC §5.1).
  css: ["~/assets/css/tailwind.css"],
  postcss: { plugins: { tailwindcss: {}, autoprefixer: {} } },

  runtimeConfig: {
    // Server-only. Diisi NUXT_LARAVEL_URL dan NUXT_FRONTEND_TOKEN; tidak pernah ke browser.
    laravelUrl: "http://localhost:18000",
    frontendToken: "",
  },

  // Sama dengan app/layout.tsx platform-v2 (inventaris A §1.1).
  app: {
    head: {
      htmlAttrs: { lang: "id" },
      title: "Dashboard Data Pariwisata & Ekraf — DKI Jakarta",
      meta: [
        { name: "description", content: "Platform visualisasi data terkonsolidasi Dinas Pariwisata & Ekonomi Kreatif Provinsi DKI Jakarta." },
      ],
      link: [
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        { rel: "icon", href: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { rel: "icon", href: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "manifest", href: "/site.webmanifest" },
      ],
    },
  },

  typescript: { strict: true, typeCheck: false },
});
