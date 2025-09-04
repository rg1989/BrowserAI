import { NetworkMonitor } from './NetworkMonitor';
import { NetworkStorage } from './NetworkStorage';
import { DOMObserver } from './DOMObserver';
import { ContentAnalyzer, ContentAnalysis, UserContext, ContentIntent } from './ContentAnalyzer';
import { PrivacyController } from './PrivacyController';
import { MonitoringConfigManager } from './MonitoringConfig';
import { ContextAggregator, AggregatedContext, ContextAggregationConfig } from './ContextAggregator';
import {
    PageContext,
    NetworkActivity,
    LayoutSnapshot,
    ContentSnapshot,
    UserInteraction,
    MonitoringState
} from '../types/monitoring';

/**
 * Monitoring event types
 */
export enum MonitoringEvent {
    STARTED = 'started',
    STOPPED = 'stopped',
    PAUSED = 'paused',
    RESUMED = 'resumed',
    ERROR = 'error',
    CONTEXT_UPDATED = 'context_updated',
    PRIVACY_CHANGED = 'privacy_changed'
}

/**
 * Event listener callback
 */
export type MonitoringEventListener = (event: MonitoringEvent, data?: any) => void;

/**
 * Page context monitoring orchestrator
 * Coordinates all monitoring components and provides unified API
 */
export class PageContextMonitor {
    private networkMonitor: NetworkMonitor;
    private networkStorage: NetworkStorage;
    private domObserver: DOMObserver;
    private contentAnalyzer: ContentAnalyzer;
    private privacyController: PrivacyController;
    private config: MonitoringConfigManager;
    private contextAggregator: ContextAggregator;
    private eventListeners: Map<MonitoringEvent, MonitoringEventListener[]>;
    private state: MonitoringState;
    private currentContext: PageContext | null;
    private updateInterval: number | null;
    private errorCount: number;
    private maxErrors: number;
    private contentAnalysisTimeout: number | null = null;
    private startTime: number = Date.now();

    constructor(config?: Partial<MonitoringConfig>) {
        this.config = new MonitoringConfigManager(config);
        this.privacyController = new PrivacyController(this.config.getPrivacyConfig());
        this.networkMonitor = new NetworkMonitor(this.privacyController);
        this.networkStorage = new NetworkStorage(this.config.getStorageConfig());
        this.domObserver = new DOMObserver();
        this.contentAnalyzer = new ContentAnalyzer();
        this.contextAggregator = new ContextAggregator();
        this.eventListeners = new Map();
        this.state = MonitoringState.STOPPED;
        this.currentContext = null;
        this.updateInterval = null;
        this.errorCount = 0;
        this.maxErrors = 5;

        this.setupEventHandlers();
    }

    /**
     * Start monitoring page context
     */
    async start(): Promise<void> {
        try {
            if (this.state === MonitoringState.RUNNING) {
                console.warn('PageContextMonitor is already running');
                return;
            }

            this.state = MonitoringState.STARTING;
            this.errorCount = 0;

            // Initialize storage
            await this.networkStorage.initialize();

            // Start individual monitors
            await this.networkMonitor.start();
            this.domObserver.startObserving();

            // Start periodic context updates
            this.startPeriodicUpdates();

            this.state = MonitoringState.RUNNING;
            this.emit(MonitoringEvent.STARTED);

            console.log('PageContextMonitor started successfully');
        } catch (error) {
            this.state = MonitoringState.ERROR;
            this.handleError('Failed to start monitoring', error);
            throw error;
        }
    }

    /**
     * Stop monitoring page context
     */
    async stop(): Promise<void> {
        try {
            if (this.state === MonitoringState.STOPPED) {
                return;
            }

            this.state = MonitoringState.STOPPING;

            // Stop periodic updates
            this.stopPeriodicUpdates();

            // Stop individual monitors
            await this.networkMonitor.stop();
            this.domObserver.stopObserving();

            // Clean up storage
            await this.networkStorage.cleanup();

            this.state = MonitoringState.STOPPED;
            this.emit(MonitoringEvent.STOPPED);

            console.log('PageContextMonitor stopped successfully');
        } catch (error) {
            this.handleError('Failed to stop monitoring', error);
        }
    }

    /**
     * Pause monitoring (keeps data but stops collection)
     */
    pause(): void {
        if (this.state !== MonitoringState.RUNNING) {
            return;
        }

        this.state = MonitoringState.PAUSED;
        this.stopPeriodicUpdates();
        this.networkMonitor.pause();
        this.domObserver.pauseObserving();
        this.emit(MonitoringEvent.PAUSED);
    }

    /**
     * Resume monitoring from paused state
     */
    resume(): void {
        if (this.state !== MonitoringState.PAUSED) {
            return;
        }

        this.state = MonitoringState.RUNNING;
        this.startPeriodicUpdates();
        this.networkMonitor.resume();
        this.domObserver.resumeObserving();
        this.emit(MonitoringEvent.RESUMED);
    }

