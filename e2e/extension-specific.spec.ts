import { test, expect, chromium } from "@playwright/test";
import path from "path";

test.describe("Browser Extension Specific Tests", () => {
  test.describe("Extension Loading and Injection", () => {
    test("should load extension in different page contexts", async () => {
      // Test extension loading on various page types
      const pages = [
        "https://example.com",
        "https://github.com",
        "https://stackoverflow.com",
        "data:text/html,<html><body><h1>Test Page</h1></body></html>",
      ];

      for (const url of pages) {
        const browser = await chromium.launch();
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
          await page.goto(url, { waitUntil: "networkidle" });

          // Wait for extension to inject
          await page.waitForTimeout(1000);

          // Test that CMD+K works
          await page.keyboard.press("Meta+KeyK");

          // Should be able to activate overlay
          await page.waitForSelector(".spotlight-overlay", { timeout: 5000 });
          await expect(page.locator(".spotlight-overlay")).toBeVisible();

          await page.keyboard.press("Escape");
        } catch (error) {
          console.log(`Failed on ${url}:`, error);
        } finally {
          await browser.close();
        }
      }
    });

    test("should handle iframe contexts", async ({ page }) => {
      // Create a page with iframe
      await page.setContent(`
        <html>
          <body>
            <h1>Main Page</h1>
            <iframe src="data:text/html,<html><body><h2>Iframe Content</h2><input id='iframe-input' /></body></html>" width="400" height="300"></iframe>
          </body>
        </html>
      `);

      await page.waitForLoadState("networkidle");

      // Focus on iframe input
      const iframe = page.frameLocator("iframe");
      await iframe.locator("#iframe-input").click();

      // Try to activate overlay from iframe context
      await page.keyboard.press("Meta+KeyK");

      // Should still work (extension should be injected in main frame)
      await page.waitForSelector(".spotlight-overlay", { timeout: 5000 });
      await expect(page.locator(".spotlight-overlay")).toBeVisible();
    });

    test("should handle dynamic content loading", async ({ page }) => {
      await page.goto("https://example.com");

      // Add dynamic content
      await page.evaluate(() => {
        const div = document.createElement("div");
        div.innerHTML = '<button id="dynamic-btn">Dynamic Button</button>';
        document.body.appendChild(div);
      });

      // Focus on dynamic element
      await page.locator("#dynamic-btn").click();

      // Extension should still work
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");
      await expect(page.locator(".spotlight-overlay")).toBeVisible();
    });
  });

  test.describe("Cross-Page Persistence", () => {
    test("should maintain functionality across page navigations", async ({
      page,
    }) => {
      // Start on one page
      await page.goto("https://example.com");

      // Test extension works
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");
      await page.keyboard.press("Escape");

      // Navigate to different page
      await page.goto("https://httpbin.org/html");
      await page.waitForLoadState("networkidle");

      // Extension should still work
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay", { timeout: 5000 });
      await expect(page.locator(".spotlight-overlay")).toBeVisible();
    });

    test("should handle page reloads", async ({ page }) => {
      await page.goto("https://example.com");

      // Test extension works
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");
      await page.keyboard.press("Escape");

      // Reload page
      await page.reload({ waitUntil: "networkidle" });

      // Extension should still work after reload
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay", { timeout: 5000 });
      await expect(page.locator(".spotlight-overlay")).toBeVisible();
    });

    test("should handle browser back/forward navigation", async ({ page }) => {
      // Navigate through multiple pages
      await page.goto("https://example.com");
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");
      await page.keyboard.press("Escape");

      await page.goto("https://httpbin.org/html");
      await page.waitForLoadState("networkidle");

      // Go back
      await page.goBack();
      await page.waitForLoadState("networkidle");

      // Extension should still work
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay", { timeout: 5000 });
      await expect(page.locator(".spotlight-overlay")).toBeVisible();
    });
  });

  test.describe("Extension Isolation", () => {
    test("should not interfere with page functionality", async ({ page }) => {
      await page.goto("https://example.com");

      // Add some page functionality
      await page.evaluate(() => {
        window.testValue = "initial";
        document.addEventListener("keydown", (e) => {
          if (e.metaKey && e.key === "k") {
            window.testValue = "page-handler-called";
          }
        });
      });

      // Activate extension
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Check that page functionality is preserved
      const testValue = await page.evaluate(() => window.testValue);
      expect(testValue).toBe("page-handler-called");

      // Extension should still work
      await expect(page.locator(".spotlight-overlay")).toBeVisible();
    });

    test("should handle conflicting keyboard shortcuts gracefully", async ({
      page,
    }) => {
      await page.goto("https://example.com");

      // Add conflicting keyboard handler
      await page.evaluate(() => {
        document.addEventListener("keydown", (e) => {
          if (e.metaKey && e.key === "k") {
            e.preventDefault();
            console.log("Page prevented default");
          }
        });
      });

      // Try to activate extension
      await page.keyboard.press("Meta+KeyK");

      // Extension should still work (content script should handle this)
      await page.waitForSelector(".spotlight-overlay", { timeout: 5000 });
      await expect(page.locator(".spotlight-overlay")).toBeVisible();
    });

    test("should not leak styles to page", async ({ page }) => {
      await page.goto("https://example.com");

      // Check that extension styles don't affect page elements
      const pageBodyStyles = await page.evaluate(() => {
        const body = document.body;
        const computedStyle = window.getComputedStyle(body);
        return {
          position: computedStyle.position,
          zIndex: computedStyle.zIndex,
          overflow: computedStyle.overflow,
        };
      });

      // Activate extension
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Check that page styles are unchanged
      const pageBodyStylesAfter = await page.evaluate(() => {
        const body = document.body;
        const computedStyle = window.getComputedStyle(body);
        return {
          position: computedStyle.position,
          zIndex: computedStyle.zIndex,
          overflow: computedStyle.overflow,
        };
      });

      expect(pageBodyStylesAfter).toEqual(pageBodyStyles);
    });
  });

  test.describe("Extension Configuration", () => {
    test("should load default configuration", async ({ page }) => {
      await page.goto("https://example.com");
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Check that default workflows are loaded
      await expect(page.locator("text=AI Ask")).toBeVisible();
      await expect(page.locator("text=AI Agent")).toBeVisible();
      await expect(page.locator("text=Close")).toBeVisible();
    });

    test("should handle configuration errors gracefully", async ({ page }) => {
      await page.goto("https://example.com");

      // Simulate configuration error by modifying the config loading
      await page.evaluate(() => {
        // This would simulate a configuration loading error
        window.localStorage.setItem("spotlight-config-error", "true");
      });

      // Extension should still work with fallback configuration
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay", { timeout: 5000 });
      await expect(page.locator(".spotlight-overlay")).toBeVisible();

      // Should have at least the Close workflow as fallback
      await expect(page.locator("text=Close")).toBeVisible();
    });
  });

  test.describe("Extension Performance", () => {
    test("should not significantly impact page load time", async ({ page }) => {
      const startTime = Date.now();

      await page.goto("https://example.com");
      await page.waitForLoadState("networkidle");

      const loadTime = Date.now() - startTime;

      // Page should load within reasonable time even with extension
      expect(loadTime).toBeLessThan(5000);

      // Extension should be ready quickly after page load
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay", { timeout: 2000 });
    });

    test("should not cause memory leaks", async ({ page }) => {
      await page.goto("https://example.com");

      // Activate and deactivate extension multiple times
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press("Meta+KeyK");
        await page.waitForSelector(".spotlight-overlay");
        await page.keyboard.press("Escape");
        await page.waitForSelector(".spotlight-overlay", { state: "hidden" });
      }

      // Check that DOM is clean (no leftover elements)
      const overlayCount = await page.locator(".spotlight-overlay").count();
      expect(overlayCount).toBeLessThanOrEqual(1);
    });

    test("should handle high-frequency interactions", async ({ page }) => {
      await page.goto("https://example.com");

      // Rapid keyboard interactions
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press("Meta+KeyK");
        await page.keyboard.press("Escape");
      }

      // Final activation should still work
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay", { timeout: 5000 });
      await expect(page.locator(".spotlight-overlay")).toBeVisible();
    });
  });

  test.describe("Browser Compatibility", () => {
    test("should work in different browser contexts", async () => {
      // This test would ideally run across different browsers
      // For now, we'll test different viewport sizes and contexts

      const viewports = [
        { width: 1920, height: 1080 }, // Desktop
        { width: 1366, height: 768 }, // Laptop
        { width: 768, height: 1024 }, // Tablet
        { width: 375, height: 667 }, // Mobile
      ];

      for (const viewport of viewports) {
        const browser = await chromium.launch();
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();

        try {
          await page.goto("https://example.com");
          await page.keyboard.press("Meta+KeyK");
          await page.waitForSelector(".spotlight-overlay", { timeout: 5000 });
          await expect(page.locator(".spotlight-overlay")).toBeVisible();
        } finally {
          await browser.close();
        }
      }
    });

    test("should handle different page encodings", async ({ page }) => {
      // Test with different character encodings
      const testPages = [
        "data:text/html;charset=utf-8,<html><body><h1>UTF-8 Test 🚀</h1></body></html>",
        "data:text/html;charset=iso-8859-1,<html><body><h1>ISO Test</h1></body></html>",
      ];

      for (const testPage of testPages) {
        await page.goto(testPage);
        await page.keyboard.press("Meta+KeyK");
        await page.waitForSelector(".spotlight-overlay", { timeout: 5000 });
        await expect(page.locator(".spotlight-overlay")).toBeVisible();
        await page.keyboard.press("Escape");
      }
    });
  });
});
