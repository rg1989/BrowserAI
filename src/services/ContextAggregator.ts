import {
    PageContext,
    ContentSnapshot,
    LayoutSnapshot,
    NetworkActivity,
    UserInteraction,
    SemanticData,
    EnhancedContext,
    PerformanceMetrics
} from '../types/monitoring';

/**
 * Context aggregation configuration
 */
export interface ContextAggregationConfig {
    includeNetworkData: boolean;
    includeLayoutData: boolean;
    includeInteractionData: boolean;
    includeSemanticData: boolean;
    includePluginData: boolean;
    maxNetworkRequests: number;
    maxInteractions: number;
    contentPrioritization: ContentPriority;
    cacheTimeout: number; // milliseconds
}

/**
 * Content prioritization settings
 */
export interface ContentPriority {
    headings: number;
    forms: number;
    tables: number;
    links: number;
    images: number;
    text: number;
}

/**
 * Aggregated context for AI consumption
 */
export interface AggregatedContext {
    summary: ContextSummary;
    content: ContentSnapshot;
    network?: NetworkActivity;
    layout?: LayoutSnapshot;
    interactions?: UserInteraction[];
    semantics?: SemanticData;
    plugin?: EnhancedContext;
    metadata: ContextMetadata;
    performance: PerformanceMetrics;
}

/**
 * Context summary for quick AI understanding
 */
export interface ContextSummary {
    pageType: PageType;
    primaryContent: string;
    keyElements: string[];
    userActivity: ActivitySummary;
    dataFlows: DataFlowSummary[];
    relevanceScore: number;
}

/**
 * Activity summary
 */
export interface ActivitySummary {
    recentInteractions: number;
    activeElements: string[];
    formActivity: boolean;
    navigationActivity: boolean;
}

/**
 * Data flow summary
 */
export interface DataFlowSummary {
    type: 'api' | 'form' | 'navigation';
    endpoint?: string;
    method?: string;
    status?: number;
    timestamp: number;
    relevance: number;
}

/**
 * Context metadata
 */
export interface ContextMetadata {
    timestamp: number;
    url: string;
    title: string;
    aggregationTime: number;
    cacheHit: boolean;
    dataQuality: DataQuality;
}

/**
 * Data quality metrics
 */
export interface DataQuality {
    completeness: number; // 0-1
    freshness: number; // 0-1
    accuracy: number; // 0-1
    relevance: number; // 0-1
}

/**
 * Page type classification
 */
export enum PageType {
    UNKNOWN = 'unknown',
    ARTICLE = 'article',
    ECOMMERCE = 'ecommerce',
    FORM = 'form',
    DASHBOARD = 'dashboard',
    SEARCH = 'search',
    SOCIAL = 'social',
    DOCUMENTATION = 'documentation',
    APPLICATION = 'application'
}

/**
 * Context aggregator for combining monitoring data into AI-consumable format
 */
export class ContextAggregator {
    private config: ContextAggregationConfig;
    private cache: Map<string, { context: AggregatedContext; timestamp: number }>;
    private performanceMetrics: PerformanceMetrics;

    constructor(config?: Partial<ContextAggregationConfig>) {
        this.config = {
            includeNetworkData: true,
            includeLayoutData: true,
            includeInteractionData: true,
            includeSemanticData: true,
            includePluginData: true,
            maxNetworkRequests: 20,
            maxInteractions: 10,
            contentPrioritization: {
                headings: 1.0,
                forms: 0.9,
                tables: 0.8,
                links: 0.6,
                images: 0.4,
                text: 0.7
            },
            cacheTimeout: 30000, // 30 seconds
            ...config
        };

        this.cache = new Map();
        this.performanceMetrics = {
            responseTime: 0,
            dataSize: 0,
            cacheHit: false,
            processingTime: 0
        };
    }