    /**
     * Get current page context
     */
    async getCurrentContext(): Promise<PageContext | null> {
        if (this.state !== MonitoringState.RUNNING) {
            return this.currentContext;
        }

        try {
            await this.updateContext();
            return this.currentContext;
        } catch (error) {
            this.handleError('Failed to get current context', error);
            return this.currentContext;
        }
    }

    /**
     * Get aggregated context for AI chat integration
     * This is the main API for AI systems to get contextual information
     */
    async getContext(): Promise<AggregatedContext | null> {
        if (this.state !== MonitoringState.RUNNING) {
            console.warn('PageContextMonitor is not running, returning null context');
            return null;
        }

        try {
            // Ensure we have current context
            const pageContext = await this.getCurrentContext();
            if (!pageContext) {
                return null;
            }

            // Aggregate context for AI consumption
            const aggregatedContext = await this.contextAggregator.aggregateContext(pageContext);

            // Emit context update event
            this.emit(MonitoringEvent.CONTEXT_UPDATED, aggregatedContext);

            return aggregatedContext;
        } catch (error) {
            this.handleError('Failed to get aggregated context', error);
            return null;
        }
    }

    /**
     * Get page context with semantic analysis
     */
    async getSemanticContext(userContext?: UserContext, intent?: ContentIntent): Promise<{
        context: PageContext | null;
        analysis: ContentAnalysis | null;
    }> {
        const context = await this.getCurrentContext();
        if (!context || !context.content) {
            return { context, analysis: null };
        }

        try {
            const analysis = this.contentAnalyzer.analyzeContent(context.content, userContext, intent);
            return { context, analysis };
        } catch (error) {
            this.handleError('Failed to perform semantic analysis', error);
            return { context, analysis: null };
        }
    }

    /**
     * Get context with custom aggregation configuration
     */
    async getContextWithConfig(aggregationConfig: Partial<ContextAggregationConfig>): Promise<AggregatedContext | null> {
        if (this.state !== MonitoringState.RUNNING) {
            return null;
        }

        try {
            const pageContext = await this.getCurrentContext();
            if (!pageContext) {
                return null;
            }

            // Create temporary aggregator with custom config
            const tempAggregator = new ContextAggregator(aggregationConfig);
            return await tempAggregator.aggregateContext(pageContext);
        } catch (error) {
            this.handleError('Failed to get context with custom config', error);
            return null;
        }
    }

    /**
     * Update monitoring configuration
     */
    updateConfig(newConfig: Partial<MonitoringConfig>): void {
        this.config.updateConfig(newConfig);

        // Update individual components
        this.privacyController.updateConfig(this.config.getPrivacyConfig());
        this.networkStorage.updateConfig(this.config.getStorageConfig());

        // Mock calls for components that don't have updateConfig methods yet
        if (this.networkMonitor && (this.networkMonitor as any).updateConfig) {
            (this.networkMonitor as any).updateConfig(this.config.getPerformanceConfig());
        }
        if (this.domObserver && (this.domObserver as any).updateConfig) {
            (this.domObserver as any).updateConfig(this.config.getPerformanceConfig());
        }

        // Note: Periodic update interval is currently fixed
        // Could be made configurable in the future
    }

    /**
     * Update context aggregation configuration
     */
    updateContextAggregationConfig(config: Partial<ContextAggregationConfig>): void {
        this.contextAggregator.updateConfig(config);
    }

    /**
     * Clear context aggregation cache
     */
    clearContextCache(): void {
        this.contextAggregator.clearCache();
    }

    /**
     * Get context aggregation performance metrics
     */
    getContextPerformanceMetrics() {
        return this.contextAggregator.getPerformanceMetrics();
    }

    /**
     * Get monitoring statistics
     */
    async getStatistics(): Promise<{
        state: MonitoringState;
        uptime: number;
        errorCount: number;
        networkRequests: number;
        domMutations: number;
        storageSize: number;
    }> {
        const networkStats = await this.networkStorage.getStatistics();
        const domStats = this.domObserver.getStatistics();

        return {
            state: this.state,
            uptime: this.getUptime(),
            errorCount: this.errorCount,
            networkRequests: networkStats.totalRequests,
            domMutations: domStats.totalMutations,
            storageSize: networkStats.storageSize
        };
    }

