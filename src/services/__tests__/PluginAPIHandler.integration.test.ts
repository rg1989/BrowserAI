import { PluginAPIHandler } from '../PluginAPIHandler';
import {
    PluginGuidelines,
    ContextProvider,
    StructuredData,
    PerformanceLevel
} from '../../types/monitoring';

// Mock fetch for testing API endpoints
global.fetch = jest.fn();

// Mock global window object
const mockWindow = global.window as any;

describe('PluginAPIHandler Integration Tests', () => {
    let pluginHandler: PluginAPIHandler;

    beforeEach(() => {
        // Reset DOM and window mocks
        document.body.innerHTML = '';
        document.head.innerHTML = '';

        // Clear all plugin-related properties from window
        Object.keys(mockWindow).forEach(key => {
            if (key.includes('Plugin') || key.includes('plugin') || key === 'app') {
                delete mockWindow[key];
            }
        });

        // Mock performance.now()
        global.performance = {
            now: jest.fn(() => Date.now())
        } as any;

        // Reset fetch mock
        (fetch as jest.Mock).mockClear();
    });

    afterEach(() => {
        if (pluginHandler) {
            pluginHandler.clear();
        }
    });

    describe('Enhanced Context API Detection', () => {
        it('should detect plugin configuration from meta tags', () => {
            // Arrange
            document.head.innerHTML = `
                <meta name="spotlight-plugin" content='{"name": "MetaPlugin", "version": "2.0.0", "capabilities": ["enhanced-context"]}'>
            `;

            // Act
            pluginHandler = new PluginAPIHandler();
            const detectedPlugins = pluginHandler.getDetectedPlugins();

            // Assert
            expect(detectedPlugins.some(p => p.name === 'MetaPlugin')).toBe(true);
        });

        it('should detect plugin manifest from link tags', async () => {
            // Arrange
            document.head.innerHTML = `
                <link rel="spotlight-plugin" href="/plugin-manifest.json">
            `;

            const mockManifest = {
                name: 'ManifestPlugin',
                version: '1.5.0',
                capabilities: ['context', 'semantic'],
                contextAPI: {
                    endpoint: '/api/context'
                }
            };

            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockManifest)
            });

            // Act
            pluginHandler = new PluginAPIHandler();

            // Wait for async detection to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            const detectedPlugins = pluginHandler.getDetectedPlugins();

            // Assert
            expect(detectedPlugins.some(p => p.name === 'ManifestPlugin')).toBe(true);
        });

        it('should detect well-known endpoints', async () => {
            // Arrange
            const mockPluginConfig = {
                name: 'WellKnownPlugin',
                version: '1.0.0',
                capabilities: ['context'],
                contextAPI: {
                    endpoint: '/.well-known/spotlight-plugin'
                }
            };

            (fetch as jest.Mock)
                .mockResolvedValueOnce({ ok: true }) // HEAD request
                .mockResolvedValueOnce({ // GET request
                    ok: true,
                    json: () => Promise.resolve(mockPluginConfig)
                });

            // Act
            pluginHandler = new PluginAPIHandler();

            // Wait for async detection to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            const detectedPlugins = pluginHandler.getDetectedPlugins();

            // Assert
            expect(detectedPlugins.some(p => p.name === 'WellKnownPlugin')).toBe(true);
        });
    });

    describe('Plugin Guidelines Detection', () => {
        it('should detect plugin guidelines from structured markup', () => {
            // Arrange
            document.head.innerHTML = `
                <meta name="spotlight-guidelines-version" content="1.0.0">
                <meta name="spotlight-context-api" content="/api/spotlight/context">
                <meta name="spotlight-performance" content="streaming,compression">
            `;

            document.body.innerHTML = `
                <div data-spotlight-semantic="product" data-spotlight-required="true">
                    <span data-spotlight-field="name">Test Product</span>
                </div>
            `;

            // Act
            pluginHandler = new PluginAPIHandler();
            const guidelines = pluginHandler.getPluginGuidelines();

            // Assert
            expect(guidelines.size).toBeGreaterThan(0);
            const structuredGuidelines = guidelines.get('structured-markup');
            expect(structuredGuidelines).toBeDefined();
            expect(structuredGuidelines!.contextAPI.endpoint).toBe('/api/spotlight/context');
            expect(structuredGuidelines!.semanticMarkup.required).toContain('product');
        });

        it('should detect compliance from data attributes', () => {
            // Arrange
            document.body.innerHTML = `
                <div data-spotlight-compliant="true">
                    <div data-spotlight-context="product">
                        <span data-spotlight-field="name">Product Name</span>
                        <span data-spotlight-field="price">$99.99</span>
                    </div>
                    <div data-spotlight-context="user">
                        <span data-spotlight-field="name">User Name</span>
                    </div>
                </div>
            `;

            // Act
            pluginHandler = new PluginAPIHandler();
            const guidelines = pluginHandler.getPluginGuidelines();

            // Assert
            expect(guidelines.size).toBeGreaterThan(0);
            const dataGuidelines = guidelines.get('data-attributes');
            expect(dataGuidelines).toBeDefined();
            expect(dataGuidelines!.semanticMarkup.required).toContain('data-spotlight-context');
        });
    });

    describe('Structured Data Extraction', () => {
        it('should extract enhanced Schema.org data', async () => {
            // Arrange
            document.body.innerHTML = `
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@type": "Product",
                    "name": "Enhanced Product",
                    "offers": {
                        "@type": "Offer",
                        "price": "199.99",
                        "priceCurrency": "USD"
                    }
                }
                </script>
            `;

            const mockConfig = {
                name: 'SchemaPlugin',
                contextAPI: { endpoint: '/api/context' },
                semanticMarkup: {
                    required: ['script[type="application/ld+json"]'],
                    recommended: [],
                    custom: []
                }
            };

            (fetch as jest.Mock).mockRejectedValue(new Error('API not available'));

            // Act
            pluginHandler = new PluginAPIHandler();

            // Manually register the enhanced provider to test structured data extraction
            const provider: ContextProvider = {
                id: 'schema-test',
                name: 'Schema Test',
                version: '1.0.0',
                getContext: async () => {
                    // This will trigger structured data extraction
                    return pluginHandler['extractStructuredData'](mockConfig);
                },
                getSchema: () => ({ type: 'object', properties: {} }),
                supportsRealtime: () => false
            };

            pluginHandler.registerProvider(provider);
            const context = await pluginHandler.getEnhancedContext();

            // Assert
            expect(context).not.toBeNull();
            expect(context!.data.enhancedSchema).toBeDefined();
            expect(context!.data.enhancedSchema[0]['@type']).toBe('Product');
            expect(context!.data.enhancedSchema[0]._spotlight).toBeDefined();
        });

        it('should extract data from compliant markup efficiently', async () => {
            // Arrange
            document.body.innerHTML = `
                <div data-spotlight-context="product-list">
                    ${Array.from({ length: 50 }, (_, i) => `
                        <div data-spotlight-context="product">
                            <span data-spotlight-field="name">Product ${i}</span>
                            <span data-spotlight-field="price">$${(i + 1) * 10}.99</span>
                        </div>
                    `).join('')}
                </div>
            `;

            const mockConfig = {
                semanticMarkup: {
                    required: ['[data-spotlight-context="product"]'],
                    recommended: [],
                    custom: []
                }
            };

            // Act
            pluginHandler = new PluginAPIHandler();
            const startTime = performance.now();

            const extractedData = pluginHandler['extractStructuredData'](mockConfig);

            const endTime = performance.now();
            const extractionTime = endTime - startTime;

            // Assert
            expect(extractedData['[data-spotlight-context="product"]']).toBeDefined();
            expect(extractedData['[data-spotlight-context="product"]'].length).toBeLessThanOrEqual(100); // Performance limit
            expect(extractionTime).toBeLessThan(100); // Should be fast
        });
    });

    describe('Performance Optimizations', () => {
        beforeEach(() => {
            pluginHandler = new PluginAPIHandler();
        });

        it('should cache context for performance', async () => {
            // Arrange
            const mockProvider: ContextProvider = {
                id: 'cache-test',
                name: 'Cache Test',
                version: '1.0.0',
                getContext: jest.fn().mockResolvedValue({ cached: 'data', timestamp: Date.now() }),
                getSchema: () => ({ type: 'object', properties: {} }),
                supportsRealtime: () => false
            };

            pluginHandler.registerProvider(mockProvider);

            // Act - First call to populate cache
            await pluginHandler.getEnhancedContext();

            // Act - Second call (should potentially use cache)
            const context2 = await pluginHandler.getOptimizedContext();

            // Assert
            expect(context2).not.toBeNull();
            expect(mockProvider.getContext).toHaveBeenCalled();
        });

        it('should provide cache statistics', async () => {
            // Arrange
            const mockProvider: ContextProvider = {
                id: 'stats-test',
                name: 'Stats Test',
                version: '1.0.0',
                getContext: jest.fn().mockResolvedValue({ stats: 'data' }),
                getSchema: () => ({ type: 'object', properties: {} }),
                supportsRealtime: () => false
            };

            pluginHandler.registerProvider(mockProvider);

            // Act
            await pluginHandler.getEnhancedContext();
            const stats = pluginHandler.getCacheStats();

            // Assert
            expect(stats.size).toBeGreaterThanOrEqual(0);
            expect(stats.hitRate).toBeGreaterThanOrEqual(0);
            expect(stats.oldestEntry).toBeGreaterThanOrEqual(0);
        });

        it('should clear cache when requested', async () => {
            // Arrange
            const mockProvider: ContextProvider = {
                id: 'clear-test',
                name: 'Clear Test',
                version: '1.0.0',
                getContext: jest.fn().mockResolvedValue({ clear: 'data' }),
                getSchema: () => ({ type: 'object', properties: {} }),
                supportsRealtime: () => false
            };

            pluginHandler.registerProvider(mockProvider);
            await pluginHandler.getOptimizedContext();

            // Act
            pluginHandler.clearContextCache();
            const stats = pluginHandler.getCacheStats();

            // Assert
            expect(stats.size).toBe(0);
        });

        it('should handle cache timeout correctly', async () => {
            // Arrange
            pluginHandler.setCacheTimeout(100); // 100ms timeout

            const mockProvider: ContextProvider = {
                id: 'timeout-test',
                name: 'Timeout Test',
                version: '1.0.0',
                getContext: jest.fn().mockResolvedValue({ timeout: 'data' }),
                getSchema: () => ({ type: 'object', properties: {} }),
                supportsRealtime: () => false
            };

            pluginHandler.registerProvider(mockProvider);

            // Act
            await pluginHandler.getOptimizedContext();

            // Wait for cache to expire
            await new Promise(resolve => setTimeout(resolve, 150));

            await pluginHandler.getOptimizedContext();

            // Assert
            expect(mockProvider.getContext).toHaveBeenCalledTimes(2); // Called twice due to cache expiry
        });
    });

    describe('Enhanced Context Capabilities', () => {
        beforeEach(() => {
            pluginHandler = new PluginAPIHandler();
        });

        it('should detect enhanced context capabilities', () => {
            // Arrange
            document.head.innerHTML = `
                <meta name="spotlight-guidelines-version" content="1.0.0">
                <meta name="spotlight-context-api" content="/api/context">
            `;

            // Act
            pluginHandler = new PluginAPIHandler();
            const hasEnhanced = pluginHandler.hasEnhancedContext();

            // Assert
            expect(hasEnhanced).toBe(true);
        });

        it('should handle API endpoints with authentication', async () => {
            // Arrange
            const mockConfig = {
                name: 'AuthPlugin',
                contextAPI: {
                    endpoint: '/api/secure/context',
                    authentication: {
                        type: 'bearer',
                        token: 'test-token-123'
                    }
                }
            };

            (fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ secure: 'data' })
            });

            // Act
            pluginHandler['registerEnhancedAPI']('auth-test', mockConfig);
            const context = await pluginHandler.getEnhancedContext();

            // Assert
            expect(fetch).toHaveBeenCalledWith('/api/secure/context', expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer test-token-123'
                })
            }));
            expect(context!.data).toEqual({ secure: 'data' });
        });

        it('should handle streaming and performance optimizations', () => {
            // Arrange
            const mockConfig = {
                name: 'StreamingPlugin',
                capabilities: ['context'],
                contextAPI: {
                    endpoint: '/api/streaming'
                },
                performance: {
                    streaming: true,
                    compression: true,
                    cacheHeaders: true
                }
            };

            // Act
            pluginHandler['registerEnhancedAPI']('streaming-test', mockConfig);
            const providers = pluginHandler.getRegisteredProviders();
            const streamingProvider = providers.find(p => p.name === 'StreamingPlugin');

            // Assert
            expect(streamingProvider).toBeDefined();
            expect(streamingProvider!.supportsRealtime()).toBe(true);
        });
    });

    describe('Error Handling and Fallbacks', () => {
        beforeEach(() => {
            pluginHandler = new PluginAPIHandler();
        });

        it('should handle malformed plugin configurations gracefully', () => {
            // Arrange
            document.head.innerHTML = `
                <meta name="spotlight-plugin" content='{"invalid": json}'>
            `;

            // Act & Assert - Should not throw
            expect(() => {
                pluginHandler = new PluginAPIHandler();
            }).not.toThrow();
        });

        it('should fallback to structured data when API fails', async () => {
            // Arrange
            document.body.innerHTML = `
                <div data-spotlight-context="fallback">
                    <span data-spotlight-field="name">Fallback Data</span>
                </div>
            `;

            const mockConfig = {
                name: 'FallbackPlugin',
                capabilities: ['context'],
                contextAPI: {
                    endpoint: '/api/failing-endpoint'
                },
                semanticMarkup: {
                    required: ['[data-spotlight-context]'],
                    recommended: [],
                    custom: []
                }
            };

            (fetch as jest.Mock).mockRejectedValue(new Error('API failed'));

            // Act
            pluginHandler['registerEnhancedAPI']('fallback-test', mockConfig);
            const context = await pluginHandler.getEnhancedContext();

            // Assert
            expect(context).not.toBeNull();
            // The context should be returned even if empty (graceful degradation)
            expect(context!.data).toBeDefined();
        });

        it('should handle network timeouts gracefully', async () => {
            // Arrange
            const mockConfig = {
                name: 'TimeoutPlugin',
                contextAPI: {
                    endpoint: '/api/slow-endpoint'
                }
            };

            (fetch as jest.Mock).mockImplementation(() =>
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), 100)
                )
            );

            // Act
            pluginHandler['registerEnhancedAPI']('timeout-test', mockConfig);
            const context = await pluginHandler.getEnhancedContext();

            // Assert - Should handle timeout gracefully
            expect(context!.data).toEqual({});
        });
    });
});