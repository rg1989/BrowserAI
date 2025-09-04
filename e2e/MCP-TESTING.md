# MCP (Model Context Protocol) Testing for Spotlight Browser Extension

This document describes the comprehensive MCP testing setup for the Spotlight Browser Extension, designed to validate end-to-end functionality using MCP browser tools integration.

## Overview

The MCP testing suite provides:

- **Comprehensive E2E validation** with detailed state capture and logging
- **Screenshot-based testing** with metadata for MCP analysis
- **Performance monitoring** with detailed metrics collection
- **Cross-page behavior validation** across different website types
- **Accessibility compliance testing** for MCP standards
- **Error handling and recovery validation**
- **Multi-step workflow testing** with breadcrumb tracking

## Test Structure

### Core Test Files

1. **`mcp-playwright-integration.spec.ts`** - Enhanced integration tests with MCP-specific features
2. **`mcp-browser-integration.spec.ts`** - Comprehensive MCP browser tool integration tests
3. **`mcp-config.ts`** - Configuration and utilities for MCP testing
4. **`run-mcp-tests.ts`** - Test runner with report generation

### Test Categories

#### 1. Core Extension Functionality

- CMD+K overlay activation with state capture
- Keyboard navigation with detailed logging
- Workflow execution with performance monitoring
- Search field focus management

#### 2. Chat Interface Testing

- Message sending and display validation
- Input validation and edge cases
- Keyboard shortcuts (Enter, Shift+Enter)
- State management across workflows

#### 3. Multi-step Navigation

- Breadcrumb display and updates
- Navigation state tracking
- Workflow transitions with data passing
- Back navigation and state restoration

#### 4. Cross-page Behavior

- Extension functionality across different websites
- State isolation between tabs
- Page refresh handling
- Dynamic content compatibility

#### 5. Performance and Reliability

- Activation time measurement
- Memory pressure testing
- Rapid interaction handling
- Network error recovery

#### 6. Accessibility Validation

- Keyboard-only navigation
- Focus management
- ARIA attributes validation
- Screen reader compatibility

## Running MCP Tests

### Quick Start

```bash
# Run all MCP tests
npm run test:e2e:mcp

# Run MCP tests with UI (interactive)
npm run test:e2e:mcp:ui

# Run MCP tests in headed mode (visible browser)
npm run test:e2e:mcp:headed

# Run comprehensive MCP test suite with reports
npm run test:mcp
```

### Advanced Usage

```bash
# Run specific MCP test file
npx playwright test e2e/mcp-browser-integration.spec.ts --project=chromium-mcp

# Run with custom output directory
ts-node e2e/run-mcp-tests.ts --output-dir custom-reports

# Run with specific report format
ts-node e2e/run-mcp-tests.ts --format html

# Run without screenshots
ts-node e2e/run-mcp-tests.ts --no-screenshots
```

## MCP Integration Features

### Screenshot Capture with Metadata

Every test captures screenshots with detailed metadata:

```typescript
await spotlightUtils.takeScreenshotWithMetadata("test-step-1.png");
```

Metadata includes:

- Timestamp
- Current URL
- Viewport size
- Extension state
- Current workflow
- Performance metrics

### State Capture and Logging

Comprehensive state capture for MCP analysis:

```typescript
const state = await spotlightUtils.capturePageState();
console.log("Extension State:", JSON.stringify(state, null, 2));
```

State includes:

- Page information
- Extension overlay status
- Focused elements
- Workflow items
- Chat messages
- Search field values
- Breadcrumb text

### Performance Monitoring

Detailed performance metrics collection:

```typescript
const performanceMetrics = {
  activationTime: 250,
  navigationTime: 100,
  workflowTime: 500,
  closeTime: 150,
};
```

### Accessibility Validation

Comprehensive accessibility testing:

```typescript
const accessibilityReport = await spotlightUtils.validateAccessibility();
```

Includes:

- Focusable elements count
- ARIA labels validation
- Keyboard navigation testing
- Focus management verification

## Test Configuration

### Browser Settings

MCP tests use optimized browser settings:

```typescript
const mcpBrowserConfig = {
  headless: false, // MCP tools work better with visible browser
  viewport: { width: 1280, height: 720 },
  args: [
    "--disable-web-security", // For MCP testing across domains
    "--enable-automation", // Better MCP tool integration
    "--disable-features=VizDisplayCompositor", // Better MCP compatibility
  ],
};
```

