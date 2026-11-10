import { defineConfig, devices } from "@playwright/test"

/**
 * Smoke tests on desktop and on a throttled phone (item 32 of the performance pass).
 * Runs against a running app (E2E_BASE_URL, default http://localhost:3000) with the locally
 * installed Chrome, so no browser download is needed. Sign-in uses E2E_EMAIL / E2E_PASSWORD —
 * a real account of yours; signed-in tests are skipped without them.
 *
 *   E2E_EMAIL=… E2E_PASSWORD=… npm run test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    // Pixel 7 viewport/touch/UA; network and CPU throttled per test through CDP (see e2e/throttle.ts).
    { name: "mobile-slow", use: { ...devices["Pixel 7"], channel: "chrome" }, metadata: { throttle: true } },
  ],
})
