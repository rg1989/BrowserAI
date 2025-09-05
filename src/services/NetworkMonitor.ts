import {
    NetworkRequest,
    NetworkResponse,
    NetworkError,
    NetworkActivity,
    RequestType,
    ErrorType,
    TimeWindow
} from '../types/monitoring';
import { CircularBuffer } from '../utils/CircularBuffer';
import { PrivacyController } from './PrivacyController';
import {
    ErrorHandler,
    ErrorCategory,
    ErrorSeverity,
    RecoveryStrategy,
    CircuitBreaker,
    withErrorHandling
} from '../utils/ErrorHandler';
import {
    PerformanceMonitor,
    PerformanceMetrics,
    PerformanceAlertLevel,
    AdaptiveThrottler,
    withPerformanceMonitoring
} from '../utils/PerformanceMonitor';

/**
 * Network monitoring service that intercepts and tracks HTTP requests and responses
 * Supports both webRequest API (background script) and fetch/XHR patching (content script)
 * Enhanced with comprehensive error handling and recovery mechanisms
 */
export class NetworkMonitor {
    private requestBuffer: CircularBuffer<NetworkRequest>;
    private responseBuffer: CircularBuffer<NetworkResponse>;
    private errorBuffer: CircularBuffer<NetworkError>;
    private privacyController: PrivacyController;
    private isMonitoring: boolean = false;
    private requestIdCounter: number = 0;
    private activeRequests: Map<string, NetworkRequest> = new Map();

    // Original functions for restoration
    private originalFetch?: typeof fetch;
    private originalXHROpen?: typeof XMLHttpRequest.prototype.open;
    private originalXHRSend?: typeof XMLHttpRequest.prototype.send;

    // Error handling and recovery
    private errorHandler: ErrorHandler;
    private circuitBreaker: CircuitBreaker;
    private isPaused: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 1000;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private lastHealthCheck: Date = new Date();
    private monitoringErrors: number = 0;
    private maxMonitoringErrors: number = 10;

    // Performance monitoring
    private performanceMonitor: PerformanceMonitor;
    private throttler: AdaptiveThrottler;
    private performanceMetrics: PerformanceMetrics[] = [];
    private lastPerformanceCheck: Date = new Date();
    private dynamicThrottleDelay: number = 0;

    constructor(
        bufferSize: number = 1000,
        privacyController: PrivacyController
    ) {
        this.requestBuffer = new CircularBuffer<NetworkRequest>(bufferSize);
        this.responseBuffer = new CircularBuffer<NetworkResponse>(bufferSize);
        this.errorBuffer = new CircularBuffer<NetworkError>(bufferSize);
        this.privacyController = privacyController;
        this.errorHandler = ErrorHandler.getInstance();
        this.circuitBreaker = new CircuitBreaker(5, 60000, 30000);
        this.performanceMonitor = PerformanceMonitor.getInstance();
        this.throttler = new AdaptiveThrottler();

        // Set up error handling and performance monitoring callbacks
        this.setupErrorHandling();
        this.setupPerformanceMonitoring();
    }

    /**
     * Start monitoring network requests with error handling
     */
    async start(): Promise<void> {
        try {
            await this.circuitBreaker.execute(async () => {
                await this.startMonitoring();
            });
        } catch (error) {
            await this.errorHandler.handleError(
                ErrorCategory.NETWORK,
                ErrorSeverity.HIGH,
                `Failed to start network monitoring: ${error.message}`,
                'NetworkMonitor',
                error instanceof Error ? error : new Error(String(error))
            );
            throw error;
        }
    }

    /**
     * Start monitoring network requests
     */
    @withErrorHandling(ErrorCategory.NETWORK, 'NetworkMonitor', ErrorSeverity.MEDIUM)
    private async startMonitoring(): Promise<void> {
        if (this.isMonitoring) {
            console.warn('NetworkMonitor is already running');
            return;
        }

        try {
            this.isMonitoring = true;
            this.isPaused = false;
            this.monitoringErrors = 0;
            this.reconnectAttempts = 0;

            await this.patchFetch();
            await this.patchXMLHttpRequest();
            this.startHealthCheck();

            console.log('NetworkMonitor started successfully');
        } catch (error) {
            this.isMonitoring = false;
            throw new Error(`Failed to start network monitoring: ${error.message}`);
        }
    }

