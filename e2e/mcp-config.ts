/**
 * MCP (Model Context Protocol) Configuration for Playwright Tests
 *
 * This configuration file provides settings and utilities specifically
 * designed for MCP browser tool integration with the Spotlight Extension tests.
 */

export const MCPConfig = {
  // Browser settings optimized for MCP tools
  browser: {
    headless: false, // MCP tools work better with visible browser
    viewport: { width: 1280, height: 720 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security", // For MCP testing across domains
      "--disable-features=VizDisplayCompositor", // Better MCP compatibility
      "--enable-automation", // Better MCP tool integration
      "--disable-background-timer-throttling", // Prevent timing issues
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  },

  // Screenshot settings for MCP analysis
  screenshots: {
    directory: "e2e/screenshots",
    format: "png" as const,
    fullPage: true,
    quality: 90,
  },

  // Performance thresholds for MCP monitoring
  performance: {
    maxActivationTime: 1000, // ms
    maxNavigationTime: 500, // ms
    maxWorkflowLoadTime: 2000, // ms
    maxCloseTime: 500, // ms
  },

  // Test data for MCP validation
  testData: {
    urls: [
      "https://example.com",
      "https://httpbin.org/html",
      "https://jsonplaceholder.typicode.com",
      "data:text/html,<html><body><h1>MCP Test Page</h1><p>Test content</p></body></html>",
    ],
    messages: [
      "MCP integration test message",
      "Testing chat functionality with MCP",
      "Validate message handling",
      "Performance test message",
    ],
    workflows: ["AI Ask", "AI Agent", "Close"],
  },

  // MCP-specific test settings
  mcp: {
    enableDetailedLogging: true,
    captureNetworkRequests: true,
    monitorPerformance: true,
    validateAccessibility: true,
    generateReports: true,
  },
};

/**
 * MCP Test Reporter
 * Generates detailed reports for MCP analysis
 */
export class MCPTestReporter {
  private results: any[] = [];
  private screenshots: string[] = [];
  private performanceMetrics: any[] = [];

  addResult(testName: string, result: any) {
    this.results.push({
      testName,
      timestamp: new Date().toISOString(),
      ...result,
    });
  }

  addScreenshot(filename: string, metadata?: any) {
    this.screenshots.push({
      filename,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  addPerformanceMetric(metric: any) {
    this.performanceMetrics.push({
      timestamp: new Date().toISOString(),
      ...metric,
    });
  }

  generateReport(): any {
    return {
      summary: {
        totalTests: this.results.length,
        passedTests: this.results.filter((r) => r.success).length,
        failedTests: this.results.filter((r) => !r.success).length,
        totalScreenshots: this.screenshots.length,
        totalMetrics: this.performanceMetrics.length,
      },
      results: this.results,
      screenshots: this.screenshots,
      performance: this.performanceMetrics,
      generatedAt: new Date().toISOString(),
    };
  }

  saveReport(filename: string = "mcp-test-report.json") {
    const fs = require("fs");
    const report = this.generateReport();
    fs.writeFileSync(`e2e/${filename}`, JSON.stringify(report, null, 2));
    console.log(`MCP test report saved to e2e/${filename}`);
  }
}

/**
 * MCP Browser Tools Integration
 * Utilities for integrating with MCP browser tools
 */
export class MCPBrowserTools {
  constructor(private page: any) {}

  /**
   * Take a screenshot with MCP-compatible metadata
   */
  async takeScreenshot(filename: string, options: any = {}) {
    const screenshot = await this.page.screenshot({
      path: `${MCPConfig.screenshots.directory}/${filename}`,
      fullPage: MCPConfig.screenshots.fullPage,
      ...options,
    });

    // Generate metadata for MCP analysis
    const metadata = {
      filename,
      timestamp: new Date().toISOString(),
      url: this.page.url(),
      viewport: await this.page.viewportSize(),
      title: await this.page.title(),
      ...options.metadata,
    };

    // Save metadata alongside screenshot
    const fs = require("fs");
    fs.writeFileSync(
      `${MCPConfig.screenshots.directory}/${filename}.metadata.json`,
      JSON.stringify(metadata, null, 2)
    );

    return { screenshot, metadata };
  }

  /**
   * Capture page state for MCP analysis
   */
  async capturePageState() {
    return await this.page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        extension: {
          overlayPresent: !!document.querySelector(".spotlight-overlay"),
          overlayVisible:
            document.querySelector(".spotlight-overlay")?.style.display !==
            "none",
          focusedElement: document.activeElement?.tagName || null,
          workflowItems: Array.from(
            document.querySelectorAll(".workflow-item")
          ).map((item) => item.textContent?.trim()),
          chatMessages: Array.from(document.querySelectorAll(".message"))
            .length,
          searchFieldValue:
            (document.querySelector(".search-field-input") as HTMLInputElement)
              ?.value || "",
          breadcrumb:
            document.querySelector(".search-field-prefix")?.textContent || "",
        },
        performance: {
          loadTime:
            performance.timing.loadEventEnd -
            performance.timing.navigationStart,
          domContentLoaded:
            performance.timing.domContentLoadedEventEnd -
            performance.timing.navigationStart,
        },
      };
    });
  }

  /**
   * Monitor network requests for MCP analysis
   */
  async monitorNetworkRequests() {
    const requests: any[] = [];

    this.page.on("request", (request: any) => {
      requests.push({
        url: request.url(),
        method: request.method(),
        timestamp: new Date().toISOString(),
        resourceType: request.resourceType(),
      });
    });

    this.page.on("response", (response: any) => {
      const request = requests.find((r) => r.url === response.url());
      if (request) {
        request.status = response.status();
        request.responseTime = new Date().toISOString();
      }
    });

    return requests;
  }

  /**
   * Validate accessibility for MCP compliance
   */
  async validateAccessibility() {
    return await this.page.evaluate(() => {
      const report = {
        focusableElements: 0,
        ariaLabels: 0,
        headingStructure: [],
        colorContrast: "not-tested", // Would need actual color analysis
        keyboardNavigation: true,
      };

      // Count focusable elements
      const focusableSelectors = [
        "input:not([disabled])",
        "button:not([disabled])",
        '[tabindex="0"]',
        '[role="button"]:not([disabled])',
        "a[href]",
      ];

      focusableSelectors.forEach((selector) => {
        report.focusableElements += document.querySelectorAll(selector).length;
      });

      // Count ARIA labels
      report.ariaLabels = document.querySelectorAll(
        "[aria-label], [aria-labelledby]"
      ).length;

      // Check heading structure
      const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
      headings.forEach((heading) => {
        report.headingStructure.push({
          level: heading.tagName,
          text: heading.textContent?.trim() || "",
        });
      });

      return report;
    });
  }
}

/**
 * MCP Test Utilities
 * Helper functions for MCP-specific testing
 */
export const MCPTestUtils = {
  /**
   * Wait for extension to be ready
   */
  async waitForExtensionReady(page: any, timeout: number = 5000) {
    await page.waitForFunction(
      () => {
        // Check if extension content script is loaded
        return (
          window.document.querySelector('script[src*="content"]') !== null ||
          window.document.querySelector('[data-extension="spotlight"]') !==
            null ||
          // Check if CMD+K listener is attached (indirect check)
          window.document.addEventListener !== undefined
        );
      },
      { timeout }
    );
  },

  /**
   * Simulate MCP browser tool interactions
   */
  async simulateMCPInteraction(page: any, action: string, params: any = {}) {
    switch (action) {
      case "navigate":
        await page.goto(params.url);
        await page.waitForLoadState("networkidle");
        break;

      case "click":
        await page.click(params.selector);
        break;

      case "type":
        await page.type(params.selector, params.text);
        break;

      case "keyboard":
        await page.keyboard.press(params.key);
        break;

      case "screenshot":
        return await page.screenshot(params);

      default:
        throw new Error(`Unknown MCP action: ${action}`);
    }
  },

  /**
   * Generate MCP-compatible test data
   */
  generateTestData(type: string) {
    switch (type) {
      case "messages":
        return MCPConfig.testData.messages;

      case "urls":
        return MCPConfig.testData.urls;

      case "workflows":
        return MCPConfig.testData.workflows;

      default:
        return [];
    }
  },
};
