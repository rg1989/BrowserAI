import {
    PluginCapability,
    ContextProvider,
    PluginInfo,
    EnhancedContext,
    StructuredData,
    PerformanceMetrics,
    PerformanceLevel,
    ContextSchema,
    PluginGuidelines
} from '../types/monitoring';

/**
 * PluginAPIHandler manages integration with websites that implement plugin guidelines
 * for enhanced context and functionality.
 */
export class PluginAPIHandler {
    private registeredProviders: Map<string, ContextProvider> = new Map();
    private detectedPlugins: Map<string, PluginInfo> = new Map();
    private isEnabled: boolean = true;
    private performanceMetrics: Map<string, PerformanceMetrics> = new Map();
    private pluginGuidelines: Map<string, PluginGuidelines> = new Map();
    private enhancedContextCache: Map<string, { data: StructuredData; timestamp: number }> = new Map();
    private cacheTimeout: number = 30000; // 30 seconds cache timeout

    constructor() {
        this.initializePluginDetection();
    }

    /**
     * Initialize plugin detection by scanning for plugin APIs on the current page
     */
    private initializePluginDetection(): void {
        if (!this.isEnabled) return;

        // Check for global plugin objects
        this.detectGlobalPlugins();

        // Check for semantic markup
        this.detectSemanticMarkup();

        // Listen for dynamic plugin registration
        this.setupPluginRegistrationListener();

        // Detect enhanced context APIs
        this.detectEnhancedContextAPIs();

        // Detect plugin guidelines compliance
        this.detectPluginGuidelines();
    }

    /**
     * Detect plugins that register themselves on the global window object
     */
    private detectGlobalPlugins(): void {
        // Check for standard plugin registration patterns
        const pluginPatterns = [
            'spotlightPlugin',
            'contextPlugin',
            'pagePlugin',
            'aiPlugin'
        ];

        pluginPatterns.forEach(pattern => {
            const plugin = (window as any)[pattern];
            if (plugin && this.isValidPlugin(plugin)) {
                this.registerDetectedPlugin(pattern, plugin);
            }
        });

        // Check for plugins in common namespaces
        const namespaces = ['app', 'site', 'page', 'context'];
        namespaces.forEach(namespace => {
            const ns = (window as any)[namespace];
            if (ns && ns.plugin && this.isValidPlugin(ns.plugin)) {
                this.registerDetectedPlugin(`${namespace}.plugin`, ns.plugin);
            }
        });
    }

    /**
     * Detect semantic markup that indicates plugin support
     */
    private detectSemanticMarkup(): void {
        // Check for plugin-specific data attributes
        const pluginElements = document.querySelectorAll('[data-spotlight-context], [data-plugin-context], [data-ai-context]');

        if (pluginElements.length > 0) {
            const pluginInfo: PluginInfo = {
                name: 'semantic-markup',
                version: '1.0.0',
                capabilities: ['semantic', 'context']
            };

            this.detectedPlugins.set('semantic-markup', pluginInfo);
        }

        // Check for Schema.org structured data
        const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');
        if (schemaScripts.length > 0) {
            const pluginInfo: PluginInfo = {
                name: 'schema-org',
                version: '1.0.0',
                capabilities: ['structured-data', 'semantic']
            };

            this.detectedPlugins.set('schema-org', pluginInfo);
        }
    }

