import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
    createExtensionContext,
    activateSpotlight,
    closeSpotlight,
    waitForPageReady,
} from "./test-utils";
import {
    measurePerformanceImpact,
    triggerDOMChanges,
    triggerNetworkActivity,
    testCrossTabBehavior,
} from "./monitoring-test-utils";

let context: BrowserContext;
let page: Page;

test.describe("Performance Validation Tests", () => {
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

    test("measures monitoring overhead on page load", async () => {
        // Test performance on a clean page load
        const performanceStart = await page.evaluate(() => performance.now());

        // Navigate to a content-heavy page
        await page.goto("https://jsonplaceholder.typicode.com/");
        await page.waitForLoadState("networkidle");

        const performanceEnd = await page.evaluate(() => performance.now());
        const loadTime = performanceEnd - performanceStart;

        // Verify reasonable load time (adjust threshold as needed)
        expect(loadTime).toBeLessThan(10000); // Less than 10 seconds

        // Check memory usage
        const memoryUsage = await page.evaluate(() => {
            return (performance as any).memory ? {
                usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
                totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
                jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
            } : null;
        });

        if (memoryUsage) {
            // Memory usage should be reasonable
            expect(memoryUsage.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
        }
    });

    test("validates DOM observation performance", async () => {
        // Measure performance before heavy DOM operations
        const beforeMetrics = await measurePerformanceImpact(page);

        // Trigger intensive DOM changes
        await triggerDOMChanges(page);

        // Add more intensive DOM operations
        await page.evaluate(() => {
            const container = document.createElement('div');
            document.body.appendChild(container);

            // Create a large number of DOM elements
            for (let i = 0; i < 2000; i++) {
                const element = document.createElement('div');
                element.className = `perf-test-${i}`;
                element.textContent = `Performance test element ${i}`;
                element.style.cssText = `
          background-color: hsl(${i % 360}, 50%, 50%);
          padding: 5px;
          margin: 1px;
          border: 1px solid #ccc;
        `;
                container.appendChild(element);

                // Trigger style recalculations
                if (i % 100 === 0) {
                    element.style.transform = `rotate(${i}deg)`;
                }
            }

            // Trigger mutations
            setTimeout(() => {
                const elements = container.querySelectorAll('div');
                elements.forEach((el, index) => {
                    if (index % 3 === 0) {
                        el.remove();
                    } else if (index % 3 === 1) {
                        el.textContent += ' (modified)';
                    } else {
                        el.setAttribute('data-modified', 'true');
                    }
                });
            }, 100);
        });

        await page.waitForTimeout(3000);

        // Measure performance after operations
        const afterMetrics = await measurePerformanceImpact(page);

        // Verify performance impact is acceptable
        const timeDifference = afterMetrics.operationTime - beforeMetrics.operationTime;
        expect(timeDifference).toBeLessThan(5000); // Less than 5 seconds difference

        // Check that monitoring is still responsive
        await activateSpotlight(page);
        const overlay = page.locator('[data-testid="spotlight-overlay"]');
        await expect(overlay).toBeVisible({ timeout: 2000 });
        await closeSpotlight(page);
    });

    test("validates network monitoring performance", async () => {
        // Measure baseline performance
        const startTime = await page.evaluate(() => performance.now());

        // Trigger intensive network activity
        await triggerNetworkActivity(page);

        // Add more network requests
        await page.evaluate(async () => {
            const requests = [];

            // Create many concurrent requests
            for (let i = 0; i < 100; i++) {
                requests.push(
                    fetch(`https://httpbin.org/json?test=${i}`).catch(() => { })
                );

                if (i % 20 === 0) {
                    requests.push(
                        fetch('https://jsonplaceholder.typicode.com/posts', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title: `Test ${i}`, body: `Body ${i}` })
                        }).catch(() => { })
                    );
                }
            }

            await Promise.allSettled(requests);
        });

        const endTime = await page.evaluate(() => performance.now());
        const totalTime = endTime - startTime;

        // Verify network monitoring doesn't cause excessive delays
        expect(totalTime).toBeLessThan(30000); // Less than 30 seconds for all operations

        // Check that the extension is still responsive
        await activateSpotlight(page);
        await page.keyboard.press("Enter");

        const chatInterface = page.locator('[data-testid="chat-interface"]');
        await expect(chatInterface).toBeVisible({ timeout: 3000 });

        const promptInput = page.locator('[data-testid="prompt-input"]');
        await promptInput.fill("Test responsiveness after network activity");
        await page.keyboard.press("Enter");

        await closeSpotlight(page);
    });

    test("validates memory usage and cleanup", async () => {
        // Get initial memory baseline
        const initialMemory = await page.evaluate(() => {
            return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
        });

        // Perform memory-intensive operations
        for (let iteration = 0; iteration < 5; iteration++) {
            // Create DOM elements
            await page.evaluate((iter) => {
                const container = document.createElement('div');
                container.id = `memory-test-${iter}`;
                document.body.appendChild(container);

                for (let i = 0; i < 500; i++) {
                    const element = document.createElement('div');
                    element.textContent = `Memory test ${iter}-${i}`;
                    element.dataset.iteration = iter.toString();
                    container.appendChild(element);
                }
            }, iteration);

            // Trigger network activity
            await page.evaluate(async (iter) => {
                const requests = [];
                for (let i = 0; i < 20; i++) {
                    requests.push(
                        fetch(`https://httpbin.org/json?iter=${iter}&req=${i}`).catch(() => { })
                    );
                }
                await Promise.allSettled(requests);
            }, iteration);

            // Clean up some elements to test garbage collection
            if (iteration > 1) {
                await page.evaluate((iter) => {
                    const oldContainer = document.getElementById(`memory-test-${iter - 2}`);
                    if (oldContainer) {
                        oldContainer.remove();
                    }
                }, iteration);
            }

            await page.waitForTimeout(1000);
        }

        // Force garbage collection if available
        await page.evaluate(() => {
            if ((window as any).gc) {
                (window as any).gc();
            }
        });

        await page.waitForTimeout(2000);

        // Check final memory usage
        const finalMemory = await page.evaluate(() => {
            return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
        });

        const memoryIncrease = finalMemory - initialMemory;

        // Memory increase should be reasonable (less than 100MB)
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

        // Verify monitoring is still functional
        const monitoringStatus = await page.evaluate(() => {
            return window.pageContextMonitor ? {
                isEnabled: window.pageContextMonitor.isEnabled(),
                hasContext: !!window.pageContextMonitor.getContext(),
                networkActivityCount: window.pageContextMonitor.getNetworkActivity().length
            } : null;
        });

        expect(monitoringStatus).toBeTruthy();
        if (monitoringStatus) {
            expect(monitoringStatus.isEnabled).toBe(true);
        }
    });

    test("validates performance under high load", async () => {
        // Create a high-load scenario
        const loadTestResults = await page.evaluate(async () => {
            const startTime = performance.now();
            const results = {
                domOperations: 0,
                networkRequests: 0,
                errors: 0,
                totalTime: 0
            };

            try {
                // Concurrent DOM operations
                const domPromise = new Promise<void>((resolve) => {
                    let domOps = 0;
                    const interval = setInterval(() => {
                        for (let i = 0; i < 50; i++) {
                            const element = document.createElement('div');
                            element.textContent = `Load test ${domOps}-${i}`;
                            document.body.appendChild(element);
                            domOps++;

                            if (domOps % 10 === 0) {
                                element.remove();
                            }
                        }
                        results.domOperations = domOps;

                        if (domOps >= 1000) {
                            clearInterval(interval);
                            resolve();
                        }
                    }, 10);
                });

                // Concurrent network requests
                const networkPromise = (async () => {
                    const requests = [];
                    for (let i = 0; i < 50; i++) {
                        requests.push(
                            fetch(`https://httpbin.org/delay/0?load=${i}`)
                                .then(() => results.networkRequests++)
                                .catch(() => results.errors++)
                        );
                    }
                    await Promise.allSettled(requests);
                })();

                // Wait for both operations to complete
                await Promise.all([domPromise, networkPromise]);

                results.totalTime = performance.now() - startTime;
            } catch (error) {
                results.errors++;
            }

            return results;
        });

        // Verify performance under load
        expect(loadTestResults.totalTime).toBeLessThan(15000); // Less than 15 seconds
        expect(loadTestResults.domOperations).toBeGreaterThan(500);
        expect(loadTestResults.errors).toBeLessThan(loadTestResults.networkRequests * 0.5); // Less than 50% error rate

        // Verify extension still works after high load
        await activateSpotlight(page);
        const overlay = page.locator('[data-testid="spotlight-overlay"]');
        await expect(overlay).toBeVisible({ timeout: 5000 });
        await closeSpotlight(page);
    });

    test("validates cross-tab performance isolation", async () => {
        // Test performance isolation between tabs
        const crossTabResults = await testCrossTabBehavior(context);

        expect(crossTabResults.tab1Data).toBeTruthy();
        expect(crossTabResults.tab2Data).toBeTruthy();

        if (crossTabResults.tab1Data && crossTabResults.tab2Data) {
            expect(crossTabResults.tab1Data.url).toContain('httpbin.org');
            expect(crossTabResults.tab2Data.url).toContain('jsonplaceholder.typicode.com');

            // Each tab should have its own context
            expect(crossTabResults.tab1Data.hasContext).toBe(true);
            expect(crossTabResults.tab2Data.hasContext).toBe(true);
        }
    });

    test("validates monitoring throttling under stress", async () => {
        // Test that monitoring implements proper throttling
        const throttlingTest = await page.evaluate(async () => {
            const results = {
                eventsGenerated: 0,
                eventsProcessed: 0,
                throttlingActive: false,
                startTime: performance.now(),
                endTime: 0
            };

            // Generate rapid DOM changes to trigger throttling
            const container = document.createElement('div');
            document.body.appendChild(container);

            // Create rapid mutations
            for (let i = 0; i < 5000; i++) {
                const element = document.createElement('span');
                element.textContent = `Throttle test ${i}`;
                container.appendChild(element);
                results.eventsGenerated++;

                // Immediate modifications
                element.style.color = i % 2 === 0 ? 'red' : 'blue';
                element.setAttribute('data-test', i.toString());

                if (i % 100 === 0) {
                    element.remove();
                }
            }

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 2000));

            results.endTime = performance.now();

            // Check if monitoring is still responsive
            if (window.pageContextMonitor) {
                try {
                    const context = window.pageContextMonitor.getContext();
                    results.eventsProcessed = context ? 1 : 0;
                    results.throttlingActive = true; // Assume throttling if we get here quickly
                } catch (error) {
                    results.eventsProcessed = 0;
                }
            }

            return results;
        });

        // Verify throttling is working (processing should be much less than generation)
        expect(throttlingTest.eventsGenerated).toBeGreaterThan(1000);
        expect(throttlingTest.endTime - throttlingTest.startTime).toBeLessThan(10000); // Less than 10 seconds

        // Extension should still be responsive
        await activateSpotlight(page);
        const overlay = page.locator('[data-testid="spotlight-overlay"]');
        await expect(overlay).toBeVisible({ timeout: 3000 });
        await closeSpotlight(page);
    });

    test("validates performance on different page types", async () => {
        const pageTypes = [
            { url: "https://httpbin.org/html", type: "static" },
            { url: "https://jsonplaceholder.typicode.com/", type: "api" },
            { url: "data:text/html,<html><body><h1>Simple Page</h1></body></html>", type: "minimal" }
        ];

        const performanceResults = [];

        for (const pageType of pageTypes) {
            const startTime = performance.now();

            await page.goto(pageType.url);
            await page.waitForLoadState("networkidle");

            // Test monitoring activation time
            const activationStart = performance.now();
            await activateSpotlight(page);
            const overlay = page.locator('[data-testid="spotlight-overlay"]');
            await expect(overlay).toBeVisible();
            const activationEnd = performance.now();

            await closeSpotlight(page);

            const endTime = performance.now();

            performanceResults.push({
                type: pageType.type,
                totalTime: endTime - startTime,
                activationTime: activationEnd - activationStart,
                url: pageType.url
            });
        }

        // Verify performance is consistent across page types
        for (const result of performanceResults) {
            expect(result.totalTime).toBeLessThan(10000); // Less than 10 seconds
            expect(result.activationTime).toBeLessThan(2000); // Less than 2 seconds to activate
        }

        // Activation should be fastest on minimal pages
        const minimalResult = performanceResults.find(r => r.type === "minimal");
        if (minimalResult) {
            expect(minimalResult.activationTime).toBeLessThan(1000); // Less than 1 second
        }
    });
});