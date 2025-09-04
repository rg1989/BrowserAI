import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Page,
} from "@playwright/test";

/**
 * MCP Setup Test
 *
 * This test validates that the MCP testing infrastructure is properly configured
 * and can run basic browser automation tests without requiring the full extension build.
 */

test.describe("MCP Setup Validation", () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async () => {
    // Launch browser with MCP-compatible settings (without extension)
    context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security", // For MCP testing
        "--disable-features=VizDisplayCompositor", // Better MCP compatibility
        "--enable-automation", // Better MCP tool integration
      ],
      viewport: { width: 1280, height: 720 },
    });

    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("MCP browser setup works correctly", async () => {
    // Navigate to a test page
    await page.goto("https://example.com");
    await page.waitForLoadState("networkidle");

    // Verify page loaded
    await expect(page).toHaveTitle(/Example Domain/);

    // Test screenshot capability for MCP
    const screenshot = await page.screenshot({
      path: "e2e/screenshots/mcp-setup-test.png",
      fullPage: true,
    });
    expect(screenshot).toBeTruthy();

    // Test state capture for MCP
    const pageState = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      };
    });

    expect(pageState.url).toBe("https://example.com/");
    expect(pageState.title).toContain("Example Domain");
    expect(pageState.viewport.width).toBe(1280);
    expect(pageState.viewport.height).toBe(720);

    console.log("MCP Page State:", JSON.stringify(pageState, null, 2));
  });

  test("MCP keyboard interaction works", async () => {
    await page.goto("https://example.com");
    await page.waitForLoadState("networkidle");

    // Test keyboard events
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");

    // Test key combinations
    await page.keyboard.press("Meta+KeyK");
    await page.keyboard.press("Control+KeyA");

    // Verify page is still responsive
    await expect(page).toHaveTitle(/Example Domain/);
  });

  test("MCP performance measurement works", async () => {
    const startTime = Date.now();

    await page.goto("https://example.com");
    await page.waitForLoadState("networkidle");

    const loadTime = Date.now() - startTime;

    console.log("MCP Performance Metrics:", {
      loadTime,
      timestamp: new Date().toISOString(),
    });

    // Verify reasonable load time
    expect(loadTime).toBeLessThan(10000); // 10 seconds max
  });

  test("MCP cross-page navigation works", async () => {
    const testUrls = [
      "https://example.com",
      "https://httpbin.org/html",
      "data:text/html,<html><body><h1>MCP Test Page</h1></body></html>",
    ];

    for (const url of testUrls) {
      console.log(`Testing MCP navigation to: ${url}`);

      await page.goto(url);
      await page.waitForLoadState("networkidle");

      // Capture state for each page
      const state = await page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
      }));

      console.log(`MCP State for ${url}:`, state);

      // Take screenshot for MCP analysis
      const urlSafe = url.replace(/[^a-zA-Z0-9]/g, "-");
      await page.screenshot({
        path: `e2e/screenshots/mcp-nav-${urlSafe}.png`,
      });
    }
  });

  test("MCP accessibility validation works", async () => {
    await page.goto("https://example.com");
    await page.waitForLoadState("networkidle");

    // Test accessibility features
    const a11yReport = await page.evaluate(() => {
      const report = {
        focusableElements: 0,
        headings: 0,
        links: 0,
        images: 0,
      };

      // Count focusable elements
      const focusableSelectors = [
        "input:not([disabled])",
        "button:not([disabled])",
        "a[href]",
        '[tabindex="0"]',
      ];

      focusableSelectors.forEach((selector) => {
        report.focusableElements += document.querySelectorAll(selector).length;
      });

      // Count other elements
      report.headings = document.querySelectorAll(
        "h1, h2, h3, h4, h5, h6"
      ).length;
      report.links = document.querySelectorAll("a[href]").length;
      report.images = document.querySelectorAll("img").length;

      return report;
    });

    console.log(
      "MCP Accessibility Report:",
      JSON.stringify(a11yReport, null, 2)
    );

    // Basic validation
    expect(a11yReport.headings).toBeGreaterThan(0);
    expect(a11yReport.links).toBeGreaterThan(0);
  });
});
