import { fileURLToPath } from "node:url";

// Layer fitur atlas (KONTRAK §1): enam subhalaman GCI/GPCI. Komponen berawalan `Atlas`.
export default defineNuxtConfig({
  components: [{ path: fileURLToPath(new URL("./components", import.meta.url)), pathPrefix: false }],
});
