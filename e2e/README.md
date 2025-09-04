# E2E Testing for Spotlight Browser Extension

This directory contains end-to-end tests for the Spotlight Browser Extension using Playwright.

## Setup

The E2E tests require the extension to be built before running. This is handled automatically by the global setup script.

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI mode (interactive)
npm run test:e2e:ui

# Run E2E tests in headed mode (visible browser)
npm run test:e2e:headed

# Run all tests (unit + E2E)
npm run test:all
```

## Test Structure

### `extension-e2e.spec.ts`

Core functionality tests:

- CMD+K overlay activation
- Keyboard navigation
- Basic workflow execution
- Overlay positioning and styling

### `workflow-execution.spec.ts`

Workflow-specific tests:

- AI Ask and AI Agent workflows
- Chat interface interactions
- Search and form workflows
- Complex navigation sequences

### `cross-page-behavior.spec.ts`

Cross-page functionality tests:

- Extension behavior on different websites
- State persistence across navigation
- Multi-tab behavior
- Performance on heavy pages

## Test Data Attributes

The tests rely on `data-testid` attributes in the components:

- `spotlight-overlay`: Main overlay container
- `spotlight-overlay-container`: Overlay wrapper with backdrop
- `search-field`: Main search input field
- `workflow-list`: List of available workflows
- `workflow-item`: Individual workflow option
- `chat-interface`: Chat interface component
- `message-list`: Chat message history
- `prompt-input`: Chat input field
- `send-button`: Chat send button
- `search-interface`: Search workflow interface
- `form-interface`: Form workflow interface
- `loader-interface`: Loading workflow interface

## Browser Extension Testing

The tests use Chromium with the extension loaded via command line arguments:

- `--disable-extensions-except=<path>`: Only load our extension
- `--load-extension=<path>`: Load the extension from build directory
- `--no-sandbox`: Required for CI environments

## Debugging

- Use `npm run test:e2e:ui` for interactive debugging
- Use `npm run test:e2e:headed` to see the browser during tests
- Screenshots and videos are captured on test failures
- Traces are recorded on retry for detailed debugging

## CI/CD Considerations

- Tests run in single worker mode to avoid conflicts
- Extension is built automatically before tests
- Retries are enabled in CI environments
- HTML reports are generated for test results

## Adding New Tests

1. Create test files in the `e2e/` directory
2. Use the existing test structure as a template
3. Ensure proper `data-testid` attributes are added to components
4. Test both keyboard and mouse interactions
5. Include error scenarios and edge cases

## Troubleshooting

### Extension Not Loading

- Ensure `npm run build:test` completes successfully
- Check that `build/chrome-mv3-prod/manifest.json` exists
- Verify extension permissions in manifest

### Tests Timing Out

- Increase timeout values for slow networks
- Use `waitForLoadState('networkidle')` for dynamic pages
- Add explicit waits for extension initialization

### Flaky Tests

- Use `waitForTimeout()` sparingly, prefer element-based waits
- Ensure proper cleanup between tests
- Check for race conditions in async operations