### Performance Thresholds

```typescript
const performanceThresholds = {
  maxActivationTime: 1000, // ms
  maxNavigationTime: 500, // ms
  maxWorkflowLoadTime: 2000, // ms
  maxCloseTime: 500, // ms
};
```

## Test Data and URLs

### Test URLs

- `https://example.com` - Basic HTML testing
- `https://httpbin.org/html` - Simple HTML structure
- `https://jsonplaceholder.typicode.com` - API documentation site
- Data URLs for controlled testing environments

### Test Messages

- "MCP integration test message"
- "Testing chat functionality with MCP"
- "Validate message handling"
- "Performance test message"

## Report Generation

### JSON Reports

Detailed JSON reports include:

- Test summary and statistics
- Individual test results
- Performance metrics
- Screenshot metadata
- Environment information

### HTML Reports

Visual HTML reports with:

- Interactive test results
- Performance charts
- Screenshot galleries
- Error details
- Environment information

### Report Location

Reports are saved to:

- `e2e/mcp-reports/` - Main report directory
- `e2e/screenshots/` - Screenshot files with metadata
- `e2e/mcp-reports/mcp-test-report.json` - JSON report
- `e2e/mcp-reports/mcp-test-report.html` - HTML report

## MCP Browser Tools Integration

### Compatible MCP Tools

The tests are designed to work with:

- MCP Playwright browser tools
- MCP screenshot analysis tools
- MCP performance monitoring tools
- MCP accessibility validation tools

### MCP Tool Usage Examples

```typescript
// Take screenshot for MCP analysis
await mcpBrowserTools.takeScreenshot("workflow-test.png", {
  metadata: { testStep: "workflow-navigation" },
});

// Capture state for MCP debugging
const state = await mcpBrowserTools.capturePageState();

// Monitor network requests for MCP analysis
const requests = await mcpBrowserTools.monitorNetworkRequests();

// Validate accessibility for MCP compliance
const a11yReport = await mcpBrowserTools.validateAccessibility();
```

## Troubleshooting

### Common Issues

1. **Extension not loading**

   - Ensure `npm run build:test` completes successfully
   - Check that `build/chrome-mv3-prod/manifest.json` exists

2. **Tests timing out**

   - Increase timeout values in test configuration
   - Check network connectivity for external URLs

3. **Screenshots not saving**

   - Ensure `e2e/screenshots/` directory exists
   - Check file permissions

4. **MCP tools not connecting**
   - Verify browser launch arguments
   - Check MCP tool configuration

### Debug Mode

Run tests with debug output:

```bash
DEBUG=pw:api npm run test:e2e:mcp
```

### Verbose Logging

Enable detailed logging in tests:

```typescript
MCPConfig.mcp.enableDetailedLogging = true;
```

## Best Practices

### Test Writing

1. **Use descriptive test names** that explain the MCP validation purpose
2. **Capture state before and after** each major operation
3. **Take screenshots at key points** for MCP analysis
4. **Log performance metrics** for monitoring
5. **Validate accessibility** in each test

### MCP Integration

1. **Use consistent metadata** across screenshots
2. **Log structured data** for MCP analysis
3. **Monitor performance** throughout tests
4. **Validate error handling** scenarios
5. **Test cross-browser compatibility** where applicable

### Maintenance

1. **Update test data** regularly
2. **Review performance thresholds** periodically
3. **Clean up old screenshots** and reports
4. **Update MCP tool configurations** as needed
5. **Document test changes** and new features

## Contributing

When adding new MCP tests:

1. Follow the existing test structure
2. Include comprehensive state capture
3. Add appropriate screenshots with metadata
4. Update this documentation
5. Test with actual MCP tools when possible

## Requirements Validation

This MCP testing setup validates all requirements from task 15:

- ✅ **Configure Playwright MCP for browser extension testing**
- ✅ **Write E2E tests for CMD+K overlay activation and focus**
- ✅ **Test complete keyboard navigation sequences**
- ✅ **Verify workflow execution and chat interface interactions**
- ✅ **Test multi-step navigation and breadcrumb display**
- ✅ **Validate extension behavior across different web pages**

All tests include detailed logging, screenshot capture, and state validation for comprehensive MCP analysis and debugging.
