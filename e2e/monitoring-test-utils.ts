import { Page, expect } from "@playwright/test";

/**
 * Utility functions for page context monitoring E2E tests
 */

/**
 * Create a test page with rich content for monitoring
 */
export async function createTestPageWithContent(page: Page) {
    await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Monitoring Test Page</title>
      <meta property="og:title" content="Test Page">
      <meta property="og:description" content="A test page for monitoring">
      <meta name="description" content="Test page for context monitoring">
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": "Monitoring Test Page",
        "description": "A test page for context monitoring",
        "author": {
          "@type": "Person",
          "name": "Test Author"
        }
      }
      </script>
    </head>
    <body>
      <header>
        <h1>Monitoring Test Page</h1>
        <nav>
          <a href="#section1">Section 1</a>
          <a href="#section2">Section 2</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>
      
      <main>
        <section id="section1">
          <h2>Content Section</h2>
          <p>This is a test paragraph with <strong>important</strong> content.</p>
          <ul>
            <li>List item 1</li>
            <li>List item 2</li>
            <li>List item 3</li>
          </ul>
        </section>
        
        <section id="section2">
          <h2>Data Table</h2>
          <table id="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>City</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>John Doe</td>
                <td>30</td>
                <td>New York</td>
                <td>Active</td>
              </tr>
              <tr>
                <td>Jane Smith</td>
                <td>25</td>
                <td>Los Angeles</td>
                <td>Inactive</td>
              </tr>
              <tr>
                <td>Bob Johnson</td>
                <td>35</td>
                <td>Chicago</td>
                <td>Active</td>
              </tr>
            </tbody>
          </table>
        </section>
        
        <section id="contact">
          <h2>Contact Form</h2>
          <form id="contact-form">
            <div>
              <label for="name">Name:</label>
              <input type="text" id="name" name="name" required>
            </div>
            <div>
              <label for="email">Email:</label>
              <input type="email" id="email" name="email" required>
            </div>
            <div>
              <label for="subject">Subject:</label>
              <select id="subject" name="subject">
                <option value="general">General Inquiry</option>
                <option value="support">Support</option>
                <option value="feedback">Feedback</option>
              </select>
            </div>
            <div>
              <label for="message">Message:</label>
              <textarea id="message" name="message" rows="4" required></textarea>
            </div>
            <button type="submit">Send Message</button>
          </form>
        </section>
        
        <section id="interactive">
          <h2>Interactive Elements</h2>
          <button id="dynamic-btn" onclick="addDynamicContent()">Add Content</button>
          <button id="api-btn" onclick="makeApiCall()">Make API Call</button>
          <div id="dynamic-content"></div>
          <div id="api-results"></div>
        </section>
      </main>
      
      <footer>
        <p>&copy; 2024 Test Page. All rights reserved.</p>
      </footer>
      
      <script>
        let contentCounter = 0;
        
        function addDynamicContent() {
          contentCounter++;
          const container = document.getElementById('dynamic-content');
          const newElement = document.createElement('div');
          newElement.className = 'dynamic-item';
          newElement.innerHTML = \`
            <h3>Dynamic Content \${contentCounter}</h3>
            <p>This content was added dynamically at \${new Date().toLocaleTimeString()}</p>
            <button onclick="removeDynamicContent(this)">Remove</button>
          \`;
          container.appendChild(newElement);
          
          // Trigger a custom event for monitoring
          window.dispatchEvent(new CustomEvent('contentAdded', {
            detail: { count: contentCounter, timestamp: Date.now() }
          }));
        }
        
        function removeDynamicContent(button) {
          button.parentElement.remove();
          window.dispatchEvent(new CustomEvent('contentRemoved', {
            detail: { timestamp: Date.now() }
          }));
        }
        
        async function makeApiCall() {
          const resultsDiv = document.getElementById('api-results');
          resultsDiv.innerHTML = '<p>Loading...</p>';
          
          try {
            // Make multiple API calls to test network monitoring
            const [users, posts, comments] = await Promise.all([
              fetch('https://jsonplaceholder.typicode.com/users/1').then(r => r.json()),
              fetch('https://jsonplaceholder.typicode.com/posts/1').then(r => r.json()),
              fetch('https://jsonplaceholder.typicode.com/comments?postId=1').then(r => r.json())
            ]);
            
            resultsDiv.innerHTML = \`
              <h4>API Results</h4>
              <div><strong>User:</strong> \${users.name} (\${users.email})</div>
              <div><strong>Post:</strong> \${posts.title}</div>
              <div><strong>Comments:</strong> \${comments.length} comments</div>
            \`;
          } catch (error) {
            resultsDiv.innerHTML = \`<p>Error: \${error.message}</p>\`;
          }
        }
        
        // Simulate some initial network activity
        setTimeout(() => {
          fetch('https://httpbin.org/json').catch(() => {});
          fetch('https://httpbin.org/user-agent').catch(() => {});
        }, 1000);
        
        // Add scroll tracking
        let scrollTimeout;
        window.addEventListener('scroll', () => {
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            window.dispatchEvent(new CustomEvent('scrollEnd', {
              detail: { 
                scrollY: window.scrollY,
                scrollX: window.scrollX,
                timestamp: Date.now()
              }
            }));
          }, 150);
        });
        
        // Form submission handling
        document.getElementById('contact-form').addEventListener('submit', (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData.entries());
          
          window.dispatchEvent(new CustomEvent('formSubmitted', {
            detail: { formData: data, timestamp: Date.now() }
          }));
          
          alert('Form submitted! (This is just a test)');
        });
      </script>
    </body>
    </html>
  `);

    await page.waitForLoadState("networkidle");
}

