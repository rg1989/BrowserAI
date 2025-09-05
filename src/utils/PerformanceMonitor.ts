/**
 * Performance monitoring utilities for monitoring components
 * Provides metrics collection, dynamic throttling, and memory management
 */

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
    responseTime: number;
    dataSize: number;
    cacheHit: boolean;
    processingTime: number;
    memoryUsage?: MemoryUsage;
    cpuUsage?: number;
    timestamp: Date;
}

/**
 * Memory usage information
 */
export interface MemoryUsage {
    used: number;
    total: number;
    percentage: number;
    heapUsed?: number;
    heapTotal?: number;
}

/**
 * Performance thresholds for dynamic optimization
 */
export interface PerformanceThresholds {
    maxResponseTime: number; // milliseconds
    maxMemoryUsage: number; // percentage
    maxCpuUsage: number; // percentage
    maxDataSize: number; // bytes
    warningThreshold: number; // percentage of max
    criticalThreshold: number; // percentage of max
}

/**
 * Performance optimization configuration
 */
export interface PerformanceConfig {
    enableMetrics: boolean;
    enableDynamicThrottling: boolean;
    enableMemoryMonitoring: boolean;
    enableCpuMonitoring: boolean;
    metricsRetentionTime: number; // milliseconds
    samplingRate: number; // 0-1, percentage of operations to sample
    thresholds: PerformanceThresholds;
}

/**
 * Performance alert levels
 */
export enum PerformanceAlertLevel {
    INFO = 'info',
    WARNING = 'warning',
    CRITICAL = 'critical'
}

/**
 * Performance alert interface
 */
export interface PerformanceAlert {
    level: PerformanceAlertLevel;
    metric: string;
    value: number;
    threshold: number;
    timestamp: Date;
    component: string;
    message: string;
}

/**
 * Performance optimization action
 */
export interface OptimizationAction {
    type: 'throttle' | 'reduce_quality' | 'disable_feature' | 'cleanup_memory';
    component: string;
    parameter: string;
    oldValue: any;
    newValue: any;
    timestamp: Date;
    reason: string;
}

/**
 * Performance monitoring callback
 */
export type PerformanceCallback = (alert: PerformanceAlert) => void;

/**
 * Comprehensive performance monitor for monitoring components
 */
