import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
    createExtensionContext,
    activateSpotlight,
    closeSpotlight,
    waitForPageReady,
} from "./test-utils";
import {
    createPluginEnabledPage,
} from "./monitoring-test-utils";

let context: BrowserContext;
let page: Page;

test.describe("Plugin Integration Tests", () => {
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

    test("detects and integrates with plugin API", async () => {
        // Create a page with plugin API
        await createPluginEnabledPage(page);

        // Wait for plugin detection
        await page.waitForTimeout(2000);

        // Check plugin detection
        const pluginData = await page.evaluate(() => {
            if (window.pageContextMonitor && window.pageContextMonitor.getPluginInfo) {
                return {
                    hasPlugin: !!window.spotlightPlugin,
                    pluginDetected: window.pageContextMonitor.getPluginInfo(),
                    pluginCapabilities: window.spotlightPlugin?.capabilities || [],
                    pluginVersion: window.spotlightPlugin?.version
                };
            }
            return {
                hasPlugin: !!window.spotlightPlugin,
                pluginDetected: null,
                pluginCapabilities: window.spotlightPlugin?.capabilities || [],
                pluginVersion: window.spotlightPlugin?.version
            };
        });

        expect(pluginData.hasPlugin).toBe(true);
        expect(pluginData.pluginCapabilities).toContain('context');
        expect(pluginData.pluginCapabilities).toContain('ecommerce');
        expect(pluginData.pluginVersion).toBe('1.0.0');
    });

    test("retrieves enhanced context from plugin", async () => {
        await createPluginEnabledPage(page);
        await page.waitForTimeout(2000);

        // Get enhanced context through plugin
        const enhancedContext = await page.evaluate(async () => {
            if (window.spotlightPlugin && window.spotlightPlugin.getContext) {
                try {
                    const context = await window.spotlightPlugin.getContext();
                    return {
                        success: true,
                        contextType: context.type,
                        hasProduct: !!context.product,
                        hasUser: !!context.user,
                        hasCart: !!context.cart,
                        productId: context.product?.id,
                        productName: context.product?.name,
                        productPrice: context.product?.price
                    };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }
            return { success: false, error: 'No plugin found' };
        });

        expect(enhancedContext.success).toBe(true);
        expect(enhancedContext.contextType).toBe('ecommerce');
        expect(enhancedContext.hasProduct).toBe(true);
        expect(enhancedContext.hasUser).toBe(true);
        expect(enhancedContext.hasCart).toBe(true);
        expect(enhancedContext.productId).toBe('123');
        expect(enhancedContext.productName).toBe('Test Product');
        expect(enhancedContext.productPrice).toBe('$99.99');
    });

    test("validates plugin schema and data structure", async () => {
        await createPluginEnabledPage(page);
        await page.waitForTimeout(2000);

        // Validate plugin schema
        const schemaValidation = await page.evaluate(() => {
            if (window.spotlightPlugin && window.spotlightPlugin.getSchema) {
                try {
                    const schema = window.spotlightPlugin.getSchema();
                    return {
                        success: true,
                        hasType: !!schema.type,
                        hasProperties: !!schema.properties,
                        schemaType: schema.type,
                        propertyCount: Object.keys(schema.properties || {}).length,
                        hasProductSchema: !!schema.properties?.product,
                        hasUserSchema: !!schema.properties?.user,
                        hasCartSchema: !!schema.properties?.cart
                    };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }
            return { success: false, error: 'No plugin found' };
        });

        expect(schemaValidation.success).toBe(true);
        expect(schemaValidation.hasType).toBe(true);
        expect(schemaValidation.schemaType).toBe('object');
        expect(schemaValidation.propertyCount).toBeGreaterThan(0);
        expect(schemaValidation.hasProductSchema).toBe(true);
        expect(schemaValidation.hasUserSchema).toBe(true);
        expect(schemaValidation.hasCartSchema).toBe(true);
    });

    test("handles real-time plugin updates", async () => {
        await createPluginEnabledPage(page);
        await page.waitForTimeout(2000);

        // Set up real-time update listener
        const updatePromise = page.evaluate(() => {
            return new Promise((resolve) => {
                if (window.spotlightPlugin && window.spotlightPlugin.onContextRequest) {
                    const updates = [];

                    window.spotlightPlugin.onContextRequest((update) => {
                        updates.push(update);
                        if (updates.length >= 2) {
                            resolve(updates);
                        }
                    });

                    // Trigger updates by interacting with the page
                    setTimeout(() => {
                        document.querySelector('.add-to-cart')?.click();
                    }, 500);

                    // Trigger another update
                    setTimeout(() => {
                        const event = new CustomEvent('productView', {
                            detail: { productId: '123', source: 'test' }
                        });
                        window.dispatchEvent(event);
                    }, 1000);

                    // Timeout after 5 seconds
                    setTimeout(() => resolve(updates), 5000);
                } else {
                    resolve([]);
                }
            });
        });

        const updates = await updatePromise;
        expect(Array.isArray(updates)).toBe(true);
        expect(updates.length).toBeGreaterThan(0);

        if (updates.length > 0) {
            const cartUpdate = updates.find(u => u.type === 'cart-update');
            const productView = updates.find(u => u.type === 'product-view');

            expect(cartUpdate || productView).toBeTruthy();
        }
    });

    test("integrates plugin context with AI chat", async () => {
        await createPluginEnabledPage(page);
        await page.waitForTimeout(2000);

        // Activate spotlight and test AI integration
        await activateSpotlight(page);
        await page.keyboard.press("Enter"); // Navigate to AI Ask

        const chatInterface = page.locator('[data-testid="chat-interface"]');
        await expect(chatInterface).toBeVisible();

        // Ask plugin-specific questions
        const pluginQuestions = [
            "What product am I looking at?",
            "What's the price of this product?",
            "Can you help me add this to my cart?",
            "What's in my shopping cart?",
            "Am I logged in?",
            "What e-commerce data is available?"
        ];

        for (const question of pluginQuestions) {
            const promptInput = page.locator('[data-testid="prompt-input"]');
            await promptInput.fill(question);
            await page.keyboard.press("Enter");

            const messageList = page.locator('[data-testid="message-list"]');
            await expect(messageList).toContainText(question);

            await page.waitForTimeout(500);
        }

        await closeSpotlight(page);
    });

    test("handles plugin errors gracefully", async () => {
        // Create a page with a faulty plugin
        await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Faulty Plugin Test</title>
      </head>
      <body>
        <h1>Faulty Plugin Page</h1>
        
        <script>
          // Mock faulty plugin API
          window.spotlightPlugin = {
            version: '1.0.0',
            capabilities: ['context', 'faulty'],
            
            getContext: async () => {
              throw new Error('Plugin context error');
            },
            
            getSchema: () => {
              throw new Error('Plugin schema error');
            },
            
            onContextRequest: (callback) => {
              // Simulate callback error
              setTimeout(() => {
                try {
                  callback(null); // Invalid callback data
                } catch (error) {
                  console.error('Callback error:', error);
                }
              }, 1000);
            }
          };
        </script>
      </body>
      </html>
    `);

        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);

        // Test error handling
        const errorHandling = await page.evaluate(async () => {
            const results = {
                contextError: null,
                schemaError: null,
                callbackError: null,
                monitoringStillWorks: false
            };

            // Test context error
            try {
                await window.spotlightPlugin.getContext();
            } catch (error) {
                results.contextError = error.message;
            }

            // Test schema error
            try {
                window.spotlightPlugin.getSchema();
            } catch (error) {
                results.schemaError = error.message;
            }

            // Test if monitoring still works despite plugin errors
            if (window.pageContextMonitor) {
                try {
                    const context = window.pageContextMonitor.getContext();
                    results.monitoringStillWorks = !!context;
                } catch (error) {
                    results.monitoringStillWorks = false;
                }
            }

            return results;
        });

        expect(errorHandling.contextError).toBe('Plugin context error');
        expect(errorHandling.schemaError).toBe('Plugin schema error');
        expect(errorHandling.monitoringStillWorks).toBe(true);

        // Verify extension still works
        await activateSpotlight(page);
        const overlay = page.locator('[data-testid="spotlight-overlay"]');
        await expect(overlay).toBeVisible();
        await closeSpotlight(page);
    });

    test("validates plugin capability negotiation", async () => {
        // Create a page with multiple plugin capabilities
        await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Multi-Capability Plugin Test</title>
      </head>
      <body>
        <h1>Multi-Capability Plugin</h1>
        
        <script>
          window.spotlightPlugin = {
            version: '2.0.0',
            capabilities: ['context', 'realtime', 'semantic', 'analytics', 'custom'],
            
            getContext: async () => ({
              type: 'multi-capability',
              features: {
                analytics: { pageViews: 100, uniqueVisitors: 50 },
                semantic: { tags: ['test', 'plugin'], category: 'demo' },
                custom: { customData: 'test-value', timestamp: Date.now() }
              }
            }),
            
            getSchema: () => ({
              type: 'object',
              properties: {
                type: { type: 'string' },
                features: {
                  type: 'object',
                  properties: {
                    analytics: { type: 'object' },
                    semantic: { type: 'object' },
                    custom: { type: 'object' }
                  }
                }
              }
            }),
            
            // Capability-specific methods
            getAnalytics: () => ({ pageViews: 100, uniqueVisitors: 50 }),
            getSemanticData: () => ({ tags: ['test', 'plugin'], category: 'demo' }),
            getCustomData: () => ({ customData: 'test-value' })
          };
        </script>
      </body>
      </html>
    `);

        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);

        // Test capability negotiation
        const capabilityTest = await page.evaluate(async () => {
            const results = {
                allCapabilities: window.spotlightPlugin?.capabilities || [],
                contextData: null,
                hasAnalytics: false,
                hasSemantic: false,
                hasCustom: false,
                capabilityCount: 0
            };

            if (window.spotlightPlugin) {
                results.capabilityCount = results.allCapabilities.length;

                // Test context retrieval
                try {
                    const context = await window.spotlightPlugin.getContext();
                    results.contextData = context;
                    results.hasAnalytics = !!context.features?.analytics;
                    results.hasSemantic = !!context.features?.semantic;
                    results.hasCustom = !!context.features?.custom;
                } catch (error) {
                    console.error('Context error:', error);
                }
            }

            return results;
        });

        expect(capabilityTest.allCapabilities).toContain('context');
        expect(capabilityTest.allCapabilities).toContain('realtime');
        expect(capabilityTest.allCapabilities).toContain('semantic');
        expect(capabilityTest.allCapabilities).toContain('analytics');
        expect(capabilityTest.allCapabilities).toContain('custom');
        expect(capabilityTest.capabilityCount).toBe(5);
        expect(capabilityTest.hasAnalytics).toBe(true);
        expect(capabilityTest.hasSemantic).toBe(true);
        expect(capabilityTest.hasCustom).toBe(true);
    });

    test("validates plugin performance optimization", async () => {
        await createPluginEnabledPage(page);
        await page.waitForTimeout(2000);

        // Measure plugin performance
        const performanceTest = await page.evaluate(async () => {
            const results = {
                contextCallTime: 0,
                schemaCallTime: 0,
                multipleCallsTime: 0,
                callCount: 0
            };

            if (window.spotlightPlugin) {
                // Single context call
                const start1 = performance.now();
                try {
                    await window.spotlightPlugin.getContext();
                    results.contextCallTime = performance.now() - start1;
                } catch (error) {
                    console.error('Context call error:', error);
                }

                // Schema call
                const start2 = performance.now();
                try {
                    window.spotlightPlugin.getSchema();
                    results.schemaCallTime = performance.now() - start2;
                } catch (error) {
                    console.error('Schema call error:', error);
                }

                // Multiple rapid calls
                const start3 = performance.now();
                const promises = [];
                for (let i = 0; i < 10; i++) {
                    promises.push(window.spotlightPlugin.getContext().catch(() => null));
                    results.callCount++;
                }
                await Promise.all(promises);
                results.multipleCallsTime = performance.now() - start3;
            }

            return results;
        });

        // Verify reasonable performance
        expect(performanceTest.contextCallTime).toBeLessThan(1000); // Less than 1 second
        expect(performanceTest.schemaCallTime).toBeLessThan(100); // Less than 100ms
        expect(performanceTest.multipleCallsTime).toBeLessThan(5000); // Less than 5 seconds for 10 calls
        expect(performanceTest.callCount).toBe(10);
    });

    test("validates fallback to universal monitoring when plugin fails", async () => {
        // Create a page where plugin fails after initial success
        await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Plugin Failure Test</title>
      </head>
      <body>
        <h1>Plugin Failure Test</h1>
        <p>This page tests fallback behavior when plugin fails.</p>
        
        <form id="test-form">
          <input type="text" name="test" value="test data">
          <button type="submit">Submit</button>
        </form>
        
        <script>
          let callCount = 0;
          
          window.spotlightPlugin = {
            version: '1.0.0',
            capabilities: ['context'],
            
            getContext: async () => {
              callCount++;
              if (callCount > 2) {
                throw new Error('Plugin failed after 2 calls');
              }
              return {
                type: 'test',
                data: { callCount, status: 'working' }
              };
            },
            
            getSchema: () => ({
              type: 'object',
              properties: {
                type: { type: 'string' },
                data: { type: 'object' }
              }
            })
          };
        </script>
      </body>
      </html>
    `);

        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);

        // Test initial plugin success
        const initialTest = await page.evaluate(async () => {
            if (window.spotlightPlugin) {
                try {
                    const context1 = await window.spotlightPlugin.getContext();
                    const context2 = await window.spotlightPlugin.getContext();
                    return {
                        success: true,
                        call1: context1,
                        call2: context2
                    };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }
            return { success: false, error: 'No plugin' };
        });

        expect(initialTest.success).toBe(true);
        expect(initialTest.call1.data.callCount).toBe(1);
        expect(initialTest.call2.data.callCount).toBe(2);

        // Test plugin failure and fallback
        const fallbackTest = await page.evaluate(async () => {
            const results = {
                pluginFailed: false,
                universalMonitoringWorks: false,
                hasContext: false,
                contextSource: null
            };

            // Try plugin call that should fail
            if (window.spotlightPlugin) {
                try {
                    await window.spotlightPlugin.getContext();
                } catch (error) {
                    results.pluginFailed = true;
                }
            }

            // Check if universal monitoring still works
            if (window.pageContextMonitor) {
                try {
                    const context = window.pageContextMonitor.getContext();
                    results.universalMonitoringWorks = true;
                    results.hasContext = !!context;
                    results.contextSource = context?.source || 'universal';
                } catch (error) {
                    results.universalMonitoringWorks = false;
                }
            }

            return results;
        });

        expect(fallbackTest.pluginFailed).toBe(true);
        expect(fallbackTest.universalMonitoringWorks).toBe(true);
        expect(fallbackTest.hasContext).toBe(true);

        // Verify extension still works with universal monitoring
        await activateSpotlight(page);
        await page.keyboard.press("Enter");

        const chatInterface = page.locator('[data-testid="chat-interface"]');
        await expect(chatInterface).toBeVisible();

        const promptInput = page.locator('[data-testid="prompt-input"]');
        await promptInput.fill("What content is on this page?");
        await page.keyboard.press("Enter");

        await closeSpotlight(page);
    });
});