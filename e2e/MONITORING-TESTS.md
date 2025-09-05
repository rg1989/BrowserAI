# Page Context Monitoring E2E Tests

This directory contains comprehensive end-to-end tests for the Page Context Monitoring system in the Spotlight Browser Extension.

## Overview

The monitoring test suite validates the complete functionality of the page context monitoring system, including:

- **Network Monitoring**: Request/response interception and privacy controls
- **DOM Observation**: Mutation tracking, viewport changes, and interaction monitoring
- **Context Collection**: Content analysis, semantic extraction, and data aggregation
- **Plugin Integration**: Enhanced context providers and API integration
- **Performance Validation**: System performance impact and optimization
- **Privacy Validation**: Data redaction, user consent, and security controls

## Test Structure

### Core Test Files

#### `page-context-monitoring.spec.ts`
Complete monitoring pipeline tests covering:
- Network request/response monitoring
- DOM change detection and tracking
- Viewport and scroll change monitoring
- Semantic data extraction
- Plugin API integration
- AI chat context integration
- Cross-page navigation behavior
- Monitoring enable/disable states
- Performance impact validation

#### `network-monitoring.spec.ts`
Specialized network monitoring tests:
- HTTP request/response capture
- Different request types (fetch, XHR, form submissions)
- Request/response headers and timing
- Error handling and failure scenarios
- Privacy controls for sensitive data
- Rolling buffer management
- AI integration with network context

#### `performance-validation.spec.ts`
Performance impact and optimization tests:
- Page load performance monitoring
- DOM observation performance under load
- Network monitoring performance impact
- Memory usage and cleanup validation
- High-load scenario testing
- Cross-tab performance isolation
- Monitoring throttling under stress
- Performance across different page types

#### `privacy-validation.spec.ts`
Privacy and security validation tests:
- Sensitive data redaction in forms
- Network request privacy filtering
- Domain exclusion functionality
- Data retention and cleanup policies
- User consent and opt-out mechanisms
- Cross-origin privacy protection
- AI chat privacy integration
- Privacy settings persistence

#### `plugin-integration.spec.ts`
Plugin API integration tests:
- Plugin detection and integration
- Enhanced context retrieval
- Schema validation and data structure
- Real-time plugin updates
- Plugin context with AI chat
- Error handling and graceful degradation
- Capability negotiation
- Performance optimization
- Fallback to universal monitoring

### Utility Files

#### `monitoring-test-utils.ts`
Specialized utility functions for monitoring tests:
- `createTestPageWithContent()`: Creates rich test pages
- `createPluginEnabledPage()`: Creates pages with plugin APIs
- `triggerNetworkActivity()`: Generates network requests
- `triggerDOMChanges()`: Creates DOM mutations
- `testFormInteractions()`: Tests form monitoring
- `testViewportChanges()`: Tests scroll/viewport tracking
- `verifyMonitoringData()`: Validates captured data
- `testPrivacyControls()`: Tests privacy mechanisms
- `measurePerformanceImpact()`: Performance measurement
- `testCrossTabBehavior()`: Multi-tab testing

#### `run-monitoring-tests.ts`
Comprehensive test runner with:
- Sequential test suite execution
- Performance timing and reporting
- Error handling and debugging tips
- Summary report generation
- Individual test suite targeting

## Running Tests

### All Monitoring Tests
```bash
# Run complete monitoring test suite
npm run test:e2e:monitoring

# Run all tests including monitoring
npm run test:all:monitoring
```

### Individual Test Suites
```bash
# Core monitoring pipeline
npm run test:e2e:monitoring:pipeline

# Network monitoring only
npm run test:e2e:monitoring:network

# Performance validation
npm run test:e2e:monitoring:performance

# Privacy validation
npm run test:e2e:monitoring:privacy

# Plugin integration
npm run test:e2e:monitoring:plugin
```

### Debug Mode
```bash
# Run with visible browser for debugging
npm run test:e2e:monitoring:headed

# Run specific test with UI mode
npx playwright test --ui e2e/page-context-monitoring.spec.ts
```

### Targeted Testing
```bash
# Run specific test runner with suite name
npx ts-node e2e/run-monitoring-tests.ts network
npx ts-node e2e/run-monitoring-tests.ts performance
npx ts-node e2e/run-monitoring-tests.ts privacy
```

## Test Requirements

### Prerequisites
- Extension must be built: `npm run build:test`
- Playwright browsers installed: `npx playwright install`
- Chrome/Chromium available for extension testing