    /**
     * Aggregate page context into AI-consumable format
     */
    async aggregateContext(pageContext: PageContext): Promise<AggregatedContext> {
        const startTime = performance.now();
        const cacheKey = this.generateCacheKey(pageContext);

        // Check cache first
        const cached = this.getCachedContext(cacheKey);
        if (cached) {
            this.performanceMetrics.cacheHit = true;
            this.performanceMetrics.responseTime = performance.now() - startTime;
            return cached;
        }

        try {
            // Generate context summary
            const summary = await this.generateContextSummary(pageContext);

            // Aggregate components based on configuration
            const aggregatedContext: AggregatedContext = {
                summary,
                content: this.prioritizeContent(pageContext.content),
                metadata: {
                    timestamp: pageContext.timestamp,
                    url: pageContext.url,
                    title: pageContext.title,
                    aggregationTime: performance.now() - startTime,
                    cacheHit: false,
                    dataQuality: this.assessDataQuality(pageContext)
                },
                performance: this.performanceMetrics
            };

            // Add optional components
            if (this.config.includeNetworkData && pageContext.network) {
                aggregatedContext.network = this.filterNetworkActivity(pageContext.network);
            }

            if (this.config.includeLayoutData && pageContext.layout) {
                aggregatedContext.layout = pageContext.layout;
            }

            if (this.config.includeInteractionData && pageContext.interactions) {
                aggregatedContext.interactions = this.filterInteractions(pageContext.interactions);
            }

            if (this.config.includeSemanticData && pageContext.semantics) {
                aggregatedContext.semantics = pageContext.semantics;
            }

            if (this.config.includePluginData && pageContext.plugin) {
                aggregatedContext.plugin = pageContext.plugin;
            }

            // Cache the result
            this.cacheContext(cacheKey, aggregatedContext);

            // Update performance metrics
            this.performanceMetrics.processingTime = performance.now() - startTime;
            this.performanceMetrics.responseTime = this.performanceMetrics.processingTime;
            this.performanceMetrics.cacheHit = false;
            this.performanceMetrics.dataSize = this.estimateDataSize(aggregatedContext);

            return aggregatedContext;

        } catch (error) {
            console.error('Context aggregation failed:', error);
            throw new Error(`Failed to aggregate context: ${error}`);
        }
    }

    /**
     * Generate context summary for AI understanding
     */
    private async generateContextSummary(pageContext: PageContext): Promise<ContextSummary> {
        const pageType = this.classifyPageType(pageContext);
        const primaryContent = this.extractPrimaryContent(pageContext.content);
        const keyElements = this.identifyKeyElements(pageContext.content);
        const userActivity = this.summarizeUserActivity(pageContext.interactions);
        const dataFlows = this.summarizeDataFlows(pageContext.network);
        const relevanceScore = this.calculateRelevanceScore(pageContext);

        return {
            pageType,
            primaryContent,
            keyElements,
            userActivity,
            dataFlows,
            relevanceScore
        };
    }

    /**
     * Classify page type based on content and structure
     */
    private classifyPageType(pageContext: PageContext): PageType {
        const { content, url } = pageContext;

        // Check URL patterns first
        if (url.includes('/search') || url.includes('?q=')) {
            return PageType.SEARCH;
        }
        if (url.includes('/product/') || url.includes('/item/')) {
            return PageType.ECOMMERCE;
        }
        if (url.includes('/docs/') || url.includes('/documentation/')) {
            return PageType.DOCUMENTATION;
        }

        // Check content structure
        if (content.forms.length > 2) {
            return PageType.FORM;
        }
        if (content.tables.length > 3 && content.forms.length > 0) {
            return PageType.DASHBOARD;
        }
        if (content.headings.length > 5 && content.text.length > 1000) {
            return PageType.ARTICLE;
        }

        // Check semantic data
        if (pageContext.semantics) {
            const schemaTypes = pageContext.semantics.schema.map(s => s.type.toLowerCase());
            if (schemaTypes.includes('product') || schemaTypes.includes('offer')) {
                return PageType.ECOMMERCE;
            }
            if (schemaTypes.includes('article') || schemaTypes.includes('blogposting')) {
                return PageType.ARTICLE;
            }
        }

        return PageType.UNKNOWN;
    }

    /**
     * Extract primary content for AI understanding
     */
    private extractPrimaryContent(content: ContentSnapshot): string {
        // Prioritize content based on importance
        const parts: string[] = [];

        // Add main headings
        const mainHeadings = content.headings
            .filter(h => h.level <= 2)
            .slice(0, 3)
            .map(h => h.text);
        parts.push(...mainHeadings);

        // Add key text content (first few paragraphs)
        const textPreview = content.text.substring(0, 500);
        if (textPreview.trim()) {
            parts.push(textPreview);
        }

        // Add form information if present
        if (content.forms.length > 0) {
            const formInfo = content.forms
                .slice(0, 2)
                .map(form => `Form with fields: ${form.fields.map(f => f.name).join(', ')}`)
                .join('; ');
            parts.push(formInfo);
        }

        return parts.join('\n\n').trim();
    }

