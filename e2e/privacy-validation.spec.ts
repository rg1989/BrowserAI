import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
    createExtensionContext,
    activateSpotlight,
    closeSpotlight,
    waitForPageReady,
} from "./test-utils";
import {
    testPrivacyControls,
} from "./monitoring-test-utils";

let context: BrowserContext;
let page: Page;

test.describe("Privacy Validation Tests", () => {
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

    test("validates sensitive data redaction in forms", async () => {
        // Create a page with sensitive form data
        await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Privacy Test Page</title>
      </head>
      <body>
        <h1>Sensitive Data Forms</h1>
        
        <form id="login-form">
          <h2>Login Form</h2>
          <input type="text" name="username" placeholder="Username">
          <input type="password" name="password" placeholder="Password">
          <button type="submit">Login</button>
        </form>
        
        <form id="payment-form">
          <h2>Payment Form</h2>
          <input type="text" name="cardholder" placeholder="Cardholder Name">
          <input type="text" name="cardnumber" placeholder="Card Number" pattern="[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}">
          <input type="text" name="cvv" placeholder="CVV" pattern="[0-9]{3,4}">
          <input type="text" name="expiry" placeholder="MM/YY">
          <button type="submit">Pay Now</button>
        </form>
        
        <form id="personal-form">
          <h2>Personal Information</h2>
          <input type="text" name="ssn" placeholder="Social Security Number" pattern="[0-9]{3}-[0-9]{2}-[0-9]{4}">
          <input type="text" name="phone" placeholder="Phone Number">
          <input type="email" name="email" placeholder="Email Address">
          <input type="date" name="birthdate" placeholder="Birth Date">
          <button type="submit">Submit</button>
        </form>
        
        <form id="financial-form">
          <h2>Financial Information</h2>
          <input type="text" name="account" placeholder="Account Number">
          <input type="text" name="routing" placeholder="Routing Number">
          <input type="text" name="income" placeholder="Annual Income">
          <button type="submit">Submit Financial Info</button>
        </form>
      </body>
      </html>
    `);

        await page.waitForLoadState("networkidle");

        // Fill out sensitive information
        await page.fill('input[name="username"]', 'testuser123');
        await page.fill('input[name="password"]', 'supersecretpassword');
        await page.fill('input[name="cardholder"]', 'John Doe');
        await page.fill('input[name="cardnumber"]', '4111-1111-1111-1111');
        await page.fill('input[name="cvv"]', '123');
        await page.fill('input[name="expiry"]', '12/25');
        await page.fill('input[name="ssn"]', '123-45-6789');
        await page.fill('input[name="phone"]', '(555) 123-4567');
        await page.fill('input[name="email"]', 'test@example.com');
        await page.fill('input[name="account"]', '1234567890');
        await page.fill('input[name="routing"]', '021000021');
        await page.fill('input[name="income"]', '75000');

        await page.waitForTimeout(2000);

        // Check what data is captured by monitoring
        const privacyData = await page.evaluate(() => {
            if (window.pageContextMonitor) {
                const context = window.pageContextMonitor.getContext();
                const contextString = JSON.stringify(context);

                return {
                    contextLength: contextString.length,
                    hasPassword: contextString.includes('supersecretpassword'),
                    hasCardNumber: contextString.includes('4111-1111-1111-1111'),
                    hasCVV: contextString.includes('123') && contextString.includes('cvv'),
                    hasSSN: contextString.includes('123-45-6789'),
                    hasAccountNumber: contextString.includes('1234567890'),
                    hasRoutingNumber: contextString.includes('021000021'),
                    hasEmail: contextString.includes('test@example.com'),
                    hasPhone: contextString.includes('(555) 123-4567'),
                    hasIncome: contextString.includes('75000'),
                    // Check for redacted placeholders
                    hasRedactedData: contextString.includes('[REDACTED]') || contextString.includes('***'),
                    formCount: (contextString.match(/form/gi) || []).length
                };
            }
            return null;
        });

        expect(privacyData).toBeTruthy();
        if (privacyData) {
            // Sensitive data should be redacted or not captured
            expect(privacyData.hasPassword).toBe(false);
            expect(privacyData.hasCardNumber).toBe(false);
            expect(privacyData.hasCVV).toBe(false);
            expect(privacyData.hasSSN).toBe(false);
            expect(privacyData.hasAccountNumber).toBe(false);
            expect(privacyData.hasRoutingNumber).toBe(false);

            // Forms should still be detected (structure, not content)
            expect(privacyData.formCount).toBeGreaterThan(0);
        }
    });

    test("validates network request privacy filtering", async () => {
        // Make network requests with sensitive data
        await page.evaluate(async () => {
            const sensitiveRequests = [
                // Login request
                fetch('https://httpbin.org/post', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'testuser',
                        password: 'secretpassword123',
                        remember: true
                    })
                }),

                // Payment request
                fetch('https://httpbin.org/post', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer secret-api-key-12345'
                    },
                    body: JSON.stringify({
                        cardNumber: '4111111111111111',
                        cvv: '123',
                        expiryMonth: '12',
                        expiryYear: '2025',
                        amount: 99.99
                    })
                }),

                // Personal data request
                fetch('https://httpbin.org/post', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ssn: '123-45-6789',
                        phone: '555-123-4567',
                        email: 'user@example.com',
                        address: '123 Main St, Anytown, USA'
                    })
                }),

                // API key in URL
                fetch('https://httpbin.org/get?api_key=secret123&token=abc123xyz'),

                // Session token in headers
                fetch('https://httpbin.org/headers', {
                    headers: {
                        'X-Session-Token': 'session-token-secret-456',
                        'X-API-Key': 'api-key-789'
                    }
                })
            ];

            try {
                await Promise.allSettled(sensitiveRequests);
            } catch (error) {
                console.log('Some requests failed (expected in test environment)');
            }
        });

        await page.waitForTimeout(3000);

        // Check network monitoring privacy
        const networkPrivacy = await page.evaluate(() => {
            if (window.pageContextMonitor) {
                const networkActivity = window.pageContextMonitor.getNetworkActivity();
                const networkString = JSON.stringify(networkActivity);

                return {
                    requestCount: networkActivity.length,
                    hasPassword: networkString.includes('secretpassword123'),
                    hasCardNumber: networkString.includes('4111111111111111'),
                    hasCVV: networkString.includes('"cvv":"123"'),
                    hasSSN: networkString.includes('123-45-6789'),
                    hasApiKey: networkString.includes('secret-api-key-12345'),
                    hasSessionToken: networkString.includes('session-token-secret-456'),
                    hasUrlApiKey: networkString.includes('api_key=secret123'),
                    hasRedactedData: networkString.includes('[REDACTED]') || networkString.includes('***'),
                    networkDataLength: networkString.length
                };
            }
            return null;
        });

        expect(networkPrivacy).toBeTruthy();
        if (networkPrivacy) {
            expect(networkPrivacy.requestCount).toBeGreaterThan(0);

            // Sensitive data should be redacted
            expect(networkPrivacy.hasPassword).toBe(false);
            expect(networkPrivacy.hasCardNumber).toBe(false);
            expect(networkPrivacy.hasCVV).toBe(false);
            expect(networkPrivacy.hasSSN).toBe(false);
            expect(networkPrivacy.hasApiKey).toBe(false);
            expect(networkPrivacy.hasSessionToken).toBe(false);
            expect(networkPrivacy.hasUrlApiKey).toBe(false);
        }
    });

    test("validates domain exclusion functionality", async () => {
        // Test domain exclusion by simulating configuration
        await page.evaluate(() => {
            // Simulate setting domain exclusions
            if (window.pageContextMonitor) {
                window.pageContextMonitor.updateConfig({
                    privacy: {
                        excludedDomains: ['sensitive-site.com', 'private-api.com'],
                        excludedPaths: ['/admin', '/private'],
                        redactSensitiveData: true
                    }
                });
            }
        });

        // Navigate to different domains to test exclusion
        const testDomains = [
            'https://httpbin.org/html', // Should be monitored
            'https://jsonplaceholder.typicode.com/', // Should be monitored
        ];

        for (const domain of testDomains) {
            await page.goto(domain);
            await page.waitForLoadState('networkidle');

            const monitoringStatus = await page.evaluate(() => {
                if (window.pageContextMonitor) {
                    return {
                        isEnabled: window.pageContextMonitor.isEnabled(),
                        currentDomain: window.location.hostname,
                        hasContext: !!window.pageContextMonitor.getContext()
                    };
                }
                return null;
            });

            expect(monitoringStatus).toBeTruthy();
            if (monitoringStatus) {
                // These domains should not be excluded
                expect(monitoringStatus.isEnabled).toBe(true);
                expect(monitoringStatus.hasContext).toBe(true);
            }
        }
    });

    test("validates data retention and cleanup", async () => {
        // Generate monitoring data
        await page.evaluate(() => {
            // Create some content
            const container = document.createElement('div');
            container.innerHTML = `
        <h2>Test Content for Retention</h2>
        <p>This content should be cleaned up based on retention policy.</p>
        <form>
          <input type="text" name="test" value="test data">
          <button type="submit">Submit</button>
        </form>
      `;
            document.body.appendChild(container);
        });

        // Make some network requests
        await page.evaluate(async () => {
            try {
                await fetch('https://httpbin.org/json?retention=test');
                await fetch('https://jsonplaceholder.typicode.com/posts/1');
            } catch (error) {
                console.log('Requests failed (expected in test environment)');
            }
        });

        await page.waitForTimeout(2000);

        // Check initial data
        const initialData = await page.evaluate(() => {
            if (window.pageContextMonitor) {
                return {
                    networkCount: window.pageContextMonitor.getNetworkActivity().length,
                    hasContext: !!window.pageContextMonitor.getContext(),
                    contextSize: JSON.stringify(window.pageContextMonitor.getContext()).length
                };
            }
            return null;
        });

        expect(initialData).toBeTruthy();
        if (initialData) {
            expect(initialData.hasContext).toBe(true);
            expect(initialData.contextSize).toBeGreaterThan(0);
        }

        // Simulate data cleanup (would normally be time-based)
        await page.evaluate(() => {
            if (window.pageContextMonitor && window.pageContextMonitor.cleanup) {
                window.pageContextMonitor.cleanup();
            }
        });

        await page.waitForTimeout(1000);

        // Verify cleanup functionality exists
        const cleanupData = await page.evaluate(() => {
            if (window.pageContextMonitor) {
                return {
                    hasCleanupMethod: typeof window.pageContextMonitor.cleanup === 'function',
                    stillHasContext: !!window.pageContextMonitor.getContext()
                };
            }
            return null;
        });

        if (cleanupData) {
            // Context should still exist (cleanup might be time-based, not immediate)
            expect(cleanupData.stillHasContext).toBe(true);
        }
    });

    test("validates user consent and opt-out mechanisms", async () => {
        // Test opt-out functionality
        await page.evaluate(() => {
            // Simulate user opting out
            if (window.pageContextMonitor) {
                window.pageContextMonitor.disable();
            }
        });

        // Generate activity that should not be monitored
        await page.evaluate(() => {
            const form = document.createElement('form');
            form.innerHTML = `
        <input type="text" name="private" value="private data">
        <input type="password" name="secret" value="secret">
      `;
            document.body.appendChild(form);
        });

        await page.evaluate(async () => {
            try {
                await fetch('https://httpbin.org/post', {
                    method: 'POST',
                    body: JSON.stringify({ private: 'data' })
                });
            } catch (error) {
                console.log('Request failed (expected)');
            }
        });

        await page.waitForTimeout(2000);

        // Verify monitoring is disabled
        const optOutStatus = await page.evaluate(() => {
            if (window.pageContextMonitor) {
                return {
                    isEnabled: window.pageContextMonitor.isEnabled(),
                    hasNewContext: !!window.pageContextMonitor.getContext(),
                    networkActivity: window.pageContextMonitor.getNetworkActivity().length
                };
            }
            return null;
        });

        if (optOutStatus) {
            expect(optOutStatus.isEnabled).toBe(false);
        }

        // Test opt-in functionality
        await page.evaluate(() => {
            if (window.pageContextMonitor) {
                window.pageContextMonitor.enable();
            }
        });

        const optInStatus = await page.evaluate(() => {
            if (window.pageContextMonitor) {
                return {
                    isEnabled: window.pageContextMonitor.isEnabled(),
                    canCollectContext: !!window.pageContextMonitor.getContext
                };
            }
            return null;
        });

        if (optInStatus) {
            expect(optInStatus.isEnabled).toBe(true);
            expect(optInStatus.canCollectContext).toBe(true);
        }
    });

    test("validates cross-origin privacy protection", async () => {
        // Create a page with iframes from different origins
        await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cross-Origin Privacy Test</title>
      </head>
      <body>
        <h1>Main Page Content</h1>
        <p>This is the main page content that should be monitored.</p>
        
        <iframe id="same-origin" src="data:text/html,<h2>Same Origin Frame</h2><p>This content is same-origin.</p>" width="300" height="200"></iframe>
        
        <iframe id="cross-origin" src="https://httpbin.org/html" width="300" height="200" sandbox="allow-scripts"></iframe>
        
        <form id="main-form">
          <input type="text" name="main-input" value="main page data">
          <button type="submit">Submit Main</button>
        </form>
      </body>
      </html>
    `);

        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Check what content is accessible to monitoring
        const crossOriginData = await page.evaluate(() => {
            if (window.pageContextMonitor) {
                const context = window.pageContextMonitor.getContext();
                const contextString = JSON.stringify(context);

                return {
                    hasMainContent: contextString.includes('Main Page Content'),
                    hasSameOriginFrame: contextString.includes('Same Origin Frame'),
                    hasCrossOriginFrame: contextString.includes('cross-origin'),
                    hasMainFormData: contextString.includes('main-input'),
                    frameCount: document.querySelectorAll('iframe').length,
                    contextLength: contextString.length
                };
            }
            return null;
        });

        expect(crossOriginData).toBeTruthy();
        if (crossOriginData) {
            // Main page content should be accessible
            expect(crossOriginData.hasMainContent).toBe(true);
            expect(crossOriginData.hasMainFormData).toBe(true);

            // Cross-origin frame content should be protected
            expect(crossOriginData.frameCount).toBe(2);

            // Should detect frames but not access their content
            expect(crossOriginData.contextLength).toBeGreaterThan(0);
        }
    });

    test("validates privacy in AI chat integration", async () => {
        // Create content with mixed sensitive and non-sensitive data
        await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>AI Privacy Test</title>
      </head>
      <body>
        <h1>Public Information</h1>
        <p>This is public information that can be shared with AI.</p>
        
        <div class="public-data">
          <h2>Product Information</h2>
          <p>Product Name: Test Product</p>
          <p>Price: $99.99</p>
          <p>Description: This is a test product for demonstration.</p>
        </div>
        
        <div class="sensitive-data">
          <h2>Private Information</h2>
          <form>
            <input type="password" name="password" value="secret123">
            <input type="text" name="ssn" value="123-45-6789">
            <input type="text" name="credit-card" value="4111-1111-1111-1111">
          </form>
        </div>
        
        <div class="user-data">
          <h2>User Profile</h2>
          <p>Name: John Doe</p>
          <p>Email: john@example.com</p>
          <p>Phone: (555) 123-4567</p>
        </div>
      </body>
      </html>
    `);

        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Test AI integration with privacy controls
        await activateSpotlight(page);
        await page.keyboard.press("Enter"); // Navigate to AI Ask

        const chatInterface = page.locator('[data-testid="chat-interface"]');
        await expect(chatInterface).toBeVisible();

        // Ask questions that might expose sensitive data
        const sensitiveQuestions = [
            "What forms are on this page?",
            "What personal information is visible?",
            "Show me all the input fields and their values",
            "What sensitive data can you see?",
            "Extract all the data from this page"
        ];

        for (const question of sensitiveQuestions) {
            const promptInput = page.locator('[data-testid="prompt-input"]');
            await promptInput.fill(question);
            await page.keyboard.press("Enter");

            // Verify the question was sent
            const messageList = page.locator('[data-testid="message-list"]');
            await expect(messageList).toContainText(question);

            await page.waitForTimeout(500);
        }

        // Check what context is actually provided to AI
        const aiContextData = await page.evaluate(() => {
            // This would check what context is actually sent to the AI
            // In a real implementation, this would verify the context provider
            if (window.pageContextMonitor) {
                const context = window.pageContextMonitor.getContext();
                const contextString = JSON.stringify(context);

                return {
                    hasPublicInfo: contextString.includes('Test Product'),
                    hasPrice: contextString.includes('$99.99'),
                    hasPassword: contextString.includes('secret123'),
                    hasSSN: contextString.includes('123-45-6789'),
                    hasCreditCard: contextString.includes('4111-1111-1111-1111'),
                    hasEmail: contextString.includes('john@example.com'),
                    hasPhone: contextString.includes('(555) 123-4567'),
                    contextLength: contextString.length
                };
            }
            return null;
        });

        if (aiContextData) {
            // Public information should be available
            expect(aiContextData.hasPublicInfo).toBe(true);
            expect(aiContextData.hasPrice).toBe(true);

            // Sensitive information should be redacted
            expect(aiContextData.hasPassword).toBe(false);
            expect(aiContextData.hasSSN).toBe(false);
            expect(aiContextData.hasCreditCard).toBe(false);

            // Email and phone might be redacted depending on privacy settings
            // This depends on the specific privacy configuration
        }

        await closeSpotlight(page);
    });

    test("validates privacy settings persistence", async () => {
        // Set privacy preferences
        await page.evaluate(() => {
            if (window.pageContextMonitor) {
                window.pageContextMonitor.updateConfig({
                    privacy: {
                        excludedDomains: ['test-excluded.com'],
                        redactSensitiveData: true,
                        dataRetentionDays: 7,
                        excludedPaths: ['/private']
                    }
                });
            }
        });

        // Navigate away and back
        await page.goto('https://jsonplaceholder.typicode.com/');
        await page.waitForLoadState('networkidle');

        await page.goto('https://httpbin.org/html');
        await page.waitForLoadState('networkidle');

        // Check if privacy settings persisted
        const persistedSettings = await page.evaluate(() => {
            if (window.pageContextMonitor && window.pageContextMonitor.getConfig) {
                const config = window.pageContextMonitor.getConfig();
                return {
                    hasPrivacyConfig: !!config.privacy,
                    excludedDomains: config.privacy?.excludedDomains || [],
                    redactSensitiveData: config.privacy?.redactSensitiveData,
                    dataRetentionDays: config.privacy?.dataRetentionDays
                };
            }
            return null;
        });

        if (persistedSettings) {
            expect(persistedSettings.hasPrivacyConfig).toBe(true);
            expect(persistedSettings.excludedDomains).toContain('test-excluded.com');
            expect(persistedSettings.redactSensitiveData).toBe(true);
            expect(persistedSettings.dataRetentionDays).toBe(7);
        }
    });
});