import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import path from "path";

let context: BrowserContext;
let page: Page;

test.describe("Cross-Page Behavior E2E Tests", () => {
  test.beforeAll(async () => {
    // Launch browser with extension
    const pathToExtension = path.join(__dirname, "../build/chrome-mv3-prod");

    context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });

    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("Extension works on different website types", async () => {
    const testSites = [
      { url: "https://example.com", name: "Static HTML" },
      { url: "https://httpbin.org/html", name: "Simple HTML" },
      {
        url: "https://jsonplaceholder.typicode.com",
        name: "API Documentation",
      },
      { url: "https://www.wikipedia.org", name: "Complex Website" },
    ];

    for (const site of testSites) {
      console.log(`Testing on ${site.name}: ${site.url}`);

      try {
        await page.goto(site.url, { waitUntil: "networkidle", timeout: 10000 });
      } catch (error) {
        console.log(`Skipping ${site.name} due to network issues`);
        continue;
      }

      // Test CMD+K activation
      await page.keyboard.press("Meta+KeyK");

      // Verify overlay appears
      const overlay = page.locator('[data-testid="spotlight-overlay"]');
      await expect(overlay).toBeVisible({ timeout: 5000 });

      // Verify search field is focused
      const searchField = page.locator('[data-testid="search-field"]');
      await expect(searchField).toBeFocused();

      // Test basic navigation
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowUp");

      // Test workflow selection
      await page.keyboard.press("Enter");

      // Should navigate to chat interface
      const chatInterface = page.locator('[data-testid="chat-interface"]');
      await expect(chatInterface).toBeVisible();

      // Go back and close
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");

      // Verify overlay is closed
      await expect(overlay).not.toBeVisible();
    }
  });

  test("Extension persists across page navigation", async () => {
    // Start on one page
    await page.goto("https://example.com");
    await page.waitForLoadState("networkidle");

    // Test extension works
    await page.keyboard.press("Meta+KeyK");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // Navigate to different page
    await page.goto("https://httpbin.org/html");
    await page.waitForLoadState("networkidle");

    // Test extension still works
    await page.keyboard.press("Meta+KeyK");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // Navigate back
    await page.goBack();
    await page.waitForLoadState("networkidle");

    // Test extension still works
    await page.keyboard.press("Meta+KeyK");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("Extension works in new tabs", async () => {
    // Open new tab
    const newPage = await context.newPage();

    try {
      await newPage.goto("https://example.com");
      await newPage.waitForLoadState("networkidle");

      // Test extension in new tab
      await newPage.keyboard.press("Meta+KeyK");
      await expect(
        newPage.locator('[data-testid="spotlight-overlay"]')
      ).toBeVisible();

      // Test workflow navigation
      await newPage.keyboard.press("Enter");
      await expect(
        newPage.locator('[data-testid="chat-interface"]')
      ).toBeVisible();

      // Close overlay
      await newPage.keyboard.press("Escape");
      await newPage.keyboard.press("Escape");

      // Test in original tab
      await page.bringToFront();
      await page.keyboard.press("Meta+KeyK");
      await expect(
        page.locator('[data-testid="spotlight-overlay"]')
      ).toBeVisible();
      await page.keyboard.press("Escape");
    } finally {
      await newPage.close();
    }
  });

  test("Extension handles dynamic content pages", async () => {
    // Test on a page with dynamic content
    await page.goto("https://jsonplaceholder.typicode.com");
    await page.waitForLoadState("networkidle");

    // Wait for any dynamic content to load
    await page.waitForTimeout(2000);

    // Test extension activation
    await page.keyboard.press("Meta+KeyK");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();

    // Test that overlay is properly positioned over dynamic content
    const overlay = page.locator('[data-testid="spotlight-overlay"]');
    const overlayBox = await overlay.boundingBox();

    expect(overlayBox).toBeTruthy();
    if (overlayBox) {
      expect(overlayBox.y).toBeGreaterThan(0);
      expect(overlayBox.x).toBeGreaterThan(0);
    }

    // Test interaction still works
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();

    // Close
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });

  test("Extension handles iframe content", async () => {
    // Create a test page with iframe
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><title>Iframe Test</title></head>
      <body>
        <h1>Main Page</h1>
        <iframe src="https://example.com" width="500" height="300"></iframe>
      </body>
      </html>
    `;

    // Navigate to data URL with iframe
    await page.goto(`data:text/html,${encodeURIComponent(htmlContent)}`);
    await page.waitForLoadState("networkidle");

    // Test extension works on main page
    await page.keyboard.press("Meta+KeyK");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // Click inside iframe
    const iframe = page.frameLocator("iframe");
    await iframe.locator("body").click();

    // Test extension still works after iframe interaction
    await page.keyboard.press("Meta+KeyK");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("Extension state isolation between tabs", async () => {
    // Open extension in first tab
    await page.keyboard.press("Meta+KeyK");
    await page.keyboard.press("Enter"); // Go to AI Ask
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();

    // Open new tab
    const newPage = await context.newPage();

    try {
      await newPage.goto("https://example.com");
      await newPage.waitForLoadState("networkidle");

      // Open extension in new tab - should start fresh
      await newPage.keyboard.press("Meta+KeyK");
      await expect(
        newPage.locator('[data-testid="workflow-list"]')
      ).toBeVisible();

      // Should not show chat interface (state should be isolated)
      const chatInterface = newPage.locator('[data-testid="chat-interface"]');
      await expect(chatInterface).not.toBeVisible();

      // Go back to first tab - should maintain state
      await page.bringToFront();
      await expect(
        page.locator('[data-testid="chat-interface"]')
      ).toBeVisible();
    } finally {
      await newPage.close();
    }

    // Clean up first tab
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });

  test("Extension handles page refresh", async () => {
    await page.goto("https://example.com");
    await page.waitForLoadState("networkidle");

    // Open extension and navigate to chat
    await page.keyboard.press("Meta+KeyK");
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();

    // Refresh page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Extension should work again (state should reset)
    await page.keyboard.press("Meta+KeyK");
    await expect(page.locator('[data-testid="workflow-list"]')).toBeVisible();

    // Should not show chat interface (state should be reset)
    const chatInterface = page.locator('[data-testid="chat-interface"]');
    await expect(chatInterface).not.toBeVisible();

    await page.keyboard.press("Escape");
  });

  test("Extension performance on heavy pages", async () => {
    // Test on a page that might have heavy JavaScript
    await page.goto("https://www.wikipedia.org");
    await page.waitForLoadState("networkidle");

    // Wait for page to fully load
    await page.waitForTimeout(3000);

    // Measure activation time
    const startTime = Date.now();
    await page.keyboard.press("Meta+KeyK");

    const overlay = page.locator('[data-testid="spotlight-overlay"]');
    await expect(overlay).toBeVisible();

    const endTime = Date.now();
    const activationTime = endTime - startTime;

    // Should activate within reasonable time (less than 1 second)
    expect(activationTime).toBeLessThan(1000);

    // Test responsiveness
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");

    // Should respond quickly
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();

    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });
});