    /**
     * Identify key elements on the page
     */
    private identifyKeyElements(content: ContentSnapshot): string[] {
        const elements: string[] = [];

        // Add significant headings
        content.headings
            .filter(h => h.level <= 3)
            .slice(0, 5)
            .forEach(h => elements.push(`H${h.level}: ${h.text}`));

        // Add important links
        content.links
            .filter(link => link.text.length > 3 && link.text.length < 50)
            .slice(0, 5)
            .forEach(link => elements.push(`Link: ${link.text}`));

        // Add form fields
        content.forms.forEach(form => {
            form.fields.slice(0, 3).forEach(field => {
                elements.push(`Field: ${field.name} (${field.type})`);
            });
        });

        // Add table information
        content.tables.slice(0, 2).forEach((table, index) => {
            elements.push(`Table ${index + 1}: ${table.headers.join(', ')}`);
        });

        return elements;
    }

    /**
     * Summarize user activity
     */
    private summarizeUserActivity(interactions: UserInteraction[]): ActivitySummary {
        const recentInteractions = interactions.filter(
            i => Date.now() - i.timestamp < 60000 // Last minute
        ).length;

        const activeElements = [...new Set(
            interactions
                .slice(-10)
                .map(i => i.element.tagName.toLowerCase())
        )];

        const formActivity = interactions.some(i =>
            i.type === 'input' || i.type === 'submit'
        );

        const navigationActivity = interactions.some(i =>
            i.type === 'click' && i.element.tagName.toLowerCase() === 'a'
        );

        return {
            recentInteractions,
            activeElements,
            formActivity,
            navigationActivity
        };
    }

    /**
     * Summarize data flows (API calls, form submissions)
     */
    private summarizeDataFlows(network: NetworkActivity): DataFlowSummary[] {
        const flows: DataFlowSummary[] = [];

        // Process recent network requests
        network.recentRequests.slice(-10).forEach(request => {
            flows.push({
                type: 'api',
                endpoint: request.url,
                method: request.method,
                status: request.status,
                timestamp: request.timestamp,
                relevance: this.calculateRequestRelevance(request)
            });
        });

        return flows.sort((a, b) => b.relevance - a.relevance);
    }

    /**
     * Calculate relevance score for the entire context
     */
    private calculateRelevanceScore(pageContext: PageContext): number {
        let score = 0.5; // Base score

        // Content quality factors
        if (pageContext.content.text.length > 100) score += 0.1;
        if (pageContext.content.headings.length > 0) score += 0.1;
        if (pageContext.content.forms.length > 0) score += 0.1;

        // User activity factors
        if (pageContext.interactions.length > 0) score += 0.1;
        const recentActivity = pageContext.interactions.filter(
            i => Date.now() - i.timestamp < 300000 // Last 5 minutes
        ).length;
        if (recentActivity > 0) score += 0.1;

        // Network activity factors
        if (pageContext.network.recentRequests.length > 0) score += 0.1;

        return Math.min(1.0, score);
    }

    /**
     * Calculate request relevance for prioritization
     */
    private calculateRequestRelevance(request: any): number {
        let relevance = 0.5;

        // API endpoints are more relevant
        if (request.url.includes('/api/')) relevance += 0.3;
        if (request.url.includes('.json')) relevance += 0.2;

        // Recent requests are more relevant
        const age = Date.now() - request.timestamp;
        if (age < 60000) relevance += 0.2; // Last minute
        else if (age < 300000) relevance += 0.1; // Last 5 minutes

        // Successful requests are more relevant
        if (request.status >= 200 && request.status < 300) relevance += 0.1;

        return Math.min(1.0, relevance);
    }

    /**
     * Prioritize content based on configuration
     */
    private prioritizeContent(content: ContentSnapshot): ContentSnapshot {
        const priorities = this.config.contentPrioritization;

        return {
            ...content,
            headings: content.headings.slice(0, Math.ceil(10 * priorities.headings)),
            links: content.links.slice(0, Math.ceil(20 * priorities.links)),
            images: content.images.slice(0, Math.ceil(10 * priorities.images)),
            forms: content.forms.slice(0, Math.ceil(5 * priorities.forms)),
            tables: content.tables.slice(0, Math.ceil(3 * priorities.tables)),
            text: content.text.substring(0, Math.ceil(2000 * priorities.text))
        };
    }

    /**
     * Filter network activity based on configuration
     */
    private filterNetworkActivity(network: NetworkActivity): NetworkActivity {
        return {
            ...network,
            recentRequests: network.recentRequests
                .slice(-this.config.maxNetworkRequests)
                .filter(req => this.isRelevantRequest(req))
        };
    }

