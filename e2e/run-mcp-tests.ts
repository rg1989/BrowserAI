#!/usr/bin/env ts-node

/**
 * MCP Test Runner
 *
 * This script runs the MCP-specific Playwright tests and generates
 * comprehensive reports for MCP browser tool integration validation.
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

interface MCPTestConfig {
  testFiles: string[];
  outputDir: string;
  reportFormat: "json" | "html" | "both";
  includeScreenshots: boolean;
  includePerformanceMetrics: boolean;
}

class MCPTestRunner {
  private config: MCPTestConfig;
  private results: any[] = [];

  constructor(config: Partial<MCPTestConfig> = {}) {
    this.config = {
      testFiles: [
        "e2e/mcp-playwright-integration.spec.ts",
        "e2e/mcp-browser-integration.spec.ts",
      ],
      outputDir: "e2e/mcp-reports",
      reportFormat: "both",
      includeScreenshots: true,
      includePerformanceMetrics: true,
      ...config,
    };
  }

  async run(): Promise<void> {
    console.log("🚀 Starting MCP Playwright Tests...");

    // Ensure output directory exists
    this.ensureOutputDirectory();

    // Ensure screenshots directory exists
    this.ensureScreenshotsDirectory();

    // Build extension first
    await this.buildExtension();

    // Run MCP-specific tests
    await this.runTests();

    // Generate reports
    await this.generateReports();

    console.log("✅ MCP Playwright Tests completed!");
  }

  private ensureOutputDirectory(): void {
    if (!existsSync(this.config.outputDir)) {
      mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  private ensureScreenshotsDirectory(): void {
    const screenshotsDir = "e2e/screenshots";
    if (!existsSync(screenshotsDir)) {
      mkdirSync(screenshotsDir, { recursive: true });
    }
  }

  private async buildExtension(): Promise<void> {
    console.log("🔨 Building extension for MCP testing...");

    try {
      execSync("npm run build:test", {
        stdio: "inherit",
        cwd: path.join(__dirname, ".."),
      });
      console.log("✅ Extension built successfully");
    } catch (error) {
      console.error("❌ Failed to build extension:", error);
      process.exit(1);
    }
  }

  private async runTests(): Promise<void> {
    console.log("🧪 Running MCP tests...");

    for (const testFile of this.config.testFiles) {
      console.log(`Running ${testFile}...`);

      try {
        const command = `npx playwright test ${testFile} --project=chromium-mcp --reporter=json`;
        const output = execSync(command, {
          cwd: path.join(__dirname, ".."),
          encoding: "utf8",
        });

        // Parse test results
        try {
          const result = JSON.parse(output);
          this.results.push({
            testFile,
            success: true,
            result,
          });
        } catch (parseError) {
          // If JSON parsing fails, still record the test as run
          this.results.push({
            testFile,
            success: true,
            result: { output },
          });
        }

        console.log(`✅ ${testFile} completed`);
      } catch (error) {
        console.error(`❌ ${testFile} failed:`, error);
        this.results.push({
          testFile,
          success: false,
          error: error.toString(),
        });
      }
    }
  }

  private async generateReports(): Promise<void> {
    console.log("📊 Generating MCP test reports...");

    const report = {
      summary: {
        totalTestFiles: this.config.testFiles.length,
        successfulTestFiles: this.results.filter((r) => r.success).length,
        failedTestFiles: this.results.filter((r) => !r.success).length,
        timestamp: new Date().toISOString(),
      },
      configuration: this.config,
      results: this.results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };

    // Generate JSON report
    if (
      this.config.reportFormat === "json" ||
      this.config.reportFormat === "both"
    ) {
      const jsonReportPath = path.join(
        this.config.outputDir,
        "mcp-test-report.json"
      );
      writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
      console.log(`📄 JSON report saved to ${jsonReportPath}`);
    }

    // Generate HTML report
    if (
      this.config.reportFormat === "html" ||
      this.config.reportFormat === "both"
    ) {
      const htmlReport = this.generateHTMLReport(report);
      const htmlReportPath = path.join(
        this.config.outputDir,
        "mcp-test-report.html"
      );
      writeFileSync(htmlReportPath, htmlReport);
      console.log(`📄 HTML report saved to ${htmlReportPath}`);
    }

    // Generate summary
    this.printSummary(report);
  }

  private generateHTMLReport(report: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Playwright Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .metric { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 24px; font-weight: bold; color: #007acc; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
        .test-results { margin-top: 20px; }
        .test-file { background: white; margin-bottom: 15px; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .test-file h3 { margin: 0 0 10px 0; }
        .status { padding: 4px 8px; border-radius: 4px; color: white; font-size: 12px; }
        .status.success { background: #28a745; }
        .status.error { background: #dc3545; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>MCP Playwright Test Report</h1>
        <p>Generated on ${report.summary.timestamp}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Total Test Files</h3>
            <div class="value">${report.summary.totalTestFiles}</div>
        </div>
        <div class="metric">
            <h3>Successful</h3>
            <div class="value success">${
              report.summary.successfulTestFiles
            }</div>
        </div>
        <div class="metric">
            <h3>Failed</h3>
            <div class="value error">${report.summary.failedTestFiles}</div>
        </div>
        <div class="metric">
            <h3>Success Rate</h3>
            <div class="value">${Math.round(
              (report.summary.successfulTestFiles /
                report.summary.totalTestFiles) *
                100
            )}%</div>
        </div>
    </div>

    <div class="test-results">
        <h2>Test Results</h2>
        ${report.results
          .map(
            (result: any) => `
            <div class="test-file">
                <h3>
                    ${result.testFile}
                    <span class="status ${
                      result.success ? "success" : "error"
                    }">
                        ${result.success ? "PASSED" : "FAILED"}
                    </span>
                </h3>
                ${
                  result.error ? `<pre class="error">${result.error}</pre>` : ""
                }
                ${
                  result.result && typeof result.result === "object"
                    ? `<pre>${JSON.stringify(result.result, null, 2)}</pre>`
                    : ""
                }
            </div>
        `
          )
          .join("")}
    </div>

    <div class="environment">
        <h2>Environment</h2>
        <pre>${JSON.stringify(report.environment, null, 2)}</pre>
    </div>
</body>
</html>`;
  }

  private printSummary(report: any): void {
    console.log("\n📊 MCP Test Summary:");
    console.log(`   Total test files: ${report.summary.totalTestFiles}`);
    console.log(`   Successful: ${report.summary.successfulTestFiles}`);
    console.log(`   Failed: ${report.summary.failedTestFiles}`);
    console.log(
      `   Success rate: ${Math.round(
        (report.summary.successfulTestFiles / report.summary.totalTestFiles) *
          100
      )}%`
    );

    if (report.summary.failedTestFiles > 0) {
      console.log("\n❌ Failed tests:");
      report.results
        .filter((r: any) => !r.success)
        .forEach((r: any) => {
          console.log(`   - ${r.testFile}`);
        });
    }

    console.log(`\n📁 Reports saved to: ${this.config.outputDir}`);

    if (this.config.includeScreenshots) {
      console.log("📸 Screenshots saved to: e2e/screenshots");
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const config: Partial<MCPTestConfig> = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--output-dir":
        config.outputDir = args[++i];
        break;
      case "--format":
        config.reportFormat = args[++i] as "json" | "html" | "both";
        break;
      case "--no-screenshots":
        config.includeScreenshots = false;
        break;
      case "--no-performance":
        config.includePerformanceMetrics = false;
        break;
      case "--test-file":
        config.testFiles = config.testFiles || [];
        config.testFiles.push(args[++i]);
        break;
    }
  }

  const runner = new MCPTestRunner(config);
  runner.run().catch((error) => {
    console.error("❌ MCP test runner failed:", error);
    process.exit(1);
  });
}

export { MCPTestRunner };
