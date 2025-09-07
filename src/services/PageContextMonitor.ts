import { NetworkMonitor } from "./NetworkMonitor";
import { NetworkStorage } from "./NetworkStorage";
import { DOMObserver } from "./DOMObserver";
import {
  ContentAnalyzer,
  ContentAnalysis,
  UserContext,
  ContentIntent,
} from "./ContentAnalyzer";
import { PrivacyController } from "./PrivacyController";
import { MonitoringConfigManager } from "./MonitoringConfig";
import {
  ContextAggregator,
  AggregatedContext,
  ContextAggregationConfig,
} from "./ContextAggregator";
import {
  PageContext,
  NetworkActivity,
  LayoutSnapshot,
  ContentSnapshot,
  UserInteraction,
  MonitoringState,
  MonitoringConfig,
} from "../types/monitoring";
import {
  ErrorHandler,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
  CircuitBreaker,
  withErrorHandling,
} from "../utils/ErrorHandler";

/**
 * Monitoring event types
 */
export enum MonitoringEvent {
  STARTED = "started",
  STOPPED = "stopped",
  PAUSED = "paused",
  RESUMED = "resumed",
  ERROR = "error",
  CONTEXT_UPDATED = "context_updated",
  PRIVACY_CHANGED = "privacy_changed",
}

/**
 * Event listener callback
 */
export type MonitoringEventListener = (
  event: MonitoringEvent,
  data?: any
) => void;

