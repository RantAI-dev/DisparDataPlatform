import { fileURLToPath } from "node:url";

// Layer fitur indikator (KONTRAK §1): /gci, /gpci, detail indikator, tiga halaman pariwisata.
export default defineNuxtConfig({
  components: [{ path: fileURLToPath(new URL("./components", import.meta.url)), pathPrefix: false }],
});
