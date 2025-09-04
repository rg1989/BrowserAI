import {
    NetworkRequest,
    NetworkResponse,
    NetworkError,
    RequestType,
    ErrorType
} from '../types/monitoring';
import { PrivacyController } from './PrivacyController';

/**
 * Background script request interceptor using Chrome's webRequest API
 * Provides comprehensive network monitoring across all tabs
 */
export class RequestInterceptor {
    private privacyController: PrivacyController;
    private isActive: boolean = false;
    private requestIdCounter: number = 0;
    private pendingRequests: Map<string, NetworkRequest> = new Map();

    // Event listeners for cleanup
    private listeners: {
        onBeforeRequest?: (details: chrome.webRequest.WebRequestBodyDetails) => void;
        onBeforeSendHeaders?: (details: chrome.webRequest.WebRequestHeadersDetails) => void;
        onHeadersReceived?: (details: chrome.webRequest.WebResponseHeadersDetails) => void;
        onCompleted?: (details: chrome.webRequest.WebResponseDetails) => void;
        onErrorOccurred?: (details: chrome.webRequest.WebResponseErrorDetails) => void;
    } = {};

    constructor(privacyController: PrivacyController) {
        this.privacyController = privacyController;
    }

    /**
     * Start intercepting network requests using webRequest API
     */
    startInterception(): void {
        if (this.isActive || !chrome.webRequest) {
            return;
        }

        this.isActive = true;
        this.setupWebRequestListeners();
    }

    /**
     * Stop intercepting network requests
     */
    stopInterception(): void {
        if (!this.isActive || !chrome.webRequest) {
            return;
        }

        this.isActive = false;
        this.removeWebRequestListeners();
        this.pendingRequests.clear();
    }

    /**
     * Check if interception is currently active
     */
    isIntercepting(): boolean {
        return this.isActive;
    }

    /**
     * Get pending requests (for debugging)
     */
    getPendingRequests(): NetworkRequest[] {
        return Array.from(this.pendingRequests.values());
    }

    private setupWebRequestListeners(): void {
        const filter = { urls: ["<all_urls>"] };
        const extraInfoSpec = ["requestBody", "extraHeaders"];
        const responseExtraInfoSpec = ["responseHeaders", "extraHeaders"];

        // Intercept request initiation
        this.listeners.onBeforeRequest = (details) => {
            this.handleBeforeRequest(details);
        };

        // Intercept request headers
        this.listeners.onBeforeSendHeaders = (details) => {
            this.handleBeforeSendHeaders(details);
        };

        // Intercept response headers
        this.listeners.onHeadersReceived = (details) => {
            this.handleHeadersReceived(details);
        };

        // Intercept completed requests
        this.listeners.onCompleted = (details) => {
            this.handleCompleted(details);
        };

        // Intercept failed requests
        this.listeners.onErrorOccurred = (details) => {
            this.handleErrorOccurred(details);
        };

        // Register listeners
        chrome.webRequest.onBeforeRequest.addListener(
            this.listeners.onBeforeRequest,
            filter,
            extraInfoSpec
        );

        chrome.webRequest.onBeforeSendHeaders.addListener(
            this.listeners.onBeforeSendHeaders,
            filter,
            responseExtraInfoSpec
        );

        chrome.webRequest.onHeadersReceived.addListener(
            this.listeners.onHeadersReceived,
            filter,
            responseExtraInfoSpec
        );

        chrome.webRequest.onCompleted.addListener(
            this.listeners.onCompleted,
            filter,
            responseExtraInfoSpec
        );

        chrome.webRequest.onErrorOccurred.addListener(
            this.listeners.onErrorOccurred,
            filter
        );
    }

    private removeWebRequestListeners(): void {
        if (this.listeners.onBeforeRequest) {
            chrome.webRequest.onBeforeRequest.removeListener(this.listeners.onBeforeRequest);
        }
        if (this.listeners.onBeforeSendHeaders) {
            chrome.webRequest.onBeforeSendHeaders.removeListener(this.listeners.onBeforeSendHeaders);
        }
        if (this.listeners.onHeadersReceived) {
            chrome.webRequest.onHeadersReceived.removeListener(this.listeners.onHeadersReceived);
        }
        if (this.listeners.onCompleted) {
            chrome.webRequest.onCompleted.removeListener(this.listeners.onCompleted);
        }
        if (this.listeners.onErrorOccurred) {
            chrome.webRequest.onErrorOccurred.removeListener(this.listeners.onErrorOccurred);
        }

        this.listeners = {};
    }

    private handleBeforeRequest(details: chrome.webRequest.WebRequestBodyDetails): void {
        if (!this.privacyController.shouldMonitorUrl(details.url)) {
            return;
        }

        const requestType = this.determineRequestType(details);
        const requestBody = this.extractRequestBody(details);

        const request: NetworkRequest = {
            id: `bg_${details.requestId}`,
            url: this.privacyController.sanitizeNetworkData({ url: details.url }).url,
            method: details.method,
            headers: {}, // Will be populated in onBeforeSendHeaders
            body: requestBody,
            timestamp: new Date(details.timeStamp),
            initiator: details.initiator || 'unknown',
            type: requestType
        };

        this.pendingRequests.set(details.requestId.toString(), request);
        this.privacyController.logDataCollection('network-request', details.url);

        // Send to content script for storage
        this.sendToContentScript('network-request', request, details.tabId);
    }