    /**
     * Set up listener for dynamic plugin registration
     */
    private setupPluginRegistrationListener(): void {
        // Listen for custom events that indicate plugin registration
        window.addEventListener('spotlight-plugin-ready', (event: any) => {
            const plugin = event.detail;
            if (this.isValidPlugin(plugin)) {
                this.registerDetectedPlugin('dynamic', plugin);
            }
        });

        // Listen for postMessage plugin registration
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'spotlight-plugin-register') {
                const plugin = event.data.plugin;
                if (this.isValidPlugin(plugin)) {
                    this.registerDetectedPlugin('postmessage', plugin);
                }
            }
        });
    }

    /**
     * Detect enhanced context APIs that follow plugin guidelines
     */
    private detectEnhancedContextAPIs(): void {
        // Check for meta tags indicating plugin support
        const pluginMeta = document.querySelector('meta[name="spotlight-plugin"]');
        if (pluginMeta) {
            const content = pluginMeta.getAttribute('content');
            if (content) {
                try {
                    const pluginConfig = JSON.parse(content);
                    this.registerEnhancedAPI('meta-plugin', pluginConfig);
                } catch (error) {
                    console.warn('Failed to parse plugin meta configuration:', error);
                }
            }
        }

        // Check for link tags pointing to plugin manifests
        const pluginLinks = document.querySelectorAll('link[rel="spotlight-plugin"]');
        pluginLinks.forEach(async (link) => {
            const href = link.getAttribute('href');
            if (href) {
                try {
                    const response = await fetch(href);
                    const pluginManifest = await response.json();
                    this.registerEnhancedAPI('manifest-plugin', pluginManifest);
                } catch (error) {
                    console.warn('Failed to load plugin manifest:', error);
                }
            }
        });

        // Check for well-known endpoints
        this.checkWellKnownEndpoints();
    }

    /**
     * Check for well-known plugin endpoints
     */
    private async checkWellKnownEndpoints(): Promise<void> {
        const wellKnownPaths = [
            '/.well-known/spotlight-plugin',
            '/api/spotlight/plugin',
            '/spotlight-plugin.json'
        ];

        for (const path of wellKnownPaths) {
            try {
                const response = await fetch(path, {
                    method: 'HEAD',
                    credentials: 'same-origin'
                });
                if (response.ok) {
                    // Endpoint exists, try to fetch the plugin configuration
                    const configResponse = await fetch(path, {
                        credentials: 'same-origin'
                    });
                    if (configResponse.ok) {
                        const pluginConfig = await configResponse.json();
                        this.registerEnhancedAPI(`wellknown-${path}`, pluginConfig);
                    }
                }
            } catch (error) {
                // Silently ignore errors for well-known endpoints
                // as they may not exist on most sites
            }
        }
    }

    /**
     * Detect plugin guidelines compliance through structured markup
     */
    private detectPluginGuidelines(): void {
        // Check for plugin guidelines meta information
        const guidelinesVersion = document.querySelector('meta[name="spotlight-guidelines-version"]');
        if (guidelinesVersion) {
            const version = guidelinesVersion.getAttribute('content') || '1.0.0';

            // Extract plugin guidelines from structured markup
            const guidelines = this.extractPluginGuidelines(version);
            if (guidelines) {
                this.pluginGuidelines.set('structured-markup', guidelines);
            }
        }

        // Check for data attributes indicating compliance
        const compliantElements = document.querySelectorAll('[data-spotlight-compliant]');
        if (compliantElements.length > 0) {
            const guidelines = this.extractGuidelinesFromElements(compliantElements);
            this.pluginGuidelines.set('data-attributes', guidelines);
        }
    }

    /**
     * Extract plugin guidelines from structured markup
     */
    private extractPluginGuidelines(version: string): PluginGuidelines | null {
        try {
            // Look for context API configuration
            const contextAPI = document.querySelector('meta[name="spotlight-context-api"]');
            const contextEndpoint = contextAPI?.getAttribute('content');

            // Look for semantic markup configuration
            const semanticElements = document.querySelectorAll('[data-spotlight-semantic]');
            const requiredMarkup: string[] = [];
            const recommendedMarkup: string[] = [];

            semanticElements.forEach(element => {
                const semantic = element.getAttribute('data-spotlight-semantic');
                const required = element.getAttribute('data-spotlight-required') === 'true';

                if (semantic) {
                    if (required) {
                        requiredMarkup.push(semantic);
                    } else {
                        recommendedMarkup.push(semantic);
                    }
                }
            });

            // Look for performance configuration
            const performanceConfig = document.querySelector('meta[name="spotlight-performance"]');
            const performanceSettings = performanceConfig?.getAttribute('content');

            if (contextEndpoint || semanticElements.length > 0) {
                return {
                    contextAPI: {
                        endpoint: contextEndpoint || '/api/spotlight/context',
                        schema: {
                            type: 'object',
                            properties: {}
                        }
                    },
                    semanticMarkup: {
                        required: requiredMarkup,
                        recommended: recommendedMarkup,
                        custom: []
                    },
                    performance: {
                        cacheHeaders: true,
                        compression: true,
                        streaming: performanceSettings?.includes('streaming') || false
                    }
                };
            }
        } catch (error) {
            console.warn('Failed to extract plugin guidelines:', error);
        }

        return null;
    }

    /**
     * Extract guidelines from compliant elements
     */
    private extractGuidelinesFromElements(elements: NodeListOf<Element>): PluginGuidelines {
        const customMarkup: any[] = [];

        elements.forEach(element => {
            const contextType = element.getAttribute('data-spotlight-context');
            const fields = element.querySelectorAll('[data-spotlight-field]');

            if (contextType && fields.length > 0) {
                const fieldNames = Array.from(fields).map(field =>
                    field.getAttribute('data-spotlight-field')
                ).filter(Boolean);

                customMarkup.push({
                    attribute: `data-spotlight-context="${contextType}"`,
                    values: fieldNames,
                    description: `Context type: ${contextType}`
                });
            }
        });

        return {
            contextAPI: {
                endpoint: '/api/spotlight/context',
                schema: {
                    type: 'object',
                    properties: {}
                }
            },
            semanticMarkup: {
                required: ['data-spotlight-context'],
                recommended: ['data-spotlight-field'],
                custom: customMarkup
            },
            performance: {
                cacheHeaders: false,
                compression: false,
                streaming: false
            }
        };
    }

    /**
     * Register an enhanced API plugin
     */
    private registerEnhancedAPI(id: string, config: any): void {
        if (this.isValidEnhancedConfig(config)) {
            const pluginInfo: PluginInfo = {
                name: config.name || id,
                version: config.version || '1.0.0',
                capabilities: config.capabilities || ['context'],
                endpoint: config.contextAPI?.endpoint,
                authentication: config.contextAPI?.authentication
            };

            this.detectedPlugins.set(id, pluginInfo);

            // Create enhanced context provider
            if (config.contextAPI) {
                const provider = this.createEnhancedContextProvider(id, config);
                this.registeredProviders.set(id, provider);
            }
        }
    }

    /**
     * Validate enhanced plugin configuration
     */
    private isValidEnhancedConfig(config: any): boolean {
        return (
            config &&
            typeof config === 'object' &&
            (config.contextAPI || config.semanticMarkup || config.capabilities)
        );
    }

    /**
     * Create enhanced context provider with performance optimizations
     */
    private createEnhancedContextProvider(id: string, config: any): ContextProvider {
        return {
            id,
            name: config.name || id,
            version: config.version || '1.0.0',

            getContext: async (): Promise<StructuredData> => {
                // Check cache first for performance optimization
                const cached = this.enhancedContextCache.get(id);
                if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }

                const startTime = performance.now();

                try {
                    let context: StructuredData = {};

                    // Try enhanced API first
                    if (config.contextAPI?.endpoint) {
                        context = await this.fetchEnhancedContext(config.contextAPI);
                    }

                    // Fallback to structured data extraction
                    if (Object.keys(context).length === 0) {
                        context = this.extractStructuredData(config);
                    }

                    // Cache the result for performance
                    this.enhancedContextCache.set(id, {
                        data: context,
                        timestamp: Date.now()
                    });

                    // Record performance metrics
                    const endTime = performance.now();
                    this.recordPerformanceMetrics(id, {
                        responseTime: endTime - startTime,
                        dataSize: JSON.stringify(context).length,
                        cacheHit: false,
                        processingTime: endTime - startTime
                    });

                    return context;
                } catch (error) {
                    console.warn(`Failed to get enhanced context from ${id}:`, error);
                    return {};
                }
            },

            getSchema: (): ContextSchema => {
                return config.contextAPI?.schema || {
                    type: 'object',
                    properties: {}
                };
            },

            supportsRealtime: (): boolean => {
                return config.performance?.streaming || false;
            }
        };
    }

    /**
     * Fetch enhanced context from API with performance optimizations
     */
    private async fetchEnhancedContext(contextAPI: any): Promise<StructuredData> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        // Add performance headers
        if (contextAPI.cacheHeaders !== false) {
            headers['Cache-Control'] = 'max-age=30';
        }

        if (contextAPI.compression !== false) {
            headers['Accept-Encoding'] = 'gzip, deflate, br';
        }

        // Add authentication if configured
        if (contextAPI.authentication) {
            const auth = contextAPI.authentication;
            if (auth.type === 'bearer' && auth.token) {
                headers['Authorization'] = `Bearer ${auth.token}`;
            } else if (auth.type === 'basic' && auth.credentials) {
                const encoded = btoa(`${auth.credentials.username}:${auth.credentials.password}`);
                headers['Authorization'] = `Basic ${encoded}`;
            }
        }

        const response = await fetch(contextAPI.endpoint, {
            method: 'GET',
            headers,
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error(`Enhanced API request failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Extract structured data from compliant sites with performance optimizations
     */
    private extractStructuredData(config: any): StructuredData {
        const context: StructuredData = {};

        // Extract from semantic markup with guidelines
        if (config.semanticMarkup) {
            const markup = config.semanticMarkup;

            // Process required markup
            markup.required?.forEach((selector: string) => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    context[selector] = this.extractFromElements(elements);
                }
            });

            // Process recommended markup
            markup.recommended?.forEach((selector: string) => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    context[selector] = this.extractFromElements(elements);
                }
            });

            // Process custom markup
            markup.custom?.forEach((customSpec: any) => {
                const elements = document.querySelectorAll(`[${customSpec.attribute}]`);
                if (elements.length > 0) {
                    context[customSpec.attribute] = this.extractFromElements(elements);
                }
            });
        }

        // Extract enhanced Schema.org data
        const enhancedSchemaData = this.extractEnhancedSchemaData();
        if (enhancedSchemaData.length > 0) {
            context.enhancedSchema = enhancedSchemaData;
        }

        return context;
    }

    /**
     * Extract data from elements with performance optimizations
     */
    private extractFromElements(elements: NodeListOf<Element>): any[] {
        const results: any[] = [];
        const maxElements = 100; // Limit for performance

        const elementsToProcess = Array.from(elements).slice(0, maxElements);

        elementsToProcess.forEach(element => {
            const data: any = {};

            // Extract all data attributes efficiently
            Array.from(element.attributes).forEach(attr => {
                if (attr.name.startsWith('data-spotlight-')) {
                    const key = attr.name.replace('data-spotlight-', '');
                    data[key] = attr.value;
                }
            });

            // Extract text content
            if (element.textContent?.trim()) {
                data.text = element.textContent.trim();
            }

            // Extract child field elements
            const fields = element.querySelectorAll('[data-spotlight-field]');
            fields.forEach(field => {
                const fieldName = field.getAttribute('data-spotlight-field');
                if (fieldName) {
                    data[fieldName] = field.textContent?.trim() || field.getAttribute('value') || '';
                }
            });

            if (Object.keys(data).length > 0) {
                results.push(data);
            }
        });

        return results;
    }

    /**
     * Extract enhanced Schema.org data with better parsing
     */
    private extractEnhancedSchemaData(): any[] {
        const schemaData: any[] = [];

        // Process JSON-LD scripts with error handling
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        scripts.forEach(script => {
            try {
                const data = JSON.parse(script.textContent || '');

                // Validate and enhance the schema data
                if (this.isValidSchemaData(data)) {
                    schemaData.push(this.enhanceSchemaData(data));
                }
            } catch (error) {
                console.warn('Failed to parse enhanced Schema.org JSON-LD:', error);
            }
        });

        return schemaData;
    }

    /**
     * Validate Schema.org data
     */
    private isValidSchemaData(data: any): boolean {
        return (
            data &&
            typeof data === 'object' &&
            (data['@type'] || data.type) &&
            (data['@context'] || data.context)
        );
    }

    /**
     * Enhance Schema.org data with additional context
     */
    private enhanceSchemaData(data: any): any {
        const enhanced = { ...data };

        // Add extraction metadata
        enhanced._spotlight = {
            extractedAt: new Date().toISOString(),
            source: 'enhanced-schema-extraction',
            version: '1.0.0'
        };

        // Add performance hints
        if (data['@type']) {
            enhanced._performance = {
                cacheable: true,
                priority: this.getSchemaTypePriority(data['@type'])
            };
        }

        return enhanced;
    }

    /**
     * Get priority for different Schema.org types
     */
    private getSchemaTypePriority(type: string): 'high' | 'medium' | 'low' {
        const highPriorityTypes = ['Product', 'Article', 'Person', 'Organization'];
        const mediumPriorityTypes = ['Event', 'Place', 'Recipe', 'Review'];

        if (highPriorityTypes.includes(type)) return 'high';
        if (mediumPriorityTypes.includes(type)) return 'medium';
        return 'low';
    }

    /**
     * Validate that an object is a valid plugin
     */
    private isValidPlugin(plugin: any): boolean {
        return (
            plugin &&
            typeof plugin === 'object' &&
            typeof plugin.version === 'string' &&
            Array.isArray(plugin.capabilities) &&
            (typeof plugin.getContext === 'function' || typeof plugin.contextAPI === 'object')
        );
    }

    /**
     * Register a detected plugin and create a context provider
     */
    private registerDetectedPlugin(id: string, plugin: any): void {
        const pluginInfo: PluginInfo = {
            name: plugin.name || id,
            version: plugin.version,
            capabilities: plugin.capabilities,
            endpoint: plugin.contextAPI?.endpoint,
            authentication: plugin.contextAPI?.authentication
        };

        this.detectedPlugins.set(id, pluginInfo);

        // Create context provider if plugin supports it
        if (plugin.getContext || plugin.contextAPI) {
            const provider = this.createContextProvider(id, plugin);
            this.registeredProviders.set(id, provider);
        }
    }

    /**
     * Create a context provider from a plugin
     */
    private createContextProvider(id: string, plugin: any): ContextProvider {
        return {
            id,
            name: plugin.name || id,
            version: plugin.version,

            getContext: async (): Promise<StructuredData> => {
                const startTime = performance.now();

                try {
                    let context: StructuredData;

                    if (plugin.getContext) {
                        // Direct function call
                        context = await plugin.getContext();
                    } else if (plugin.contextAPI?.endpoint) {
                        // API endpoint call
                        context = await this.fetchContextFromAPI(plugin.contextAPI);
                    } else {
                        // Fallback to semantic extraction
                        context = this.extractSemanticContext();
                    }

                    // Record performance metrics
                    const endTime = performance.now();
                    this.recordPerformanceMetrics(id, {
                        responseTime: endTime - startTime,
                        dataSize: JSON.stringify(context).length,
                        cacheHit: false,
                        processingTime: endTime - startTime
                    });

                    return context;
                } catch (error) {
                    console.warn(`Failed to get context from plugin ${id}:`, error);
                    return {};
                }
            },

            getSchema: (): ContextSchema => {
                return plugin.getSchema ? plugin.getSchema() : {
                    type: 'object',
                    properties: {}
                };
            },

            supportsRealtime: (): boolean => {
                return typeof plugin.onContextRequest === 'function' ||
                    typeof plugin.subscribe === 'function';
            }
        };
    }

    /**
     * Fetch context from a plugin API endpoint
     */
    private async fetchContextFromAPI(contextAPI: any): Promise<StructuredData> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        // Add authentication if configured
        if (contextAPI.authentication) {
            const auth = contextAPI.authentication;
            if (auth.type === 'bearer' && auth.token) {
                headers['Authorization'] = `Bearer ${auth.token}`;
            } else if (auth.type === 'basic' && auth.credentials) {
                const encoded = btoa(`${auth.credentials.username}:${auth.credentials.password}`);
                headers['Authorization'] = `Basic ${encoded}`;
            }
        }

        const response = await fetch(contextAPI.endpoint, {
            method: 'GET',
            headers,
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error(`Plugin API request failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Extract semantic context from page markup
     */
    private extractSemanticContext(): StructuredData {
        const context: StructuredData = {};

        // Extract from data attributes
        const contextElements = document.querySelectorAll('[data-spotlight-context]');
        contextElements.forEach(element => {
            const contextType = element.getAttribute('data-spotlight-context');
            if (contextType) {
                context[contextType] = this.extractElementContext(element);
            }
        });

        // Extract from Schema.org JSON-LD
        const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');
        const schemaData: any[] = [];
        schemaScripts.forEach(script => {
            try {
                const data = JSON.parse(script.textContent || '');
                schemaData.push(data);
            } catch (error) {
                console.warn('Failed to parse Schema.org JSON-LD:', error);
            }
        });

        if (schemaData.length > 0) {
            context.schema = schemaData;
        }

        return context;
    }

    /**
     * Extract context from a specific element
     */
    private extractElementContext(element: Element): any {
        const context: any = {};

        // Extract data attributes
        Array.from(element.attributes).forEach(attr => {
            if (attr.name.startsWith('data-spotlight-')) {
                const key = attr.name.replace('data-spotlight-', '');
                context[key] = attr.value;
            }
        });

        // Extract child elements with spotlight attributes
        const childElements = element.querySelectorAll('[data-spotlight-field]');
        childElements.forEach(child => {
            const fieldName = child.getAttribute('data-spotlight-field');
            if (fieldName) {
                context[fieldName] = child.textContent?.trim() || child.getAttribute('value') || '';
            }
        });

        return context;
    }

    /**
     * Record performance metrics for a plugin
     */
    private recordPerformanceMetrics(pluginId: string, metrics: PerformanceMetrics): void {
        this.performanceMetrics.set(pluginId, metrics);
    }

    /**
     * Get all detected plugins
     */
    public getDetectedPlugins(): PluginInfo[] {
        return Array.from(this.detectedPlugins.values());
    }

    /**
     * Get all registered context providers
     */
    public getRegisteredProviders(): ContextProvider[] {
        return Array.from(this.registeredProviders.values());
    }

    /**
     * Register a context provider manually
     */
    public registerProvider(provider: ContextProvider): void {
        this.registeredProviders.set(provider.id, provider);
    }

    /**
     * Unregister a context provider
     */
    public unregisterProvider(providerId: string): void {
        this.registeredProviders.delete(providerId);
    }

    /**
     * Get enhanced context from all registered providers
     */
    public async getEnhancedContext(): Promise<EnhancedContext | null> {
        if (this.registeredProviders.size === 0) {
            return null;
        }

        const contexts: StructuredData[] = [];
        const capabilities: PluginCapability[] = [];
        let totalResponseTime = 0;
        let totalDataSize = 0;

        // Collect context from all providers
        for (const [id, provider] of this.registeredProviders) {
            try {
                const context = await provider.getContext();
                contexts.push(context);

                // Create capability info
                const pluginInfo = this.detectedPlugins.get(id);
                if (pluginInfo) {
                    capabilities.push({
                        name: pluginInfo.name,
                        version: pluginInfo.version,
                        features: pluginInfo.capabilities,
                        performance: this.calculatePerformanceLevel(id)
                    });
                } else {
                    // For manually registered providers, create capability from provider info
                    capabilities.push({
                        name: provider.name,
                        version: provider.version,
                        features: ['context'], // Default feature for manual providers
                        performance: this.calculatePerformanceLevel(id)
                    });
                }

                // Aggregate performance metrics
                const metrics = this.performanceMetrics.get(id);
                if (metrics) {
                    totalResponseTime += metrics.responseTime;
                    totalDataSize += metrics.dataSize;
                }
            } catch (error) {
                console.warn(`Failed to get context from provider ${id}:`, error);
            }
        }

        if (contexts.length === 0) {
            return null;
        }

        // Merge all contexts
        const mergedData = this.mergeContexts(contexts);

        return {
            provider: 'PluginAPIHandler',
            version: '1.0.0',
            capabilities,
            data: mergedData,
            performance: {
                responseTime: totalResponseTime / contexts.length,
                dataSize: totalDataSize,
                cacheHit: false,
                processingTime: totalResponseTime / contexts.length
            }
        };
    }

    /**
     * Merge multiple contexts into a single structured data object
     */
    private mergeContexts(contexts: StructuredData[]): StructuredData {
        const merged: StructuredData = {};

        contexts.forEach((context, index) => {
            Object.keys(context).forEach(key => {
                if (merged[key]) {
                    // Handle conflicts by creating arrays or merging objects
                    if (Array.isArray(merged[key])) {
                        if (Array.isArray(context[key])) {
                            merged[key] = [...merged[key], ...context[key]];
                        } else {
                            merged[key].push(context[key]);
                        }
                    } else if (typeof merged[key] === 'object' && typeof context[key] === 'object') {
                        merged[key] = { ...merged[key], ...context[key] };
                    } else {
                        // Convert to array for conflicting values
                        merged[key] = [merged[key], context[key]];
                    }
                } else {
                    merged[key] = context[key];
                }
            });
        });

        return merged;
    }

    /**
     * Calculate performance level for a plugin based on metrics
     */
    private calculatePerformanceLevel(pluginId: string): PerformanceLevel {
        const metrics = this.performanceMetrics.get(pluginId);
        if (!metrics) {
            return PerformanceLevel.MEDIUM;
        }

        // Performance thresholds (in milliseconds)
        if (metrics.responseTime < 50) {
            return PerformanceLevel.OPTIMAL;
        } else if (metrics.responseTime < 200) {
            return PerformanceLevel.HIGH;
        } else if (metrics.responseTime < 500) {
            return PerformanceLevel.MEDIUM;
        } else {
            return PerformanceLevel.LOW;
        }
    }

    /**
     * Negotiate capabilities with a plugin
     */
    public negotiateCapabilities(plugin: PluginInfo): PluginCapability[] {
        const supportedFeatures = ['context', 'semantic', 'realtime', 'structured-data'];
        const negotiatedFeatures = plugin.capabilities.filter(cap =>
            supportedFeatures.includes(cap)
        );

        return [{
            name: plugin.name,
            version: plugin.version,
            features: negotiatedFeatures,
            performance: PerformanceLevel.MEDIUM // Default until measured
        }];
    }

    /**
     * Enable or disable plugin integration
     */
    public setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;

        if (enabled) {
            this.initializePluginDetection();
        } else {
            this.registeredProviders.clear();
            this.detectedPlugins.clear();
            this.performanceMetrics.clear();
        }
    }

    /**
     * Check if plugin integration is enabled
     */
    public isPluginIntegrationEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Get performance metrics for all plugins
     */
    public getPerformanceMetrics(): Map<string, PerformanceMetrics> {
        return new Map(this.performanceMetrics);
    }

    /**
     * Get detected plugin guidelines
     */
    public getPluginGuidelines(): Map<string, PluginGuidelines> {
        return new Map(this.pluginGuidelines);
    }

    /**
     * Check if a site has enhanced context capabilities
     */
    public hasEnhancedContext(): boolean {
        return this.pluginGuidelines.size > 0 ||
            Array.from(this.detectedPlugins.values()).some(plugin =>
                plugin.capabilities.includes('enhanced-context') ||
                plugin.endpoint
            );
    }

    /**
     * Get performance optimized context (uses caching)
     */
    public async getOptimizedContext(): Promise<EnhancedContext | null> {
        // Check if we have any cached context that's still valid
        const validCachedEntries = Array.from(this.enhancedContextCache.entries())
            .filter(([_, cached]) => Date.now() - cached.timestamp < this.cacheTimeout);

        if (validCachedEntries.length > 0) {
            // Return cached context with performance benefits
            const mergedCachedData = this.mergeContexts(
                validCachedEntries.map(([_, cached]) => cached.data)
            );

            return {
                provider: 'PluginAPIHandler-Cached',
                version: '1.0.0',
                capabilities: [{
                    name: 'cached-context',
                    version: '1.0.0',
                    features: ['cached', 'optimized'],
                    performance: PerformanceLevel.OPTIMAL
                }],
                data: mergedCachedData,
                performance: {
                    responseTime: 0, // Cached response
                    dataSize: JSON.stringify(mergedCachedData).length,
                    cacheHit: true,
                    processingTime: 0
                }
            };
        }

        // Fallback to regular context retrieval
        return this.getEnhancedContext();
    }

    /**
     * Clear context cache for performance management
     */
    public clearContextCache(): void {
        this.enhancedContextCache.clear();
    }

    /**
     * Set cache timeout for performance tuning
     */
    public setCacheTimeout(timeout: number): void {
        this.cacheTimeout = timeout;
    }

    /**
     * Get cache statistics for performance monitoring
     */
    public getCacheStats(): { size: number; hitRate: number; oldestEntry: number } {
        const now = Date.now();
        const entries = Array.from(this.enhancedContextCache.values());
        const validEntries = entries.filter(cached => now - cached.timestamp < this.cacheTimeout);

        const oldestEntry = entries.length > 0
            ? Math.min(...entries.map(cached => cached.timestamp))
            : 0;

        return {
            size: validEntries.length,
            hitRate: validEntries.length / Math.max(entries.length, 1),
            oldestEntry: now - oldestEntry
        };
    }

    /**
     * Clear all registered providers and detected plugins
     */
    public clear(): void {
        this.registeredProviders.clear();
        this.detectedPlugins.clear();
        this.performanceMetrics.clear();
        this.pluginGuidelines.clear();
        this.enhancedContextCache.clear();
    }
}