// E2E portal (SPEC §9 job `e2e`): Nuxt hasil build melawan Laravel + Data API palsu (fixture-server).
// E2E_BASE_URL menunjuk server yang sudah jalan; tanpa itu Playwright menjalankan .output sendiri.
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["junit", { outputFile: "test-results/e2e-junit.xml" }]] : "list",
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "node .output/server/index.mjs",
        url: `http://127.0.0.1:${PORT}/_kerangka`,
        reuseExistingServer: !process.env.CI,
        env: { PORT: String(PORT), HOST: "127.0.0.1" },
        timeout: 60_000,
      },
});