export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private config: PerformanceConfig;
    private metrics: Map<string, PerformanceMetrics[]> = new Map();
    private alerts: PerformanceAlert[] = [];
    private optimizationActions: OptimizationAction[] = [];
    private callbacks: Map<PerformanceAlertLevel, PerformanceCallback[]> = new Map();
    private cleanupInterval: NodeJS.Timeout | null = null;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private isMonitoring: boolean = false;

    // Performance tracking
    private operationTimers: Map<string, number> = new Map();
    private memoryBaseline: number = 0;
    private lastCleanup: Date = new Date();

    private constructor(config?: Partial<PerformanceConfig>) {
        this.config = {
            enableMetrics: true,
            enableDynamicThrottling: true,
            enableMemoryMonitoring: true,
            enableCpuMonitoring: false, // CPU monitoring is limited in browsers
            metricsRetentionTime: 3600000, // 1 hour
            samplingRate: 0.1, // Sample 10% of operations
            thresholds: {
                maxResponseTime: 1000, // 1 second
                maxMemoryUsage: 80, // 80%
                maxCpuUsage: 70, // 70%
                maxDataSize: 10485760, // 10MB
                warningThreshold: 70, // 70% of max
                criticalThreshold: 90 // 90% of max
            },
            ...config
        };

        this.initializeMonitoring();
    }

    /**
     * Get singleton instance
     */
    static getInstance(config?: Partial<PerformanceConfig>): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor(config);
        }
        return PerformanceMonitor.instance;
    }

    /**
     * Reset singleton instance (for testing)
     */
    static resetInstance(): void {
        if (PerformanceMonitor.instance) {
            PerformanceMonitor.instance.stopMonitoring();
        }
        PerformanceMonitor.instance = undefined as any;
    }

    /**
     * Start performance monitoring
     */
    startMonitoring(): void {
        if (this.isMonitoring) {
            return;
        }

        this.isMonitoring = true;
        this.memoryBaseline = this.getCurrentMemoryUsage()?.used || 0;

        // Start periodic monitoring
        this.monitoringInterval = setInterval(() => {
            this.performPeriodicCheck();
        }, 30000); // Check every 30 seconds

        // Start cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldMetrics();
        }, 300000); // Cleanup every 5 minutes

        console.log('Performance monitoring started');
    }

    /**
     * Stop performance monitoring
     */
    stopMonitoring(): void {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        console.log('Performance monitoring stopped');
    }

    /**
     * Start timing an operation
     */
    startTimer(operationId: string): void {
        if (!this.config.enableMetrics || !this.shouldSample()) {
            return;
        }

        this.operationTimers.set(operationId, performance.now());
    }

    /**
     * End timing an operation and record metrics
     */
    endTimer(
        operationId: string,
        component: string,
        dataSize: number = 0,
        cacheHit: boolean = false
    ): PerformanceMetrics | null {
        if (!this.config.enableMetrics || !this.operationTimers.has(operationId)) {
            return null;
        }

        const startTime = this.operationTimers.get(operationId)!;
        const endTime = performance.now();
        const processingTime = endTime - startTime;

        this.operationTimers.delete(operationId);

        const metrics: PerformanceMetrics = {
            responseTime: processingTime,
            dataSize,
            cacheHit,
            processingTime,
            memoryUsage: this.getCurrentMemoryUsage(),
            timestamp: new Date()
        };

        this.recordMetrics(component, metrics);
        this.checkThresholds(component, metrics);

        return metrics;
    }

    /**
     * Record performance metrics for a component
     */
    recordMetrics(component: string, metrics: PerformanceMetrics): void {
        if (!this.config.enableMetrics) {
            return;
        }

        if (!this.metrics.has(component)) {
            this.metrics.set(component, []);
        }

        const componentMetrics = this.metrics.get(component)!;
        componentMetrics.push(metrics);

        // Keep only recent metrics
        const cutoff = Date.now() - this.config.metricsRetentionTime;
        const filteredMetrics = componentMetrics.filter(m => m.timestamp.getTime() > cutoff);
        this.metrics.set(component, filteredMetrics);
    }

    /**
     * Get performance statistics for a component
     */
    getComponentStats(component: string): {
        averageResponseTime: number;
        maxResponseTime: number;
        minResponseTime: number;
        averageDataSize: number;
        cacheHitRate: number;
        totalOperations: number;
        memoryTrend: 'increasing' | 'decreasing' | 'stable';
    } | null {
        const componentMetrics = this.metrics.get(component);
        if (!componentMetrics || componentMetrics.length === 0) {
            return null;
        }

        const responseTimes = componentMetrics.map(m => m.responseTime);
        const dataSizes = componentMetrics.map(m => m.dataSize);
        const cacheHits = componentMetrics.filter(m => m.cacheHit).length;

        // Calculate memory trend
        const memoryTrend = this.calculateMemoryTrend(componentMetrics);

        return {
            averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
            maxResponseTime: Math.max(...responseTimes),
            minResponseTime: Math.min(...responseTimes),
            averageDataSize: dataSizes.reduce((a, b) => a + b, 0) / dataSizes.length,
            cacheHitRate: (cacheHits / componentMetrics.length) * 100,
            totalOperations: componentMetrics.length,
            memoryTrend
        };
    }

    /**
     * Get overall system performance statistics
     */
    getSystemStats(): {
        totalComponents: number;
        totalOperations: number;
        averageResponseTime: number;
        memoryUsage: MemoryUsage | null;
        activeAlerts: number;
        optimizationActions: number;
        performanceScore: number;
    } {
        const allMetrics = Array.from(this.metrics.values()).flat();
        const totalOperations = allMetrics.length;
        const averageResponseTime = totalOperations > 0
            ? allMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalOperations
            : 0;

        const activeAlerts = this.alerts.filter(a =>
            Date.now() - a.timestamp.getTime() < 300000 // Last 5 minutes
        ).length;

        const performanceScore = this.calculatePerformanceScore();

        return {
            totalComponents: this.metrics.size,
            totalOperations,
            averageResponseTime,
            memoryUsage: this.getCurrentMemoryUsage(),
            activeAlerts,
            optimizationActions: this.optimizationActions.length,
            performanceScore
        };
    }

    /**
     * Get current memory usage
     */
    getCurrentMemoryUsage(): MemoryUsage | null {
        if (!this.config.enableMemoryMonitoring) {
            return null;
        }

        try {
            // Use performance.memory if available (Chrome)
            if ('memory' in performance) {
                const memory = (performance as any).memory;
                return {
                    used: memory.usedJSHeapSize,
                    total: memory.totalJSHeapSize,
                    percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
                    heapUsed: memory.usedJSHeapSize,
                    heapTotal: memory.totalJSHeapSize
                };
            }

            // Fallback estimation based on object count and size
            return this.estimateMemoryUsage();
        } catch (error) {
            console.warn('Failed to get memory usage:', error);
            return null;
        }
    }

    /**
     * Check if current operation should trigger throttling
     */
    shouldThrottle(component: string): boolean {
        if (!this.config.enableDynamicThrottling) {
            return false;
        }

        const stats = this.getComponentStats(component);
        if (!stats) {
            return false;
        }

        // Check if response time exceeds threshold
        if (stats.averageResponseTime > this.config.thresholds.maxResponseTime) {
            return true;
        }

        // Check memory usage
        const memoryUsage = this.getCurrentMemoryUsage();
        if (memoryUsage && memoryUsage.percentage > this.config.thresholds.maxMemoryUsage) {
            return true;
        }

        return false;
    }

    /**
     * Get recommended throttle delay for component
     */
    getThrottleDelay(component: string): number {
        const stats = this.getComponentStats(component);
        if (!stats) {
            return 0;
        }

        let delay = 0;

        // Base delay on response time
        if (stats.averageResponseTime > this.config.thresholds.maxResponseTime) {
            const factor = stats.averageResponseTime / this.config.thresholds.maxResponseTime;
            delay = Math.min(1000, 100 * factor); // Max 1 second delay
        }

        // Increase delay based on memory usage
        const memoryUsage = this.getCurrentMemoryUsage();
        if (memoryUsage && memoryUsage.percentage > this.config.thresholds.maxMemoryUsage) {
            const memoryFactor = memoryUsage.percentage / this.config.thresholds.maxMemoryUsage;
            delay += Math.min(500, 50 * memoryFactor);
        }

        return Math.round(delay);
    }

    /**
     * Trigger memory cleanup
     */
    triggerMemoryCleanup(): void {
        try {
            // Clean up old metrics
            this.cleanupOldMetrics();

            // Clean up old alerts
            const cutoff = Date.now() - 3600000; // 1 hour
            this.alerts = this.alerts.filter(a => a.timestamp.getTime() > cutoff);

            // Clean up old optimization actions
            this.optimizationActions = this.optimizationActions.filter(
                a => a.timestamp.getTime() > cutoff
            );

            // Force garbage collection if available
            if ('gc' in window && typeof (window as any).gc === 'function') {
                (window as any).gc();
            }

            this.lastCleanup = new Date();
            console.log('Memory cleanup completed');
        } catch (error) {
            console.error('Memory cleanup failed:', error);
        }
    }

    /**
     * Register performance callback
     */
    onPerformanceAlert(level: PerformanceAlertLevel, callback: PerformanceCallback): void {
        if (!this.callbacks.has(level)) {
            this.callbacks.set(level, []);
        }
        this.callbacks.get(level)!.push(callback);
    }

    /**
     * Get recent performance alerts
     */
    getRecentAlerts(timeWindow: number = 300000): PerformanceAlert[] {
        const cutoff = Date.now() - timeWindow;
        return this.alerts.filter(a => a.timestamp.getTime() > cutoff);
    }

    /**
     * Get optimization actions history
     */
    getOptimizationHistory(timeWindow: number = 3600000): OptimizationAction[] {
        const cutoff = Date.now() - timeWindow;
        return this.optimizationActions.filter(a => a.timestamp.getTime() > cutoff);
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<PerformanceConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current configuration
     */
    getConfig(): PerformanceConfig {
        return { ...this.config };
    }

    /**
     * Private methods
     */

    private initializeMonitoring(): void {
        // Initialize callback maps
        Object.values(PerformanceAlertLevel).forEach(level => {
            this.callbacks.set(level, []);
        });
    }

    private shouldSample(): boolean {
        return Math.random() < this.config.samplingRate;
    }

    private checkThresholds(component: string, metrics: PerformanceMetrics): void {
        const thresholds = this.config.thresholds;

        // Check response time
        if (metrics.responseTime > thresholds.maxResponseTime * (thresholds.criticalThreshold / 100)) {
            this.createAlert(
                PerformanceAlertLevel.CRITICAL,
                'responseTime',
                metrics.responseTime,
                thresholds.maxResponseTime,
                component,
                `Response time critically high: ${metrics.responseTime.toFixed(2)}ms`
            );
        } else if (metrics.responseTime > thresholds.maxResponseTime * (thresholds.warningThreshold / 100)) {
            this.createAlert(
                PerformanceAlertLevel.WARNING,
                'responseTime',
                metrics.responseTime,
                thresholds.maxResponseTime,
                component,
                `Response time elevated: ${metrics.responseTime.toFixed(2)}ms`
            );
        }

        // Check data size
        if (metrics.dataSize > thresholds.maxDataSize * (thresholds.criticalThreshold / 100)) {
            this.createAlert(
                PerformanceAlertLevel.CRITICAL,
                'dataSize',
                metrics.dataSize,
                thresholds.maxDataSize,
                component,
                `Data size critically large: ${(metrics.dataSize / 1024 / 1024).toFixed(2)}MB`
            );
        }

        // Check memory usage
        if (metrics.memoryUsage) {
            if (metrics.memoryUsage.percentage > thresholds.maxMemoryUsage * (thresholds.criticalThreshold / 100)) {
                this.createAlert(
                    PerformanceAlertLevel.CRITICAL,
                    'memoryUsage',
                    metrics.memoryUsage.percentage,
                    thresholds.maxMemoryUsage,
                    component,
                    `Memory usage critically high: ${metrics.memoryUsage.percentage.toFixed(1)}%`
                );
            } else if (metrics.memoryUsage.percentage > thresholds.maxMemoryUsage * (thresholds.warningThreshold / 100)) {
                this.createAlert(
                    PerformanceAlertLevel.WARNING,
                    'memoryUsage',
                    metrics.memoryUsage.percentage,
                    thresholds.maxMemoryUsage,
                    component,
                    `Memory usage elevated: ${metrics.memoryUsage.percentage.toFixed(1)}%`
                );
            }
        }
    }

    private createAlert(
        level: PerformanceAlertLevel,
        metric: string,
        value: number,
        threshold: number,
        component: string,
        message: string
    ): void {
        const alert: PerformanceAlert = {
            level,
            metric,
            value,
            threshold,
            timestamp: new Date(),
            component,
            message
        };

        this.alerts.push(alert);

        // Notify callbacks
        const callbacks = this.callbacks.get(level);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(alert);
                } catch (error) {
                    console.error('Performance callback error:', error);
                }
            });
        }

        // Log alert
        const logLevel = level === PerformanceAlertLevel.CRITICAL ? 'error' :
            level === PerformanceAlertLevel.WARNING ? 'warn' : 'info';
        console[logLevel](`Performance Alert [${level.toUpperCase()}]: ${message}`);
    }

    private performPeriodicCheck(): void {
        if (!this.isMonitoring) {
            return;
        }

        try {
            // Check overall system performance
            const memoryUsage = this.getCurrentMemoryUsage();
            if (memoryUsage && memoryUsage.percentage > this.config.thresholds.maxMemoryUsage) {
                this.triggerMemoryCleanup();
            }

            // Check if any components need optimization
            for (const [component, metrics] of this.metrics.entries()) {
                if (metrics.length > 0) {
                    const stats = this.getComponentStats(component);
                    if (stats && this.shouldOptimize(stats)) {
                        this.applyOptimization(component, stats);
                    }
                }
            }
        } catch (error) {
            console.error('Periodic performance check failed:', error);
        }
    }

    private shouldOptimize(stats: any): boolean {
        return stats.averageResponseTime > this.config.thresholds.maxResponseTime ||
            stats.memoryTrend === 'increasing';
    }

    private applyOptimization(component: string, stats: any): void {
        // This is a placeholder for component-specific optimization
        // In practice, this would call specific optimization methods on components

        const action: OptimizationAction = {
            type: 'throttle',
            component,
            parameter: 'processingInterval',
            oldValue: 100,
            newValue: 200,
            timestamp: new Date(),
            reason: `High response time: ${stats.averageResponseTime.toFixed(2)}ms`
        };

        this.optimizationActions.push(action);
        console.log(`Applied optimization to ${component}: ${action.reason}`);
    }

    private calculateMemoryTrend(metrics: PerformanceMetrics[]): 'increasing' | 'decreasing' | 'stable' {
        if (metrics.length < 2) {
            return 'stable';
        }

        const recentMetrics = metrics.slice(-10); // Last 10 measurements
        const memoryValues = recentMetrics
            .map(m => m.memoryUsage?.used || 0)
            .filter(v => v > 0);

        if (memoryValues.length < 2) {
            return 'stable';
        }

        const first = memoryValues[0];
        const last = memoryValues[memoryValues.length - 1];
        const change = (last - first) / first;

        if (change > 0.1) return 'increasing'; // 10% increase
        if (change < -0.1) return 'decreasing'; // 10% decrease
        return 'stable';
    }

    private calculatePerformanceScore(): number {
        // Avoid circular dependency by calculating stats inline
        const allMetrics = Array.from(this.metrics.values()).flat();
        const totalOperations = allMetrics.length;
        const averageResponseTime = totalOperations > 0
            ? allMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalOperations
            : 0;

        const activeAlerts = this.alerts.filter(a =>
            Date.now() - a.timestamp.getTime() < 300000 // Last 5 minutes
        ).length;

        let score = 100;

        // Deduct points for high response times
        if (averageResponseTime > this.config.thresholds.maxResponseTime) {
            const factor = averageResponseTime / this.config.thresholds.maxResponseTime;
            score -= Math.min(30, 10 * factor);
        }

        // Deduct points for high memory usage
        const memoryUsage = this.getCurrentMemoryUsage();
        if (memoryUsage) {
            const memoryFactor = memoryUsage.percentage / this.config.thresholds.maxMemoryUsage;
            if (memoryFactor > 1) {
                score -= Math.min(30, 15 * memoryFactor);
            }
        }

        // Deduct points for active alerts
        score -= Math.min(20, activeAlerts * 2);

        return Math.max(0, Math.round(score));
    }

    private estimateMemoryUsage(): MemoryUsage {
        // Rough estimation based on metrics and data structures
        const estimatedUsed = this.metrics.size * 1000 + this.alerts.length * 500;
        const estimatedTotal = estimatedUsed * 2; // Assume 50% usage

        return {
            used: estimatedUsed,
            total: estimatedTotal,
            percentage: (estimatedUsed / estimatedTotal) * 100
        };
    }

    private cleanupOldMetrics(): void {
        const cutoff = Date.now() - this.config.metricsRetentionTime;

        for (const [component, metrics] of this.metrics.entries()) {
            const filteredMetrics = metrics.filter(m => m.timestamp.getTime() > cutoff);
            this.metrics.set(component, filteredMetrics);
        }
    }
}

