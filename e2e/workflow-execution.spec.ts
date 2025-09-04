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

test.describe("Workflow Execution E2E Tests", () => {
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

  test.beforeEach(async () => {
    await page.goto("https://example.com");
    await page.waitForLoadState("networkidle");
  });

  test("AI Ask workflow complete interaction", async () => {
    // Activate overlay
    await page.keyboard.press("Meta+Slash");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();

    // Select AI Ask (first option)
    await page.keyboard.press("Enter");

    // Verify chat interface is displayed
    const chatInterface = page.locator('[data-testid="chat-interface"]');
    await expect(chatInterface).toBeVisible();

    // Verify search field is disabled and shows breadcrumb
    const searchField = page.locator('[data-testid="search-field"]');
    await expect(searchField).toBeDisabled();

    // Verify prompt input is focused
    const promptInput = page.locator('[data-testid="prompt-input"]');
    await expect(promptInput).toBeFocused();

    // Type and send a message
    await promptInput.fill("What is the weather today?");
    await page.keyboard.press("Enter");

    // Verify message appears in chat
    const messageList = page.locator('[data-testid="message-list"]');
    await expect(messageList).toContainText("What is the weather today?");

    // Verify input is cleared
    await expect(promptInput).toHaveValue("");

    // Test going back
    await page.keyboard.press("Escape");

    // Should return to workflow list
    const workflowList = page.locator('[data-testid="workflow-list"]');
    await expect(workflowList).toBeVisible();

    // Search field should be enabled again
    await expect(searchField).toBeEnabled();
  });

  test("AI Agent workflow complete interaction", async () => {
    // Activate overlay
    await page.keyboard.press("Meta+Slash");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();

    // Navigate to AI Agent (second option)
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // Verify chat interface is displayed
    const chatInterface = page.locator('[data-testid="chat-interface"]');
    await expect(chatInterface).toBeVisible();

    // Verify breadcrumb shows AI Agent
    const searchField = page.locator('[data-testid="search-field"]');
    const placeholder = await searchField.getAttribute("placeholder");
    expect(placeholder).toContain("AI Agent");

    // Test message interaction
    const promptInput = page.locator('[data-testid="prompt-input"]');
    await promptInput.fill("Help me write a function");

    // Click send button instead of Enter
    const sendButton = page.locator('[data-testid="send-button"]');
    await sendButton.click();

    // Verify message appears
    const messageList = page.locator('[data-testid="message-list"]');
    await expect(messageList).toContainText("Help me write a function");
  });

  test("Search workflow with form interaction", async () => {
    // This test assumes a search workflow is configured
    // We'll test the general pattern even if specific workflow isn't available

    await page.keyboard.press("Meta+Slash");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();

    // Look for any search-type workflow
    const searchWorkflow = page
      .locator('[data-testid="workflow-item"]')
      .filter({ hasText: /Search|Find/ });

    if ((await searchWorkflow.count()) > 0) {
      await searchWorkflow.first().click();

      // If search interface appears
      const searchInterface = page.locator('[data-testid="search-interface"]');
      if (await searchInterface.isVisible()) {
        // Test search functionality
        const searchInput = page.locator('[data-testid="search-input"]');
        await searchInput.fill("test query");

        // Look for search results
        const searchResults = page.locator('[data-testid="search-results"]');
        await expect(searchResults).toBeVisible();
      }
    }
  });

  test("Form workflow interaction", async () => {
    // Test form workflow if available
    await page.keyboard.press("Meta+Slash");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();

    // Look for form-type workflow
    const formWorkflow = page
      .locator('[data-testid="workflow-item"]')
      .filter({ hasText: /Form|Details|Edit/ });

    if ((await formWorkflow.count()) > 0) {
      await formWorkflow.first().click();

      // If form interface appears
      const formInterface = page.locator('[data-testid="form-interface"]');
      if (await formInterface.isVisible()) {
        // Test form field interaction
        const formFields = page.locator('[data-testid="form-field"]');

        if ((await formFields.count()) > 0) {
          await formFields.first().fill("test value");

          // Look for submit button
          const submitButton = page.locator('[data-testid="submit-button"]');
          if (await submitButton.isVisible()) {
            await submitButton.click();
          }
        }
      }
    }
  });

  test("Loader workflow behavior", async () => {
    // Test loader workflow if available
    await page.keyboard.press("Meta+Slash");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();

    // Look for any workflow that might trigger loading
    const workflows = page.locator('[data-testid="workflow-item"]');
    const workflowCount = await workflows.count();

    if (workflowCount > 3) {
      // More than the basic AI Ask, AI Agent, Close
      // Try the fourth workflow
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press("ArrowDown");
      }
      await page.keyboard.press("Enter");

      // Check if loader interface appears
      const loaderInterface = page.locator('[data-testid="loader-interface"]');
      if (await loaderInterface.isVisible()) {
        // Verify loading indicator
        const loadingIndicator = page.locator(
          '[data-testid="loading-indicator"]'
        );
        await expect(loadingIndicator).toBeVisible();
      }
    }
  });

  test("Complex navigation sequence", async () => {
    // Test a complex navigation sequence
    await page.keyboard.press("Meta+Slash");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();

    // Navigate through multiple workflows
    // AI Ask -> Back -> AI Agent -> Back -> Close

    // Go to AI Ask
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();

    // Go back
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="workflow-list"]')).toBeVisible();

    // Go to AI Agent
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();

    // Verify breadcrumb changed
    const searchField = page.locator('[data-testid="search-field"]');
    const placeholder = await searchField.getAttribute("placeholder");
    expect(placeholder).toContain("AI Agent");

    // Go back
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="workflow-list"]')).toBeVisible();

    // Navigate to Close and execute
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // Overlay should close
    const overlay = page.locator('[data-testid="spotlight-overlay"]');
    await expect(overlay).not.toBeVisible();
  });

  test("Rapid keyboard navigation", async () => {
    // Test rapid keyboard interactions
    await page.keyboard.press("Meta+Slash");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();

    // Rapid arrow key presses
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(50); // Small delay to ensure state updates
    }

    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(50);
    }

    // Should still be functional
    await page.keyboard.press("Enter");

    // Should navigate to selected workflow
    const chatInterface = page.locator('[data-testid="chat-interface"]');
    const workflowList = page.locator('[data-testid="workflow-list"]');

    // Either chat interface or workflow list should be visible
    await expect(chatInterface.or(workflowList)).toBeVisible();
  });

  test("Mouse and keyboard interaction combination", async () => {
    // Test combining mouse clicks with keyboard navigation
    await page.keyboard.press("Meta+Slash");
    await expect(
      page.locator('[data-testid="spotlight-overlay"]')
    ).toBeVisible();

    // Use keyboard to navigate
    await page.keyboard.press("ArrowDown");

    // Then use mouse to click
    const aiAgentOption = page
      .locator('[data-testid="workflow-item"]')
      .filter({ hasText: "AI Agent" });
    await aiAgentOption.click();

    // Should navigate to AI Agent
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();

    // Use keyboard to go back
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="workflow-list"]')).toBeVisible();

    // Use mouse to click Close
    const closeOption = page
      .locator('[data-testid="workflow-item"]')
      .filter({ hasText: "Close" });
    await closeOption.click();

    // Should close overlay
    const overlay = page.locator('[data-testid="spotlight-overlay"]');
    await expect(overlay).not.toBeVisible();
  });
});
