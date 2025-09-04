import { PluginAPIHandler } from '../PluginAPIHandler';
import {
    PluginInfo,
    ContextProvider,
    StructuredData,
    PerformanceLevel
} from '../../types/monitoring';

// Mock global window object
const mockWindow = global.window as any;

describe('PluginAPIHandler', () => {
    let pluginHandler: PluginAPIHandler;

    beforeEach(() => {
        // Reset DOM and window mocks
        document.body.innerHTML = '';

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
    });

    afterEach(() => {
        if (pluginHandler) {
            pluginHandler.clear();
        }

        // Additional cleanup
        Object.keys(mockWindow).forEach(key => {
            if (key.includes('Plugin') || key.includes('plugin') || key === 'app') {
                delete mockWindow[key];
            }
        });
    });

    describe('Plugin Detection', () => {
        it('should detect global spotlight plugin', () => {
            // Arrange
            const mockPlugin = {
                name: 'TestPlugin',
                version: '1.0.0',
                capabilities: ['context', 'semantic'],
                getContext: jest.fn().mockResolvedValue({ test: 'data' }),
                getSchema: jest.fn().mockReturnValue({ type: 'object', properties: {} })
            };
            mockWindow.spotlightPlugin = mockPlugin;

            // Act
            pluginHandler = new PluginAPIHandler();
            const detectedPlugins = pluginHandler.getDetectedPlugins();

            // Assert
            expect(detectedPlugins).toHaveLength(1);
            expect(detectedPlugins[0].name).toBe('TestPlugin');
            expect(detectedPlugins[0].capabilities).toEqual(['context', 'semantic']);
        });

        it('should ignore invalid plugins', () => {
            // Arrange
            mockWindow.spotlightPlugin = { invalid: 'plugin' }; // Missing required properties

            // Act
            pluginHandler = new PluginAPIHandler();
            const detectedPlugins = pluginHandler.getDetectedPlugins();

            // Assert
            expect(detectedPlugins).toHaveLength(0);
        });
    });

    describe('Context Provider Management', () => {
        beforeEach(() => {
            pluginHandler = new PluginAPIHandler();
        });

        it('should manually register context providers', () => {
            // Arrange
            const mockProvider: ContextProvider = {
                id: 'manual-provider',
                name: 'Manual Provider',
                version: '1.0.0',
                getContext: jest.fn().mockResolvedValue({ manual: 'data' }),
                getSchema: jest.fn().mockReturnValue({ type: 'object', properties: {} }),
                supportsRealtime: jest.fn().mockReturnValue(false)
            };

            // Act
            pluginHandler.registerProvider(mockProvider);
            const providers = pluginHandler.getRegisteredProviders();

            // Assert
            expect(providers.some(p => p.id === 'manual-provider')).toBe(true);
        });

        it('should unregister context providers', () => {
            // Arrange
            const mockProvider: ContextProvider = {
                id: 'test-provider',
                name: 'Test Provider',
                version: '1.0.0',
                getContext: jest.fn().mockResolvedValue({}),
                getSchema: jest.fn().mockReturnValue({ type: 'object', properties: {} }),
                supportsRealtime: jest.fn().mockReturnValue(false)
            };
            pluginHandler.registerProvider(mockProvider);

            // Act
            pluginHandler.unregisterProvider('test-provider');
            const providers = pluginHandler.getRegisteredProviders();

            // Assert
            expect(providers.some(p => p.id === 'test-provider')).toBe(false);
        });
    });

    describe('Enhanced Context Retrieval', () => {
        beforeEach(() => {
            pluginHandler = new PluginAPIHandler();
        });

        it('should return null when no providers are registered', async () => {
            // Act
            const context = await pluginHandler.getEnhancedContext();

            // Assert
            expect(context).toBeNull();
        });

        it('should retrieve enhanced context from registered providers', async () => {
            // Arrange
            const mockProvider: ContextProvider = {
                id: 'test-provider',
                name: 'Test Provider',
                version: '1.0.0',
                getContext: jest.fn().mockResolvedValue({ test: 'data', value: 123 }),
                getSchema: jest.fn().mockReturnValue({ type: 'object', properties: {} }),
                supportsRealtime: jest.fn().mockReturnValue(false)
            };
            pluginHandler.registerProvider(mockProvider);

            // Act
            const context = await pluginHandler.getEnhancedContext();

            // Assert
            expect(context).not.toBeNull();
            expect(context!.provider).toBe('PluginAPIHandler');
            expect(context!.data).toEqual({ test: 'data', value: 123 });
            expect(context!.capabilities).toHaveLength(1);
        });

        it('should handle provider errors gracefully', async () => {
            // Arrange
            const failingProvider: ContextProvider = {
                id: 'failing-provider',
                name: 'Failing Provider',
                version: '1.0.0',
                getContext: jest.fn().mockRejectedValue(new Error('Provider failed')),
                getSchema: jest.fn().mockReturnValue({ type: 'object', properties: {} }),
                supportsRealtime: jest.fn().mockReturnValue(false)
            };
            const workingProvider: ContextProvider = {
                id: 'working-provider',
                name: 'Working Provider',
                version: '1.0.0',
                getContext: jest.fn().mockResolvedValue({ working: 'data' }),
                getSchema: jest.fn().mockReturnValue({ type: 'object', properties: {} }),
                supportsRealtime: jest.fn().mockReturnValue(false)
            };

            pluginHandler.registerProvider(failingProvider);
            pluginHandler.registerProvider(workingProvider);

            // Act
            const context = await pluginHandler.getEnhancedContext();

            // Assert
            expect(context!.data).toEqual({ working: 'data' });
            expect(context!.capabilities).toHaveLength(1); // Only working provider
        });
    });

    describe('Capability Negotiation', () => {
        beforeEach(() => {
            pluginHandler = new PluginAPIHandler();
        });

        it('should negotiate capabilities with plugins', () => {
            // Arrange
            const pluginInfo: PluginInfo = {
                name: 'TestPlugin',
                version: '1.0.0',
                capabilities: ['context', 'semantic', 'unsupported-feature']
            };

            // Act
            const negotiated = pluginHandler.negotiateCapabilities(pluginInfo);

            // Assert
            expect(negotiated).toHaveLength(1);
            expect(negotiated[0].features).toEqual(['context', 'semantic']);
            expect(negotiated[0].features).not.toContain('unsupported-feature');
        });
    });

    describe('Enable/Disable Functionality', () => {
        beforeEach(() => {
            pluginHandler = new PluginAPIHandler();
        });

        it('should enable and disable plugin integration', () => {
            // Act - Disable
            pluginHandler.setEnabled(false);
            expect(pluginHandler.isPluginIntegrationEnabled()).toBe(false);
            expect(pluginHandler.getDetectedPlugins()).toHaveLength(0);

            // Act - Re-enable
            pluginHandler.setEnabled(true);
            expect(pluginHandler.isPluginIntegrationEnabled()).toBe(true);
        });

        it('should clear all data when disabled', () => {
            // Arrange
            const provider: ContextProvider = {
                id: 'test-provider',
                name: 'Test Provider',
                version: '1.0.0',
                getContext: jest.fn().mockResolvedValue({}),
                getSchema: jest.fn().mockReturnValue({ type: 'object', properties: {} }),
                supportsRealtime: jest.fn().mockReturnValue(false)
            };
            pluginHandler.registerProvider(provider);

            // Act
            pluginHandler.setEnabled(false);

            // Assert
            expect(pluginHandler.getRegisteredProviders()).toHaveLength(0);
            expect(pluginHandler.getDetectedPlugins()).toHaveLength(0);
            expect(pluginHandler.getPerformanceMetrics().size).toBe(0);
        });
    });
});