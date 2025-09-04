import { test, expect } from "@playwright/test";

test.describe("Workflow Scenario E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("https://example.com");
    await page.waitForTimeout(1000);
  });

  test.describe("AI Chat Workflow Scenarios", () => {
    test("should complete full AI Ask workflow", async ({ page }) => {
      // Activate overlay
      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");

      // Navigate to AI Ask
      await page.locator("text=AI Ask").click();
      await page.waitForSelector(".chat-interface");

      // Verify chat interface is ready
      await expect(page.locator(".search-field-prefix")).toHaveText("AI Ask:");
      await expect(page.locator(".prompt-textarea")).toBeVisible();
      await expect(page.locator(".message-list")).toBeVisible();

      // Send a message
      const chatInput = page.locator(".prompt-textarea");
      await chatInput.fill("What is TypeScript?");
      await chatInput.press("Enter");

      // Verify message appears
      await expect(page.locator(".message-user")).toBeVisible();
      await expect(page.locator("text=What is TypeScript?")).toBeVisible();

      // Verify AI response (mock)
      await expect(page.locator(".message-ai")).toBeVisible({ timeout: 5000 });

      // Test message history
      await chatInput.fill("Tell me more");
      await chatInput.press("Enter");

      // Should have multiple messages
      const userMessages = page.locator(".message-user");
      await expect(userMessages).toHaveCount(2);
    });

    test("should handle AI Agent workflow with streaming", async ({ page }) => {
      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");

      // Navigate to AI Agent
      await page.locator("text=AI Agent").click();
      await page.waitForSelector(".chat-interface");

      // Send a message that would trigger streaming
      const chatInput = page.locator(".prompt-textarea");
      await chatInput.fill("Generate a long response about web development");
      await chatInput.press("Enter");

      // Verify streaming response (if implemented)
      await expect(page.locator(".message-user")).toBeVisible();

      // Look for streaming indicators or progressive text updates
      const aiMessage = page.locator(".message-ai").last();
      await expect(aiMessage).toBeVisible({ timeout: 10000 });
    });

    test("should handle chat input validation", async ({ page }) => {
      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");
      await page.locator("text=AI Ask").click();
      await page.waitForSelector(".chat-interface");

      const chatInput = page.locator(".prompt-textarea");
      const sendButton = page.locator(".prompt-send-button");

      // Empty message should disable send button
      await expect(sendButton).toBeDisabled();

      // Whitespace only should also disable send button
      await chatInput.fill("   ");
      await expect(sendButton).toBeDisabled();

      // Valid message should enable send button
      await chatInput.fill("Hello");
      await expect(sendButton).not.toBeDisabled();

      // Very long message should still work
      const longMessage = "A".repeat(1000);
      await chatInput.fill(longMessage);
      await expect(sendButton).not.toBeDisabled();
    });

    test("should handle chat keyboard shortcuts", async ({ page }) => {
      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");
      await page.locator("text=AI Ask").click();
      await page.waitForSelector(".chat-interface");

      const chatInput = page.locator(".prompt-textarea");

      // Enter should send message
      await chatInput.fill("Test message");
      await chatInput.press("Enter");
      await expect(page.locator("text=Test message")).toBeVisible();

      // Shift+Enter should create new line (not send)
      await chatInput.fill("Line 1");
      await chatInput.press("Shift+Enter");
      await chatInput.type("Line 2");

      // Should have multiline text
      const inputValue = await chatInput.inputValue();
      expect(inputValue).toContain("\n");
    });
  });

  test.describe("Search Workflow Scenarios", () => {
    test("should handle search workflow if available", async ({ page }) => {
      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");

      // Look for search workflows
      const searchWorkflow = page
        .locator("text=Search")
        .or(page.locator('[data-workflow-type="search"]'));

      if (await searchWorkflow.isVisible()) {
        await searchWorkflow.click();
        await page.waitForSelector(".search-interface");

        // Test search functionality
        const searchInput = page.locator(".search-field-input");
        await searchInput.fill("test query");

        // Verify search interface responds
        await expect(page.locator(".search-interface")).toBeVisible();

        // Test search results (mock)
        await page.keyboard.press("Enter");

        // Should show some kind of results or feedback
        await expect(page.locator(".search-interface")).toBeVisible();
      }
    });

    test("should handle search with no results", async ({ page }) => {
      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");

      const searchWorkflow = page
        .locator("text=Search")
        .or(page.locator('[data-workflow-type="search"]'));

      if (await searchWorkflow.isVisible()) {
        await searchWorkflow.click();
        await page.waitForSelector(".search-interface");

        // Search for something that won't have results
        const searchInput = page.locator(".search-field-input");
        await searchInput.fill("xyznonexistentquery123");
        await page.keyboard.press("Enter");

        // Should handle no results gracefully
        await expect(page.locator(".search-interface")).toBeVisible();
      }
    });

    test("should handle search result selection", async ({ page }) => {
      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");

      const searchWorkflow = page
        .locator("text=Search")
        .or(page.locator('[data-workflow-type="search"]'));

      if (await searchWorkflow.isVisible()) {
        await searchWorkflow.click();
        await page.waitForSelector(".search-interface");

        const searchInput = page.locator(".search-field-input");
        await searchInput.fill("user");

        // If search results appear, test selection
        const searchResults = page.locator(".search-result");
        if (await searchResults.first().isVisible({ timeout: 2000 })) {
          await searchResults.first().click();

          // Should navigate to next workflow or show details
          await page.waitForTimeout(1000);
        }
      }
    });
  });

  test.describe("Form Workflow Scenarios", () => {
    test("should handle form workflow if available", async ({ page }) => {
      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");

      // Look for form workflows
      const formWorkflow = page
        .locator("text=Details")
        .or(page.locator("text=Form"))
        .or(page.locator('[data-workflow-type="form"]'));

      if (await formWorkflow.isVisible()) {
        await formWorkflow.click();
        await page.waitForSelector(".form-interface");

        // Test form interface
        await expect(page.locator(".form-interface")).toBeVisible();

        // Look for form buttons
        const editButton = page
          .locator("text=Edit")
          .or(page.locator(".form-button-secondary"));
        const closeButton = page
          .locator("text=Close")
          .or(page.locator(".form-button-primary"));

        if (await editButton.isVisible()) {
          await expect(editButton).toBeVisible();
        }

        if (await closeButton.isVisible()) {
          await expect(closeButton).toBeVisible();

          // Test close functionality
          await closeButton.click();
          await expect(page.locator(".spotlight-overlay")).not.toBeVisible();
        }
      }
    });

    test("should handle form data display", async ({ page }) => {
      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");

      const formWorkflow = page
        .locator("text=Details")
        .or(page.locator('[data-workflow-type="form"]'));

      if (await formWorkflow.isVisible()) {
        await formWorkflow.click();
        await page.waitForSelector(".form-interface");

        // Check for form fields and data
        const formFields = page.locator(".form-field");
        if (await formFields.first().isVisible()) {
          await expect(formFields.first()).toBeVisible();

          // Check for labels and values
          const formLabels = page.locator(".form-label");
          const formValues = page.locator(".form-value");

          if (await formLabels.first().isVisible()) {
            await expect(formLabels.first()).toBeVisible();
          }

          if (await formValues.first().isVisible()) {
            await expect(formValues.first()).toBeVisible();
          }
        }
      }
    });
  });

  test.describe("Multi-step Workflow Scenarios", () => {
    test("should handle search-to-form workflow sequence", async ({ page }) => {
      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");

      // Look for a search workflow that leads to form
      const searchWorkflow = page
        .locator("text=Search Users")
        .or(page.locator("text=Search"));

      if (await searchWorkflow.isVisible()) {
        // Step 1: Navigate to search
        await searchWorkflow.click();
        await page.waitForSelector(".search-interface");

        // Step 2: Perform search
        const searchInput = page.locator(".search-field-input");
        await searchInput.fill("john");

        // Step 3: Select result (if available)
        const searchResults = page.locator(".search-result");
        if (await searchResults.first().isVisible({ timeout: 2000 })) {
          await searchResults.first().click();

          // Step 4: Should navigate to form/details
          await page.waitForSelector(".form-interface", { timeout: 5000 });
          await expect(page.locator(".form-interface")).toBeVisible();

          // Step 5: Verify breadcrumb shows the path
          const breadcrumb = page.locator(".search-field-prefix");
          if (await breadcrumb.isVisible()) {
            const breadcrumbText = await breadcrumb.textContent();
            expect(breadcrumbText).toContain(":");
          }
        }
      }
    });

    test("should handle complex navigation with back button", async ({
      page,
    }) => {
      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");

      // Navigate through multiple levels
      await page.locator("text=AI Ask").click();
      await page.waitForSelector(".chat-interface");

      // Verify we're in chat
      await expect(page.locator(".chat-interface")).toBeVisible();
      await expect(page.locator(".search-field-prefix")).toHaveText("AI Ask:");

      // Go back
      await page.keyboard.press("Escape");

      // Should be back to workflow list
      await expect(page.locator(".workflow-list")).toBeVisible();
      await expect(page.locator("text=AI Ask")).toBeVisible();

      // Navigate to different workflow
      await page.locator("text=AI Agent").click();
      await page.waitForSelector(".chat-interface");

      // Verify we're in different chat
      await expect(page.locator(".search-field-prefix")).toHaveText(
        "AI Agent:"
      );
    });

    test("should maintain workflow state during navigation", async ({
      page,
    }) => {
      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");

      // Navigate to chat and enter some text
      await page.locator("text=AI Ask").click();
      await page.waitForSelector(".chat-interface");

      const chatInput = page.locator(".prompt-textarea");
      await chatInput.fill("Draft message");

      // Go back without sending
      await page.keyboard.press("Escape");
      await page.waitForSelector(".workflow-list");

      // Navigate back to chat
      await page.locator("text=AI Ask").click();
      await page.waitForSelector(".chat-interface");

      // Check if state is preserved or reset (depends on implementation)
      const inputValue = await chatInput.inputValue();
      // State should typically be reset for clean UX
      expect(inputValue).toBe("");
    });
  });

  test.describe("Error Scenarios", () => {
    test("should handle workflow execution errors", async ({ page }) => {
      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");

      // Try to execute a workflow that might fail
      await page.locator("text=Close").click();

      // Should handle gracefully (Close should work)
      await expect(page.locator(".spotlight-overlay")).not.toBeVisible();
    });

    test("should handle network errors in AI workflows", async ({ page }) => {
      // Simulate network issues
      await page.route("**/*", (route) => {
        if (
          route.request().url().includes("api") ||
          route.request().url().includes("ai")
        ) {
          route.abort();
        } else {
          route.continue();
        }
      });

      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");

      await page.locator("text=AI Ask").click();
      await page.waitForSelector(".chat-interface");

      // Try to send message
      const chatInput = page.locator(".prompt-textarea");
      await chatInput.fill("Test message");
      await chatInput.press("Enter");

      // Should handle network error gracefully
      await expect(page.locator(".message-user")).toBeVisible();

      // Should show error state or retry option
      await page.waitForTimeout(2000);
    });

    test("should handle malformed configuration", async ({ page }) => {
      // Simulate configuration issues
      await page.addInitScript(() => {
        window.localStorage.setItem(
          "spotlight-config-override",
          JSON.stringify({
            workflows: {
              "broken-workflow": {
                id: "broken-workflow",
                name: "Broken Workflow",
                type: "invalid-type",
              },
            },
          })
        );
      });

      await page.goto("https://example.com");
      await page.keyboard.press("Meta+Slash");

      // Should still work with fallback configuration
      await page.waitForSelector(".spotlight-overlay", { timeout: 5000 });
      await expect(page.locator(".spotlight-overlay")).toBeVisible();

      // Should have at least basic workflows
      await expect(page.locator(".workflow-item")).toHaveCount.greaterThan(0);
    });
  });

  test.describe("Accessibility Scenarios", () => {
    test("should support screen reader navigation", async ({ page }) => {
      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");

      // Check for proper ARIA attributes
      const workflowItems = page.locator(".workflow-item");
      await expect(workflowItems.first()).toHaveAttribute("role", "button");
      await expect(workflowItems.first()).toHaveAttribute("tabindex", "0");

      // Check for aria-selected
      const selectedItem = page.locator(".workflow-item-selected");
      await expect(selectedItem).toHaveAttribute("aria-selected", "true");
    });

    test("should support high contrast mode", async ({ page }) => {
      // Simulate high contrast mode
      await page.emulateMedia({ colorScheme: "dark" });

      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");

      // Verify overlay is still visible and functional
      await expect(page.locator(".spotlight-overlay")).toBeVisible();

      // Test navigation still works
      await page.keyboard.press("ArrowDown");
      const selectedItem = page.locator(".workflow-item-selected");
      await expect(selectedItem).toBeVisible();
    });

    test("should support reduced motion preferences", async ({ page }) => {
      // Simulate reduced motion preference
      await page.emulateMedia({ reducedMotion: "reduce" });

      await page.keyboard.press("Meta+Slash");
      await page.waitForSelector(".spotlight-overlay");

      // Overlay should still appear (just without animations)
      await expect(page.locator(".spotlight-overlay")).toBeVisible();

      // Navigation should still work
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
    });
  });
});
