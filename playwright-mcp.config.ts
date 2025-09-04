import { defineConfig, devices } from "@playwright/test";

/**
 * MCP-specific Playwright configuration
 * This configuration is optimized for MCP browser tool integration
 * and doesn't require extension building for basic MCP testing.
 */
export default defineConfig({
  testDir: "./e2e",
  /* No global setup for MCP-only tests */
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html"],
    ["list"],
    ["json", { outputFile: "e2e/mcp-reports/test-results.json" }],
  ],
  /* Shared settings for all the projects below. */
  use: {
    /* Collect trace when retrying the failed test. */
    trace: "on-first-retry",
    /* Screenshot on failure */
    screenshot: "only-on-failure",
    /* Video recording */
    video: "retain-on-failure",
  },

  /* Configure projects for MCP testing */
  projects: [
    {
      name: "mcp-setup",
      testMatch: "**/mcp-setup-test.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-web-security", // For MCP testing
            "--disable-features=VizDisplayCompositor", // Better MCP compatibility
            "--enable-automation", // Better MCP tool integration
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
          ],
        },
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "mcp-extension",
      testMatch: "**/mcp-*.spec.ts",
      testIgnore: "**/mcp-setup-test.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-web-security",
            "--disable-features=VizDisplayCompositor",
            "--enable-automation",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
          ],
        },
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
