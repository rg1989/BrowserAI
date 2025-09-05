/**
 * Error handling utilities for monitoring components
 * Provides centralized error management, recovery strategies, and graceful degradation
 */

/**
 * Error severity levels
 */
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * Error categories for monitoring components
 */
export enum ErrorCategory {
    NETWORK = 'network',
    DOM = 'dom',
    STORAGE = 'storage',
    CONTEXT = 'context',
    PRIVACY = 'privacy',
    PERFORMANCE = 'performance',
    PLUGIN = 'plugin',
    UNKNOWN = 'unknown'
}

/**
 * Recovery strategy types
 */
export enum RecoveryStrategy {
    RETRY = 'retry',
    FALLBACK = 'fallback',
    GRACEFUL_DEGRADATION = 'graceful_degradation',
    RESTART_COMPONENT = 'restart_component',
    DISABLE_FEATURE = 'disable_feature',
    NO_ACTION = 'no_action'
}

/**
 * Monitoring error interface
 */
export interface MonitoringError {
    id: string;
    timestamp: Date;
    category: ErrorCategory;
    severity: ErrorSeverity;
    message: string;
    originalError?: Error;
    component: string;
    context?: Record<string, any>;
    recoveryStrategy: RecoveryStrategy;
    retryCount: number;
    maxRetries: number;
    resolved: boolean;
}

/**
 * Error recovery configuration
 */
export interface ErrorRecoveryConfig {
    maxRetries: number;
    retryDelay: number;
    exponentialBackoff: boolean;
    fallbackEnabled: boolean;
    gracefulDegradation: boolean;
    autoRestart: boolean;
    errorThreshold: number;
    timeWindow: number; // milliseconds
}

/**
 * Error handler callback
 */
export type ErrorHandlerCallback = (error: MonitoringError) => void;

/**
 * Centralized error handler for monitoring components
 */
export class ErrorHandler {
    private static instance: ErrorHandler;
    private errors: Map<string, MonitoringError> = new Map();
    private errorCallbacks: Map<ErrorCategory, ErrorHandlerCallback[]> = new Map();
    private config: ErrorRecoveryConfig;
    private errorCounts: Map<string, { count: number; firstError: Date }> = new Map();

    private constructor(config?: Partial<ErrorRecoveryConfig>) {
        this.config = {
            maxRetries: 3,
            retryDelay: 1000,
            exponentialBackoff: true,
            fallbackEnabled: true,
            gracefulDegradation: true,
            autoRestart: false,
            errorThreshold: 5,
            timeWindow: 300000, // 5 minutes
            ...config
        };
    }

