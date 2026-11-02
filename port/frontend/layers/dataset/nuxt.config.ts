import { fileURLToPath } from "node:url";

// Layer fitur dataset (KONTRAK §1): /katalog, /sdi, /sdi/[slug]. Komponen berawalan `Dataset`.
export default defineNuxtConfig({
  components: [{ path: fileURLToPath(new URL("./components", import.meta.url)), pathPrefix: false }],
});