    /**
     * Stop monitoring network requests with cleanup
     */
    async stop(): Promise<void> {
        try {
            await this.stopMonitoring();
        } catch (error) {
            await this.errorHandler.handleError(
                ErrorCategory.NETWORK,
                ErrorSeverity.MEDIUM,
                `Error stopping network monitoring: ${error.message}`,
                'NetworkMonitor',
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }

    /**
     * Stop monitoring network requests
     */
    private async stopMonitoring(): Promise<void> {
        if (!this.isMonitoring) {
            return;
        }

        try {
            this.isMonitoring = false;
            this.isPaused = false;
            this.stopHealthCheck();

            await this.restoreFetch();
            await this.restoreXMLHttpRequest();

            this.activeRequests.clear();
            this.circuitBreaker.reset();

            console.log('NetworkMonitor stopped successfully');
        } catch (error) {
            console.error('Error during NetworkMonitor shutdown:', error);
            throw error;
        }
    }

    /**
     * Pause monitoring (keeps patches but stops processing)
     */
    pause(): void {
        if (this.isMonitoring && !this.isPaused) {
            this.isPaused = true;
            console.log('NetworkMonitor paused');
        }
    }

    /**
     * Resume monitoring from paused state
     */
    resume(): void {
        if (this.isMonitoring && this.isPaused) {
            this.isPaused = false;
            console.log('NetworkMonitor resumed');
        }
    }

    /**
     * Get recent network activity within a time window
     */
    getRecentActivity(timeWindowMs: number = 60000): NetworkActivity {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - timeWindowMs);

        return {
            requests: this.requestBuffer.getInTimeWindow(startTime, endTime),
            responses: this.responseBuffer.getInTimeWindow(startTime, endTime),
            errors: this.errorBuffer.getInTimeWindow(startTime, endTime),
            timeWindow: {
                start: startTime,
                end: endTime,
                duration: timeWindowMs
            }
        };
    }

    /**
     * Get all captured network activity
     */
    getAllActivity(): NetworkActivity {
        const now = new Date();
        const requests = this.requestBuffer.getAll();
        const oldestRequest = requests[0];
        const startTime = oldestRequest ? oldestRequest.timestamp : now;

        return {
            requests,
            responses: this.responseBuffer.getAll(),
            errors: this.errorBuffer.getAll(),
            timeWindow: {
                start: startTime,
                end: now,
                duration: now.getTime() - startTime.getTime()
            }
        };
    }

    /**
     * Get network activity statistics
     */
    getStatistics(): {
        totalRequests: number;
        totalResponses: number;
        totalErrors: number;
        successRate: number;
        averageResponseTime: number;
        requestsByType: Record<RequestType, number>;
    } {
        const requests = this.requestBuffer.getAll();
        const responses = this.responseBuffer.getAll();
        const errors = this.errorBuffer.getAll();

        const requestsByType = requests.reduce((acc, req) => {
            acc[req.type] = (acc[req.type] || 0) + 1;
            return acc;
        }, {} as Record<RequestType, number>);

        // Calculate average response time
        const responseTimes: number[] = [];
        responses.forEach(response => {
            const request = requests.find(req => req.id === response.requestId);
            if (request) {
                responseTimes.push(response.timestamp.getTime() - request.timestamp.getTime());
            }
        });

        const averageResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
            : 0;

        const totalRequests = requests.length;
        const successfulResponses = responses.filter(r => r.status >= 200 && r.status < 400).length;
        const successRate = totalRequests > 0 ? (successfulResponses / totalRequests) * 100 : 0;

        return {
            totalRequests,
            totalResponses: responses.length,
            totalErrors: errors.length,
            successRate,
            averageResponseTime,
            requestsByType
        };
    }

    /**
     * Clear all captured network data
     */
    clearData(): void {
        this.requestBuffer.clear();
        this.responseBuffer.clear();
        this.errorBuffer.clear();
        this.activeRequests.clear();
    }

    /**
     * Check if monitoring is currently active
     */
    isActive(): boolean {
        return this.isMonitoring && !this.isPaused;
    }

    /**
     * Get monitoring health status
     */
    getHealthStatus(): {
        isActive: boolean;
        isPaused: boolean;
        circuitBreakerState: string;
        errorCount: number;
        lastHealthCheck: Date;
        reconnectAttempts: number;
    } {
        return {
            isActive: this.isMonitoring,
            isPaused: this.isPaused,
            circuitBreakerState: this.circuitBreaker.getState(),
            errorCount: this.monitoringErrors,
            lastHealthCheck: this.lastHealthCheck,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    /**
     * Attempt to recover from errors
     */
    async recover(): Promise<boolean> {
        try {
            if (this.errorHandler.shouldDisableComponent('NetworkMonitor')) {
                console.warn('NetworkMonitor disabled due to too many errors');
                return false;
            }

            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error('Max reconnection attempts reached');
                return false;
            }

            this.reconnectAttempts++;

            // Stop current monitoring
            await this.stopMonitoring();

            // Wait before reconnecting
            await this.sleep(this.reconnectDelay * this.reconnectAttempts);

            // Restart monitoring
            await this.startMonitoring();

            console.log(`NetworkMonitor recovered after ${this.reconnectAttempts} attempts`);
            return true;
        } catch (error) {
            await this.errorHandler.handleError(
                ErrorCategory.NETWORK,
                ErrorSeverity.HIGH,
                `Recovery failed: ${error.message}`,
                'NetworkMonitor',
                error instanceof Error ? error : new Error(String(error))
            );
            return false;
        }
    }

    private generateRequestId(): string {
        return `req_${++this.requestIdCounter}_${Date.now()}`;
    }

    private patchFetch(): void {
        if (typeof window === 'undefined' || !window.fetch) {
            return;
        }

        this.originalFetch = window.fetch;
        const self = this;

        window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

            // Check if URL should be monitored
            if (!self.privacyController.shouldMonitorUrl(url)) {
                return self.originalFetch!.call(this, input, init);
            }

            const requestId = self.generateRequestId();
            const timestamp = new Date();

            // Create request record
            const request: NetworkRequest = {
                id: requestId,
                url: self.privacyController.sanitizeNetworkData({ url }).url,
                method: init?.method || 'GET',
                headers: self.sanitizeHeaders(init?.headers),
                body: init?.body ? self.privacyController.sanitizeNetworkData({
                    url,
                    body: typeof init.body === 'string' ? init.body : '[Binary Data]'
                }).body : undefined,
                timestamp,
                initiator: 'fetch',
                type: RequestType.FETCH
            };

            self.requestBuffer.push(request);
            self.activeRequests.set(requestId, request);
            self.privacyController.logDataCollection('network-request', url);

            try {
                const response = await self.originalFetch!.call(this, input, init);

                // Create response record
                const responseHeaders: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    responseHeaders[key] = value;
                });

                // Clone response to read body without consuming it
                const responseClone = response.clone();
                let responseBody: string | undefined;

                try {
                    const contentType = response.headers.get('content-type') || '';
                    if (contentType.includes('application/json') || contentType.includes('text/')) {
                        responseBody = await responseClone.text();
                        responseBody = self.privacyController.sanitizeNetworkData({
                            url,
                            body: responseBody
                        }).body;
                    }
                } catch (bodyError) {
                    // Ignore body reading errors
                }

                const networkResponse: NetworkResponse = {
                    requestId,
                    status: response.status,
                    statusText: response.statusText,
                    headers: self.privacyController.sanitizeNetworkData({
                        url,
                        headers: responseHeaders
                    }).headers || {},
                    body: responseBody,
                    timestamp: new Date(),
                    size: parseInt(response.headers.get('content-length') || '0', 10)
                };

                self.responseBuffer.push(networkResponse);
                self.activeRequests.delete(requestId);

                return response;
            } catch (error) {
                // Create error record
                const networkError: NetworkError = {
                    requestId,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date(),
                    type: self.categorizeError(error)
                };

                self.errorBuffer.push(networkError);
                self.activeRequests.delete(requestId);

                throw error;
            }
        };
    }

    private patchXMLHttpRequest(): void {
        if (typeof window === 'undefined' || !window.XMLHttpRequest) {
            return;
        }

        const self = this;
        this.originalXHROpen = XMLHttpRequest.prototype.open;
        this.originalXHRSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (
            method: string,
            url: string | URL,
            async?: boolean,
            username?: string | null,
            password?: string | null
        ) {
            const urlString = typeof url === 'string' ? url : url.href;

            // Store request info on XHR instance
            (this as any)._monitoringData = {
                method,
                url: urlString,
                requestId: self.generateRequestId(),
                timestamp: new Date()
            };

            return self.originalXHROpen!.call(this, method, url, async, username, password);
        };

        XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
            const monitoringData = (this as any)._monitoringData;

            if (!monitoringData || !self.privacyController.shouldMonitorUrl(monitoringData.url)) {
                return self.originalXHRSend!.call(this, body);
            }

            // Create request record
            const request: NetworkRequest = {
                id: monitoringData.requestId,
                url: self.privacyController.sanitizeNetworkData({ url: monitoringData.url }).url,
                method: monitoringData.method,
                headers: self.getXHRHeaders(this),
                body: body ? self.privacyController.sanitizeNetworkData({
                    url: monitoringData.url,
                    body: typeof body === 'string' ? body : '[Binary Data]'
                }).body : undefined,
                timestamp: monitoringData.timestamp,
                initiator: 'xhr',
                type: RequestType.XHR
            };

            self.requestBuffer.push(request);
            self.activeRequests.set(monitoringData.requestId, request);
            self.privacyController.logDataCollection('network-request', monitoringData.url);

            // Set up response/error handlers
            const originalOnReadyStateChange = this.onreadystatechange;

            this.onreadystatechange = function () {
                if (this.readyState === XMLHttpRequest.DONE) {
                    if (this.status >= 200) {
                        // Create response record
                        const responseHeaders = self.parseXHRResponseHeaders(this.getAllResponseHeaders());

                        const networkResponse: NetworkResponse = {
                            requestId: monitoringData.requestId,
                            status: this.status,
                            statusText: this.statusText,
                            headers: self.privacyController.sanitizeNetworkData({
                                url: monitoringData.url,
                                headers: responseHeaders
                            }).headers || {},
                            body: this.responseText ? self.privacyController.sanitizeNetworkData({
                                url: monitoringData.url,
                                body: this.responseText
                            }).body : undefined,
                            timestamp: new Date(),
                            size: this.responseText ? this.responseText.length : 0
                        };

                        self.responseBuffer.push(networkResponse);
                    } else {
                        // Create error record
                        const networkError: NetworkError = {
                            requestId: monitoringData.requestId,
                            error: `HTTP ${this.status}: ${this.statusText}`,
                            timestamp: new Date(),
                            type: ErrorType.NETWORK
                        };

                        self.errorBuffer.push(networkError);
                    }

                    self.activeRequests.delete(monitoringData.requestId);
                }

                if (originalOnReadyStateChange) {
                    originalOnReadyStateChange.call(this);
                }
            };

            return self.originalXHRSend!.call(this, body);
        };
    }

    private restoreFetch(): void {
        if (this.originalFetch && typeof window !== 'undefined') {
            window.fetch = this.originalFetch;
            this.originalFetch = undefined;
        }
    }

    private restoreXMLHttpRequest(): void {
        if (this.originalXHROpen && this.originalXHRSend) {
            XMLHttpRequest.prototype.open = this.originalXHROpen;
            XMLHttpRequest.prototype.send = this.originalXHRSend;
            this.originalXHROpen = undefined;
            this.originalXHRSend = undefined;
        }
    }

    private sanitizeHeaders(headers?: HeadersInit): Record<string, string> {
        const result: Record<string, string> = {};

        if (!headers) {
            return result;
        }

        if (headers instanceof Headers) {
            headers.forEach((value, key) => {
                result[key] = value;
            });
        } else if (Array.isArray(headers)) {
            headers.forEach(([key, value]) => {
                result[key] = value;
            });
        } else {
            Object.assign(result, headers);
        }

        return this.privacyController.sanitizeNetworkData({
            url: '',
            headers: result
        }).headers || {};
    }

    private getXHRHeaders(xhr: XMLHttpRequest): Record<string, string> {
        // XHR doesn't provide a way to get request headers after they're set
        // This is a limitation of the XHR API
        return {};
    }

    private parseXHRResponseHeaders(headerString: string): Record<string, string> {
        const headers: Record<string, string> = {};

        if (!headerString) {
            return headers;
        }

        headerString.split('\r\n').forEach(line => {
            const parts = line.split(': ');
            if (parts.length === 2) {
                headers[parts[0].toLowerCase()] = parts[1];
            }
        });

        return headers;
    }

    private categorizeError(error: any): ErrorType {
        if (!error) {
            return ErrorType.UNKNOWN;
        }

        const errorMessage = error.message || String(error);
        const lowerMessage = errorMessage.toLowerCase();

        if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
            return ErrorType.NETWORK;
        }

        if (lowerMessage.includes('timeout')) {
            return ErrorType.TIMEOUT;
        }

        if (lowerMessage.includes('cors') || lowerMessage.includes('cross-origin')) {
            return ErrorType.CORS;
        }

        if (lowerMessage.includes('security') || lowerMessage.includes('blocked')) {
            return ErrorType.SECURITY;
        }

        return ErrorType.UNKNOWN;
    }

    /**
     * Set up error handling callbacks and monitoring
     */
    private setupErrorHandling(): void {
        this.errorHandler.onError(ErrorCategory.NETWORK, async (error) => {
            this.monitoringErrors++;

            if (error.severity === ErrorSeverity.CRITICAL) {
                console.error('Critical network monitoring error, attempting recovery');
                await this.recover();
            } else if (this.monitoringErrors >= this.maxMonitoringErrors) {
                console.warn('Too many network monitoring errors, pausing monitoring');
                this.pause();
            }
        });
    }

    /**
     * Start health check monitoring
     */
    private startHealthCheck(): void {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000); // Check every 30 seconds
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
     * Perform health check
     */
    private async performHealthCheck(): Promise<void> {
        try {
            this.lastHealthCheck = new Date();

            // Check if patches are still in place
            if (this.isMonitoring && !this.isPaused) {
                const fetchPatched = window.fetch !== this.originalFetch;
                const xhrPatched = XMLHttpRequest.prototype.open !== this.originalXHROpen;

                if (!fetchPatched || !xhrPatched) {
                    await this.errorHandler.handleError(
                        ErrorCategory.NETWORK,
                        ErrorSeverity.HIGH,
                        'Network patches have been overridden, attempting recovery',
                        'NetworkMonitor'
                    );
                    await this.recover();
                }
            }

            // Check circuit breaker state
            if (this.circuitBreaker.getState() === 'open') {
                console.warn('Network monitoring circuit breaker is open');
            }

            // Reset error count if monitoring is stable
            if (this.monitoringErrors > 0 && this.isMonitoring && !this.isPaused) {
                this.monitoringErrors = Math.max(0, this.monitoringErrors - 1);
            }

        } catch (error) {
            console.error('Health check failed:', error);
        }
    }

    /**
     * Enhanced fetch patching with error handling
     */
    private async patchFetch(): Promise<void> {
        if (typeof window === 'undefined' || !window.fetch) {
            throw new Error('Fetch API not available');
        }

        try {
            this.originalFetch = window.fetch;
            const self = this;

            window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
                // Skip if paused
                if (self.isPaused) {
                    return self.originalFetch!.call(this, input, init);
                }

                const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

                // Check if URL should be monitored
                if (!self.privacyController.shouldMonitorUrl(url)) {
                    return self.originalFetch!.call(this, input, init);
                }

                try {
                    return await self.circuitBreaker.execute(async () => {
                        return await self.interceptFetch.call(self, input, init);
                    });
                } catch (error) {
                    // Log error but don't break the original request
                    await self.errorHandler.handleError(
                        ErrorCategory.NETWORK,
                        ErrorSeverity.LOW,
                        `Fetch interception failed: ${error.message}`,
                        'NetworkMonitor',
                        error instanceof Error ? error : new Error(String(error)),
                        { url }
                    );

                    // Fall back to original fetch
                    return self.originalFetch!.call(this, input, init);
                }
            };
        } catch (error) {
            throw new Error(`Failed to patch fetch: ${error.message}`);
        }
    }

    /**
     * Enhanced XHR patching with error handling
     */
    private async patchXMLHttpRequest(): Promise<void> {
        if (typeof window === 'undefined' || !window.XMLHttpRequest) {
            throw new Error('XMLHttpRequest not available');
        }

        try {
            const self = this;
            this.originalXHROpen = XMLHttpRequest.prototype.open;
            this.originalXHRSend = XMLHttpRequest.prototype.send;

            XMLHttpRequest.prototype.open = function (
                method: string,
                url: string | URL,
                async?: boolean,
                username?: string | null,
                password?: string | null
            ) {
                try {
                    const urlString = typeof url === 'string' ? url : url.href;

                    // Store request info on XHR instance
                    (this as any)._monitoringData = {
                        method,
                        url: urlString,
                        requestId: self.generateRequestId(),
                        timestamp: new Date()
                    };

                    return self.originalXHROpen!.call(this, method, url, async, username, password);
                } catch (error) {
                    // Log error but don't break the original request
                    self.errorHandler.handleError(
                        ErrorCategory.NETWORK,
                        ErrorSeverity.LOW,
                        `XHR open interception failed: ${error.message}`,
                        'NetworkMonitor',
                        error instanceof Error ? error : new Error(String(error))
                    );

                    return self.originalXHROpen!.call(this, method, url, async, username, password);
                }
            };

            XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
                try {
                    return self.interceptXHRSend.call(self, this, body);
                } catch (error) {
                    // Log error but don't break the original request
                    self.errorHandler.handleError(
                        ErrorCategory.NETWORK,
                        ErrorSeverity.LOW,
                        `XHR send interception failed: ${error.message}`,
                        'NetworkMonitor',
                        error instanceof Error ? error : new Error(String(error))
                    );

                    return self.originalXHRSend!.call(this, body);
                }
            };
        } catch (error) {
            throw new Error(`Failed to patch XMLHttpRequest: ${error.message}`);
        }
    }

    /**
     * Intercept fetch requests with error handling
     */
    private async interceptFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const requestId = this.generateRequestId();
        const timestamp = new Date();

        // Create request record
        const request: NetworkRequest = {
            id: requestId,
            url: this.privacyController.sanitizeNetworkData({ url }).url,
            method: init?.method || 'GET',
            headers: this.sanitizeHeaders(init?.headers),
            body: init?.body ? this.privacyController.sanitizeNetworkData({
                url,
                body: typeof init.body === 'string' ? init.body : '[Binary Data]'
            }).body : undefined,
            timestamp,
            initiator: 'fetch',
            type: RequestType.FETCH
        };

        this.requestBuffer.push(request);
        this.activeRequests.set(requestId, request);
        this.privacyController.logDataCollection('network-request', url);

        try {
            const response = await this.originalFetch!.call(window, input, init);

            // Process response
            await this.processResponse(requestId, response, url);

            return response;
        } catch (error) {
            // Create error record
            const networkError: NetworkError = {
                requestId,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date(),
                type: this.categorizeError(error)
            };

            this.errorBuffer.push(networkError);
            this.activeRequests.delete(requestId);

            throw error;
        }
    }

    /**
     * Intercept XHR send with error handling
     */
    private interceptXHRSend(xhr: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): any {
        const monitoringData = (xhr as any)._monitoringData;

        if (!monitoringData || this.isPaused || !this.privacyController.shouldMonitorUrl(monitoringData.url)) {
            return this.originalXHRSend!.call(xhr, body);
        }

        // Create request record
        const request: NetworkRequest = {
            id: monitoringData.requestId,
            url: this.privacyController.sanitizeNetworkData({ url: monitoringData.url }).url,
            method: monitoringData.method,
            headers: this.getXHRHeaders(xhr),
            body: body ? this.privacyController.sanitizeNetworkData({
                url: monitoringData.url,
                body: typeof body === 'string' ? body : '[Binary Data]'
            }).body : undefined,
            timestamp: monitoringData.timestamp,
            initiator: 'xhr',
            type: RequestType.XHR
        };

        this.requestBuffer.push(request);
        this.activeRequests.set(monitoringData.requestId, request);
        this.privacyController.logDataCollection('network-request', monitoringData.url);

        // Set up response/error handlers
        const originalOnReadyStateChange = xhr.onreadystatechange;

        xhr.onreadystatechange = function () {
            try {
                if (this.readyState === XMLHttpRequest.DONE) {
                    self.processXHRResponse(monitoringData.requestId, this, monitoringData.url);
                }

                if (originalOnReadyStateChange) {
                    originalOnReadyStateChange.call(this);
                }
            } catch (error) {
                console.error('Error in XHR response handler:', error);
            }
        };

        const self = this;
        return this.originalXHRSend!.call(xhr, body);
    }

    /**
     * Process fetch response with error handling
     */
    private async processResponse(requestId: string, response: Response, url: string): Promise<void> {
        try {
            // Create response record
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            // Clone response to read body without consuming it
            const responseClone = response.clone();
            let responseBody: string | undefined;

            try {
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json') || contentType.includes('text/')) {
                    responseBody = await responseClone.text();
                    responseBody = this.privacyController.sanitizeNetworkData({
                        url,
                        body: responseBody
                    }).body;
                }
            } catch (bodyError) {
                // Ignore body reading errors
            }

            const networkResponse: NetworkResponse = {
                requestId,
                status: response.status,
                statusText: response.statusText,
                headers: this.privacyController.sanitizeNetworkData({
                    url,
                    headers: responseHeaders
                }).headers || {},
                body: responseBody,
                timestamp: new Date(),
                size: parseInt(response.headers.get('content-length') || '0', 10)
            };

            this.responseBuffer.push(networkResponse);
            this.activeRequests.delete(requestId);
        } catch (error) {
            await this.errorHandler.handleError(
                ErrorCategory.NETWORK,
                ErrorSeverity.LOW,
                `Failed to process response: ${error.message}`,
                'NetworkMonitor',
                error instanceof Error ? error : new Error(String(error)),
                { requestId, url }
            );
        }
    }

    /**
     * Process XHR response with error handling
     */
    private processXHRResponse(requestId: string, xhr: XMLHttpRequest, url: string): void {
        try {
            if (xhr.status >= 200) {
                // Create response record
                const responseHeaders = this.parseXHRResponseHeaders(xhr.getAllResponseHeaders());

                const networkResponse: NetworkResponse = {
                    requestId,
                    status: xhr.status,
                    statusText: xhr.statusText,
                    headers: this.privacyController.sanitizeNetworkData({
                        url,
                        headers: responseHeaders
                    }).headers || {},
                    body: xhr.responseText ? this.privacyController.sanitizeNetworkData({
                        url,
                        body: xhr.responseText
                    }).body : undefined,
                    timestamp: new Date(),
                    size: xhr.responseText ? xhr.responseText.length : 0
                };

                this.responseBuffer.push(networkResponse);
            } else {
                // Create error record
                const networkError: NetworkError = {
                    requestId,
                    error: `HTTP ${xhr.status}: ${xhr.statusText}`,
                    timestamp: new Date(),
                    type: ErrorType.NETWORK
                };

                this.errorBuffer.push(networkError);
            }

            this.activeRequests.delete(requestId);
        } catch (error) {
            this.errorHandler.handleError(
                ErrorCategory.NETWORK,
                ErrorSeverity.LOW,
                `Failed to process XHR response: ${error.message}`,
                'NetworkMonitor',
                error instanceof Error ? error : new Error(String(error)),
                { requestId, url }
            );
        }
    }

    /**
     * Restore fetch with error handling
     */
    private async restoreFetch(): Promise<void> {
        try {
            if (this.originalFetch && typeof window !== 'undefined') {
                window.fetch = this.originalFetch;
                this.originalFetch = undefined;
            }
        } catch (error) {
            throw new Error(`Failed to restore fetch: ${error.message}`);
        }
    }

    /**
     * Restore XMLHttpRequest with error handling
     */
    private async restoreXMLHttpRequest(): Promise<void> {
        try {
            if (this.originalXHROpen && this.originalXHRSend) {
                XMLHttpRequest.prototype.open = this.originalXHROpen;
                XMLHttpRequest.prototype.send = this.originalXHRSend;
                this.originalXHROpen = undefined;
                this.originalXHRSend = undefined;
            }
        } catch (error) {
            throw new Error(`Failed to restore XMLHttpRequest: ${error.message}`);
        }
    }

    /**
     * Sleep utility for delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Setup performance monitoring callbacks
     */
    private setupPerformanceMonitoring(): void {
        this.performanceMonitor.onPerformanceAlert(PerformanceAlertLevel.WARNING, (alert) => {
            if (alert.component === 'NetworkMonitor') {
                console.warn(`NetworkMonitor performance warning: ${alert.message}`);
                this.adjustPerformanceSettings(alert);
            }
        });

        this.performanceMonitor.onPerformanceAlert(PerformanceAlertLevel.CRITICAL, (alert) => {
            if (alert.component === 'NetworkMonitor') {
                console.error(`NetworkMonitor performance critical: ${alert.message}`);
                this.handleCriticalPerformanceIssue(alert);
            }
        });
    }

    /**
     * Adjust performance settings based on alerts
     */
    private adjustPerformanceSettings(alert: any): void {
        switch (alert.metric) {
            case 'responseTime':
                // Increase throttle delay for request processing
                this.dynamicThrottleDelay = Math.min(1000, this.dynamicThrottleDelay + 100);
                break;
            case 'memoryUsage':
                // Reduce buffer sizes
                this.requestBuffer.resize(Math.max(100, this.requestBuffer.size * 0.8));
                this.responseBuffer.resize(Math.max(100, this.responseBuffer.size * 0.8));
                break;
            case 'dataSize':
                // Enable more aggressive data filtering
                console.log('Enabling aggressive data filtering due to large data size');
                break;
        }
    }

    /**
     * Handle critical performance issues
     */
    private async handleCriticalPerformanceIssue(alert: any): Promise<void> {
        switch (alert.metric) {
            case 'responseTime':
                // Temporarily pause monitoring to recover
                this.pause();
                setTimeout(() => this.resume(), 5000);
                break;
            case 'memoryUsage':
                // Trigger aggressive cleanup
                this.clearData();
                this.performanceMonitor.triggerMemoryCleanup();
                break;
        }
    }

    /**
     * Enhanced intercept fetch with performance monitoring
     */
    @withPerformanceMonitoring('NetworkMonitor')
    private async interceptFetchWithMetrics(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const operationId = `fetch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Check if we should throttle this request
        if (this.performanceMonitor.shouldThrottle('NetworkMonitor')) {
            const delay = this.performanceMonitor.getThrottleDelay('NetworkMonitor');
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        this.performanceMonitor.startTimer(operationId);

        try {
            const response = await this.interceptFetch(input, init);

            // Calculate data size
            const contentLength = response.headers.get('content-length');
            const dataSize = contentLength ? parseInt(contentLength, 10) : 0;

            this.performanceMonitor.endTimer(operationId, 'NetworkMonitor', dataSize);

            return response;
        } catch (error) {
            this.performanceMonitor.endTimer(operationId, 'NetworkMonitor', 0);
            throw error;
        }
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats(): {
        componentStats: any;
        systemStats: any;
        recentAlerts: any[];
        throttleDelay: number;
        optimizationActions: any[];
    } {
        return {
            componentStats: this.performanceMonitor.getComponentStats('NetworkMonitor'),
            systemStats: this.performanceMonitor.getSystemStats(),
            recentAlerts: this.performanceMonitor.getRecentAlerts(),
            throttleDelay: this.dynamicThrottleDelay,
            optimizationActions: this.performanceMonitor.getOptimizationHistory()
        };
    }

    /**
     * Optimize performance based on current metrics
     */
    optimizePerformance(): void {
        const stats = this.performanceMonitor.getComponentStats('NetworkMonitor');
        if (!stats) return;

        // Adjust buffer sizes based on usage patterns
        if (stats.cacheHitRate < 50) {
            // Low cache hit rate, increase buffer size
            const newSize = Math.min(2000, this.requestBuffer.size * 1.2);
            this.requestBuffer.resize(newSize);
            this.responseBuffer.resize(newSize);
        } else if (stats.cacheHitRate > 90) {
            // High cache hit rate, can reduce buffer size
            const newSize = Math.max(500, this.requestBuffer.size * 0.9);
            this.requestBuffer.resize(newSize);
            this.responseBuffer.resize(newSize);
        }

        // Adjust throttling based on response times
        if (stats.averageResponseTime > 500) {
            this.dynamicThrottleDelay = Math.min(1000, this.dynamicThrottleDelay + 50);
        } else if (stats.averageResponseTime < 100) {
            this.dynamicThrottleDelay = Math.max(0, this.dynamicThrottleDelay - 25);
        }
    }

    /**
     * Enhanced health check with performance monitoring
     */
    private async performHealthCheck(): Promise<void> {
        try {
            this.lastHealthCheck = new Date();

            // Existing health checks...
            if (this.isMonitoring && !this.isPaused) {
                const fetchPatched = window.fetch !== this.originalFetch;
                const xhrPatched = XMLHttpRequest.prototype.open !== this.originalXHROpen;

                if (!fetchPatched || !xhrPatched) {
                    await this.errorHandler.handleError(
                        ErrorCategory.NETWORK,
                        ErrorSeverity.HIGH,
                        'Network patches have been overridden, attempting recovery',
                        'NetworkMonitor'
                    );
                    await this.recover();
                }
            }

            // Performance health checks
            const memoryUsage = this.performanceMonitor.getCurrentMemoryUsage();
            if (memoryUsage && memoryUsage.percentage > 85) {
                console.warn('High memory usage detected, triggering cleanup');
                this.performanceMonitor.triggerMemoryCleanup();
            }

            // Optimize performance periodically
            const timeSinceLastOptimization = Date.now() - this.lastPerformanceCheck.getTime();
            if (timeSinceLastOptimization > 60000) { // Every minute
                this.optimizePerformance();
                this.lastPerformanceCheck = new Date();
            }

            // Reset error count if monitoring is stable
            if (this.monitoringErrors > 0 && this.isMonitoring && !this.isPaused) {
                this.monitoringErrors = Math.max(0, this.monitoringErrors - 1);
            }

            // Check circuit breaker state
            if (this.circuitBreaker.getState() === 'open') {
                console.warn('Network monitoring circuit breaker is open');
            }

        } catch (error) {
            console.error('Health check failed:', error);
        }
    }

    /**
     * Add event listener support for error notifications
     */
    addEventListener(event: string, callback: (data: any) => void): void {
        // Implementation would depend on existing event system
        // This is a placeholder for the interface
    }
}