    /**
     * Get singleton instance
     */
    static getInstance(config?: Partial<ErrorRecoveryConfig>): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler(config);
        }
        return ErrorHandler.instance;
    }

    /**
     * Handle an error with automatic recovery
     */
    async handleError(
        category: ErrorCategory,
        severity: ErrorSeverity,
        message: string,
        component: string,
        originalError?: Error,
        context?: Record<string, any>
    ): Promise<MonitoringError> {
        const errorId = this.generateErrorId();
        const recoveryStrategy = this.determineRecoveryStrategy(category, severity);

        const monitoringError: MonitoringError = {
            id: errorId,
            timestamp: new Date(),
            category,
            severity,
            message,
            originalError,
            component,
            context,
            recoveryStrategy,
            retryCount: 0,
            maxRetries: this.config.maxRetries,
            resolved: false
        };

        this.errors.set(errorId, monitoringError);
        this.updateErrorCounts(component);

        // Log error
        this.logError(monitoringError);

        // Execute recovery strategy
        await this.executeRecoveryStrategy(monitoringError);

        // Notify callbacks
        this.notifyErrorCallbacks(monitoringError);

        return monitoringError;
    }

    /**
     * Retry a failed operation
     */
    async retryOperation<T>(
        operation: () => Promise<T>,
        errorId: string,
        context?: Record<string, any>
    ): Promise<T> {
        const error = this.errors.get(errorId);
        if (!error) {
            throw new Error(`Error ${errorId} not found`);
        }

        if (error.retryCount >= error.maxRetries) {
            throw new Error(`Max retries exceeded for error ${errorId}`);
        }

        error.retryCount++;

        try {
            // Calculate delay with exponential backoff
            const delay = this.config.exponentialBackoff
                ? this.config.retryDelay * Math.pow(2, error.retryCount - 1)
                : this.config.retryDelay;

            await this.sleep(delay);

            const result = await operation();

            // Mark error as resolved
            error.resolved = true;
            this.logRecovery(error);

            return result;
        } catch (retryError) {
            error.context = { ...error.context, ...context, retryError: retryError.message };

            if (error.retryCount >= error.maxRetries) {
                await this.handleMaxRetriesExceeded(error);
            }

            throw retryError;
        }
    }

    /**
     * Check if component should be disabled due to too many errors
     */
    shouldDisableComponent(component: string): boolean {
        const errorData = this.errorCounts.get(component);
        if (!errorData) return false;

        const now = new Date();
        const timeSinceFirstError = now.getTime() - errorData.firstError.getTime();

        return errorData.count >= this.config.errorThreshold &&
            timeSinceFirstError <= this.config.timeWindow;
    }

    /**
     * Reset error count for a component
     */
    resetErrorCount(component: string): void {
        this.errorCounts.delete(component);
    }

    /**
     * Get error statistics
     */
    getErrorStatistics(): {
        totalErrors: number;
        errorsByCategory: Record<ErrorCategory, number>;
        errorsBySeverity: Record<ErrorSeverity, number>;
        resolvedErrors: number;
        activeErrors: number;
    } {
        const errors = Array.from(this.errors.values());

        const errorsByCategory = {} as Record<ErrorCategory, number>;
        const errorsBySeverity = {} as Record<ErrorSeverity, number>;

        errors.forEach(error => {
            errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
            errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
        });

        return {
            totalErrors: errors.length,
            errorsByCategory,
            errorsBySeverity,
            resolvedErrors: errors.filter(e => e.resolved).length,
            activeErrors: errors.filter(e => !e.resolved).length
        };
    }

    /**
     * Register error callback
     */
    onError(category: ErrorCategory, callback: ErrorHandlerCallback): void {
        if (!this.errorCallbacks.has(category)) {
            this.errorCallbacks.set(category, []);
        }
        this.errorCallbacks.get(category)!.push(callback);
    }

    /**
     * Clear resolved errors older than specified time
     */
    cleanupResolvedErrors(maxAge: number = 3600000): void { // 1 hour default
        const cutoff = new Date(Date.now() - maxAge);

        for (const [id, error] of this.errors.entries()) {
            if (error.resolved && error.timestamp < cutoff) {
                this.errors.delete(id);
            }
        }
    }

    /**
     * Get recent errors for a component
     */
    getRecentErrors(component: string, timeWindow: number = 300000): MonitoringError[] {
        const cutoff = new Date(Date.now() - timeWindow);

        return Array.from(this.errors.values())
            .filter(error => error.component === component && error.timestamp >= cutoff)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    private generateErrorId(): string {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private determineRecoveryStrategy(category: ErrorCategory, severity: ErrorSeverity): RecoveryStrategy {
        // Critical errors require immediate action
        if (severity === ErrorSeverity.CRITICAL) {
            return RecoveryStrategy.RESTART_COMPONENT;
        }

        // Category-specific strategies
        switch (category) {
            case ErrorCategory.NETWORK:
                return RecoveryStrategy.RETRY;
            case ErrorCategory.DOM:
                return RecoveryStrategy.GRACEFUL_DEGRADATION;
            case ErrorCategory.STORAGE:
                return RecoveryStrategy.FALLBACK;
            case ErrorCategory.CONTEXT:
                return RecoveryStrategy.GRACEFUL_DEGRADATION;
            case ErrorCategory.PRIVACY:
                return RecoveryStrategy.DISABLE_FEATURE;
            case ErrorCategory.PERFORMANCE:
                return RecoveryStrategy.GRACEFUL_DEGRADATION;
            case ErrorCategory.PLUGIN:
                return RecoveryStrategy.FALLBACK;
            default:
                return RecoveryStrategy.RETRY;
        }
    }

    private async executeRecoveryStrategy(error: MonitoringError): Promise<void> {
        switch (error.recoveryStrategy) {
            case RecoveryStrategy.RETRY:
                // Retry will be handled by the component calling retryOperation
                break;
            case RecoveryStrategy.FALLBACK:
                await this.executeFallback(error);
                break;
            case RecoveryStrategy.GRACEFUL_DEGRADATION:
                await this.executeGracefulDegradation(error);
                break;
            case RecoveryStrategy.RESTART_COMPONENT:
                await this.executeComponentRestart(error);
                break;
            case RecoveryStrategy.DISABLE_FEATURE:
                await this.executeFeatureDisable(error);
                break;
            case RecoveryStrategy.NO_ACTION:
            default:
                // No automatic recovery action
                break;
        }
    }

    private async executeFallback(error: MonitoringError): Promise<void> {
        console.warn(`Executing fallback for ${error.component}: ${error.message}`);
        // Fallback implementation will be component-specific
        // This is a placeholder for the strategy
    }

    private async executeGracefulDegradation(error: MonitoringError): Promise<void> {
        console.warn(`Graceful degradation for ${error.component}: ${error.message}`);
        // Graceful degradation will reduce functionality but keep core features working
    }

    private async executeComponentRestart(error: MonitoringError): Promise<void> {
        console.warn(`Component restart required for ${error.component}: ${error.message}`);
        // Component restart will be handled by the monitoring system
    }

    private async executeFeatureDisable(error: MonitoringError): Promise<void> {
        console.warn(`Disabling feature in ${error.component}: ${error.message}`);
        // Feature disable will be handled by the component
    }

    private async handleMaxRetriesExceeded(error: MonitoringError): Promise<void> {
        console.error(`Max retries exceeded for ${error.component}: ${error.message}`);

        // Escalate to next recovery strategy
        if (error.recoveryStrategy === RecoveryStrategy.RETRY) {
            error.recoveryStrategy = RecoveryStrategy.GRACEFUL_DEGRADATION;
            await this.executeRecoveryStrategy(error);
        }
    }

    private updateErrorCounts(component: string): void {
        const existing = this.errorCounts.get(component);

        if (existing) {
            existing.count++;
        } else {
            this.errorCounts.set(component, {
                count: 1,
                firstError: new Date()
            });
        }
    }

    private logError(error: MonitoringError): void {
        const logLevel = this.getLogLevel(error.severity);
        const message = `[${error.category.toUpperCase()}] ${error.component}: ${error.message}`;

        switch (logLevel) {
            case 'error':
                console.error(message, error.originalError);
                break;
            case 'warn':
                console.warn(message, error.originalError);
                break;
            case 'info':
                console.info(message);
                break;
            default:
                console.log(message);
        }
    }

    private logRecovery(error: MonitoringError): void {
        console.info(`Recovered from error in ${error.component} after ${error.retryCount} retries`);
    }

    private getLogLevel(severity: ErrorSeverity): string {
        switch (severity) {
            case ErrorSeverity.CRITICAL:
            case ErrorSeverity.HIGH:
                return 'error';
            case ErrorSeverity.MEDIUM:
                return 'warn';
            case ErrorSeverity.LOW:
                return 'info';
            default:
                return 'log';
        }
    }

    private notifyErrorCallbacks(error: MonitoringError): void {
        const callbacks = this.errorCallbacks.get(error.category);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(error);
                } catch (callbackError) {
                    console.error('Error in error callback:', callbackError);
                }
            });
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ErrorRecoveryConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current configuration
     */
    getConfig(): ErrorRecoveryConfig {
        return { ...this.config };
    }
}

