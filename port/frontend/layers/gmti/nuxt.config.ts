import { fileURLToPath } from "node:url";

// Layer fitur gmti, spasial, dan hotel-scraped (KONTRAK §1). Komponen berawalan `Gmti`.
export default defineNuxtConfig({
  components: [{ path: fileURLToPath(new URL("./components", import.meta.url)), pathPrefix: false }],
});
