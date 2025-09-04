import { test, expect } from "@playwright/test";

test.describe("Spotlight Browser Extension E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a test page where the extension will be injected
    await page.goto("https://example.com");

    // Wait for the extension to be loaded
    await page.waitForTimeout(1000);
  });

  test.describe("Extension Activation", () => {
    test("should activate overlay with CMD+K", async ({ page }) => {
      // Press CMD+K to activate the spotlight overlay
      await page.keyboard.press("Meta+KeyK");

      // Wait for overlay to appear
      await page.waitForSelector(".spotlight-overlay", { timeout: 5000 });

      // Verify overlay is visible
      const overlay = page.locator(".spotlight-overlay");
      await expect(overlay).toBeVisible();

      // Verify search field is focused
      const searchInput = page.locator(".search-field-input");
      await expect(searchInput).toBeFocused();
    });

    test("should show initial workflows when overlay opens", async ({
      page,
    }) => {
      // Activate overlay
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Verify initial workflows are displayed
      await expect(page.locator("text=AI Ask")).toBeVisible();
      await expect(page.locator("text=AI Agent")).toBeVisible();
      await expect(page.locator("text=Close")).toBeVisible();

      // Verify first workflow is selected by default
      const firstWorkflow = page.locator(".workflow-item").first();
      await expect(firstWorkflow).toHaveClass(/workflow-item-selected/);
    });

    test("should close overlay with Escape key", async ({ page }) => {
      // Activate overlay
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Press Escape to close
      await page.keyboard.press("Escape");

      // Verify overlay is hidden
      await expect(page.locator(".spotlight-overlay")).not.toBeVisible();
    });
  });

  test.describe("Keyboard Navigation", () => {
    test("should navigate through workflows with arrow keys", async ({
      page,
    }) => {
      // Activate overlay
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Verify first item is selected
      let selectedItem = page.locator(".workflow-item-selected");
      await expect(selectedItem.locator(".workflow-item-name")).toHaveText(
        "AI Ask"
      );

      // Press arrow down to move to next item
      await page.keyboard.press("ArrowDown");

      // Verify second item is now selected
      selectedItem = page.locator(".workflow-item-selected");
      await expect(selectedItem.locator(".workflow-item-name")).toHaveText(
        "AI Agent"
      );

      // Press arrow down again
      await page.keyboard.press("ArrowDown");

      // Verify third item is selected
      selectedItem = page.locator(".workflow-item-selected");
      await expect(selectedItem.locator(".workflow-item-name")).toHaveText(
        "Close"
      );

      // Press arrow up to go back
      await page.keyboard.press("ArrowUp");

      // Verify we're back to second item
      selectedItem = page.locator(".workflow-item-selected");
      await expect(selectedItem.locator(".workflow-item-name")).toHaveText(
        "AI Agent"
      );
    });

    test("should wrap around when navigating past boundaries", async ({
      page,
    }) => {
      // Activate overlay
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Press arrow up from first item (should wrap to last)
      await page.keyboard.press("ArrowUp");

      // Verify last item is selected
      const selectedItem = page.locator(".workflow-item-selected");
      await expect(selectedItem.locator(".workflow-item-name")).toHaveText(
        "Close"
      );
    });

    test("should execute workflow with Enter key", async ({ page }) => {
      // Activate overlay
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Navigate to Close workflow
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");

      // Verify Close is selected
      const selectedItem = page.locator(".workflow-item-selected");
      await expect(selectedItem.locator(".workflow-item-name")).toHaveText(
        "Close"
      );

      // Press Enter to execute
      await page.keyboard.press("Enter");

      // Verify overlay closes (Close action)
      await expect(page.locator(".spotlight-overlay")).not.toBeVisible();
    });
  });

  test.describe("Mouse Interactions", () => {
    test("should select workflow on hover", async ({ page }) => {
      // Activate overlay
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Hover over second workflow
      const secondWorkflow = page.locator(".workflow-item").nth(1);
      await secondWorkflow.hover();

      // Verify it becomes selected
      await expect(secondWorkflow).toHaveClass(/workflow-item-selected/);
      await expect(secondWorkflow.locator(".workflow-item-name")).toHaveText(
        "AI Agent"
      );
    });

    test("should execute workflow on click", async ({ page }) => {
      // Activate overlay
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Click on Close workflow
      await page.locator("text=Close").click();

      // Verify overlay closes
      await expect(page.locator(".spotlight-overlay")).not.toBeVisible();
    });

    test("should close overlay when clicking outside", async ({ page }) => {
      // Activate overlay
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Click outside the overlay container
      await page.locator(".spotlight-overlay").click();

      // Verify overlay closes
      await expect(page.locator(".spotlight-overlay")).not.toBeVisible();
    });
  });

  test.describe("Chat Workflow Navigation", () => {
    test("should navigate to chat interface", async ({ page }) => {
      // Activate overlay
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Click on AI Ask workflow
      await page.locator("text=AI Ask").click();

      // Verify navigation to chat interface
      await expect(page.locator(".chat-interface")).toBeVisible();

      // Verify breadcrumb is shown
      await expect(page.locator(".search-field-prefix")).toHaveText("AI Ask:");

      // Verify chat input is available
      await expect(page.locator(".prompt-textarea")).toBeVisible();
      await expect(page.locator(".prompt-send-button")).toBeVisible();
    });

    test("should handle chat message input", async ({ page }) => {
      // Navigate to chat interface
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");
      await page.locator("text=AI Ask").click();
      await page.waitForSelector(".chat-interface");

      // Type a message
      const chatInput = page.locator(".prompt-textarea");
      await chatInput.fill("Hello, this is a test message");

      // Verify send button is enabled
      const sendButton = page.locator(".prompt-send-button");
      await expect(sendButton).not.toBeDisabled();

      // Send message with Enter key
      await chatInput.press("Enter");

      // Verify message appears in chat (mock response)
      await expect(page.locator(".message-user")).toBeVisible();
      await expect(
        page.locator("text=Hello, this is a test message")
      ).toBeVisible();
    });

    test("should handle back navigation from chat", async ({ page }) => {
      // Navigate to chat interface
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");
      await page.locator("text=AI Ask").click();
      await page.waitForSelector(".chat-interface");

      // Press Escape to go back
      await page.keyboard.press("Escape");

      // Verify we're back to workflow list
      await expect(page.locator(".workflow-list")).toBeVisible();
      await expect(page.locator("text=AI Ask")).toBeVisible();

      // Verify breadcrumb is cleared
      await expect(page.locator(".search-field-prefix")).not.toBeVisible();
    });
  });

  test.describe("Search Workflow Navigation", () => {
    test("should navigate to search interface", async ({ page }) => {
      // Activate overlay
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Navigate to search workflow (if available)
      const searchWorkflow = page.locator("text=Search");
      if (await searchWorkflow.isVisible()) {
        await searchWorkflow.click();

        // Verify navigation to search interface
        await expect(page.locator(".search-interface")).toBeVisible();

        // Verify search field is enabled
        const searchInput = page.locator(".search-field-input");
        await expect(searchInput).not.toBeDisabled();

        // Verify placeholder text
        await expect(searchInput).toHaveAttribute("placeholder", /search/i);
      }
    });

    test("should handle search input", async ({ page }) => {
      // Navigate to search interface (if available)
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      const searchWorkflow = page.locator("text=Search");
      if (await searchWorkflow.isVisible()) {
        await searchWorkflow.click();
        await page.waitForSelector(".search-interface");

        // Type in search field
        const searchInput = page.locator(".search-field-input");
        await searchInput.fill("test query");

        // Verify search results or placeholder updates
        await expect(page.locator(".search-interface")).toBeVisible();
      }
    });
  });

  test.describe("Form Workflow Navigation", () => {
    test("should navigate to form interface", async ({ page }) => {
      // This test would require a form workflow to be configured
      // For now, we'll test the general form interface behavior
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Look for any form-type workflow
      const formWorkflow = page
        .locator("text=Details")
        .or(page.locator("text=Form"));
      if (await formWorkflow.isVisible()) {
        await formWorkflow.click();

        // Verify form interface elements
        await expect(page.locator(".form-interface")).toBeVisible();

        // Verify form buttons
        await expect(page.locator(".form-button")).toBeVisible();
      }
    });
  });

  test.describe("Multi-step Workflow Navigation", () => {
    test("should handle complex workflow sequences", async ({ page }) => {
      // Test a complete workflow sequence
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Step 1: Navigate to a workflow
      await page.locator("text=AI Ask").click();
      await page.waitForSelector(".chat-interface");

      // Step 2: Verify breadcrumb
      await expect(page.locator(".search-field-prefix")).toHaveText("AI Ask:");

      // Step 3: Go back
      await page.keyboard.press("Escape");

      // Step 4: Verify we're back to initial state
      await expect(page.locator(".workflow-list")).toBeVisible();
      await expect(page.locator(".search-field-prefix")).not.toBeVisible();
    });

    test("should maintain state during navigation", async ({ page }) => {
      // Test that workflow state is maintained properly
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Navigate to chat
      await page.locator("text=AI Agent").click();
      await page.waitForSelector(".chat-interface");

      // Type something
      const chatInput = page.locator(".prompt-textarea");
      await chatInput.fill("Test message for state");

      // Go back
      await page.keyboard.press("Escape");
      await page.waitForSelector(".workflow-list");

      // Navigate back to chat
      await page.locator("text=AI Agent").click();
      await page.waitForSelector(".chat-interface");

      // Verify state is maintained (or reset as expected)
      const inputValue = await page.locator(".prompt-textarea").inputValue();
      // State should be reset on navigation
      expect(inputValue).toBe("");
    });
  });

  test.describe("Error Handling and Edge Cases", () => {
    test("should handle rapid key presses", async ({ page }) => {
      // Test rapid activation/deactivation
      await page.keyboard.press("Meta+KeyK");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Meta+KeyK");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Meta+KeyK");

      // Should still work correctly
      await page.waitForSelector(".spotlight-overlay");
      await expect(page.locator(".spotlight-overlay")).toBeVisible();
    });

    test("should handle window resize", async ({ page }) => {
      // Activate overlay
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Resize window
      await page.setViewportSize({ width: 800, height: 600 });

      // Verify overlay is still visible and functional
      await expect(page.locator(".spotlight-overlay")).toBeVisible();
      await expect(page.locator(".search-field-input")).toBeFocused();

      // Test navigation still works
      await page.keyboard.press("ArrowDown");
      const selectedItem = page.locator(".workflow-item-selected");
      await expect(selectedItem.locator(".workflow-item-name")).toHaveText(
        "AI Agent"
      );
    });

    test("should handle page navigation", async ({ page }) => {
      // Activate overlay
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Navigate to different page
      await page.goto("https://httpbin.org/html");

      // Wait for page load
      await page.waitForLoadState("networkidle");

      // Try to activate overlay again
      await page.keyboard.press("Meta+KeyK");

      // Should still work on new page
      await page.waitForSelector(".spotlight-overlay", { timeout: 5000 });
      await expect(page.locator(".spotlight-overlay")).toBeVisible();
    });

    test("should handle focus management", async ({ page }) => {
      // Create a focused input on the page
      await page.evaluate(() => {
        const input = document.createElement("input");
        input.id = "test-input";
        document.body.appendChild(input);
        input.focus();
      });

      // Verify the input is focused
      await expect(page.locator("#test-input")).toBeFocused();

      // Activate overlay
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Verify overlay search input is now focused
      await expect(page.locator(".search-field-input")).toBeFocused();

      // Close overlay
      await page.keyboard.press("Escape");

      // Verify focus returns to original input
      await expect(page.locator("#test-input")).toBeFocused();
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper ARIA attributes", async ({ page }) => {
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Check for proper ARIA attributes
      const workflowItems = page.locator(".workflow-item");
      await expect(workflowItems.first()).toHaveAttribute("role", "button");
      await expect(workflowItems.first()).toHaveAttribute("tabindex", "0");

      // Check search field accessibility
      const searchInput = page.locator(".search-field-input");
      await expect(searchInput).toHaveAttribute("autocomplete", "off");
      await expect(searchInput).toHaveAttribute("spellcheck", "false");
    });

    test("should support keyboard-only navigation", async ({ page }) => {
      // Test complete keyboard-only workflow
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Navigate using only keyboard
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");

      // Should execute the workflow (Close in this case)
      await expect(page.locator(".spotlight-overlay")).not.toBeVisible();
    });

    test("should have proper focus indicators", async ({ page }) => {
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      // Check that focused elements have visible focus indicators
      const selectedItem = page.locator(".workflow-item-selected");
      await expect(selectedItem).toBeVisible();

      // The selected item should have visual indication
      await expect(selectedItem).toHaveClass(/workflow-item-selected/);
    });
  });

  test.describe("Performance", () => {
    test("should activate quickly", async ({ page }) => {
      const startTime = Date.now();

      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");

      const endTime = Date.now();
      const activationTime = endTime - startTime;

      // Should activate within reasonable time (less than 1 second)
      expect(activationTime).toBeLessThan(1000);
    });

    test("should handle multiple rapid activations", async ({ page }) => {
      // Test performance under rapid activation/deactivation
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press("Meta+KeyK");
        await page.waitForSelector(".spotlight-overlay");
        await page.keyboard.press("Escape");
        await page.waitForSelector(".spotlight-overlay", { state: "hidden" });
      }

      // Final activation should still work
      await page.keyboard.press("Meta+KeyK");
      await page.waitForSelector(".spotlight-overlay");
      await expect(page.locator(".spotlight-overlay")).toBeVisible();
    });
  });
});