    /**
     * Filter user interactions based on configuration
     */
    private filterInteractions(interactions: UserInteraction[]): UserInteraction[] {
        return interactions
            .slice(-this.config.maxInteractions)
            .filter(interaction => this.isRelevantInteraction(interaction));
    }

    /**
     * Check if request is relevant for AI context
     */
    private isRelevantRequest(request: any): boolean {
        // Filter out static resources
        const staticExtensions = ['.css', '.js', '.png', '.jpg', '.gif', '.ico', '.woff'];
        if (staticExtensions.some(ext => request.url.includes(ext))) {
            return false;
        }

        // Include API calls and data requests
        if (request.url.includes('/api/') || request.url.includes('.json')) {
            return true;
        }

        // Include form submissions
        if (request.method === 'POST' || request.method === 'PUT') {
            return true;
        }

        // Include other GET requests that aren't static resources
        if (request.method === 'GET' && !staticExtensions.some(ext => request.url.includes(ext))) {
            return true;
        }

        return false;
    }

    /**
     * Check if interaction is relevant for AI context
     */
    private isRelevantInteraction(interaction: UserInteraction): boolean {
        // Include form interactions
        if (interaction.type === 'input' || interaction.type === 'submit') {
            return true;
        }

        // Include clicks on important elements
        if (interaction.type === 'click') {
            const tagName = interaction.element.tagName.toLowerCase();
            return ['button', 'a', 'input'].includes(tagName);
        }

        return false;
    }

    /**
     * Assess data quality
     */
    private assessDataQuality(pageContext: PageContext): DataQuality {
        const now = Date.now();
        const age = now - pageContext.timestamp;

        // Freshness: how recent is the data
        const freshness = Math.max(0, 1 - (age / 300000)); // 5 minutes max age

        // Completeness: how much data we have
        let completeness = 0.5;
        if (pageContext.content.text.length > 100) completeness += 0.1;
        if (pageContext.content.headings.length > 0) completeness += 0.1;
        if (pageContext.network.recentRequests.length > 0) completeness += 0.1;
        if (pageContext.interactions.length > 0) completeness += 0.1;
        if (pageContext.semantics) completeness += 0.1;

        // Accuracy: assume high accuracy for now
        const accuracy = 0.9;

        // Relevance: based on user activity and content
        const relevance = this.calculateRelevanceScore(pageContext);

        return {
            completeness: Math.min(1.0, completeness),
            freshness,
            accuracy,
            relevance
        };
    }

    /**
     * Generate cache key for context
     */
    private generateCacheKey(pageContext: PageContext): string {
        // Create a key based on URL and content hash (exclude timestamp for caching)
        const contentHash = this.hashContent(pageContext.content);
        return `${pageContext.url}:${contentHash}`;
    }

    /**
     * Simple content hash for cache key
     */
    private hashContent(content: ContentSnapshot): string {
        const key = `${content.text.length}:${content.headings.length}:${content.forms.length}`;
        return btoa(key).substring(0, 8);
    }

    /**
     * Get cached context if available and not expired
     */
    private getCachedContext(cacheKey: string): AggregatedContext | null {
        const cached = this.cache.get(cacheKey);
        if (!cached) return null;

        const age = Date.now() - cached.timestamp;
        if (age > this.config.cacheTimeout) {
            this.cache.delete(cacheKey);
            return null;
        }

        return cached.context;
    }

    /**
     * Cache aggregated context
     */
    private cacheContext(cacheKey: string, context: AggregatedContext): void {
        this.cache.set(cacheKey, {
            context,
            timestamp: Date.now()
        });

        // Clean up old cache entries
        this.cleanupCache();
    }

    /**
     * Clean up expired cache entries
     */
    private cleanupCache(): void {
        const now = Date.now();
        for (const [key, cached] of this.cache.entries()) {
            if (now - cached.timestamp > this.config.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Estimate data size for performance metrics
     */
    private estimateDataSize(context: AggregatedContext): number {
        return JSON.stringify(context).length;
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ContextAggregationConfig>): void {
        this.config = { ...this.config, ...newConfig };

        // Clear cache if caching settings changed
        if (newConfig.cacheTimeout !== undefined) {
            this.cache.clear();
        }
    }

    /**
     * Clear all cached contexts
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): PerformanceMetrics {
        return { ...this.performanceMetrics };
    }
}