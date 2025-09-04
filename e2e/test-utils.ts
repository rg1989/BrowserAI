import { Page, expect, BrowserContext, chromium } from "@playwright/test";
import path from "path";

/**
 * Utility functions for E2E tests
 */

/**
 * Create a browser context with the extension loaded
 */
export async function createExtensionContext(): Promise<BrowserContext> {
  const pathToExtension = path.join(__dirname, "../build/chrome-mv3-prod");

  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  return context;
}

/**
 * Activate the spotlight overlay using CMD+K
 */
export async function activateSpotlight(page: Page) {
  await page.keyboard.press("Meta+KeyK");
  const overlay = page.locator('[data-testid="spotlight-overlay"]');
  await expect(overlay).toBeVisible();
  return overlay;
}

/**
 * Close the spotlight overlay
 */
export async function closeSpotlight(page: Page) {
  const overlay = page.locator('[data-testid="spotlight-overlay"]');

  // Try pressing Escape until overlay is closed
  let attempts = 0;
  while ((await overlay.isVisible()) && attempts < 5) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    attempts++;
  }

  await expect(overlay).not.toBeVisible();
}

/**
 * Navigate to a specific workflow by name
 */
export async function navigateToWorkflow(page: Page, workflowName: string) {
  await activateSpotlight(page);

  const workflowItem = page
    .locator('[data-testid="workflow-item"]')
    .filter({ hasText: workflowName });
  await expect(workflowItem).toBeVisible();

  // Click on the workflow item
  await workflowItem.click();
}

/**
 * Navigate to a workflow using keyboard navigation
 */
export async function navigateToWorkflowWithKeyboard(
  page: Page,
  workflowName: string
) {
  await activateSpotlight(page);

  const workflowItems = page.locator('[data-testid="workflow-item"]');
  const count = await workflowItems.count();

  // Find the workflow by navigating with arrow keys
  for (let i = 0; i < count; i++) {
    const currentItem = workflowItems.nth(i);
    const text = await currentItem.textContent();

    if (text?.includes(workflowName)) {
      // Navigate to this item
      for (let j = 0; j < i; j++) {
        await page.keyboard.press("ArrowDown");
      }
      await page.keyboard.press("Enter");
      return;
    }
  }

  throw new Error(`Workflow "${workflowName}" not found`);
}

/**
 * Send a message in the chat interface
 */
export async function sendChatMessage(page: Page, message: string) {
  const chatInterface = page.locator('[data-testid="chat-interface"]');
  await expect(chatInterface).toBeVisible();

  const promptInput = page.locator('[data-testid="prompt-input"]');
  await expect(promptInput).toBeFocused();

  await promptInput.fill(message);

  // Try both Enter key and send button
  try {
    await page.keyboard.press("Enter");
  } catch {
    const sendButton = page.locator('[data-testid="send-button"]');
    await sendButton.click();
  }

  // Verify message appears in chat
  const messageList = page.locator('[data-testid="message-list"]');
  await expect(messageList).toContainText(message);

  // Verify input is cleared
  await expect(promptInput).toHaveValue("");
}

/**
 * Wait for page to be ready for extension testing
 */
export async function waitForPageReady(page: Page, url: string) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 10000 });

  // Wait a bit more for any dynamic content
  await page.waitForTimeout(1000);

  // Ensure page is focused
  await page.bringToFront();
}

/**
 * Verify overlay positioning and styling
 */
export async function verifyOverlayAppearance(page: Page) {
  const overlay = page.locator('[data-testid="spotlight-overlay"]');
  await expect(overlay).toBeVisible();

  // Check positioning
  const overlayBox = await overlay.boundingBox();
  const pageBox = await page.viewportSize();

  if (overlayBox && pageBox) {
    // Should be roughly centered horizontally
    const centerX = pageBox.width / 2;
    const overlayCenterX = overlayBox.x + overlayBox.width / 2;
    expect(Math.abs(overlayCenterX - centerX)).toBeLessThan(100);

    // Should be in upper portion of screen
    expect(overlayBox.y).toBeLessThan(pageBox.height / 2);
  }

  // Check styling
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

  return overlayStyles;
}

/**
 * Test keyboard navigation through workflow items
 */
export async function testKeyboardNavigation(page: Page) {
  await activateSpotlight(page);

  const workflowItems = page.locator('[data-testid="workflow-item"]');
  const count = await workflowItems.count();

  if (count === 0) {
    throw new Error("No workflow items found");
  }

  // Test down navigation
  for (let i = 0; i < count; i++) {
    const currentItem = workflowItems.nth(i);
    await expect(currentItem).toHaveClass(/selected/);

    if (i < count - 1) {
      await page.keyboard.press("ArrowDown");
    }
  }

  // Test up navigation
  for (let i = count - 1; i > 0; i--) {
    await page.keyboard.press("ArrowUp");
    const currentItem = workflowItems.nth(i - 1);
    await expect(currentItem).toHaveClass(/selected/);
  }
}

/**
 * Verify search field state and focus
 */
export async function verifySearchFieldState(
  page: Page,
  shouldBeFocused: boolean = true,
  shouldBeEnabled: boolean = true
) {
  const searchField = page.locator('[data-testid="search-field"]');
  await expect(searchField).toBeVisible();

  if (shouldBeFocused) {
    await expect(searchField).toBeFocused();
  }

  if (shouldBeEnabled) {
    await expect(searchField).toBeEnabled();
  } else {
    await expect(searchField).toBeDisabled();
  }
}

/**
 * Test workflow breadcrumb display
 */
export async function verifyBreadcrumb(page: Page, expectedText: string) {
  const searchField = page.locator('[data-testid="search-field"]');
  const placeholder = await searchField.getAttribute("placeholder");
  expect(placeholder).toContain(expectedText);
}

/**
 * Test extension on multiple pages
 */
export async function testOnMultiplePages(
  page: Page,
  testFn: (page: Page) => Promise<void>
) {
  const testPages = ["https://example.com", "https://httpbin.org/html"];

  for (const url of testPages) {
    try {
      await waitForPageReady(page, url);
      await testFn(page);
    } catch (error) {
      console.log(`Test failed on ${url}:`, error);
      throw error;
    }
  }
}
