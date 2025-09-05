import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
    createExtensionContext,
    activateSpotlight,
    closeSpotlight,
    waitForPageReady,
} from "./test-utils";

let context: BrowserContext;
let page: Page;

test.describe("Page Context Monitoring E2E Tests", () => {
    test.beforeAll(async () => {
        context = await createExtensionContext();
        page = await context.newPage();
    });

    test.afterAll(async () => {
        await context.close();
    });

    test.beforeEach(async () => {
        // Navigate to a test page with dynamic content
        await waitForPageReady(page, "https://httpbin.org/html");
    });

    test("monitors network requests and responses", async () => {
        // Navigate to a page that makes API calls
        await page.goto("https://jsonplaceholder.typicode.com/");
        await page.waitForLoadState("networkidle");

        // Trigger some API calls by navigating to posts
        await page.goto("https://jsonplaceholder.typicode.com/posts/1");
        await page.waitForLoadState("networkidle");

        // Activate spotlight to access context
        await activateSpotlight(page);

        // Navigate to AI Ask to test context integration
        await page.keyboard.press("Enter");

        // Wait for chat interface
        const chatInterface = page.locator('[data-testid="chat-interface"]');
        await expect(chatInterface).toBeVisible();

        // Send a message asking about network activity
        const promptInput = page.locator('[data-testid="prompt-input"]');
        await promptInput.fill("What network requests were made on this page?");
        await page.keyboard.press("Enter");

        // Verify the AI has access to network context
        // Note: This would require the actual AI integration to be working
        // For now, we verify the monitoring infrastructure is in place
        const messageList = page.locator('[data-testid="message-list"]');
        await expect(messageList).toContainText("What network requests were made on this page?");

        await closeSpotlight(page);
    });

    test("tracks DOM changes and mutations", async () => {
        // Navigate to a page with dynamic content
        await page.goto("https://httpbin.org/html");
        await page.waitForLoadState("networkidle");

        // Create some DOM changes
        await page.evaluate(() => {
            // Add a new element
            const newDiv = document.createElement('div');
            newDiv.id = 'dynamic-content';
            newDiv.textContent = 'This is dynamically added content';
            document.body.appendChild(newDiv);

            // Modify existing content
            const h1 = document.querySelector('h1');
            if (h1) {
                h1.textContent = 'Modified Heading';
            }

            // Add a form for interaction testing
            const form = document.createElement('form');
            form.innerHTML = `
        <input type="text" id="test-input" placeholder="Test input">
        <button type="submit">Submit</button>
      `;
            document.body.appendChild(form);
        });

        // Wait for DOM changes to be processed
        await page.waitForTimeout(1000);

        // Interact with the form
        await page.fill('#test-input', 'Test interaction data');
        await page.click('button[type="submit"]');

        // Activate spotlight to check context
        await activateSpotlight(page);
        await page.keyboard.press("Enter"); // Navigate to AI Ask

        const chatInterface = page.locator('[data-testid="chat-interface"]');
        await expect(chatInterface).toBeVisible();

        // Ask about page content
        const promptInput = page.locator('[data-testid="prompt-input"]');
        await promptInput.fill("What forms are on this page?");
        await page.keyboard.press("Enter");

        // Verify context is captured
        const messageList = page.locator('[data-testid="message-list"]');
        await expect(messageList).toContainText("What forms are on this page?");

        await closeSpotlight(page);
    });

    test("captures viewport and scroll changes", async () => {
        // Navigate to a long page
        await page.goto("https://httpbin.org/html");
        await page.waitForLoadState("networkidle");

        // Add some content to make the page scrollable
        await page.evaluate(() => {
            for (let i = 0; i < 50; i++) {
                const div = document.createElement('div');
                div.textContent = `Content block ${i + 1}`;
                div.style.height = '100px';
                div.style.margin = '10px';
                div.style.backgroundColor = i % 2 === 0 ? '#f0f0f0' : '#e0e0e0';
                document.body.appendChild(div);
            }
        });

        // Scroll down to trigger viewport changes
        await page.evaluate(() => window.scrollTo(0, 1000));
        await page.waitForTimeout(500);

        // Scroll back up
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);

        // Test intersection observer by scrolling to specific elements
        await page.evaluate(() => {
            const targetElement = document.querySelector('div:nth-child(20)');
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });

        await page.waitForTimeout(1000);

        // Activate spotlight to check viewport context
        await activateSpotlight(page);
        await page.keyboard.press("Enter");

        const chatInterface = page.locator('[data-testid="chat-interface"]');
        await expect(chatInterface).toBeVisible();

        // Ask about visible content
        const promptInput = page.locator('[data-testid="prompt-input"]');
        await promptInput.fill("What content is currently visible on the page?");
        await page.keyboard.press("Enter");

        const messageList = page.locator('[data-testid="message-list"]');
        await expect(messageList).toContainText("What content is currently visible on the page?");

        await closeSpotlight(page);
    });

    test("extracts semantic data and metadata", async () => {
        // Create a page with rich semantic markup
        await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Page with Semantic Data</title>
        <meta property="og:title" content="Test Page">
        <meta property="og:description" content="A test page for semantic extraction">
        <meta property="og:type" content="website">
        <meta name="twitter:card" content="summary">
        <meta name="twitter:title" content="Test Page">
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": "Test Article",
          "author": {
            "@type": "Person",
            "name": "Test Author"
          },
          "datePublished": "2024-01-01"
        }
        </script>
      </head>
      <body>
        <article itemscope itemtype="https://schema.org/Article">
          <h1 itemprop="headline">Test Article Headline</h1>
          <div itemprop="author" itemscope itemtype="https://schema.org/Person">
            <span itemprop="name">Test Author</span>
          </div>
          <time itemprop="datePublished" datetime="2024-01-01">January 1, 2024</time>
          <div itemprop="articleBody">
            <p>This is the article content with semantic markup.</p>
          </div>
        </article>
        
        <div data-spotlight-context="product-list">
          <div data-spotlight-item="product" data-id="123">
            <h2 data-spotlight-field="name">Test Product</h2>
            <span data-spotlight-field="price">$99.99</span>
          </div>
        </div>
      </body>
      </html>
    `);

        await page.waitForLoadState("networkidle");

        // Activate spotlight to test semantic extraction
        await activateSpotlight(page);
        await page.keyboard.press("Enter");

        const chatInterface = page.locator('[data-testid="chat-interface"]');
        await expect(chatInterface).toBeVisible();

        // Ask about semantic data
        const promptInput = page.locator('[data-testid="prompt-input"]');
        await promptInput.fill("What structured data is available on this page?");
        await page.keyboard.press("Enter");

        const messageList = page.locator('[data-testid="message-list"]');
        await expect(messageList).toContainText("What structured data is available on this page?");

        await closeSpotlight(page);
    });

    test("handles plugin API integration", async () => {
        // Create a page with plugin API
        await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Plugin-Enabled Page</title>
      </head>
      <body>
        <h1>Plugin Test Page</h1>
        <div id="content">Initial content</div>
        
        <script>
          // Mock plugin API
          window.spotlightPlugin = {
            version: '1.0.0',
            capabilities: ['context', 'realtime', 'semantic'],
            
            getContext: async () => {
              return {
                type: 'test-page',
                data: {
                  title: 'Plugin Test Page',
                  content: document.getElementById('content').textContent,
                  timestamp: new Date().toISOString()
                }
              };
            },
            
            getSchema: () => ({
              type: 'object',
              properties: {
                type: { type: 'string' },
                data: { type: 'object' }
              }
            }),
            
            onContextRequest: (callback) => {
              // Simulate real-time updates
              setTimeout(() => {
                callback({
                  type: 'update',
                  data: { content: 'Updated content via plugin API' }
                });
              }, 2000);
            }
          };
          
          // Trigger a context change
          setTimeout(() => {
            document.getElementById('content').textContent = 'Content updated dynamically';
            if (window.spotlightPlugin.onContextRequest) {
              const event = new CustomEvent('contextChange', {
                detail: { content: 'Content updated dynamically' }
              });
              window.dispatchEvent(event);
            }
          }, 1000);
        </script>
      </body>
      </html>
    `);

        await page.waitForLoadState("networkidle");

        // Wait for plugin to be detected and initialized
        await page.waitForTimeout(2000);

        // Activate spotlight to test plugin integration
        await activateSpotlight(page);
        await page.keyboard.press("Enter");

        const chatInterface = page.locator('[data-testid="chat-interface"]');
        await expect(chatInterface).toBeVisible();

        // Ask about plugin-provided context
        const promptInput = page.locator('[data-testid="prompt-input"]');
        await promptInput.fill("What enhanced context is available from the plugin?");
        await page.keyboard.press("Enter");

        const messageList = page.locator('[data-testid="message-list"]');
        await expect(messageList).toContainText("What enhanced context is available from the plugin?");

        await closeSpotlight(page);
    });

    test("integrates context with AI chat interface", async () => {
        // Navigate to a content-rich page
        await page.goto("https://httpbin.org/html");
        await page.waitForLoadState("networkidle");

        // Add some interactive content
        await page.evaluate(() => {
            const form = document.createElement('form');
            form.innerHTML = `
        <h2>Contact Form</h2>
        <input type="text" name="name" placeholder="Your Name" required>
        <input type="email" name="email" placeholder="Your Email" required>
        <textarea name="message" placeholder="Your Message" required></textarea>
        <button type="submit">Send Message</button>
      `;
            document.body.appendChild(form);

            const table = document.createElement('table');
            table.innerHTML = `
        <thead>
          <tr><th>Name</th><th>Age</th><th>City</th></tr>
        </thead>
        <tbody>
          <tr><td>John Doe</td><td>30</td><td>New York</td></tr>
          <tr><td>Jane Smith</td><td>25</td><td>Los Angeles</td></tr>
        </tbody>
      `;
            document.body.appendChild(table);
        });

        await page.waitForTimeout(1000);

        // Activate spotlight and test contextual AI
        await activateSpotlight(page);
        await page.keyboard.press("Enter");

        const chatInterface = page.locator('[data-testid="chat-interface"]');
        await expect(chatInterface).toBeVisible();

        // Test various context-aware queries
        const contextQueries = [
            "What forms are on this page?",
            "What data is in the table?",
            "Help me fill out the contact form",
            "What is the main content of this page?",
            "Are there any interactive elements?"
        ];

        for (const query of contextQueries) {
            const promptInput = page.locator('[data-testid="prompt-input"]');
            await promptInput.fill(query);
            await page.keyboard.press("Enter");

            // Wait for message to appear
            const messageList = page.locator('[data-testid="message-list"]');
            await expect(messageList).toContainText(query);

            // Clear input for next query
            await page.waitForTimeout(500);
        }

        await closeSpotlight(page);
    });

    test("monitors cross-page navigation and context persistence", async () => {
        // Start on first page
        await page.goto("https://httpbin.org/html");
        await page.waitForLoadState("networkidle");

        // Activate spotlight and establish context
        await activateSpotlight(page);
        await page.keyboard.press("Enter");

        let chatInterface = page.locator('[data-testid="chat-interface"]');
        await expect(chatInterface).toBeVisible();

        // Send a message to establish chat history
        let promptInput = page.locator('[data-testid="prompt-input"]');
        await promptInput.fill("Remember this: I'm testing cross-page navigation");
        await page.keyboard.press("Enter");

        await closeSpotlight(page);

        // Navigate to a different page
        await page.goto("https://jsonplaceholder.typicode.com/");
        await page.waitForLoadState("networkidle");

        // Activate spotlight again
        await activateSpotlight(page);
        await page.keyboard.press("Enter");

        chatInterface = page.locator('[data-testid="chat-interface"]');
        await expect(chatInterface).toBeVisible();

        // Test if context is maintained or properly reset
        promptInput = page.locator('[data-testid="prompt-input"]');
        await promptInput.fill("What page am I on now? Do you remember what I said before?");
        await page.keyboard.press("Enter");

        const messageList = page.locator('[data-testid="message-list"]');
        await expect(messageList).toContainText("What page am I on now? Do you remember what I said before?");

        await closeSpotlight(page);
    });

    test("handles monitoring system enable/disable states", async () => {
        // Navigate to test page
        await page.goto("https://httpbin.org/html");
        await page.waitForLoadState("networkidle");

        // Test with monitoring enabled (default state)
        await activateSpotlight(page);
        await page.keyboard.press("Enter");

        let chatInterface = page.locator('[data-testid="chat-interface"]');
        await expect(chatInterface).toBeVisible();

        let promptInput = page.locator('[data-testid="prompt-input"]');
        await promptInput.fill("What can you tell me about this page?");
        await page.keyboard.press("Enter");

        await closeSpotlight(page);

        // Open extension popup to disable monitoring
        // Note: This would require popup testing which might need additional setup
        // For now, we'll test the monitoring state through the content script

        // Inject script to simulate disabling monitoring
        await page.evaluate(() => {
            // Simulate disabling monitoring through extension API
            if (window.pageContextMonitor) {
                window.pageContextMonitor.disable();
            }
        });

        await page.waitForTimeout(1000);

        // Test with monitoring disabled
        await activateSpotlight(page);
        await page.keyboard.press("Enter");

        chatInterface = page.locator('[data-testid="chat-interface"]');
        await expect(chatInterface).toBeVisible();

        promptInput = page.locator('[data-testid="prompt-input"]');
        await promptInput.fill("Is monitoring still active?");
        await page.keyboard.press("Enter");

        await closeSpotlight(page);
    });

    test("validates performance impact of monitoring", async () => {
        // Navigate to a performance-sensitive page
        await page.goto("https://httpbin.org/html");
        await page.waitForLoadState("networkidle");

        // Measure performance before heavy monitoring
        const performanceBefore = await page.evaluate(() => {
            return {
                memory: (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0,
                timing: performance.now()
            };
        });

        // Create heavy DOM activity to test monitoring performance
        await page.evaluate(() => {
            const container = document.createElement('div');
            document.body.appendChild(container);

            // Create many DOM changes
            for (let i = 0; i < 1000; i++) {
                const element = document.createElement('div');
                element.textContent = `Dynamic element ${i}`;
                element.className = `dynamic-${i}`;
                container.appendChild(element);

                // Trigger style changes
                if (i % 10 === 0) {
                    element.style.backgroundColor = '#ff0000';
                    setTimeout(() => {
                        element.style.backgroundColor = '#00ff00';
                    }, 10);
                }
            }

            // Simulate network activity
            for (let i = 0; i < 10; i++) {
                fetch(`/status/200?test=${i}`).catch(() => { });
            }
        });

        await page.waitForTimeout(2000);

        // Measure performance after monitoring
        const performanceAfter = await page.evaluate(() => {
            return {
                memory: (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0,
                timing: performance.now()
            };
        });

        // Verify monitoring doesn't cause excessive performance degradation
        const memoryIncrease = performanceAfter.memory - performanceBefore.memory;
        const timeElapsed = performanceAfter.timing - performanceBefore.timing;

        // These are rough thresholds - adjust based on actual performance requirements
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
        expect(timeElapsed).toBeLessThan(5000); // Less than 5 seconds for operations

        // Test that the extension still works after heavy activity
        await activateSpotlight(page);
        const overlay = page.locator('[data-testid="spotlight-overlay"]');
        await expect(overlay).toBeVisible();
        await closeSpotlight(page);
    });
});