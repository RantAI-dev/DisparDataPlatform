import { fileURLToPath } from "node:url";

// Layer fitur docs (KONTRAK §1): halaman /docs. Komponen berawalan `Docs`.
export default defineNuxtConfig({
  components: [{ path: fileURLToPath(new URL("./components", import.meta.url)), pathPrefix: false }],
  runtimeConfig: {
    // Base URL API Laravel yang ditampilkan di /docs (NUXT_PUBLIC_API_BASE_URL); bukan rahasia.
    public: { apiBaseUrl: "http://localhost:18000" },
  },
});