### Test Environment
- Tests run in Chromium with extension loaded
- Single worker mode to avoid conflicts
- Network requests to external APIs (httpbin.org, jsonplaceholder.typicode.com)
- Timeout configurations for different test types

### Test Data
Tests use various data sources:
- **httpbin.org**: HTTP testing service for network requests
- **jsonplaceholder.typicode.com**: Mock API for realistic data
- **Dynamic content**: Generated HTML with forms, tables, and interactive elements
- **Mock plugins**: Simulated plugin APIs for integration testing

## Test Coverage

### Functional Coverage
- ✅ Network request/response monitoring
- ✅ DOM mutation observation
- ✅ Viewport and interaction tracking
- ✅ Content analysis and extraction
- ✅ Semantic data processing
- ✅ Plugin API integration
- ✅ AI chat context integration
- ✅ Privacy controls and data redaction
- ✅ Performance optimization
- ✅ Error handling and recovery

### Privacy Coverage
- ✅ Sensitive form data redaction
- ✅ Network request privacy filtering
- ✅ Domain and path exclusions
- ✅ User consent mechanisms
- ✅ Data retention policies
- ✅ Cross-origin protection
- ✅ AI context privacy

### Performance Coverage
- ✅ Page load impact measurement
- ✅ Memory usage monitoring
- ✅ DOM operation performance
- ✅ Network monitoring overhead
- ✅ High-load scenario testing
- ✅ Throttling and optimization
- ✅ Cross-tab isolation

### Integration Coverage
- ✅ Plugin detection and negotiation
- ✅ Enhanced context providers
- ✅ Real-time updates
- ✅ Error handling and fallbacks
- ✅ Schema validation
- ✅ Performance optimization

## Debugging Tests

### Common Issues

#### Extension Not Loading
```bash
# Ensure extension is built
npm run build:test

# Check build output
ls -la build/chrome-mv3-prod/

# Verify manifest exists
cat build/chrome-mv3-prod/manifest.json
```

#### Network Request Failures
- Tests expect some network requests to fail in CI environments
- External API dependencies may be unreliable
- Check console output for actual vs expected failures

#### Timing Issues
- Use `page.waitForTimeout()` sparingly
- Prefer element-based waits: `waitForSelector()`, `waitForLoadState()`
- Increase timeouts for slow environments

#### Memory Issues
- Monitor memory usage in performance tests
- Adjust thresholds based on test environment
- Use garbage collection hints where available

### Debug Commands
```bash
# Run with verbose output
DEBUG=pw:api npm run test:e2e:monitoring:pipeline

# Generate trace files
npx playwright test --trace on e2e/page-context-monitoring.spec.ts

# Run single test with debugging
npx playwright test --debug e2e/page-context-monitoring.spec.ts -g "monitors network requests"
```

## Test Maintenance

### Adding New Tests
1. Create test file in `e2e/` directory
2. Follow existing naming convention: `*-monitoring*.spec.ts`
3. Use utility functions from `monitoring-test-utils.ts`
4. Add test suite to `run-monitoring-tests.ts`
5. Update package.json scripts if needed

### Updating Test Data
- Modify `createTestPageWithContent()` for new scenarios
- Update mock plugin APIs in `createPluginEnabledPage()`
- Add new privacy test cases to `testPrivacyControls()`
- Extend performance scenarios in `measurePerformanceImpact()`

### Performance Thresholds
Current thresholds (adjust based on requirements):
- Page load: < 10 seconds
- Extension activation: < 2 seconds
- Memory increase: < 100MB
- DOM operations: < 5 seconds
- Network monitoring: < 30 seconds for 100 requests

### CI/CD Considerations
- Tests run in headless mode by default
- Retries enabled for flaky network requests
- Screenshots and videos captured on failures
- HTML reports generated for analysis
- Single worker mode prevents conflicts

## Troubleshooting

### Test Failures
1. Check extension build status
2. Verify network connectivity
3. Review browser console logs
4. Check timing and timeout issues
5. Validate test environment setup

### Performance Issues
1. Monitor system resources during tests
2. Check for memory leaks in extension
3. Validate throttling mechanisms
4. Review performance thresholds

### Privacy Test Failures
1. Verify privacy controls are enabled
2. Check data redaction mechanisms
3. Validate domain exclusion logic
4. Review consent mechanisms

For additional help, see the main E2E testing documentation in `e2e/README.md`.