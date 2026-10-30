import { defineConfig } from "vitest/config";
import { defineVitestProject } from "@nuxt/test-utils/config";

export default defineConfig({
  test: {
    projects: [
      { test: { name: "unit", include: ["tests/unit/**/*.spec.ts"], environment: "node" } },
      // Composable dan komponen di runtime Nuxt (happy-dom).
      await defineVitestProject({ test: { name: "nuxt", include: ["tests/nuxt/**/*.spec.ts"], environment: "nuxt" } }),
      // Membangun Nuxt sekali lalu menguji server sungguhan (proxy, redirect, error).
      { test: { name: "nitro", include: ["tests/nitro/**/*.spec.ts"], environment: "node", testTimeout: 60_000, hookTimeout: 300_000 } },
    ],
  },
});