/**
 * Decorator for automatic error handling
 */
export function withErrorHandling(
    category: ErrorCategory,
    component: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const errorHandler = ErrorHandler.getInstance();

            try {
                return await method.apply(this, args);
            } catch (error) {
                const monitoringError = await errorHandler.handleError(
                    category,
                    severity,
                    `Error in ${propertyName}: ${error.message}`,
                    component,
                    error instanceof Error ? error : new Error(String(error)),
                    { method: propertyName, args: args.length }
                );

                // Try to recover if strategy is retry
                if (monitoringError.recoveryStrategy === RecoveryStrategy.RETRY) {
                    try {
                        return await errorHandler.retryOperation(
                            () => method.apply(this, args),
                            monitoringError.id
                        );
                    } catch (retryError) {
                        // If retry fails, re-throw the original error
                        throw error;
                    }
                }

                throw error;
            }
        };

        return descriptor;
    };
}

/**
 * Circuit breaker for preventing cascading failures
 */
export class CircuitBreaker {
    private failures: number = 0;
    private lastFailureTime: number = 0;
    private state: 'closed' | 'open' | 'half-open' = 'closed';

    constructor(
        private threshold: number = 5,
        private timeout: number = 60000, // 1 minute
        private resetTimeout: number = 30000 // 30 seconds
    ) { }

    async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.state === 'open') {
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
                this.state = 'half-open';
            } else {
                throw new Error('Circuit breaker is open');
            }
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failures = 0;
        this.state = 'closed';
    }

    private onFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.failures >= this.threshold) {
            this.state = 'open';
        }
    }

    getState(): string {
        return this.state;
    }

    reset(): void {
        this.failures = 0;
        this.state = 'closed';
        this.lastFailureTime = 0;
    }
}