/**
 * Performance monitoring decorator
 */
export function withPerformanceMonitoring(component: string) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const performanceMonitor = PerformanceMonitor.getInstance();
            const operationId = `${component}_${propertyName}_${Date.now()}`;

            performanceMonitor.startTimer(operationId);

            try {
                const result = await method.apply(this, args);

                // Estimate data size if result is serializable
                let dataSize = 0;
                try {
                    if (result && typeof result === 'object') {
                        dataSize = JSON.stringify(result).length;
                    }
                } catch (e) {
                    // Ignore serialization errors
                }

                performanceMonitor.endTimer(operationId, component, dataSize);
                return result;
            } catch (error) {
                performanceMonitor.endTimer(operationId, component, 0);
                throw error;
            }
        };

        return descriptor;
    };
}

/**
 * Throttling utility based on performance metrics
 */
export class AdaptiveThrottler {
    private lastExecution: Map<string, number> = new Map();
    private performanceMonitor: PerformanceMonitor;

    constructor() {
        this.performanceMonitor = PerformanceMonitor.getInstance();
    }

    /**
     * Check if operation should be throttled
     */
    shouldThrottle(operationId: string, component: string): boolean {
        const now = Date.now();
        const lastTime = this.lastExecution.get(operationId) || 0;
        const delay = this.performanceMonitor.getThrottleDelay(component);

        return (now - lastTime) < delay;
    }

    /**
     * Execute operation with adaptive throttling
     */
    async execute<T>(
        operationId: string,
        component: string,
        operation: () => Promise<T>
    ): Promise<T> {
        if (this.shouldThrottle(operationId, component)) {
            const delay = this.performanceMonitor.getThrottleDelay(component);
            const lastTime = this.lastExecution.get(operationId) || 0;
            const waitTime = delay - (Date.now() - lastTime);

            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        this.lastExecution.set(operationId, Date.now());
        return await operation();
    }

    /**
     * Reset throttling for operation
     */
    reset(operationId: string): void {
        this.lastExecution.delete(operationId);
    }

    /**
     * Clear all throttling state
     */
    clear(): void {
        this.lastExecution.clear();
    }
}