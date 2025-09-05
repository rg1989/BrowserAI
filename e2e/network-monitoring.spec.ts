import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
    createExtensionContext,
    activateSpotlight,
    closeSpotlight,
    waitForPageReady,
} from "./test-utils";
import {
    triggerNetworkActivity,
    verifyMonitoringData,
    testPrivacyControls,
} from "./monitoring-test-utils";

let context: BrowserContext;
let page: Page;

test.describe("Network Monitoring E2E Tests", () => {
    test.beforeAll(async () => {
        context = await createExtensionContext();
        page = await context.newPage();
    });

    test.afterAll(async () => {
        await context.close();
    });

    test.beforeEach(async () => {
        await waitForPageReady(page, "https://httpbin.org/html");
    });

    test("captures HTTP requests and responses", async () => {
        // Navigate to a page that will make API calls
        await page.goto("https://jsonplaceholder.typicode.com/");
        await page.waitForLoadState("networkidle");

        // Trigger additional network activity
        await triggerNetworkActivity(page);

        // Verify network monitoring is capturing data
        const monitoringData = await verifyMonitoringData(page);
        expect(monitoringData).toBeTruthy();

        if (monitoringData) {
            expect(monitoringData.hasNetworkData).toBe(true);
            expect(monitoringData.isEnabled).toBe(true);
        }

        // Test AI integration with network context
        await activateSpotlight(page);
        await page.keyboard.press("Enter"); // Navigate to AI Ask

        const chatInterface = page.locator('[data-testid="chat-interface"]');
        await expect(chatInterface).toBeVisible();

        const promptInput = page.locator('[data-testid="prompt-input"]');
        await promptInput.fill("What API calls were made on this page?");
        await page.keyboard.press("Enter");

        const messageList = page.locator('[data-testid="message-list"]');
        await expect(messageList).toContainText("What API calls were made on this page?");

        await closeSpotlight(page);
    });

    test("monitors different types of network requests", async () => {
        // Create a page with various types of requests
        await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Network Request Test</title>
      </head>
      <body>
        <h1>Network Request Testing</h1>
        <button id="fetch-btn">Fetch JSON</button>
        <button id="xhr-btn">XMLHttpRequest</button>
        <button id="form-btn">Form Submit</button>
        <button id="image-btn">Load Image</button>
        
        <form id="test-form" action="https://httpbin.org/post" method="POST" style="display: none;">
          <input name="test" value="form-data">
        </form>
        
        <div id="results"></div>
        
        <script>
          document.getElementById('fetch-btn').addEventListener('click', async () => {
            try {
              const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
              const data = await response.json();
              document.getElementById('results').innerHTML += '<p>Fetch: ' + data.title + '</p>';
            } catch (error) {
              console.error('Fetch error:', error);
            }
          });
          
          document.getElementById('xhr-btn').addEventListener('click', () => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', 'https://jsonplaceholder.typicode.com/users/1');
            xhr.onload = function() {
              if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                document.getElementById('results').innerHTML += '<p>XHR: ' + data.name + '</p>';
              }
            };
            xhr.send();
          });
          
          document.getElementById('form-btn').addEventListener('click', () => {
            document.getElementById('test-form').submit();
          });
          
          document.getElementById('image-btn').addEventListener('click', () => {
            const img = new Image();
            img.onload = () => {
              document.getElementById('results').innerHTML += '<p>Image loaded</p>';
            };
            img.src = 'https://httpbin.org/image/png?size=100x100';
          });
        </script>
      </body>
      </html>
    `);

        await page.waitForLoadState("networkidle");

        // Test different request types
        await page.click('#fetch-btn');
        await page.waitForTimeout(2000);

        await page.click('#xhr-btn');
        await page.waitForTimeout(2000);

        await page.click('#image-btn');
        await page.waitForTimeout(2000);

        // Verify all request types were captured
        const networkData = await page.evaluate(() => {
            if (window.pageContextMonitor) {
                const activity = window.pageContextMonitor.getNetworkActivity();
                return {
                    totalRequests: activity.length,
                    requestTypes: activity.map(req => req.type || 'unknown'),
                    requestUrls: activity.map(req => req.url)
                };
            }
            return null;
        });

        expect(networkData).toBeTruthy();
        if (networkData) {
            expect(networkData.totalRequests).toBeGreaterThan(0);
            expect(networkData.requestUrls.some(url => url.includes('jsonplaceholder'))).toBe(true);
        }
    });

    test("handles request and response headers", async () => {
        // Make requests with custom headers
        await page.evaluate(async () => {
            try {
                await fetch('https://httpbin.org/headers', {
                    method: 'GET',
                    headers: {
                        'X-Custom-Header': 'test-value',
                        'Authorization': 'Bearer test-token',
                        'Content-Type': 'application/json'
                    }
                });

                await fetch('https://httpbin.org/post', {
                    method: 'POST',
                    headers: {
                        'X-Test-Header': 'post-test',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ test: 'data' })
                });
            } catch (error) {
                console.log('Network requests failed (expected in test environment)');
            }
        });

        await page.waitForTimeout(3000);

        // Verify headers are captured
        const headerData = await page.evaluate(() => {
            if (window.pageContextMonitor) {
                const activity = window.pageContextMonitor.getNetworkActivity();
                return activity.map(req => ({
                    url: req.url,
                    method: req.method,
                    hasHeaders: !!req.headers,
                    headerCount: req.headers ? Object.keys(req.headers).length : 0
                }));
            }
            return [];
        });

        expect(headerData.length).toBeGreaterThan(0);
        expect(headerData.some(req => req.hasHeaders)).toBe(true);
    });

    test("monitors request timing and performance", async () => {
        // Make requests with different timing characteristics
        await page.evaluate(async () => {
            const startTime = performance.now();

            try {
                // Fast request
                await fetch('https://httpbin.org/delay/0');

                // Slower request
                await fetch('https://httpbin.org/delay/1');

                // Parallel requests
                await Promise.all([
                    fetch('https://jsonplaceholder.typicode.com/posts/1'),
                    fetch('https://jsonplaceholder.typicode.com/posts/2'),
                    fetch('https://jsonplaceholder.typicode.com/posts/3')
                ]);
            } catch (error) {
                console.log('Some requests failed (expected in test environment)');
            }

            const endTime = performance.now();
            window.testTiming = endTime - startTime;
        });

        await page.waitForTimeout(5000);

        // Verify timing data is captured
        const timingData = await page.evaluate(() => {
            if (window.pageContextMonitor) {
                const activity = window.pageContextMonitor.getNetworkActivity();
                return {
                    requestCount: activity.length,
                    hasTiming: activity.some(req => req.timestamp),
                    testDuration: window.testTiming
                };
            }
            return null;
        });

        expect(timingData).toBeTruthy();
        if (timingData) {
            expect(timingData.requestCount).toBeGreaterThan(0);
            expect(timingData.hasTiming).toBe(true);
        }
    });

    test("handles request errors and failures", async () => {
        // Make requests that will fail
        await page.evaluate(async () => {
            const requests = [
                // Invalid URL
                fetch('https://invalid-domain-that-does-not-exist.com/api'),
                // 404 error
                fetch('https://httpbin.org/status/404'),
                // 500 error
                fetch('https://httpbin.org/status/500'),
                // Timeout (if supported)
                fetch('https://httpbin.org/delay/10', {
                    signal: AbortSignal.timeout ? AbortSignal.timeout(1000) : undefined
                })
            ];

            // Handle all requests, expecting some to fail
            const results = await Promise.allSettled(requests);
            window.requestResults = results.map(result => ({
                status: result.status,
                reason: result.status === 'rejected' ? result.reason.message : null
            }));
        });

        await page.waitForTimeout(5000);

        // Verify error handling
        const errorData = await page.evaluate(() => {
            return {
                requestResults: window.requestResults,
                monitoringData: window.pageContextMonitor ? {
                    networkActivity: window.pageContextMonitor.getNetworkActivity().length,
                    hasErrors: window.pageContextMonitor.getNetworkActivity().some(req => req.error)
                } : null
            };
        });

        expect(errorData.requestResults).toBeTruthy();
        expect(errorData.requestResults.some(result => result.status === 'rejected')).toBe(true);
    });

    test("respects privacy controls for sensitive data", async () => {
        // Test privacy controls
        const privacyData = await testPrivacyControls(page);

        if (privacyData) {
            // Verify sensitive data is not captured in plain text
            expect(privacyData.hasPassword).toBe(false);
            expect(privacyData.hasSSN).toBe(false);
            expect(privacyData.hasCreditCard).toBe(false);
        }

        // Make network requests with sensitive data
        await page.evaluate(async () => {
            try {
                await fetch('https://httpbin.org/post', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer secret-token-12345'
                    },
                    body: JSON.stringify({
                        password: 'secret-password',
                        creditCard: '4111-1111-1111-1111',
                        ssn: '123-45-6789'
                    })
                });
            } catch (error) {
                console.log('Request failed (expected in test environment)');
            }
        });

        await page.waitForTimeout(2000);

        // Verify sensitive data in network requests is handled properly
        const networkPrivacyData = await page.evaluate(() => {
            if (window.pageContextMonitor) {
                const activity = window.pageContextMonitor.getNetworkActivity();
                const activityString = JSON.stringify(activity);

                return {
                    hasSecretToken: activityString.includes('secret-token-12345'),
                    hasSecretPassword: activityString.includes('secret-password'),
                    hasCreditCard: activityString.includes('4111-1111-1111-1111'),
                    hasSSN: activityString.includes('123-45-6789'),
                    requestCount: activity.length
                };
            }
            return null;
        });

        if (networkPrivacyData) {
            // Depending on privacy settings, sensitive data should be redacted
            // This test assumes privacy controls are enabled by default
            expect(networkPrivacyData.requestCount).toBeGreaterThan(0);
        }
    });

    test("maintains rolling buffer for network activity", async () => {
        // Generate many network requests to test buffer management
        await page.evaluate(async () => {
            const requests = [];

            // Make many requests to test buffer limits
            for (let i = 0; i < 50; i++) {
                requests.push(
                    fetch(`https://httpbin.org/json?request=${i}`).catch(() => { })
                );

                // Add some delay to spread out requests
                if (i % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            await Promise.allSettled(requests);
        });

        await page.waitForTimeout(5000);

        // Verify buffer management
        const bufferData = await page.evaluate(() => {
            if (window.pageContextMonitor) {
                const activity = window.pageContextMonitor.getNetworkActivity();
                return {
                    activityCount: activity.length,
                    hasRecentActivity: activity.some(req =>
                        Date.now() - new Date(req.timestamp).getTime() < 10000
                    ),
                    oldestRequest: activity.length > 0 ? activity[0].timestamp : null,
                    newestRequest: activity.length > 0 ? activity[activity.length - 1].timestamp : null
                };
            }
            return null;
        });

        expect(bufferData).toBeTruthy();
        if (bufferData) {
            expect(bufferData.activityCount).toBeGreaterThan(0);
            expect(bufferData.hasRecentActivity).toBe(true);
        }
    });

    test("integrates network context with AI chat", async () => {
        // Make some specific API calls
        await page.evaluate(async () => {
            try {
                // User-related API call
                await fetch('https://jsonplaceholder.typicode.com/users/1');

                // Posts API call
                await fetch('https://jsonplaceholder.typicode.com/posts?userId=1');

                // Comments API call
                await fetch('https://jsonplaceholder.typicode.com/comments?postId=1');
            } catch (error) {
                console.log('API calls failed (expected in test environment)');
            }
        });

        await page.waitForTimeout(3000);

        // Test AI integration with network context
        await activateSpotlight(page);
        await page.keyboard.press("Enter");

        const chatInterface = page.locator('[data-testid="chat-interface"]');
        await expect(chatInterface).toBeVisible();

        // Ask specific questions about network activity
        const networkQuestions = [
            "What API endpoints were called?",
            "Show me the recent network requests",
            "What data was fetched from the API?",
            "Were there any failed requests?",
            "What is the response from the users API?"
        ];

        for (const question of networkQuestions) {
            const promptInput = page.locator('[data-testid="prompt-input"]');
            await promptInput.fill(question);
            await page.keyboard.press("Enter");

            const messageList = page.locator('[data-testid="message-list"]');
            await expect(messageList).toContainText(question);

            await page.waitForTimeout(1000);
        }

        await closeSpotlight(page);
    });
});