/**
 * Page context monitoring orchestrator
 * Coordinates all monitoring components and provides unified API
 * Enhanced with comprehensive error handling and recovery mechanisms
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

  // Error handling and recovery
  private errorHandler: ErrorHandler;
  private circuitBreaker: CircuitBreaker;
  private componentHealth: Map<
    string,
    { healthy: boolean; lastCheck: Date; errorCount: number }
  >;
  private recoveryAttempts: number = 0;
  private maxRecoveryAttempts: number = 3;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastSuccessfulUpdate: Date = new Date();
  private criticalErrors: number = 0;
  private maxCriticalErrors: number = 3;

  constructor(config?: Partial<MonitoringConfig>) {
    this.config = new MonitoringConfigManager(config);
    // @ts-ignore - Temporary fix for privacy config type mismatch
    this.privacyController = new PrivacyController(
      this.config.getPrivacyConfig()
    );
    this.networkMonitor = new NetworkMonitor(1000, this.privacyController);
    // @ts-ignore - Temporary fix for storage config type mismatch
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

    // Initialize error handling
    this.errorHandler = ErrorHandler.getInstance();
    this.circuitBreaker = new CircuitBreaker(5, 60000, 30000);
    this.componentHealth = new Map();

    this.setupErrorHandling();
    this.setupEventHandlers();
    this.initializeComponentHealth();
  }

  /**
   * Start monitoring page context with comprehensive error handling
   */
  async start(): Promise<void> {
    try {
      await this.circuitBreaker.execute(async () => {
        await this.startMonitoring();
      });
    } catch (error) {
      await this.errorHandler.handleError(
        ErrorCategory.CONTEXT,
        ErrorSeverity.CRITICAL,
        `Failed to start page context monitoring: ${error.message}`,
        "PageContextMonitor",
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Internal start monitoring with error handling
   */
  @withErrorHandling(
    ErrorCategory.CONTEXT,
    "PageContextMonitor",
    ErrorSeverity.HIGH
  )
  private async startMonitoring(): Promise<void> {
    if (this.state === MonitoringState.RUNNING) {
      console.warn("PageContextMonitor is already running");
      return;
    }

    this.state = MonitoringState.STARTING;
    this.errorCount = 0;
    this.criticalErrors = 0;
    this.recoveryAttempts = 0;

    try {
      // Initialize storage with fallback
      await this.initializeWithFallback("NetworkStorage", async () => {
        await this.networkStorage.initialize();
      });

      // Start individual monitors with graceful degradation
      await this.startComponentWithFallback("NetworkMonitor", async () => {
        await this.networkMonitor.start();
      });

      await this.startComponentWithFallback("DOMObserver", async () => {
        await this.domObserver.startObserving();
      });

      // Start periodic context updates
      this.startPeriodicUpdates();
      this.startHealthCheck();

      this.state = MonitoringState.RUNNING;
      this.lastSuccessfulUpdate = new Date();
      this.emit(MonitoringEvent.STARTED);

      console.log("PageContextMonitor started successfully");
    } catch (error) {
      this.state = MonitoringState.ERROR;
      throw new Error(`Failed to start monitoring: ${error.message}`);
    }
  }

  /**
   * Stop monitoring page context with comprehensive cleanup
   */
  async stop(): Promise<void> {
    try {
      await this.stopMonitoring();
    } catch (error) {
      await this.errorHandler.handleError(
        ErrorCategory.CONTEXT,
        ErrorSeverity.MEDIUM,
        `Error stopping page context monitoring: ${error.message}`,
        "PageContextMonitor",
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Internal stop monitoring with error handling
   */
  private async stopMonitoring(): Promise<void> {
    if (this.state === MonitoringState.STOPPED) {
      return;
    }

    this.state = MonitoringState.STOPPING;

    try {
      // Stop periodic updates and health checks
      this.stopPeriodicUpdates();
      this.stopHealthCheck();

      // Stop individual monitors with error handling
      const stopPromises = [
        this.stopComponentSafely("NetworkMonitor", () =>
          this.networkMonitor.stop()
        ),
        this.stopComponentSafely("DOMObserver", () =>
          this.domObserver.stopObserving()
        ),
        this.stopComponentSafely("NetworkStorage", () =>
          this.networkStorage.cleanup()
        ),
      ];

      await Promise.allSettled(stopPromises);

      // Reset circuit breaker
      this.circuitBreaker.reset();

      this.state = MonitoringState.STOPPED;
      this.emit(MonitoringEvent.STOPPED);

      console.log("PageContextMonitor stopped successfully");
    } catch (error) {
      console.error("Error during PageContextMonitor shutdown:", error);
      this.state = MonitoringState.ERROR;
      throw error;
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
      this.handleError("Failed to get current context", error);
      return this.currentContext;
    }
  }

  /**
   * Get aggregated context for AI chat integration
   * This is the main API for AI systems to get contextual information
   */
  async getContext(): Promise<AggregatedContext | null> {
    if (this.state !== MonitoringState.RUNNING) {
      console.warn("PageContextMonitor is not running, returning null context");
      return null;
    }

    try {
      // Ensure we have current context
      const pageContext = await this.getCurrentContext();
      if (!pageContext) {
        return null;
      }

      // Aggregate context for AI consumption
      const aggregatedContext = await this.contextAggregator.aggregateContext(
        pageContext
      );

      // Emit context update event
      this.emit(MonitoringEvent.CONTEXT_UPDATED, aggregatedContext);

      return aggregatedContext;
    } catch (error) {
      this.handleError("Failed to get aggregated context", error);
      return null;
    }
  }

  /**
   * Get page context with semantic analysis
   */
  async getSemanticContext(
    userContext?: UserContext,
    intent?: ContentIntent
  ): Promise<{
    context: PageContext | null;
    analysis: ContentAnalysis | null;
  }> {
    const context = await this.getCurrentContext();
    if (!context || !context.content) {
      return { context, analysis: null };
    }

    try {
      const analysis = this.contentAnalyzer.analyzeContent(
        context.content,
        userContext,
        intent
      );
      return { context, analysis };
    } catch (error) {
      this.handleError("Failed to perform semantic analysis", error);
      return { context, analysis: null };
    }
  }

  /**
   * Get context with custom aggregation configuration
   */
  async getContextWithConfig(
    aggregationConfig: Partial<ContextAggregationConfig>
  ): Promise<AggregatedContext | null> {
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
      this.handleError("Failed to get context with custom config", error);
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
      (this.networkMonitor as any).updateConfig(
        this.config.getPerformanceConfig()
      );
    }
    if (this.domObserver && (this.domObserver as any).updateConfig) {
      (this.domObserver as any).updateConfig(
        this.config.getPerformanceConfig()
      );
    }

    // Note: Periodic update interval is currently fixed
    // Could be made configurable in the future
  }

  /**
   * Update context aggregation configuration
   */
  updateContextAggregationConfig(
    config: Partial<ContextAggregationConfig>
  ): void {
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
      storageSize: networkStats.storageSize,
    };
  }

  /**
   * Add event listener
   */
  addEventListener(
    event: MonitoringEvent,
    listener: MonitoringEventListener
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(
    event: MonitoringEvent,
    listener: MonitoringEventListener
  ): void {
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
    this.networkMonitor.addEventListener("request", (data) => {
      this.handleNetworkActivity(data);
    });

    this.networkMonitor.addEventListener("response", (data) => {
      this.handleNetworkActivity(data);
    });

    // Handle DOM events
    this.domObserver.addEventListener("mutation", (data) => {
      this.handleDOMChange(data);
    });

    this.domObserver.addEventListener("interaction", (data) => {
      this.handleUserInteraction(data);
    });

    // Handle privacy changes
    this.privacyController.addEventListener("configChanged", () => {
      this.emit(MonitoringEvent.PRIVACY_CHANGED);
    });
  }

  private startPeriodicUpdates(): void {
    const interval = 5000; // Default 5 seconds - use fixed interval for now
    this.updateInterval = window.setInterval(() => {
      this.updateContext().catch((error) => {
        this.handleError("Periodic context update failed", error);
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
            height: window.innerHeight,
          },
          scrollPosition: {
            x: window.scrollX,
            y: window.scrollY,
          },
        },
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
      averageResponseTime: this.calculateAverageResponseTime(recentRequests),
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
    this.networkStorage.storeRequest(data).catch((error) => {
      this.handleError("Failed to store network activity", error);
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
    return (
      mutationData.type === "childList" || mutationData.type === "characterData"
    );
  }

  private debounceContentAnalysis(): void {
    // Simple debouncing - could be enhanced with proper debounce utility
    if (this.contentAnalysisTimeout) {
      clearTimeout(this.contentAnalysisTimeout);
    }
    this.contentAnalysisTimeout = window.setTimeout(() => {
      this.updateContext().catch((error) => {
        this.handleError("Debounced content analysis failed", error);
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

    this.emit(MonitoringEvent.ERROR, {
      message,
      error,
      count: this.errorCount,
    });

    // Stop monitoring if too many errors
    if (this.errorCount >= this.maxErrors) {
      console.error("Too many errors, stopping monitoring");
      this.stop().catch((stopError) => {
        console.error("Failed to stop monitoring after errors", stopError);
      });
    }
  }

  private emit(event: MonitoringEvent, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(event, data);
        } catch (error) {
          console.error("Event listener error", error);
        }
      });
    }
  }

  private getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get monitoring health status
   */
  getHealthStatus(): {
    state: MonitoringState;
    componentHealth: Record<
      string,
      { healthy: boolean; lastCheck: Date; errorCount: number }
    >;
    errorCount: number;
    criticalErrors: number;
    recoveryAttempts: number;
    circuitBreakerState: string;
    lastSuccessfulUpdate: Date;
    uptime: number;
  } {
    const healthStatus: Record<
      string,
      { healthy: boolean; lastCheck: Date; errorCount: number }
    > = {};

    for (const [component, health] of this.componentHealth.entries()) {
      healthStatus[component] = { ...health };
    }

    return {
      state: this.state,
      componentHealth: healthStatus,
      errorCount: this.errorCount,
      criticalErrors: this.criticalErrors,
      recoveryAttempts: this.recoveryAttempts,
      circuitBreakerState: this.circuitBreaker.getState(),
      lastSuccessfulUpdate: this.lastSuccessfulUpdate,
      uptime: this.getUptime(),
    };
  }

  /**
   * Attempt to recover from errors
   */
  async recover(): Promise<boolean> {
    try {
      if (this.errorHandler.shouldDisableComponent("PageContextMonitor")) {
        console.warn("PageContextMonitor disabled due to too many errors");
        return false;
      }

      if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
        console.error("Max recovery attempts reached for PageContextMonitor");
        return false;
      }

      this.recoveryAttempts++;
      console.log(
        `Attempting PageContextMonitor recovery (attempt ${this.recoveryAttempts})`
      );

      // Stop current monitoring
      await this.stopMonitoring();

      // Wait before restarting
      await this.sleep(2000 * this.recoveryAttempts);

      // Restart monitoring
      await this.startMonitoring();

      console.log(
        `PageContextMonitor recovered successfully after ${this.recoveryAttempts} attempts`
      );
      return true;
    } catch (error) {
      await this.errorHandler.handleError(
        ErrorCategory.CONTEXT,
        ErrorSeverity.CRITICAL,
        `PageContextMonitor recovery failed: ${error.message}`,
        "PageContextMonitor",
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Setup error handling callbacks
   */
  private setupErrorHandling(): void {
    this.errorHandler.onError(ErrorCategory.CONTEXT, async (error) => {
      this.errorCount++;

      if (error.severity === ErrorSeverity.CRITICAL) {
        this.criticalErrors++;

        if (this.criticalErrors >= this.maxCriticalErrors) {
          console.error("Too many critical errors, stopping monitoring");
          await this.stop();
        } else {
          console.error("Critical error detected, attempting recovery");
          await this.recover();
        }
      }
    });

    // Set up component-specific error handlers
    this.errorHandler.onError(ErrorCategory.NETWORK, (error) => {
      this.updateComponentHealth("NetworkMonitor", false);
    });

    this.errorHandler.onError(ErrorCategory.DOM, (error) => {
      this.updateComponentHealth("DOMObserver", false);
    });

    this.errorHandler.onError(ErrorCategory.STORAGE, (error) => {
      this.updateComponentHealth("NetworkStorage", false);
    });
  }

  /**
   * Initialize component health tracking
   */
  private initializeComponentHealth(): void {
    const components = [
      "NetworkMonitor",
      "DOMObserver",
      "NetworkStorage",
      "ContentAnalyzer",
      "ContextAggregator",
    ];

    components.forEach((component) => {
      this.componentHealth.set(component, {
        healthy: true,
        lastCheck: new Date(),
        errorCount: 0,
      });
    });
  }

  /**
   * Update component health status
   */
  private updateComponentHealth(component: string, healthy: boolean): void {
    const health = this.componentHealth.get(component);
    if (health) {
      health.healthy = healthy;
      health.lastCheck = new Date();
      if (!healthy) {
        health.errorCount++;
      }
    }
  }

  /**
   * Start component with fallback handling
   */
  private async startComponentWithFallback(
    componentName: string,
    startFn: () => Promise<void>
  ): Promise<void> {
    try {
      await startFn();
      this.updateComponentHealth(componentName, true);
      console.log(`${componentName} started successfully`);
    } catch (error) {
      this.updateComponentHealth(componentName, false);

      await this.errorHandler.handleError(
        this.getComponentErrorCategory(componentName),
        ErrorSeverity.HIGH,
        `Failed to start ${componentName}: ${error.message}`,
        "PageContextMonitor",
        error instanceof Error ? error : new Error(String(error)),
        { component: componentName }
      );

      // Continue with graceful degradation
      console.warn(
        `${componentName} failed to start, continuing with degraded functionality`
      );
    }
  }

  /**
   * Stop component safely with error handling
   */
  private async stopComponentSafely(
    componentName: string,
    stopFn: () => Promise<void>
  ): Promise<void> {
    try {
      await stopFn();
      console.log(`${componentName} stopped successfully`);
    } catch (error) {
      console.warn(`Error stopping ${componentName}:`, error);
    }
  }

  /**
   * Initialize with fallback handling
   */
  private async initializeWithFallback(
    componentName: string,
    initFn: () => Promise<void>
  ): Promise<void> {
    try {
      await initFn();
      this.updateComponentHealth(componentName, true);
    } catch (error) {
      this.updateComponentHealth(componentName, false);

      await this.errorHandler.handleError(
        ErrorCategory.STORAGE,
        ErrorSeverity.MEDIUM,
        `Failed to initialize ${componentName}: ${error.message}`,
        "PageContextMonitor",
        error instanceof Error ? error : new Error(String(error)),
        { component: componentName }
      );

      // Continue without this component
      console.warn(
        `${componentName} initialization failed, continuing without it`
      );
    }
  }

  /**
   * Get error category for component
   */
  private getComponentErrorCategory(componentName: string): ErrorCategory {
    switch (componentName) {
      case "NetworkMonitor":
        return ErrorCategory.NETWORK;
      case "DOMObserver":
        return ErrorCategory.DOM;
      case "NetworkStorage":
        return ErrorCategory.STORAGE;
      case "ContentAnalyzer":
      case "ContextAggregator":
        return ErrorCategory.CONTEXT;
      default:
        return ErrorCategory.UNKNOWN;
    }
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Check every minute
  }

  /**
   * Stop health check monitoring
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      if (this.state !== MonitoringState.RUNNING) {
        return;
      }

      // Check component health
      const networkHealth = this.networkMonitor.isActive();
      const domHealth = this.domObserver.isActive();

      this.updateComponentHealth("NetworkMonitor", networkHealth);
      this.updateComponentHealth("DOMObserver", domHealth);

      // Check if context updates are working
      const timeSinceLastUpdate =
        Date.now() - this.lastSuccessfulUpdate.getTime();
      if (timeSinceLastUpdate > 300000) {
        // 5 minutes
        await this.errorHandler.handleError(
          ErrorCategory.CONTEXT,
          ErrorSeverity.MEDIUM,
          "Context updates have been stalled for too long",
          "PageContextMonitor",
          undefined,
          { timeSinceLastUpdate }
        );
      }

      // Check circuit breaker state
      if (this.circuitBreaker.getState() === "open") {
        console.warn("PageContextMonitor circuit breaker is open");
      }

      // Reset error counts if monitoring is stable
      if (this.errorCount > 0 && this.state === MonitoringState.RUNNING) {
        this.errorCount = Math.max(0, this.errorCount - 1);
      }
    } catch (error) {
      console.error("Health check failed:", error);
    }
  }

  /**
   * Enhanced update context with error handling
   */
  private async updateContext(): Promise<void> {
    try {
      // Get current snapshots from all monitors with fallbacks
      const networkActivity = await this.getNetworkActivitySafely();
      const layoutSnapshot = this.getLayoutSnapshotSafely();
      const contentSnapshot = this.getContentSnapshotSafely();
      const userInteractions = this.getUserInteractionsSafely();

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
            height: window.innerHeight,
          },
          scrollPosition: {
            x: window.scrollX,
            y: window.scrollY,
          },
        },
      };

      this.lastSuccessfulUpdate = new Date();
      this.emit(MonitoringEvent.CONTEXT_UPDATED, this.currentContext);
    } catch (error) {
      throw new Error(`Context update failed: ${error.message}`);
    }
  }

  /**
   * Get network activity with error handling
   */
  private async getNetworkActivitySafely(): Promise<NetworkActivity> {
    try {
      if (!this.componentHealth.get("NetworkMonitor")?.healthy) {
        return this.getEmptyNetworkActivity();
      }

      return await this.getNetworkActivity();
    } catch (error) {
      console.warn("Failed to get network activity, using fallback:", error);
      return this.getEmptyNetworkActivity();
    }
  }

  /**
   * Get layout snapshot with error handling
   */
  private getLayoutSnapshotSafely(): LayoutSnapshot {
    try {
      if (!this.componentHealth.get("DOMObserver")?.healthy) {
        return this.getEmptyLayoutSnapshot();
      }

      return this.domObserver.getCurrentLayout();
    } catch (error) {
      console.warn("Failed to get layout snapshot, using fallback:", error);
      return this.getEmptyLayoutSnapshot();
    }
  }

  /**
   * Get content snapshot with error handling
   */
  private getContentSnapshotSafely(): ContentSnapshot {
    try {
      return this.contentAnalyzer.extractContent();
    } catch (error) {
      console.warn("Failed to extract content, using fallback:", error);
      return this.getEmptyContentSnapshot();
    }
  }

  /**
   * Get user interactions with error handling
   */
  private getUserInteractionsSafely(): UserInteraction[] {
    try {
      if (!this.componentHealth.get("DOMObserver")?.healthy) {
        return [];
      }

      return this.domObserver.getRecentInteractions();
    } catch (error) {
      console.warn("Failed to get user interactions, using fallback:", error);
      return [];
    }
  }

  /**
   * Fallback methods for graceful degradation
   */
  private getEmptyNetworkActivity(): NetworkActivity {
    return {
      recentRequests: [],
      totalRequests: 0,
      totalDataTransferred: 0,
      averageResponseTime: 0,
    };
  }

  private getEmptyLayoutSnapshot(): LayoutSnapshot {
    return {
      viewport: {
        width: window.innerWidth || 1024,
        height: window.innerHeight || 768,
        scrollX: window.scrollX || 0,
        scrollY: window.scrollY || 0,
        devicePixelRatio: window.devicePixelRatio || 1,
      },
      visibleElements: [],
      scrollPosition: {
        x: window.scrollX || 0,
        y: window.scrollY || 0,
        maxX: 0,
        maxY: 0,
      },
      modals: [],
      overlays: [],
    };
  }

  private getEmptyContentSnapshot(): ContentSnapshot {
    return {
      text: document.title || "",
      headings: [],
      links: [],
      images: [],
      forms: [],
      tables: [],
      metadata: {
        title: document.title || "",
        description: undefined,
        keywords: undefined,
        author: undefined,
        canonical: undefined,
        language: document.documentElement.lang || undefined,
      },
    };
  }

  /**
   * Enhanced error handling
   */
  private async handleError(message: string, error: any): Promise<void> {
    this.errorCount++;

    await this.errorHandler.handleError(
      ErrorCategory.CONTEXT,
      ErrorSeverity.HIGH,
      message,
      "PageContextMonitor",
      error instanceof Error ? error : new Error(String(error)),
      { errorCount: this.errorCount }
    );

    this.emit(MonitoringEvent.ERROR, {
      message,
      error,
      count: this.errorCount,
    });

    // Stop monitoring if too many errors
    if (this.errorCount >= this.maxErrors) {
      console.error("Too many errors, stopping monitoring");
      await this.stop();
    }
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources with comprehensive error handling
   */
  async destroy(): Promise<void> {
    try {
      await this.stop();
      this.eventListeners.clear();
      this.componentHealth.clear();
      this.currentContext = null;

      console.log("PageContextMonitor destroyed successfully");
    } catch (error) {
      console.error("Error during PageContextMonitor destruction:", error);
    }
  }
}