    private handleBeforeSendHeaders(details: chrome.webRequest.WebRequestHeadersDetails): void {
        const request = this.pendingRequests.get(details.requestId.toString());
        if (!request) {
            return;
        }

        // Update request with headers
        const headers: Record<string, string> = {};
        if (details.requestHeaders) {
            details.requestHeaders.forEach(header => {
                headers[header.name] = header.value || '';
            });
        }

        request.headers = this.privacyController.sanitizeNetworkData({
            url: request.url,
            headers
        }).headers || {};

        this.pendingRequests.set(details.requestId.toString(), request);
    }

    private handleHeadersReceived(details: chrome.webRequest.WebResponseHeadersDetails): void {
        const request = this.pendingRequests.get(details.requestId.toString());
        if (!request) {
            return;
        }

        const responseHeaders: Record<string, string> = {};
        if (details.responseHeaders) {
            details.responseHeaders.forEach(header => {
                responseHeaders[header.name] = header.value || '';
            });
        }

        const response: NetworkResponse = {
            requestId: request.id,
            status: details.statusCode,
            statusText: this.getStatusText(details.statusCode),
            headers: this.privacyController.sanitizeNetworkData({
                url: request.url,
                headers: responseHeaders
            }).headers || {},
            body: undefined, // Body will be captured separately if needed
            timestamp: new Date(details.timeStamp),
            size: parseInt(responseHeaders['content-length'] || '0', 10)
        };

        // Send to content script for storage
        this.sendToContentScript('network-response', response, details.tabId);
    }

    private handleCompleted(details: chrome.webRequest.WebResponseDetails): void {
        const request = this.pendingRequests.get(details.requestId.toString());
        if (request) {
            this.pendingRequests.delete(details.requestId.toString());
        }
    }

    private handleErrorOccurred(details: chrome.webRequest.WebResponseErrorDetails): void {
        const request = this.pendingRequests.get(details.requestId.toString());
        if (!request) {
            return;
        }

        const error: NetworkError = {
            requestId: request.id,
            error: details.error,
            timestamp: new Date(details.timeStamp),
            type: this.categorizeWebRequestError(details.error)
        };

        // Send to content script for storage
        this.sendToContentScript('network-error', error, details.tabId);
        this.pendingRequests.delete(details.requestId.toString());
    }

    private determineRequestType(details: chrome.webRequest.WebRequestBodyDetails): RequestType {
        const url = details.url.toLowerCase();

        if (details.type === 'xmlhttprequest') {
            return RequestType.XHR;
        }

        if (url.includes('websocket') || details.type === 'websocket') {
            return RequestType.WEBSOCKET;
        }

        if (url.includes('eventsource') || details.type === 'other') {
            return RequestType.EVENTSOURCE;
        }

        if (details.type === 'ping') {
            return RequestType.BEACON;
        }

        return RequestType.FETCH;
    }

    private extractRequestBody(details: chrome.webRequest.WebRequestBodyDetails): string | undefined {
        if (!details.requestBody) {
            return undefined;
        }

        try {
            if (details.requestBody.formData) {
                // Handle form data
                const formData: string[] = [];
                Object.entries(details.requestBody.formData).forEach(([key, values]) => {
                    values.forEach(value => {
                        formData.push(`${key}=${encodeURIComponent(value)}`);
                    });
                });
                return this.privacyController.sanitizeNetworkData({
                    url: details.url,
                    body: formData.join('&')
                }).body;
            }

            if (details.requestBody.raw) {
                // Handle raw data
                const decoder = new TextDecoder();
                const rawData = details.requestBody.raw
                    .map(data => decoder.decode(data.bytes))
                    .join('');
                return this.privacyController.sanitizeNetworkData({
                    url: details.url,
                    body: rawData
                }).body;
            }
        } catch (error) {
            console.warn('Failed to extract request body:', error);
        }

        return undefined;
    }

    private getStatusText(statusCode: number): string {
        const statusTexts: Record<number, string> = {
            200: 'OK',
            201: 'Created',
            204: 'No Content',
            400: 'Bad Request',
            401: 'Unauthorized',
            403: 'Forbidden',
            404: 'Not Found',
            500: 'Internal Server Error',
            502: 'Bad Gateway',
            503: 'Service Unavailable'
        };

        return statusTexts[statusCode] || 'Unknown';
    }

    private categorizeWebRequestError(error: string): ErrorType {
        const lowerError = error.toLowerCase();

        if (lowerError.includes('net::err_network') || lowerError.includes('net::err_internet_disconnected')) {
            return ErrorType.NETWORK;
        }

        if (lowerError.includes('net::err_timed_out')) {
            return ErrorType.TIMEOUT;
        }

        if (lowerError.includes('net::err_blocked') || lowerError.includes('net::err_access_denied')) {
            return ErrorType.SECURITY;
        }

        if (lowerError.includes('cors')) {
            return ErrorType.CORS;
        }

        return ErrorType.UNKNOWN;
    }

    private sendToContentScript(
        type: 'network-request' | 'network-response' | 'network-error',
        data: NetworkRequest | NetworkResponse | NetworkError,
        tabId?: number
    ): void {
        if (!tabId || tabId < 0) {
            return;
        }

        try {
            chrome.tabs.sendMessage(tabId, {
                type: 'monitoring-data',
                subType: type,
                data
            }).catch(error => {
                // Ignore errors for tabs that don't have content script
                console.debug('Failed to send monitoring data to tab:', error);
            });
        } catch (error) {
            console.debug('Failed to send message to content script:', error);
        }
    }
}