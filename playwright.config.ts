import { defineConfig, devices } from "@playwright/test";

const testPort = process.env.INTERVIEWIQ_TEST_PORT || "3100";
const testUrl = `http://localhost:${testPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: testUrl, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: `npm run dev -- --port ${testPort}`, url: testUrl, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
