import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { SpotlightTestUtils, TestData, TestConfig } from "./helpers/test-utils";
import path from "path";

/**
 * MCP Browser Integration Tests
 *
 * These tests are designed to work with MCP (Model Context Protocol) browser tools
 * and demonstrate comprehensive E2E validation of the Spotlight Browser Extension.
 *
 * The tests include:
 * - Screenshot capture with metadata for MCP analysis
 * - Detailed state logging for MCP debugging
 * - Cross-page behavior validation
 * - Performance measurement for MCP monitoring
 * - Accessibility validation for MCP compliance
 */

let context: BrowserContext;
let page: Page;
let spotlightUtils: SpotlightTestUtils;

test.describe("MCP Browser Integration Tests", () => {
  test.beforeAll(async () => {
    // Launch browser with extension and MCP-compatible settings
    const pathToExtension = path.join(__dirname, "../build/chrome-mv3-prod");

    context = await chromium.launchPersistentContext("", {
      headless: false, // MCP tools work better with visible browser
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security", // For MCP testing across domains
        "--disable-features=VizDisplayCompositor", // Better MCP compatibility
        "--enable-automation", // Better MCP tool integration
      ],
      viewport: { width: 1280, height: 720 }, // Standard viewport for MCP
    });

    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    spotlightUtils = await SpotlightTestUtils.setupTestPage(page);
  });

  test("MCP Integration: Complete workflow validation with screenshots", async () => {
    // This test demonstrates full MCP integration with detailed logging and screenshots

    console.log("Starting MCP integration test...");

    // Test complete workflow with MCP browser tools
    await spotlightUtils.testWithMCPBrowserTools();

    // Validate final state
    const isValid = await spotlightUtils.validateExtensionBehavior();
    expect(isValid).toBe(true);

    console.log("MCP integration test completed successfully");
  });

  test("MCP Integration: CMD+K activation with detailed state capture", async () => {
    // Capture initial state
    let state = await spotlightUtils.capturePageState();
    expect(state.overlayPresent).toBe(false);

    // Take initial screenshot for MCP analysis
    await spotlightUtils.takeScreenshotWithMetadata(
      "cmd-k-before-activation.png"
    );

    // Activate with CMD+K
    await page.keyboard.press("Meta+KeyK");

    // Capture activated state
    state = await spotlightUtils.capturePageState();
    expect(state.overlayPresent).toBe(true);
    expect(state.focusedElement).toBe("INPUT");

    // Take screenshot after activation
    await spotlightUtils.takeScreenshotWithMetadata(
      "cmd-k-after-activation.png"
    );

    // Verify search field is focused
    const searchField = page.locator('[data-testid="search-field"]');
    await expect(searchField).toBeFocused();

    // Verify default workflows are present
    await spotlightUtils.verifyDefaultWorkflows();

    // Take final screenshot
    await spotlightUtils.takeScreenshotWithMetadata(
      "cmd-k-workflows-visible.png"
    );
  });

  test("MCP Integration: Keyboard navigation with state tracking", async () => {
    await spotlightUtils.activateSpotlight();

    // Capture navigation states for MCP analysis
    const navigationStates = [];

    // Initial state
    let state = await spotlightUtils.capturePageState();
    navigationStates.push({ step: "initial", ...state });

    // Navigate down through workflows
    const workflows = await spotlightUtils.getVisibleWorkflows();

    for (let i = 0; i < workflows.length; i++) {
      if (i > 0) {
        await spotlightUtils.navigateWithKeyboard("down");
      }

      const selectedWorkflow = await spotlightUtils.getSelectedWorkflowName();
      state = await spotlightUtils.capturePageState();
      navigationStates.push({
        step: `navigation-${i}`,
        selectedWorkflow,
        ...state,
      });

      // Take screenshot for each navigation step
      await spotlightUtils.takeScreenshotWithMetadata(
        `navigation-step-${i}.png`
      );
    }

    // Log navigation sequence for MCP analysis
    console.log(
      "Navigation States:",
      JSON.stringify(navigationStates, null, 2)
    );

    // Verify navigation worked correctly
    expect(navigationStates.length).toBe(workflows.length + 1);

    // Test navigation back up
    for (let i = workflows.length - 1; i > 0; i--) {
      await spotlightUtils.navigateWithKeyboard("up");
      const selectedWorkflow = await spotlightUtils.getSelectedWorkflowName();
      expect(selectedWorkflow).toBe(workflows[i - 1]);
    }
  });

  test("MCP Integration: Chat interface workflow with message tracking", async () => {
    await spotlightUtils.navigateToWorkflow("AI Ask");

    // Capture chat interface state
    let state = await spotlightUtils.capturePageState();
    expect(state.breadcrumb).toContain("AI Ask");

    // Take screenshot of chat interface
    await spotlightUtils.takeScreenshotWithMetadata(
      "chat-interface-loaded.png"
    );

    // Send multiple messages and track state
    const testMessages = TestData.TEST_MESSAGES.slice(0, 3);
    const messageStates = [];

    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];

      // Send message
      await spotlightUtils.sendChatMessage(message);

      // Capture state after message
      state = await spotlightUtils.capturePageState();
      messageStates.push({
        messageIndex: i,
        message,
        chatMessages: state.chatMessages,
        timestamp: new Date().toISOString(),
      });

      // Take screenshot after each message
      await spotlightUtils.takeScreenshotWithMetadata(`chat-message-${i}.png`);

      // Verify message appears in chat
      await expect(page.locator(`text=${message}`)).toBeVisible();
    }

    // Log message states for MCP analysis
    console.log("Message States:", JSON.stringify(messageStates, null, 2));

    // Verify all messages were sent
    expect(messageStates.length).toBe(testMessages.length);
    expect(
      messageStates[messageStates.length - 1].chatMessages
    ).toBeGreaterThanOrEqual(testMessages.length);
  });

  test("MCP Integration: Multi-step navigation with breadcrumb tracking", async () => {
    const navigationSequence = [];

    // Step 1: Initial activation
    await spotlightUtils.activateSpotlight();
    let breadcrumb = await spotlightUtils.getBreadcrumbText();
    navigationSequence.push({ step: "activation", breadcrumb });
    await spotlightUtils.takeScreenshotWithMetadata(
      "multi-step-1-activation.png"
    );

    // Step 2: Navigate to AI Ask
    await spotlightUtils.navigateToWorkflow("AI Ask");
    breadcrumb = await spotlightUtils.getBreadcrumbText();
    navigationSequence.push({ step: "ai-ask", breadcrumb });
    await spotlightUtils.takeScreenshotWithMetadata("multi-step-2-ai-ask.png");
    expect(breadcrumb).toContain("AI Ask");

    // Step 3: Send a message
    await spotlightUtils.sendChatMessage("Multi-step test message");
    breadcrumb = await spotlightUtils.getBreadcrumbText();
    navigationSequence.push({ step: "message-sent", breadcrumb });
    await spotlightUtils.takeScreenshotWithMetadata(
      "multi-step-3-message-sent.png"
    );

    // Step 4: Navigate back to list
    await page.keyboard.press("Escape");
    breadcrumb = await spotlightUtils.getBreadcrumbText();
    navigationSequence.push({ step: "back-to-list", breadcrumb });
    await spotlightUtils.takeScreenshotWithMetadata(
      "multi-step-4-back-to-list.png"
    );
    expect(breadcrumb).toBe("");

    // Step 5: Navigate to AI Agent
    await spotlightUtils.navigateToWorkflow("AI Agent");
    breadcrumb = await spotlightUtils.getBreadcrumbText();
    navigationSequence.push({ step: "ai-agent", breadcrumb });
    await spotlightUtils.takeScreenshotWithMetadata(
      "multi-step-5-ai-agent.png"
    );
    expect(breadcrumb).toContain("AI Agent");

    // Step 6: Navigate back and close
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    breadcrumb = await spotlightUtils.getBreadcrumbText();
    navigationSequence.push({ step: "closed", breadcrumb });
    await spotlightUtils.takeScreenshotWithMetadata("multi-step-6-closed.png");

    // Log navigation sequence for MCP analysis
    console.log(
      "Navigation Sequence:",
      JSON.stringify(navigationSequence, null, 2)
    );

    // Verify overlay is closed
    expect(await spotlightUtils.isOverlayVisible()).toBe(false);
  });

  test("MCP Integration: Cross-page behavior validation", async () => {
    const crossPageResults = [];

    // Test on multiple pages
    for (const url of TestData.TEST_URLS.slice(0, 3)) {
      try {
        console.log(`Testing on: ${url}`);

        // Navigate to page
        await page.goto(url);
        await page.waitForLoadState("networkidle");

        // Measure activation time
        const activationTime = await spotlightUtils.measureActivationTime();

        // Test basic functionality
        await spotlightUtils.verifyDefaultWorkflows();

        // Test navigation
        await spotlightUtils.navigateWithKeyboard("down");
        const selectedWorkflow = await spotlightUtils.getSelectedWorkflowName();

        // Capture state
        const state = await spotlightUtils.capturePageState();

        crossPageResults.push({
          url,
          activationTime,
          selectedWorkflow,
          workflowCount: state.workflowItems?.length || 0,
          success: true,
        });

        // Take screenshot for this page
        const urlSafe = url.replace(/[^a-zA-Z0-9]/g, "-");
        await spotlightUtils.takeScreenshotWithMetadata(
          `cross-page-${urlSafe}.png`
        );

        await spotlightUtils.closeSpotlight();
      } catch (error) {
        console.error(`Failed on ${url}:`, error);
        crossPageResults.push({
          url,
          error: error.message,
          success: false,
        });
      }
    }

    // Log results for MCP analysis
    console.log(
      "Cross-Page Results:",
      JSON.stringify(crossPageResults, null, 2)
    );

    // Verify most pages worked
    const successfulTests = crossPageResults.filter((r) => r.success);
    expect(successfulTests.length).toBeGreaterThanOrEqual(2);

    // Verify performance is consistent
    const activationTimes = successfulTests
      .map((r) => r.activationTime)
      .filter((t) => t);
    if (activationTimes.length > 0) {
      const avgActivationTime =
        activationTimes.reduce((a, b) => a + b, 0) / activationTimes.length;
      expect(avgActivationTime).toBeLessThan(TestConfig.MAX_ACTIVATION_TIME);
    }
  });

  test("MCP Integration: Performance monitoring with detailed metrics", async () => {
    const performanceMetrics = [];

    // Test multiple activation cycles
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();

      // Activate
      await spotlightUtils.activateSpotlight();
      const activationTime = Date.now() - startTime;

      // Navigate
      const navStartTime = Date.now();
      await spotlightUtils.navigateWithKeyboard("down", 2);
      const navigationTime = Date.now() - navStartTime;

      // Enter workflow
      const workflowStartTime = Date.now();
      await page.keyboard.press("Enter");
      await page.waitForSelector('[data-testid="chat-interface"]', {
        timeout: 5000,
      });
      const workflowTime = Date.now() - workflowStartTime;

      // Close
      const closeStartTime = Date.now();
      await spotlightUtils.closeSpotlight();
      const closeTime = Date.now() - closeStartTime;

      performanceMetrics.push({
        cycle: i + 1,
        activationTime,
        navigationTime,
        workflowTime,
        closeTime,
        totalTime: activationTime + navigationTime + workflowTime + closeTime,
      });

      // Brief pause between cycles
      await page.waitForTimeout(500);
    }

    // Log metrics for MCP analysis
    console.log(
      "Performance Metrics:",
      JSON.stringify(performanceMetrics, null, 2)
    );

    // Calculate averages
    const avgActivation =
      performanceMetrics.reduce((sum, m) => sum + m.activationTime, 0) /
      performanceMetrics.length;
    const avgNavigation =
      performanceMetrics.reduce((sum, m) => sum + m.navigationTime, 0) /
      performanceMetrics.length;
    const avgWorkflow =
      performanceMetrics.reduce((sum, m) => sum + m.workflowTime, 0) /
      performanceMetrics.length;
    const avgClose =
      performanceMetrics.reduce((sum, m) => sum + m.closeTime, 0) /
      performanceMetrics.length;

    console.log("Average Performance:", {
      activation: avgActivation,
      navigation: avgNavigation,
      workflow: avgWorkflow,
      close: avgClose,
    });

    // Verify performance is within acceptable limits
    expect(avgActivation).toBeLessThan(TestConfig.MAX_ACTIVATION_TIME);
    expect(avgNavigation).toBeLessThan(500); // Navigation should be fast
    expect(avgWorkflow).toBeLessThan(2000); // Workflow loading should be reasonable
    expect(avgClose).toBeLessThan(500); // Closing should be fast
  });

  test("MCP Integration: Accessibility validation with detailed reporting", async () => {
    await spotlightUtils.activateSpotlight();

    // Comprehensive accessibility check
    await spotlightUtils.verifyAccessibility();

    // Additional MCP-specific accessibility tests
    const accessibilityReport = await page.evaluate(() => {
      const report = {
        focusableElements: [],
        ariaLabels: [],
        keyboardNavigation: true,
        colorContrast: true, // Would need actual color analysis
        semanticStructure: true,
      };

      // Check focusable elements
      const focusableSelectors = [
        "input",
        "button",
        '[tabindex="0"]',
        '[role="button"]',
      ];

      focusableSelectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          report.focusableElements.push({
            tagName: el.tagName,
            role: el.getAttribute("role"),
            ariaLabel: el.getAttribute("aria-label"),
            tabIndex: el.getAttribute("tabindex"),
          });
        });
      });

      // Check ARIA labels
      const ariaElements = document.querySelectorAll(
        "[aria-label], [aria-labelledby], [aria-describedby]"
      );
      ariaElements.forEach((el) => {
        report.ariaLabels.push({
          tagName: el.tagName,
          ariaLabel: el.getAttribute("aria-label"),
          ariaLabelledBy: el.getAttribute("aria-labelledby"),
          ariaDescribedBy: el.getAttribute("aria-describedby"),
        });
      });

      return report;
    });

    // Log accessibility report for MCP analysis
    console.log(
      "Accessibility Report:",
      JSON.stringify(accessibilityReport, null, 2)
    );

    // Take screenshot for accessibility analysis
    await spotlightUtils.takeScreenshotWithMetadata(
      "accessibility-validation.png"
    );

    // Verify accessibility requirements
    expect(accessibilityReport.focusableElements.length).toBeGreaterThan(0);
    expect(accessibilityReport.ariaLabels.length).toBeGreaterThan(0);

    // Test keyboard-only navigation
    await page.keyboard.press("Tab");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // Should navigate to chat interface using only keyboard
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();

    // Test escape navigation
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="workflow-list"]')).toBeVisible();

    await page.keyboard.press("Escape");
    expect(await spotlightUtils.isOverlayVisible()).toBe(false);
  });

  test("MCP Integration: Error handling and recovery validation", async () => {
    const errorScenarios = [];

    // Test network error scenario
    try {
      await spotlightUtils.simulateNetworkError();
      await spotlightUtils.navigateToWorkflow("AI Ask");
      await spotlightUtils.sendChatMessage(
        "This should handle network error gracefully"
      );

      // Should show user message even if AI response fails
      await expect(
        page.locator("text=This should handle network error gracefully")
      ).toBeVisible();

      errorScenarios.push({
        scenario: "network-error",
        success: true,
        message: "Extension handled network error gracefully",
      });

      await spotlightUtils.takeScreenshotWithMetadata(
        "error-network-handled.png"
      );
    } catch (error) {
      errorScenarios.push({
        scenario: "network-error",
        success: false,
        error: error.message,
      });
    } finally {
      await spotlightUtils.clearNetworkSimulation();
    }

    // Test rapid interaction scenario
    try {
      await spotlightUtils.testRapidInteractions(
        TestConfig.RAPID_INTERACTION_COUNT
      );

      errorScenarios.push({
        scenario: "rapid-interactions",
        success: true,
        message: "Extension handled rapid interactions without issues",
      });
    } catch (error) {
      errorScenarios.push({
        scenario: "rapid-interactions",
        success: false,
        error: error.message,
      });
    }

    // Test memory pressure scenario
    try {
      await page.evaluate(() => {
        // Create memory pressure
        const arrays = [];
        for (let i = 0; i < 100; i++) {
          arrays.push(new Array(10000).fill("memory-test"));
        }
        (window as any).memoryTestArrays = arrays;
      });

      // Extension should still work under memory pressure
      await spotlightUtils.activateSpotlight();
      await spotlightUtils.verifyDefaultWorkflows();
      await spotlightUtils.closeSpotlight();

      errorScenarios.push({
        scenario: "memory-pressure",
        success: true,
        message: "Extension worked under memory pressure",
      });

      // Cleanup
      await page.evaluate(() => {
        delete (window as any).memoryTestArrays;
      });
    } catch (error) {
      errorScenarios.push({
        scenario: "memory-pressure",
        success: false,
        error: error.message,
      });
    }

    // Log error scenarios for MCP analysis
    console.log("Error Scenarios:", JSON.stringify(errorScenarios, null, 2));

    // Verify most error scenarios were handled successfully
    const successfulScenarios = errorScenarios.filter((s) => s.success);
    expect(successfulScenarios.length).toBeGreaterThanOrEqual(2);
  });

  test("MCP Integration: Complete end-to-end workflow validation", async () => {
    // This test runs a complete end-to-end workflow that demonstrates
    // all major features working together for MCP validation

    const e2eResults = {
      steps: [],
      screenshots: [],
      performance: {},
      errors: [],
    };

    try {
      // Step 1: Initial page load and extension availability
      e2eResults.steps.push("Page loaded and extension available");
      await spotlightUtils.takeScreenshotWithMetadata("e2e-step-1-loaded.png");
      e2eResults.screenshots.push("e2e-step-1-loaded.png");

      // Step 2: CMD+K activation
      const activationStart = Date.now();
      await spotlightUtils.activateSpotlight();
      e2eResults.performance.activationTime = Date.now() - activationStart;
      e2eResults.steps.push("Extension activated with CMD+K");
      await spotlightUtils.takeScreenshotWithMetadata(
        "e2e-step-2-activated.png"
      );
      e2eResults.screenshots.push("e2e-step-2-activated.png");

      // Step 3: Verify default workflows
      await spotlightUtils.verifyDefaultWorkflows();
      e2eResults.steps.push("Default workflows verified");

      // Step 4: Keyboard navigation
      await spotlightUtils.testKeyboardNavigation();
      e2eResults.steps.push("Keyboard navigation tested");
      await spotlightUtils.takeScreenshotWithMetadata(
        "e2e-step-4-navigation.png"
      );
      e2eResults.screenshots.push("e2e-step-4-navigation.png");

      // Step 5: Enter AI Ask workflow
      await spotlightUtils.navigateToWorkflow("AI Ask");
      e2eResults.steps.push("Navigated to AI Ask workflow");
      await spotlightUtils.takeScreenshotWithMetadata("e2e-step-5-ai-ask.png");
      e2eResults.screenshots.push("e2e-step-5-ai-ask.png");

      // Step 6: Send chat messages
      const messages = TestData.TEST_MESSAGES.slice(0, 2);
      for (let i = 0; i < messages.length; i++) {
        await spotlightUtils.sendChatMessage(messages[i]);
        e2eResults.steps.push(`Sent chat message ${i + 1}: "${messages[i]}"`);
        await spotlightUtils.takeScreenshotWithMetadata(
          `e2e-step-6-${i}-message.png`
        );
        e2eResults.screenshots.push(`e2e-step-6-${i}-message.png`);
      }

      // Step 7: Navigate back to workflow list
      await page.keyboard.press("Escape");
      e2eResults.steps.push("Navigated back to workflow list");
      await spotlightUtils.takeScreenshotWithMetadata(
        "e2e-step-7-back-to-list.png"
      );
      e2eResults.screenshots.push("e2e-step-7-back-to-list.png");

      // Step 8: Test AI Agent workflow
      await spotlightUtils.navigateToWorkflow("AI Agent");
      e2eResults.steps.push("Navigated to AI Agent workflow");
      await spotlightUtils.sendChatMessage("AI Agent test message");
      e2eResults.steps.push("Sent message to AI Agent");
      await spotlightUtils.takeScreenshotWithMetadata(
        "e2e-step-8-ai-agent.png"
      );
      e2eResults.screenshots.push("e2e-step-8-ai-agent.png");

      // Step 9: Test Close workflow
      await page.keyboard.press("Escape");
      await spotlightUtils.navigateToWorkflow("Close");
      e2eResults.steps.push("Executed Close workflow");

      // Step 10: Verify extension closed
      expect(await spotlightUtils.isOverlayVisible()).toBe(false);
      e2eResults.steps.push("Extension closed successfully");
      await spotlightUtils.takeScreenshotWithMetadata("e2e-step-10-closed.png");
      e2eResults.screenshots.push("e2e-step-10-closed.png");

      // Step 11: Test reactivation
      await spotlightUtils.activateSpotlight();
      e2eResults.steps.push("Extension reactivated successfully");
      await spotlightUtils.closeSpotlight();

      e2eResults.success = true;
    } catch (error) {
      e2eResults.errors.push(error.message);
      e2eResults.success = false;
    }

    // Log complete E2E results for MCP analysis
    console.log("E2E Test Results:", JSON.stringify(e2eResults, null, 2));

    // Verify E2E test was successful
    expect(e2eResults.success).toBe(true);
    expect(e2eResults.steps.length).toBeGreaterThan(10);
    expect(e2eResults.screenshots.length).toBeGreaterThan(8);
    expect(e2eResults.performance.activationTime).toBeLessThan(
      TestConfig.MAX_ACTIVATION_TIME
    );
  });
});
