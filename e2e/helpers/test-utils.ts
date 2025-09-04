import { Page, expect } from "@playwright/test";

/**
 * Helper utilities for E2E tests
 */
export class SpotlightTestUtils {
  constructor(private page: Page) {}

  /**
   * Activate the spotlight overlay using CMD+K
   */
  async activateSpotlight(): Promise<void> {
    await this.page.keyboard.press("Meta+KeyK");
    await this.page.waitForSelector(".spotlight-overlay", { timeout: 5000 });
    await expect(this.page.locator(".spotlight-overlay")).toBeVisible();
  }

  /**
   * Close the spotlight overlay using Escape
   */
  async closeSpotlight(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.page.locator(".spotlight-overlay")).not.toBeVisible();
  }

  /**
   * Navigate to a specific workflow by name
   */
  async navigateToWorkflow(workflowName: string): Promise<void> {
    await this.activateSpotlight();
    await this.page.locator(`text=${workflowName}`).click();

    // Wait for navigation to complete
    await this.page.waitForTimeout(500);
  }

  /**
   * Navigate using keyboard arrows
   */
  async navigateWithKeyboard(
    direction: "up" | "down",
    steps: number = 1
  ): Promise<void> {
    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press(
        direction === "up" ? "ArrowUp" : "ArrowDown"
      );
      await this.page.waitForTimeout(100);
    }
  }

  /**
   * Get the currently selected workflow name
   */
  async getSelectedWorkflowName(): Promise<string> {
    const selectedItem = this.page.locator(
      ".workflow-item-selected .workflow-item-name"
    );
    return (await selectedItem.textContent()) || "";
  }

  /**
   * Check if we're in a specific workflow interface
   */
  async isInWorkflowInterface(
    interfaceType: "chat" | "search" | "form"
  ): Promise<boolean> {
    const selector = `.${interfaceType}-interface`;
    return await this.page.locator(selector).isVisible();
  }

  /**
   * Get the current breadcrumb text
   */
  async getBreadcrumbText(): Promise<string> {
    const breadcrumb = this.page.locator(".search-field-prefix");
    if (await breadcrumb.isVisible()) {
      return (await breadcrumb.textContent()) || "";
    }
    return "";
  }

  /**
   * Send a chat message
   */
  async sendChatMessage(message: string): Promise<void> {
    const chatInput = this.page.locator(".prompt-textarea");
    await chatInput.fill(message);
    await chatInput.press("Enter");

    // Wait for message to appear
    await expect(this.page.locator(".message-user").last()).toBeVisible();
  }

  /**
   * Perform a search query
   */
  async performSearch(query: string): Promise<void> {
    const searchInput = this.page.locator(".search-field-input");
    await searchInput.fill(query);
    await this.page.keyboard.press("Enter");

    // Wait for search to process
    await this.page.waitForTimeout(500);
  }

  /**
   * Wait for AI response in chat
   */
  async waitForAIResponse(timeout: number = 5000): Promise<void> {
    await expect(this.page.locator(".message-ai").last()).toBeVisible({
      timeout,
    });
  }

  /**
   * Check if overlay is visible
   */
  async isOverlayVisible(): Promise<boolean> {
    return await this.page.locator(".spotlight-overlay").isVisible();
  }

  /**
   * Get all visible workflow names
   */
  async getVisibleWorkflows(): Promise<string[]> {
    const workflowItems = this.page.locator(".workflow-item-name");
    const count = await workflowItems.count();
    const workflows: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await workflowItems.nth(i).textContent();
      if (text) {
        workflows.push(text);
      }
    }

    return workflows;
  }

  /**
   * Verify default workflows are present
   */
  async verifyDefaultWorkflows(): Promise<void> {
    await expect(this.page.locator("text=AI Ask")).toBeVisible();
    await expect(this.page.locator("text=AI Agent")).toBeVisible();
    await expect(this.page.locator("text=Close")).toBeVisible();
  }

  /**
   * Test keyboard navigation through all workflows
   */
  async testKeyboardNavigation(): Promise<void> {
    const workflows = await this.getVisibleWorkflows();

    // Test navigation down
    for (let i = 1; i < workflows.length; i++) {
      await this.navigateWithKeyboard("down");
      const selected = await this.getSelectedWorkflowName();
      expect(selected).toBe(workflows[i]);
    }

    // Test navigation up
    for (let i = workflows.length - 2; i >= 0; i--) {
      await this.navigateWithKeyboard("up");
      const selected = await this.getSelectedWorkflowName();
      expect(selected).toBe(workflows[i]);
    }
  }

  /**
   * Test workflow execution
   */
  async testWorkflowExecution(workflowName: string): Promise<void> {
    await this.navigateToWorkflow(workflowName);

    // Verify navigation occurred
    if (workflowName === "Close") {
      // Close workflow should close the overlay
      await expect(this.page.locator(".spotlight-overlay")).not.toBeVisible();
    } else {
      // Other workflows should show their interfaces
      const breadcrumb = await this.getBreadcrumbText();
      expect(breadcrumb).toContain(workflowName);
    }
  }

  /**
   * Simulate network error for testing error handling
   */
  async simulateNetworkError(): Promise<void> {
    await this.page.route("**/*api*", (route) => route.abort());
    await this.page.route("**/*ai*", (route) => route.abort());
  }

  /**
   * Clear network simulation
   */
  async clearNetworkSimulation(): Promise<void> {
    await this.page.unroute("**/*api*");
    await this.page.unroute("**/*ai*");
  }

  /**
   * Check accessibility attributes
   */
  async verifyAccessibility(): Promise<void> {
    // Check workflow items have proper ARIA attributes
    const workflowItems = this.page.locator(".workflow-item");
    const count = await workflowItems.count();

    for (let i = 0; i < count; i++) {
      const item = workflowItems.nth(i);
      await expect(item).toHaveAttribute("role", "button");
      await expect(item).toHaveAttribute("tabindex", "0");
    }

    // Check selected item has aria-selected
    const selectedItem = this.page.locator(".workflow-item-selected");
    if (await selectedItem.isVisible()) {
      await expect(selectedItem).toHaveAttribute("aria-selected", "true");
    }

    // Check search input accessibility
    const searchInput = this.page.locator(".search-field-input");
    if (await searchInput.isVisible()) {
      await expect(searchInput).toHaveAttribute("autocomplete", "off");
      await expect(searchInput).toHaveAttribute("spellcheck", "false");
    }
  }

  /**
   * Test performance by measuring activation time
   */
  async measureActivationTime(): Promise<number> {
    const startTime = Date.now();
    await this.activateSpotlight();
    const endTime = Date.now();
    return endTime - startTime;
  }

  /**
   * Test rapid interactions for performance
   */
  async testRapidInteractions(iterations: number = 10): Promise<void> {
    for (let i = 0; i < iterations; i++) {
      await this.activateSpotlight();
      await this.closeSpotlight();
    }

    // Final activation should still work
    await this.activateSpotlight();
    await this.verifyDefaultWorkflows();
  }

  /**
   * Setup test page with extension
   */
  static async setupTestPage(
    page: Page,
    url: string = "https://example.com"
  ): Promise<SpotlightTestUtils> {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000); // Wait for extension injection

    return new SpotlightTestUtils(page);
  }

  /**
   * MCP-specific: Take screenshot with metadata for MCP analysis
   */
  async takeScreenshotWithMetadata(filename: string): Promise<void> {
    const screenshot = await this.page.screenshot({
      path: `e2e/screenshots/${filename}`,
      fullPage: true,
    });

    // Add metadata for MCP analysis
    const metadata = {
      timestamp: new Date().toISOString(),
      url: this.page.url(),
      viewport: await this.page.viewportSize(),
      overlayVisible: await this.isOverlayVisible(),
      currentWorkflow: await this.getBreadcrumbText(),
    };

    // Store metadata alongside screenshot
    const fs = require("fs");
    fs.writeFileSync(
      `e2e/screenshots/${filename}.metadata.json`,
      JSON.stringify(metadata, null, 2)
    );
  }

  /**
   * MCP-specific: Capture page state for MCP analysis
   */
  async capturePageState(): Promise<any> {
    return await this.page.evaluate(() => {
      const state = {
        url: window.location.href,
        title: document.title,
        overlayPresent: !!document.querySelector(".spotlight-overlay"),
        focusedElement: document.activeElement?.tagName || null,
        workflowItems: Array.from(
          document.querySelectorAll(".workflow-item")
        ).map((item) => item.textContent?.trim()),
        chatMessages: Array.from(document.querySelectorAll(".message")).length,
        searchFieldValue:
          (document.querySelector(".search-field-input") as HTMLInputElement)
            ?.value || "",
        breadcrumb:
          document.querySelector(".search-field-prefix")?.textContent || "",
      };
      return state;
    });
  }

  /**
   * MCP-specific: Validate extension behavior with detailed logging
   */
  async validateExtensionBehavior(): Promise<boolean> {
    const state = await this.capturePageState();

    // Log state for MCP analysis
    console.log("Extension State:", JSON.stringify(state, null, 2));

    // Validate core functionality
    const validations = {
      overlayCanActivate: false,
      keyboardNavigationWorks: false,
      workflowsArePresent: false,
      chatInterfaceWorks: false,
    };

    try {
      // Test overlay activation
      await this.activateSpotlight();
      validations.overlayCanActivate = await this.isOverlayVisible();

      // Test keyboard navigation
      await this.navigateWithKeyboard("down");
      const selectedAfterNav = await this.getSelectedWorkflowName();
      validations.keyboardNavigationWorks = selectedAfterNav !== "";

      // Test workflows presence
      const workflows = await this.getVisibleWorkflows();
      validations.workflowsArePresent = workflows.length >= 3;

      // Test chat interface
      await this.navigateToWorkflow("AI Ask");
      validations.chatInterfaceWorks = await this.isInWorkflowInterface("chat");

      await this.closeSpotlight();
    } catch (error) {
      console.error("Extension validation failed:", error);
    }

    return Object.values(validations).every((v) => v);
  }

  /**
   * MCP-specific: Test extension with MCP browser tools integration
   */
  async testWithMCPBrowserTools(): Promise<void> {
    // Test sequence that would be compatible with MCP browser tools

    // 1. Navigate and take snapshot
    await this.page.goto("https://example.com");
    await this.takeScreenshotWithMetadata("mcp-test-initial.png");

    // 2. Activate extension
    await this.activateSpotlight();
    await this.takeScreenshotWithMetadata("mcp-test-activated.png");

    // 3. Navigate through workflows
    await this.navigateWithKeyboard("down");
    await this.takeScreenshotWithMetadata("mcp-test-navigation.png");

    // 4. Enter chat workflow
    await this.navigateToWorkflow("AI Ask");
    await this.takeScreenshotWithMetadata("mcp-test-chat.png");

    // 5. Send message
    await this.sendChatMessage("MCP integration test message");
    await this.takeScreenshotWithMetadata("mcp-test-message-sent.png");

    // 6. Navigate back
    await this.page.keyboard.press("Escape");
    await this.takeScreenshotWithMetadata("mcp-test-back-to-list.png");

    // 7. Close extension
    await this.closeSpotlight();
    await this.takeScreenshotWithMetadata("mcp-test-closed.png");
  }
}

/**
 * Common test data and constants
 */
export const TestData = {
  DEFAULT_WORKFLOWS: ["AI Ask", "AI Agent", "Close"],
  TEST_MESSAGES: [
    "Hello, this is a test message",
    "What is TypeScript?",
    "Explain React hooks",
    "How do I use async/await?",
  ],
  TEST_SEARCH_QUERIES: ["user", "john", "test query", "search term"],
  TEST_URLS: [
    "https://example.com",
    "https://httpbin.org/html",
    "https://github.com",
    "data:text/html,<html><body><h1>Test Page</h1></body></html>",
  ],
};

/**
 * Test configuration constants
 */
export const TestConfig = {
  ACTIVATION_TIMEOUT: 5000,
  RESPONSE_TIMEOUT: 10000,
  NAVIGATION_DELAY: 500,
  KEYBOARD_DELAY: 100,
  MAX_ACTIVATION_TIME: 1000,
  RAPID_INTERACTION_COUNT: 10,
};