    /**
     * Add event listener
     */
    addEventListener(event: MonitoringEvent, listener: MonitoringEventListener): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(listener);
    }

    /**
     * Remove event listener
     */
    removeEventListener(event: MonitoringEvent, listener: MonitoringEventListener): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Get current monitoring state
     */
    getState(): MonitoringState {
        return this.state;
    }

    /**
     * Check if monitoring is active
     */
    isActive(): boolean {
        return this.state === MonitoringState.RUNNING;
    }

    /**
     * Private methods
     */
    private setupEventHandlers(): void {
        // Handle network events
        this.networkMonitor.addEventListener('request', (data) => {
            this.handleNetworkActivity(data);
        });

        this.networkMonitor.addEventListener('response', (data) => {
            this.handleNetworkActivity(data);
        });

        // Handle DOM events
        this.domObserver.addEventListener('mutation', (data) => {
            this.handleDOMChange(data);
        });

        this.domObserver.addEventListener('interaction', (data) => {
            this.handleUserInteraction(data);
        });

        // Handle privacy changes
        this.privacyController.addEventListener('configChanged', () => {
            this.emit(MonitoringEvent.PRIVACY_CHANGED);
        });
    }

    private startPeriodicUpdates(): void {
        const interval = 5000; // Default 5 seconds - use fixed interval for now
        this.updateInterval = window.setInterval(() => {
            this.updateContext().catch(error => {
                this.handleError('Periodic context update failed', error);
            });
        }, interval);
    }

    private stopPeriodicUpdates(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    private async updateContext(): Promise<void> {
        try {
            // Get current snapshots from all monitors
            const networkActivity = await this.getNetworkActivity();
            const layoutSnapshot = this.domObserver.captureLayoutSnapshot();
            const contentSnapshot = this.contentAnalyzer.extractContent();
            const userInteractions = this.domObserver.getRecentInteractions();

            // Create new context
            this.currentContext = {
                url: window.location.href,
                title: document.title,
                timestamp: Date.now(),
                network: networkActivity,
                layout: layoutSnapshot,
                content: contentSnapshot,
                interactions: userInteractions,
                metadata: {
                    userAgent: navigator.userAgent,
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    },
                    scrollPosition: {
                        x: window.scrollX,
                        y: window.scrollY
                    }
                }
            };

            this.emit(MonitoringEvent.CONTEXT_UPDATED, this.currentContext);
        } catch (error) {
            throw new Error(`Context update failed: ${error}`);
        }
    }

    private async getNetworkActivity(): Promise<NetworkActivity> {
        const recentRequests = await this.networkStorage.getRecentRequests(50);
        const stats = await this.networkStorage.getStatistics();

        return {
            recentRequests,
            totalRequests: stats.totalRequests,
            totalDataTransferred: stats.totalSize,
            averageResponseTime: this.calculateAverageResponseTime(recentRequests)
        };
    }

    private calculateAverageResponseTime(requests: any[]): number {
        if (requests.length === 0) return 0;

        const totalTime = requests.reduce((sum, req) => {
            return sum + (req.responseTime || 0);
        }, 0);

        return totalTime / requests.length;
    }

    private handleNetworkActivity(data: any): void {
        // Store network activity
        this.networkStorage.storeRequest(data).catch(error => {
            this.handleError('Failed to store network activity', error);
        });
    }

    private handleDOMChange(data: any): void {
        // Handle DOM mutations - could trigger content re-analysis
        if (this.shouldReanalyzeContent(data)) {
            // Debounce content re-analysis
            this.debounceContentAnalysis();
        }
    }

    private handleUserInteraction(data: UserInteraction): void {
        // Handle user interactions - could update user context
        this.updateUserContext(data);
    }

    private shouldReanalyzeContent(mutationData: any): boolean {
        // Determine if DOM changes warrant content re-analysis
        return mutationData.type === 'childList' ||
            mutationData.type === 'characterData';
    }

    private debounceContentAnalysis(): void {
        // Simple debouncing - could be enhanced with proper debounce utility
        if (this.contentAnalysisTimeout) {
            clearTimeout(this.contentAnalysisTimeout);
        }
        this.contentAnalysisTimeout = window.setTimeout(() => {
            this.updateContext().catch(error => {
                this.handleError('Debounced content analysis failed', error);
            });
        }, 1000);
    }

    private updateUserContext(interaction: UserInteraction): void {
        // Update user context based on interactions
        // This could be used for personalized content prioritization
    }

    private handleError(message: string, error: any): void {
        this.errorCount++;
        console.error(`PageContextMonitor: ${message}`, error);

        this.emit(MonitoringEvent.ERROR, { message, error, count: this.errorCount });

        // Stop monitoring if too many errors
        if (this.errorCount >= this.maxErrors) {
            console.error('Too many errors, stopping monitoring');
            this.stop().catch(stopError => {
                console.error('Failed to stop monitoring after errors', stopError);
            });
        }
    }

    private emit(event: MonitoringEvent, data?: any): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event, data);
                } catch (error) {
                    console.error('Event listener error', error);
                }
            });
        }
    }

    private getUptime(): number {
        return Date.now() - this.startTime;
    }

    /**
     * Cleanup resources
     */
    async destroy(): Promise<void> {
        await this.stop();
        this.eventListeners.clear();
        this.currentContext = null;
    }
}