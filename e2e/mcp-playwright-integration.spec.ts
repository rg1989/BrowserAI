import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { SpotlightTestUtils, TestData, TestConfig } from "./helpers/test-utils";
import path from "path";

test.describe("MCP Playwright Integration Tests", () => {
  let context: BrowserContext;
  let page: Page;
  let spotlightUtils: SpotlightTestUtils;

  test.beforeAll(async () => {
    // Launch browser with extension using MCP-compatible setup
    const pathToExtension = path.join(__dirname, "../build/chrome-mv3-prod");

    context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security", // For MCP testing
        "--disable-features=VizDisplayCompositor", // Better MCP compatibility
      ],
    });

    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    spotlightUtils = await SpotlightTestUtils.setupTestPage(page);
  });

  test.describe("Core Extension Functionality", () => {
    test("should activate and display overlay with proper structure", async ({
      page,
    }) => {
      // Use MCP Playwright tools to take initial screenshot
      await page.goto("https://example.com");

      // Take screenshot before activation
      const beforeScreenshot = await page.screenshot({
        path: "e2e/screenshots/before-activation.png",
      });

      // Activate spotlight
      await spotlightUtils.activateSpotlight();

      // Take screenshot after activation
      const afterScreenshot = await page.screenshot({
        path: "e2e/screenshots/after-activation.png",
      });

      // Verify overlay structure
      await spotlightUtils.verifyDefaultWorkflows();

      // Verify accessibility
      await spotlightUtils.verifyAccessibility();

      // Test performance
      const activationTime = await spotlightUtils.measureActivationTime();
      expect(activationTime).toBeLessThan(TestConfig.MAX_ACTIVATION_TIME);
    });

    test("should handle complete keyboard navigation workflow", async ({
      page,
    }) => {
      await spotlightUtils.activateSpotlight();

      // Test comprehensive keyboard navigation
      await spotlightUtils.testKeyboardNavigation();

      // Test workflow execution via keyboard
      await spotlightUtils.navigateWithKeyboard("down", 2); // Navigate to Close
      const selectedWorkflow = await spotlightUtils.getSelectedWorkflowName();
      expect(selectedWorkflow).toBe("Close");

      // Execute with Enter
      await page.keyboard.press("Enter");

      // Verify execution (Close should close overlay)
      expect(await spotlightUtils.isOverlayVisible()).toBe(false);
    });

    test("should handle rapid interactions without performance degradation", async ({
      page,
    }) => {
      // Test rapid interactions
      await spotlightUtils.testRapidInteractions(
        TestConfig.RAPID_INTERACTION_COUNT
      );

      // Verify final state is correct
      await spotlightUtils.verifyDefaultWorkflows();
    });
  });

  test.describe("Chat Workflow E2E", () => {
    test("should complete full chat workflow with message handling", async ({
      page,
    }) => {
      // Navigate to chat
      await spotlightUtils.navigateToWorkflow("AI Ask");

      // Verify chat interface
      expect(await spotlightUtils.isInWorkflowInterface("chat")).toBe(true);

      // Verify breadcrumb
      const breadcrumb = await spotlightUtils.getBreadcrumbText();
      expect(breadcrumb).toBe("AI Ask:");

      // Send multiple messages
      for (const message of TestData.TEST_MESSAGES.slice(0, 2)) {
        await spotlightUtils.sendChatMessage(message);

        // Verify message appears
        await expect(page.locator(`text=${message}`)).toBeVisible();
      }

      // Test message history
      const userMessages = page.locator(".message-user");
      await expect(userMessages).toHaveCount(2);

      // Test back navigation
      await page.keyboard.press("Escape");
      await expect(page.locator(".workflow-list")).toBeVisible();
    });

    test("should handle chat input validation and edge cases", async ({
      page,
    }) => {
      await spotlightUtils.navigateToWorkflow("AI Ask");

      const chatInput = page.locator(".prompt-textarea");
      const sendButton = page.locator(".prompt-send-button");

      // Test empty message
      await expect(sendButton).toBeDisabled();

      // Test whitespace only
      await chatInput.fill("   ");
      await expect(sendButton).toBeDisabled();

      // Test valid message
      await chatInput.fill("Valid message");
      await expect(sendButton).not.toBeDisabled();

      // Test very long message
      const longMessage = "A".repeat(1500);
      await chatInput.fill(longMessage);
      await expect(sendButton).not.toBeDisabled();

      // Test special characters and emoji
      await chatInput.fill("Special chars: @#$%^&*() 🚀 emoji test");
      await expect(sendButton).not.toBeDisabled();

      // Send the message
      await chatInput.press("Enter");
      await expect(
        page.locator("text=Special chars: @#$%^&*() 🚀 emoji test")
      ).toBeVisible();
    });

    test("should handle keyboard shortcuts in chat", async ({ page }) => {
      await spotlightUtils.navigateToWorkflow("AI Agent");

      const chatInput = page.locator(".prompt-textarea");

      // Test Enter to send
      await chatInput.fill("Test Enter key");
      await chatInput.press("Enter");
      await expect(page.locator("text=Test Enter key")).toBeVisible();

      // Test Shift+Enter for new line
      await chatInput.fill("Line 1");
      await chatInput.press("Shift+Enter");
      await chatInput.type("Line 2");

      const inputValue = await chatInput.inputValue();
      expect(inputValue).toContain("\n");
      expect(inputValue).toContain("Line 1");
      expect(inputValue).toContain("Line 2");
    });
  });

  test.describe("Search Workflow E2E", () => {
    test("should handle search workflow if configured", async ({ page }) => {
      await spotlightUtils.activateSpotlight();

      // Look for search workflows
      const searchWorkflow = page
        .locator("text=Search")
        .or(page.locator('[data-workflow-type="search"]'));

      if (await searchWorkflow.isVisible()) {
        await searchWorkflow.click();

        // Verify search interface
        expect(await spotlightUtils.isInWorkflowInterface("search")).toBe(true);

        // Test search functionality
        for (const query of TestData.TEST_SEARCH_QUERIES.slice(0, 2)) {
          await spotlightUtils.performSearch(query);

          // Verify search interface responds
          await expect(page.locator(".search-interface")).toBeVisible();
        }
      }
    });
  });

  test.describe("Multi-step Navigation E2E", () => {
    test("should handle complex multi-step workflow sequences", async ({
      page,
    }) => {
      // Test complete workflow sequence
      await spotlightUtils.activateSpotlight();

      // Step 1: Navigate to AI Ask
      await spotlightUtils.navigateToWorkflow("AI Ask");
      expect(await spotlightUtils.getBreadcrumbText()).toBe("AI Ask:");

      // Step 2: Send a message
      await spotlightUtils.sendChatMessage("Hello from E2E test");

      // Step 3: Navigate back
      await page.keyboard.press("Escape");
      await expect(page.locator(".workflow-list")).toBeVisible();

      // Step 4: Navigate to different workflow
      await spotlightUtils.navigateToWorkflow("AI Agent");
      expect(await spotlightUtils.getBreadcrumbText()).toBe("AI Agent:");

      // Step 5: Verify state is independent
      const chatInput = page.locator(".prompt-textarea");
      const inputValue = await chatInput.inputValue();
      expect(inputValue).toBe(""); // Should be clean state
    });

    test("should maintain proper breadcrumb navigation", async ({ page }) => {
      await spotlightUtils.activateSpotlight();

      // Test breadcrumb updates
      expect(await spotlightUtils.getBreadcrumbText()).toBe("");

      await spotlightUtils.navigateToWorkflow("AI Ask");
      expect(await spotlightUtils.getBreadcrumbText()).toBe("AI Ask:");

      await page.keyboard.press("Escape");
      expect(await spotlightUtils.getBreadcrumbText()).toBe("");
    });
  });

  test.describe("Error Handling E2E", () => {
    test("should handle network errors gracefully", async ({ page }) => {
      // Simulate network issues
      await spotlightUtils.simulateNetworkError();

      await spotlightUtils.navigateToWorkflow("AI Ask");

      // Try to send message with network error
      await spotlightUtils.sendChatMessage("This should handle network error");

      // Should show user message even if AI response fails
      await expect(
        page.locator("text=This should handle network error")
      ).toBeVisible();

      // Clear network simulation
      await spotlightUtils.clearNetworkSimulation();
    });

    test("should recover from errors and continue functioning", async ({
      page,
    }) => {
      await spotlightUtils.activateSpotlight();

      // Cause an error by trying invalid operations
      await page.evaluate(() => {
        // Simulate error condition
        window.dispatchEvent(new Error("Test error"));
      });

      // Extension should still work
      await spotlightUtils.verifyDefaultWorkflows();

      // Navigation should still work
      await spotlightUtils.navigateWithKeyboard("down");
      const selected = await spotlightUtils.getSelectedWorkflowName();
      expect(TestData.DEFAULT_WORKFLOWS).toContain(selected);
    });
  });

  test.describe("Cross-Browser Compatibility", () => {
    test("should work consistently across different page types", async ({
      page,
    }) => {
      // Test on different page types
      for (const url of TestData.TEST_URLS.slice(0, 2)) {
        await page.goto(url);
        await page.waitForLoadState("networkidle");

        // Test activation
        const activationTime = await spotlightUtils.measureActivationTime();
        expect(activationTime).toBeLessThan(TestConfig.MAX_ACTIVATION_TIME);

        // Test basic functionality
        await spotlightUtils.verifyDefaultWorkflows();

        // Test navigation
        await spotlightUtils.navigateWithKeyboard("down");
        const selected = await spotlightUtils.getSelectedWorkflowName();
        expect(TestData.DEFAULT_WORKFLOWS).toContain(selected);

        await spotlightUtils.closeSpotlight();
      }
    });

    test("should handle different viewport sizes", async ({ page }) => {
      const viewports = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 768, height: 1024 },
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);

        await spotlightUtils.activateSpotlight();
        await spotlightUtils.verifyDefaultWorkflows();

        // Test that overlay is properly positioned
        const overlay = page.locator(".spotlight-overlay");
        const boundingBox = await overlay.boundingBox();

        expect(boundingBox).toBeTruthy();
        expect(boundingBox!.width).toBeGreaterThan(0);
        expect(boundingBox!.height).toBeGreaterThan(0);

        await spotlightUtils.closeSpotlight();
      }
    });
  });

  test.describe("Extension Lifecycle", () => {
    test("should handle extension enable/disable scenarios", async ({
      page,
    }) => {
      await page.goto("https://example.com");

      // Test normal operation
      await spotlightUtils.activateSpotlight();
      await spotlightUtils.verifyDefaultWorkflows();
      await spotlightUtils.closeSpotlight();

      // Simulate extension disable/enable (if possible)
      // This would require browser extension API access

      // Test that extension recovers properly
      await spotlightUtils.activateSpotlight();
      await spotlightUtils.verifyDefaultWorkflows();
    });

    test("should handle page lifecycle events", async ({ page }) => {
      await page.goto("https://example.com");

      // Test visibility change
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          value: "hidden",
          writable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Extension should still work when page becomes visible again
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          value: "visible",
          writable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      await spotlightUtils.activateSpotlight();
      await spotlightUtils.verifyDefaultWorkflows();
    });
  });

  test.describe("Integration with Page Content", () => {
    test("should not interfere with page form inputs", async ({ page }) => {
      // Create a page with form inputs
      await page.setContent(`
        <html>
          <body>
            <form>
              <input id="page-input" type="text" placeholder="Page input" />
              <textarea id="page-textarea" placeholder="Page textarea"></textarea>
              <button type="submit">Submit</button>
            </form>
          </body>
        </html>
      `);

      // Focus on page input
      await page.locator("#page-input").click();
      await page.locator("#page-input").fill("Page content");

      // Activate extension
      await spotlightUtils.activateSpotlight();

      // Extension should be active
      await expect(page.locator(".spotlight-overlay")).toBeVisible();

      // Close extension
      await spotlightUtils.closeSpotlight();

      // Page input should retain its value
      await expect(page.locator("#page-input")).toHaveValue("Page content");

      // Page input should be focused again
      await expect(page.locator("#page-input")).toBeFocused();
    });

    test("should handle page with existing keyboard shortcuts", async ({
      page,
    }) => {
      await page.setContent(`
        <html>
          <body>
            <div id="output">No shortcuts pressed</div>
            <script>
              document.addEventListener('keydown', (e) => {
                if (e.metaKey && e.key === 'k') {
                  document.getElementById('output').textContent = 'Page shortcut triggered';
                }
                if (e.key === 'Escape') {
                  document.getElementById('output').textContent = 'Page escape triggered';
                }
              });
            </script>
          </body>
        </html>
      `);

      // Test that extension shortcuts work alongside page shortcuts
      await spotlightUtils.activateSpotlight();

      // Extension should be active
      await expect(page.locator(".spotlight-overlay")).toBeVisible();

      // Page shortcut might also be triggered
      const output = await page.locator("#output").textContent();
      expect(output).toContain("triggered");

      // Extension Escape should work
      await page.keyboard.press("Escape");
      await expect(page.locator(".spotlight-overlay")).not.toBeVisible();
    });

    test("should preserve page scroll position", async ({ page }) => {
      // Create a long page
      await page.setContent(`
        <html>
          <body style="height: 3000px;">
            <div style="height: 1000px; background: red;">Top section</div>
            <div id="middle" style="height: 1000px; background: blue;">Middle section</div>
            <div style="height: 1000px; background: green;">Bottom section</div>
          </body>
        </html>
      `);

      // Scroll to middle
      await page.locator("#middle").scrollIntoViewIfNeeded();
      const scrollPosition = await page.evaluate(() => window.scrollY);

      // Activate extension
      await spotlightUtils.activateSpotlight();

      // Close extension
      await spotlightUtils.closeSpotlight();

      // Scroll position should be preserved
      const newScrollPosition = await page.evaluate(() => window.scrollY);
      expect(newScrollPosition).toBe(scrollPosition);
    });
  });

  test.describe("Extension State Management", () => {
    test("should maintain state across page navigations", async ({ page }) => {
      await page.goto("https://example.com");

      // Activate and test
      await spotlightUtils.activateSpotlight();
      await spotlightUtils.navigateToWorkflow("AI Ask");
      await spotlightUtils.sendChatMessage("Test message before navigation");

      // Navigate to different page
      await page.goto("https://httpbin.org/html");
      await page.waitForLoadState("networkidle");

      // Extension should work on new page
      await spotlightUtils.activateSpotlight();
      await spotlightUtils.verifyDefaultWorkflows();

      // State should be reset (new page context)
      await spotlightUtils.navigateToWorkflow("AI Ask");
      const chatInput = page.locator(".prompt-textarea");
      const inputValue = await chatInput.inputValue();
      expect(inputValue).toBe("");
    });

    test("should handle browser refresh correctly", async ({ page }) => {
      await page.goto("https://example.com");

      // Test before refresh
      await spotlightUtils.activateSpotlight();
      await spotlightUtils.verifyDefaultWorkflows();
      await spotlightUtils.closeSpotlight();

      // Refresh page
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(1000);

      // Test after refresh
      await spotlightUtils.activateSpotlight();
      await spotlightUtils.verifyDefaultWorkflows();
    });
  });

  test.describe("Accessibility E2E", () => {
    test("should support complete keyboard-only workflow", async ({ page }) => {
      // Complete workflow using only keyboard
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Navigate to AI Ask using keyboard
      await page.keyboard.press("ArrowDown"); // Should be on AI Agent
      await page.keyboard.press("ArrowUp"); // Back to AI Ask
      await page.keyboard.press("Enter"); // Select AI Ask

      // Should be in chat interface
      await page.waitForSelector(".chat-interface");

      // Send message using keyboard
      await page.keyboard.type("Keyboard only message");
      await page.keyboard.press("Enter");

      // Verify message sent
      await expect(page.locator("text=Keyboard only message")).toBeVisible();

      // Navigate back using keyboard
      await page.keyboard.press("Escape");
      await expect(page.locator(".workflow-list")).toBeVisible();

      // Close using keyboard
      await page.keyboard.press("Escape");
      await expect(page.locator(".spotlight-overlay")).not.toBeVisible();
    });

    test("should have proper focus management throughout workflow", async ({
      page,
    }) => {
      // Create focusable element on page
      await page.evaluate(() => {
        const input = document.createElement("input");
        input.id = "page-focus-test";
        input.value = "original focus";
        document.body.appendChild(input);
        input.focus();
      });

      // Verify page element is focused
      await expect(page.locator("#page-focus-test")).toBeFocused();

      // Activate extension
      await spotlightUtils.activateSpotlight();

      // Extension search should be focused
      await expect(page.locator(".search-field-input")).toBeFocused();

      // Navigate to chat
      await spotlightUtils.navigateToWorkflow("AI Ask");

      // Chat input should be focused
      await expect(page.locator(".prompt-textarea")).toBeFocused();

      // Navigate back to list
      await page.keyboard.press("Escape");

      // Search should be focused again
      await expect(page.locator(".search-field-input")).toBeFocused();

      // Close extension
      await page.keyboard.press("Escape");

      // Original page element should be focused
      await expect(page.locator("#page-focus-test")).toBeFocused();
    });

    test("should support screen reader navigation patterns", async ({
      page,
    }) => {
      await spotlightUtils.activateSpotlight();

      // Verify ARIA attributes for screen readers
      await spotlightUtils.verifyAccessibility();

      // Test that all interactive elements are properly labeled
      const workflowItems = page.locator(".workflow-item");
      const count = await workflowItems.count();

      for (let i = 0; i < count; i++) {
        const item = workflowItems.nth(i);

        // Should have accessible name
        const name = await item.locator(".workflow-item-name").textContent();
        expect(name).toBeTruthy();

        // Should be keyboard accessible
        await expect(item).toHaveAttribute("tabindex", "0");
        await expect(item).toHaveAttribute("role", "button");
      }
    });
  });

  test.describe("Performance and Reliability E2E", () => {
    test("should maintain performance under stress", async ({ page }) => {
      await page.goto("https://example.com");

      // Stress test with rapid operations
      const operations = [];

      for (let i = 0; i < 20; i++) {
        operations.push(async () => {
          await spotlightUtils.activateSpotlight();
          await spotlightUtils.navigateWithKeyboard(
            "down",
            Math.floor(Math.random() * 3)
          );
          await spotlightUtils.closeSpotlight();
        });
      }

      // Run operations in sequence
      for (const operation of operations) {
        await operation();
      }

      // Final test should still work perfectly
      const finalActivationTime = await spotlightUtils.measureActivationTime();
      expect(finalActivationTime).toBeLessThan(TestConfig.MAX_ACTIVATION_TIME);
    });

    test("should handle memory pressure gracefully", async ({ page }) => {
      await page.goto("https://example.com");

      // Create memory pressure
      await page.evaluate(() => {
        const arrays = [];
        for (let i = 0; i < 100; i++) {
          arrays.push(new Array(10000).fill("memory-test"));
        }
        window.memoryTestArrays = arrays;
      });

      // Extension should still work under memory pressure
      await spotlightUtils.activateSpotlight();
      await spotlightUtils.verifyDefaultWorkflows();

      // Navigation should still be responsive
      await spotlightUtils.testKeyboardNavigation();

      // Cleanup
      await page.evaluate(() => {
        delete window.memoryTestArrays;
      });
    });
  });
});
