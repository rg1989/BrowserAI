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

/**
 * Network monitoring service that intercepts and tracks HTTP requests and responses
 * Supports both webRequest API (background script) and fetch/XHR patching (content script)
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

    constructor(
        bufferSize: number = 1000,
        privacyController: PrivacyController
    ) {
        this.requestBuffer = new CircularBuffer<NetworkRequest>(bufferSize);
        this.responseBuffer = new CircularBuffer<NetworkResponse>(bufferSize);
        this.errorBuffer = new CircularBuffer<NetworkError>(bufferSize);
        this.privacyController = privacyController;
    }

    /**
     * Start monitoring network requests
     */
    startMonitoring(): void {
        if (this.isMonitoring) {
            return;
        }

        this.isMonitoring = true;
        this.patchFetch();
        this.patchXMLHttpRequest();
    }

    /**
     * Stop monitoring network requests
     */
    stopMonitoring(): void {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;
        this.restoreFetch();
        this.restoreXMLHttpRequest();
        this.activeRequests.clear();
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
        return this.isMonitoring;
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
}