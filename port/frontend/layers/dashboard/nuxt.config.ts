import { fileURLToPath } from "node:url";

// Layer fitur dashboard (KONTRAK §1): /dashboard dan empat sub-halaman. Komponen berawalan `Dashboard`.
export default defineNuxtConfig({
  components: [{ path: fileURLToPath(new URL("./components", import.meta.url)), pathPrefix: false }],
});