/**
 * Create a page with plugin API for testing enhanced context
 */
export async function createPluginEnabledPage(page: Page) {
    await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Plugin-Enabled Test Page</title>
    </head>
    <body>
      <h1>Plugin-Enabled Page</h1>
      <div id="plugin-content">
        <h2>E-commerce Product</h2>
        <div class="product" data-id="123">
          <h3>Test Product</h3>
          <p class="price">$99.99</p>
          <p class="description">This is a test product for plugin integration.</p>
          <button class="add-to-cart">Add to Cart</button>
        </div>
      </div>
      
      <script>
        // Mock e-commerce plugin API
        window.spotlightPlugin = {
          version: '1.0.0',
          capabilities: ['context', 'realtime', 'semantic', 'ecommerce'],
          
          getContext: async () => {
            const product = document.querySelector('.product');
            return {
              type: 'ecommerce',
              page: 'product',
              product: {
                id: product.dataset.id,
                name: product.querySelector('h3').textContent,
                price: product.querySelector('.price').textContent,
                description: product.querySelector('.description').textContent
              },
              user: {
                id: 'test-user-123',
                authenticated: true
              },
              cart: {
                items: [],
                total: 0
              },
              timestamp: new Date().toISOString()
            };
          },
          
          getSchema: () => ({
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['ecommerce'] },
              page: { type: 'string' },
              product: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  price: { type: 'string' },
                  description: { type: 'string' }
                }
              },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  authenticated: { type: 'boolean' }
                }
              },
              cart: {
                type: 'object',
                properties: {
                  items: { type: 'array' },
                  total: { type: 'number' }
                }
              }
            }
          }),
          
          onContextRequest: (callback) => {
            // Register for real-time updates
            window.addEventListener('cartUpdate', (event) => {
              callback({
                type: 'cart-update',
                data: event.detail
              });
            });
            
            window.addEventListener('productView', (event) => {
              callback({
                type: 'product-view',
                data: event.detail
              });
            });
          },
          
          // Additional plugin methods
          addToCart: (productId) => {
            const event = new CustomEvent('cartUpdate', {
              detail: {
                action: 'add',
                productId: productId,
                timestamp: Date.now()
              }
            });
            window.dispatchEvent(event);
          }
        };
        
        // Simulate plugin interactions
        document.querySelector('.add-to-cart').addEventListener('click', () => {
          window.spotlightPlugin.addToCart('123');
          alert('Product added to cart!');
        });
        
        // Simulate product view tracking
        setTimeout(() => {
          const event = new CustomEvent('productView', {
            detail: {
              productId: '123',
              timestamp: Date.now(),
              source: 'page-load'
            }
          });
          window.dispatchEvent(event);
        }, 1000);
      </script>
    </body>
    </html>
  `);

    await page.waitForLoadState("networkidle");
}

/**
 * Trigger network activity for testing network monitoring
 */
export async function triggerNetworkActivity(page: Page) {
    await page.evaluate(async () => {
        const requests = [
            fetch('https://httpbin.org/json'),
            fetch('https://httpbin.org/user-agent'),
            fetch('https://httpbin.org/headers'),
            fetch('https://jsonplaceholder.typicode.com/posts/1'),
            fetch('https://jsonplaceholder.typicode.com/users/1')
        ];

        try {
            await Promise.all(requests);
        } catch (error) {
            console.log('Some network requests failed (expected in test environment)');
        }
    });

    await page.waitForTimeout(2000); // Wait for requests to complete
}

/**
 * Trigger DOM mutations for testing DOM observation
 */
export async function triggerDOMChanges(page: Page) {
    await page.evaluate(() => {
        const container = document.createElement('div');
        container.id = 'mutation-test-container';
        document.body.appendChild(container);

        // Add elements
        for (let i = 0; i < 10; i++) {
            const element = document.createElement('div');
            element.className = 'mutation-test-item';
            element.textContent = `Mutation test item ${i}`;
            container.appendChild(element);
        }

        // Modify elements
        setTimeout(() => {
            const items = container.querySelectorAll('.mutation-test-item');
            items.forEach((item, index) => {
                if (index % 2 === 0) {
                    item.style.backgroundColor = '#ffff00';
                    item.textContent += ' (modified)';
                }
            });
        }, 500);

        // Remove some elements
        setTimeout(() => {
            const items = container.querySelectorAll('.mutation-test-item');
            for (let i = 0; i < 3; i++) {
                if (items[i]) {
                    items[i].remove();
                }
            }
        }, 1000);

        // Add attributes
        setTimeout(() => {
            const items = container.querySelectorAll('.mutation-test-item');
            items.forEach((item, index) => {
                item.setAttribute('data-test-id', `item-${index}`);
                item.setAttribute('data-modified', 'true');
            });
        }, 1500);
    });

    await page.waitForTimeout(2000); // Wait for all mutations to complete
}

/**
 * Test form interactions for monitoring
 */
export async function testFormInteractions(page: Page) {
    // Fill out a form if it exists
    const nameInput = page.locator('#name');
    if (await nameInput.isVisible()) {
        await nameInput.fill('Test User');
    }

    const emailInput = page.locator('#email');
    if (await emailInput.isVisible()) {
        await emailInput.fill('test@example.com');
    }

    const subjectSelect = page.locator('#subject');
    if (await subjectSelect.isVisible()) {
        await subjectSelect.selectOption('support');
    }

    const messageTextarea = page.locator('#message');
    if (await messageTextarea.isVisible()) {
        await messageTextarea.fill('This is a test message for monitoring form interactions.');
    }

    // Submit the form
    const submitButton = page.locator('button[type="submit"]');
    if (await submitButton.isVisible()) {
        await submitButton.click();
    }

    await page.waitForTimeout(1000);
}

/**
 * Test scroll and viewport changes
 */
export async function testViewportChanges(page: Page) {
    // Scroll to different positions
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);

    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(300);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
}

/**
 * Verify monitoring data is captured
 */
export async function verifyMonitoringData(page: Page) {
    const monitoringData = await page.evaluate(() => {
        // Access monitoring data through the extension's content script
        if (window.pageContextMonitor) {
            return {
                hasNetworkData: window.pageContextMonitor.getNetworkActivity().length > 0,
                hasDOMChanges: window.pageContextMonitor.getDOMChanges().length > 0,
                hasContextData: !!window.pageContextMonitor.getContext(),
                isEnabled: window.pageContextMonitor.isEnabled()
            };
        }
        return null;
    });

    return monitoringData;
}

/**
 * Test privacy controls and data redaction
 */
export async function testPrivacyControls(page: Page) {
    // Create content with sensitive data
    await page.evaluate(() => {
        const sensitiveForm = document.createElement('form');
        sensitiveForm.innerHTML = `
      <h3>Sensitive Data Form</h3>
      <input type="password" name="password" placeholder="Password">
      <input type="text" name="ssn" placeholder="123-45-6789" pattern="\\d{3}-\\d{2}-\\d{4}">
      <input type="text" name="credit-card" placeholder="4111-1111-1111-1111">
      <input type="text" name="phone" placeholder="(555) 123-4567">
      <button type="submit">Submit Sensitive Data</button>
    `;
        document.body.appendChild(sensitiveForm);
    });

    // Fill out sensitive data
    await page.fill('input[name="password"]', 'secretpassword123');
    await page.fill('input[name="ssn"]', '123-45-6789');
    await page.fill('input[name="credit-card"]', '4111-1111-1111-1111');
    await page.fill('input[name="phone"]', '(555) 123-4567');

    await page.waitForTimeout(1000);

    // Verify that sensitive data is properly handled by monitoring
    const privacyCheck = await page.evaluate(() => {
        if (window.pageContextMonitor) {
            const context = window.pageContextMonitor.getContext();
            const contextString = JSON.stringify(context);

            return {
                hasPassword: contextString.includes('secretpassword123'),
                hasSSN: contextString.includes('123-45-6789'),
                hasCreditCard: contextString.includes('4111-1111-1111-1111'),
                hasPhone: contextString.includes('(555) 123-4567'),
                contextLength: contextString.length
            };
        }
        return null;
    });

    return privacyCheck;
}

/**
 * Measure performance impact of monitoring
 */
export async function measurePerformanceImpact(page: Page) {
    const performanceMetrics = await page.evaluate(() => {
        const startTime = performance.now();

        // Perform intensive operations
        for (let i = 0; i < 1000; i++) {
            const element = document.createElement('div');
            element.textContent = `Performance test element ${i}`;
            document.body.appendChild(element);

            if (i % 100 === 0) {
                element.style.backgroundColor = '#ff0000';
                element.style.color = '#ffffff';
            }
        }

        const endTime = performance.now();

        return {
            operationTime: endTime - startTime,
            memoryUsage: (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0,
            domNodes: document.querySelectorAll('*').length
        };
    });

    return performanceMetrics;
}

/**
 * Test cross-tab monitoring behavior
 */
export async function testCrossTabBehavior(context: any) {
    // Create multiple tabs
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();

    // Navigate to different pages
    await tab1.goto('https://httpbin.org/html');
    await tab2.goto('https://jsonplaceholder.typicode.com/');

    await tab1.waitForLoadState('networkidle');
    await tab2.waitForLoadState('networkidle');

    // Test monitoring isolation between tabs
    const tab1Data = await tab1.evaluate(() => {
        return window.pageContextMonitor ? {
            url: window.location.href,
            hasContext: !!window.pageContextMonitor.getContext()
        } : null;
    });

    const tab2Data = await tab2.evaluate(() => {
        return window.pageContextMonitor ? {
            url: window.location.href,
            hasContext: !!window.pageContextMonitor.getContext()
        } : null;
    });

    await tab1.close();
    await tab2.close();

    return { tab1Data, tab2Data };
}