import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  createExtensionContext,
  activateSpotlight,
  closeSpotlight,
  waitForPageReady,
  verifyOverlayAppearance,
  testKeyboardNavigation,
  verifySearchFieldState,
} from "./test-utils";

let context: BrowserContext;
let page: Page;

test.describe("Spotlight Browser Extension E2E Tests", () => {
  test.beforeAll(async () => {
    context = await createExtensionContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    await waitForPageReady(page, "https://example.com");
  });

  test("CMD+K activates overlay with focus on search field", async () => {
    // Activate overlay and verify appearance
    await activateSpotlight(page);

    // Verify search field is focused
    await verifySearchFieldState(page, true, true);

    // Verify overlay appearance and positioning
    await verifyOverlayAppearance(page);

    // Verify background is blurred
    const overlayContainer = page.locator(
      '[data-testid="spotlight-overlay-container"]'
    );
    await expect(overlayContainer).toHaveClass(/backdrop-blur/);

    // Clean up
    await closeSpotlight(page);
  });

  test("displays initial workflow options", async () => {
    // Activate overlay
    await page.keyboard.press("Meta+KeyK");

    // Wait for overlay and check initial workflows
    const overlay = page.locator('[data-testid="spotlight-overlay"]');
    await expect(overlay).toBeVisible();

    // Check for AI Ask option
    const aiAskOption = page
      .locator('[data-testid="workflow-item"]')
      .filter({ hasText: "AI Ask" });
    await expect(aiAskOption).toBeVisible();

    // Check for AI Agent option
    const aiAgentOption = page
      .locator('[data-testid="workflow-item"]')
      .filter({ hasText: "AI Agent" });
    await expect(aiAgentOption).toBeVisible();

    // Check for Close option
    const closeOption = page
      .locator('[data-testid="workflow-item"]')
      .filter({ hasText: "Close" });
    await expect(closeOption).toBeVisible();
  });

  test("keyboard navigation with arrow keys", async () => {
    // Activate overlay
    await page.keyboard.press("Meta+KeyK");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();

    // Check initial selection (first item should be selected)
    const firstItem = page.locator('[data-testid="workflow-item"]').first();
    await expect(firstItem).toHaveClass(/selected/);

    // Press down arrow to move to next item
    await page.keyboard.press("ArrowDown");

    // Check that second item is now selected
    const secondItem = page.locator('[data-testid="workflow-item"]').nth(1);
    await expect(secondItem).toHaveClass(/selected/);

    // Press up arrow to move back
    await page.keyboard.press("ArrowUp");

    // Check that first item is selected again
    await expect(firstItem).toHaveClass(/selected/);
  });

  test("Enter key selects highlighted option", async () => {
    // Activate overlay
    await page.keyboard.press("Meta+KeyK");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();

    // Navigate to AI Ask option (should be first)
    const aiAskOption = page
      .locator('[data-testid="workflow-item"]')
      .filter({ hasText: "AI Ask" });
    await expect(aiAskOption).toHaveClass(/selected/);

    // Press Enter to select
    await page.keyboard.press("Enter");

    // Check that we navigated to chat interface
    const chatInterface = page.locator('[data-testid="chat-interface"]');
    await expect(chatInterface).toBeVisible();

    // Check breadcrumb shows "AI Ask:"
    const searchField = page.locator('[data-testid="search-field"]');
    await expect(searchField).toHaveAttribute("placeholder", /AI Ask/);
  });

  test("Close workflow immediately closes overlay", async () => {
    // Activate overlay
    await page.keyboard.press("Meta+KeyK");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();

    // Navigate to Close option
    const closeOption = page
      .locator('[data-testid="workflow-item"]')
      .filter({ hasText: "Close" });

    // Click on Close option or navigate to it and press Enter
    await closeOption.click();

    // Verify overlay is closed
    const overlay = page.locator('[data-testid="spotlight-overlay"]');
    await expect(overlay).not.toBeVisible();
  });

  test("Escape key navigation and overlay closing", async () => {
    // Activate overlay
    await page.keyboard.press("Meta+KeyK");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();

    // Navigate to AI Ask
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();

    // Press Escape to go back
    await page.keyboard.press("Escape");

    // Should be back to main workflow list
    const workflowList = page.locator('[data-testid="workflow-list"]');
    await expect(workflowList).toBeVisible();

    // Press Escape again to close overlay
    await page.keyboard.press("Escape");

    // Overlay should be closed
    const overlay = page.locator('[data-testid="spotlight-overlay"]');
    await expect(overlay).not.toBeVisible();
  });

  test("Chat interface functionality", async () => {
    // Activate overlay and navigate to AI Ask
    await page.keyboard.press("Meta+KeyK");
    await page.keyboard.press("Enter"); // Select AI Ask (first option)

    // Wait for chat interface
    const chatInterface = page.locator('[data-testid="chat-interface"]');
    await expect(chatInterface).toBeVisible();

    // Check that prompt input is focused
    const promptInput = page.locator('[data-testid="prompt-input"]');
    await expect(promptInput).toBeFocused();

    // Type a message
    await promptInput.fill("Hello, this is a test message");

    // Send message (either click send button or press Enter)
    const sendButton = page.locator('[data-testid="send-button"]');
    await sendButton.click();

    // Check that message appears in chat history
    const messageList = page.locator('[data-testid="message-list"]');
    await expect(messageList).toContainText("Hello, this is a test message");

    // Check that input is cleared
    await expect(promptInput).toHaveValue("");
  });

  test("Multi-step navigation and breadcrumb display", async () => {
    // This test would require a multi-step workflow to be configured
    // For now, we'll test the breadcrumb display in AI workflows

    // Activate overlay
    await page.keyboard.press("Meta+KeyK");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();

    // Navigate to AI Ask
    await page.keyboard.press("Enter");

    // Check breadcrumb display
    const searchField = page.locator('[data-testid="search-field"]');
    const placeholder = await searchField.getAttribute("placeholder");
    expect(placeholder).toContain("AI Ask");

    // Go back and try AI Agent
    await page.keyboard.press("Escape");
    await page.keyboard.press("ArrowDown"); // Move to AI Agent
    await page.keyboard.press("Enter");

    // Check AI Agent breadcrumb
    const updatedPlaceholder = await searchField.getAttribute("placeholder");
    expect(updatedPlaceholder).toContain("AI Agent");
  });

  test("Extension behavior across different web pages", async () => {
    // Test on different pages to ensure consistent behavior
    const testPages = [
      "https://example.com",
      "https://httpbin.org/html",
      "https://jsonplaceholder.typicode.com",
    ];

    for (const url of testPages) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");

      // Test CMD+K activation
      await page.keyboard.press("Meta+KeyK");

      // Verify overlay appears
      const overlay = page.locator('[data-testid="spotlight-overlay"]');
      await expect(overlay).toBeVisible();

      // Verify search field is focused
      const searchField = page.locator('[data-testid="search-field"]');
      await expect(searchField).toBeFocused();

      // Close overlay for next iteration
      await page.keyboard.press("Escape");
      await expect(overlay).not.toBeVisible();
    }
  });

  test("Keyboard shortcuts do not conflict with page shortcuts", async () => {
    // Navigate to a page that might have CMD+K shortcuts
    await page.goto("https://github.com");
    await page.waitForLoadState("networkidle");

    // Press CMD+K - should activate our extension, not GitHub's search
    await page.keyboard.press("Meta+KeyK");

    // Verify our overlay appears
    const overlay = page.locator('[data-testid="spotlight-overlay"]');
    await expect(overlay).toBeVisible();

    // Verify GitHub's search modal doesn't appear
    const githubSearch = page.locator('[data-target="command-palette.input"]');
    await expect(githubSearch).not.toBeVisible();
  });

  test("Overlay positioning and styling", async () => {
    // Activate overlay
    await page.keyboard.press("Meta+KeyK");
    const overlay = page.locator('[data-testid="spotlight-overlay"]');
    await expect(overlay).toBeVisible();

    // Check overlay is centered
    const overlayBox = await overlay.boundingBox();
    const pageBox = await page.viewportSize();

    if (overlayBox && pageBox) {
      // Overlay should be roughly centered horizontally
      const centerX = pageBox.width / 2;
      const overlayCenterX = overlayBox.x + overlayBox.width / 2;
      expect(Math.abs(overlayCenterX - centerX)).toBeLessThan(50);

      // Overlay should be in upper portion of screen
      expect(overlayBox.y).toBeLessThan(pageBox.height / 2);
    }

    // Check for proper styling (shadows, rounded corners, etc.)
    const overlayStyles = await overlay.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        borderRadius: styles.borderRadius,
        boxShadow: styles.boxShadow,
        backgroundColor: styles.backgroundColor,
      };
    });

    expect(overlayStyles.borderRadius).not.toBe("0px");
    expect(overlayStyles.boxShadow).not.toBe("none");
  });
});
