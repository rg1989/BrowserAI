/**
 * Background service worker for Spotlight Browser Extension
 * Handles network interception, storage management, and cross-tab synchronization
 */

import { NetworkStorage } from "./services/NetworkStorage";
import { MonitoringConfigManager } from "./services/MonitoringConfig";
import { PrivacyController } from "./services/PrivacyController";
import {
  NetworkRequest,
  NetworkError,
  RequestType,
  ErrorType,
} from "./types/monitoring";

/**
 * Background script manager for network monitoring and extension coordination
 */
class BackgroundScript {
  private networkStorage: NetworkStorage | null = null;
  private monitoringConfig: MonitoringConfigManager | null = null;
  private privacyController: PrivacyController | null = null;
  private isMonitoringEnabled = false;
  private activeRequests: Map<string, Partial<NetworkRequest>> = new Map();

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    try {
      // Load monitoring configuration
      await this.loadConfiguration();

      // Setup Chrome API listeners
      this.setupWebRequestListeners();
      this.setupStorageListeners();
      this.setupMessageListeners();
      this.setupTabListeners();

      console.log("Background script initialized successfully");
    } catch (error) {
      console.error("Failed to initialize background script:", error);
    }
  }

  private async loadConfiguration(): Promise<void> {
    try {
      // Load monitoring settings from Chrome storage
      const result = await chrome.storage.sync.get(["monitoringSettings"]);
      const settings = result.monitoringSettings;

      if (settings && settings.enabled) {
        this.monitoringConfig = new MonitoringConfigManager(settings);
        this.privacyController = new PrivacyController(
          this.monitoringConfig.getPrivacyConfig()
        );
        const storageConfig = this.monitoringConfig.getStorageConfig();
        this.networkStorage = new NetworkStorage(
          storageConfig.maxStorageSize,
          storageConfig.compressionLevel > 0,
          storageConfig.cleanupInterval
        );

        await this.networkStorage.initialize();
        this.isMonitoringEnabled = true;

        console.log("Network monitoring enabled in background script");
      } else {
        console.log("Network monitoring disabled in background script");
      }
    } catch (error) {
      console.error("Failed to load monitoring configuration:", error);
    }
  }

  private setupWebRequestListeners(): void {
    if (!chrome.webRequest) {
      console.warn("webRequest API not available");
      return;
    }

    // Listen for request start
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => this.handleRequestStart(details),
      { urls: ["<all_urls>"] },
      ["requestBody"]
    );

    // Listen for request headers
    chrome.webRequest.onBeforeSendHeaders.addListener(
      (details) => this.handleRequestHeaders(details),
      { urls: ["<all_urls>"] },
      ["requestHeaders"]
    );

    // Listen for response headers
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => this.handleResponseHeaders(details),
      { urls: ["<all_urls>"] },
      ["responseHeaders"]
    );

    // Listen for request completion
    chrome.webRequest.onCompleted.addListener(
      (details) => this.handleRequestCompleted(details),
      { urls: ["<all_urls>"] },
      ["responseHeaders"]
    );

    // Listen for request errors
    chrome.webRequest.onErrorOccurred.addListener(
      (details) => this.handleRequestError(details),
      { urls: ["<all_urls>"] }
    );
  }

  private setupStorageListeners(): void {
    // Listen for storage changes to update configuration
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "sync" && changes.monitoringSettings) {
        this.handleConfigurationChange(changes.monitoringSettings.newValue);
      }
    });
  }

  private setupMessageListeners(): void {
    // Listen for messages from content scripts and popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });
  }

  private setupTabListeners(): void {
    // Listen for tab updates to handle navigation
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && tab.url) {
        this.handleTabNavigation(tabId, tab.url);
      }
    });

    // Listen for tab removal to clean up data
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabClosed(tabId);
    });
  }

  private handleRequestStart(
    details: chrome.webRequest.WebRequestBodyDetails
  ): void {
    if (!this.isMonitoringEnabled || !this.shouldMonitorRequest(details.url)) {
      return;
    }

    const requestId = `${details.requestId}`;
    const request: Partial<NetworkRequest> = {
      id: requestId,
      url: details.url,
      method: details.method,
      timestamp: new Date(details.timeStamp),
      type: this.mapRequestType(details.type) as RequestType,
      tabId: details.tabId,
      frameId: details.frameId,
      requestBody: details.requestBody
        ? this.extractRequestBody(details.requestBody as any)
        : undefined,
    };

    this.activeRequests.set(requestId, request);
  }

  private handleRequestHeaders(
    details: chrome.webRequest.WebRequestHeadersDetails
  ): void {
    if (!this.isMonitoringEnabled) return;

    const requestId = `${details.requestId}`;
    const request = this.activeRequests.get(requestId);

    if (request) {
      request.headers = this.extractHeaders(details.requestHeaders);
      this.activeRequests.set(requestId, request);
    }
  }

  private handleResponseHeaders(
    details: chrome.webRequest.WebResponseHeadersDetails
  ): void {
    if (!this.isMonitoringEnabled) return;

    const requestId = `${details.requestId}`;
    const request = this.activeRequests.get(requestId);

    if (request) {
      request.statusCode = details.statusCode;
      request.responseHeaders = this.extractHeaders(details.responseHeaders);
      this.activeRequests.set(requestId, request);
    }
  }

  private async handleRequestCompleted(
    details: chrome.webRequest.WebResponseHeadersDetails
  ): Promise<void> {
    if (!this.isMonitoringEnabled || !this.networkStorage) return;

    const requestId = `${details.requestId}`;
    const request = this.activeRequests.get(requestId);

    if (request) {
      // Complete the request object
      const completedRequest: NetworkRequest = {
        id: request.id!,
        url: request.url!,
        method: request.method!,
        timestamp: request.timestamp!,
        type: request.type!,
        initiator: "background", // Default initiator for background requests
        tabId: request.tabId,
        frameId: request.frameId,
        headers: request.headers || {},
        requestBody: request.requestBody,
        statusCode: request.statusCode || details.statusCode,
        responseHeaders:
          request.responseHeaders ||
          this.extractHeaders(details.responseHeaders),
        responseTime: details.timeStamp - request.timestamp!.getTime(),
        size: this.calculateResponseSize(details.responseHeaders),
      };

      // Apply privacy filtering
      const filteredRequest = this.applyPrivacyFiltering(completedRequest);

      // Store the request
      try {
        await this.networkStorage.storeRequest(filteredRequest);
      } catch (error) {
        console.error("Failed to store network request:", error);
      }

      // Clean up
      this.activeRequests.delete(requestId);

      // Notify content scripts if needed
      this.notifyContentScript(
        completedRequest.tabId,
        "networkRequest",
        filteredRequest
      );
    }
  }

  private async handleRequestError(
    details: chrome.webRequest.WebRequestDetails & { error: string }
  ): Promise<void> {
    if (!this.isMonitoringEnabled || !this.networkStorage) return;

    const requestId = `${details.requestId}`;
    const request = this.activeRequests.get(requestId);

    if (request) {
      const error: NetworkError = {
        id: `error_${requestId}`,
        requestId: request.id!,
        url: request.url!,
        method: request.method!,
        timestamp: new Date(details.timeStamp),
        error: details.error,
        type: ErrorType.NETWORK_ERROR,
        tabId: request.tabId,
      };

      try {
        await this.networkStorage.storeError(error);
      } catch (storageError) {
        console.error("Failed to store network error:", storageError);
      }

      // Clean up
      this.activeRequests.delete(requestId);

      // Notify content scripts
      this.notifyContentScript(error.tabId, "networkError", error);
    }
  }

  private async handleConfigurationChange(newSettings: any): Promise<void> {
    try {
      if (newSettings && newSettings.enabled) {
        // Enable or update monitoring
        if (!this.isMonitoringEnabled) {
          await this.loadConfiguration();
        } else if (this.monitoringConfig) {
          this.monitoringConfig.updateConfig(newSettings);
          this.privacyController?.updateConfig(
            this.monitoringConfig.getPrivacyConfig()
          );
        }
      } else {
        // Disable monitoring
        this.isMonitoringEnabled = false;
        this.activeRequests.clear();
        console.log("Network monitoring disabled");
      }
    } catch (error) {
      console.error("Failed to handle configuration change:", error);
    }
  }

  private async handleMessage(
    message: any,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ): Promise<void> {
    try {
      switch (message.type) {
        case "GET_NETWORK_ACTIVITY":
          if (this.networkStorage) {
            const activity = await this.networkStorage.getRecentRequests(
              message.limit || 50
            );
            sendResponse({ success: true, activity });
          } else {
            sendResponse({
              success: false,
              error: "Network storage not initialized",
            });
          }
          break;

        case "CLEAR_NETWORK_DATA":
          if (this.networkStorage) {
            await this.networkStorage.clearAll();
            sendResponse({ success: true });
          } else {
            sendResponse({
              success: false,
              error: "Network storage not initialized",
            });
          }
          break;

        case "GET_MONITORING_STATUS":
          sendResponse({
            success: true,
            enabled: this.isMonitoringEnabled,
            activeRequests: this.activeRequests.size,
          });
          break;

        case "SYNC_STORAGE":
          // Handle cross-tab synchronization
          await this.syncStorageAcrossTabs();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private handleTabNavigation(tabId: number, url: string): void {
    // Clean up any pending requests for this tab
    for (const [requestId, request] of this.activeRequests.entries()) {
      if (request.tabId === tabId) {
        this.activeRequests.delete(requestId);
      }
    }

    // Notify content script of navigation
    this.notifyContentScript(tabId, "navigation", { url });
  }

  private handleTabClosed(tabId: number): void {
    // Clean up any pending requests for this tab
    for (const [requestId, request] of this.activeRequests.entries()) {
      if (request.tabId === tabId) {
        this.activeRequests.delete(requestId);
      }
    }
  }

  private shouldMonitorRequest(url: string): boolean {
    if (!this.monitoringConfig) return true;

    try {
      const urlObj = new URL(url);
      return (
        !this.monitoringConfig.isPathExcluded(urlObj.pathname) &&
        !this.monitoringConfig.isDomainExcluded(urlObj.hostname)
      );
    } catch {
      return false;
    }
  }

  private mapRequestType(chromeType: string): RequestType {
    const typeMap: { [key: string]: RequestType } = {
      main_frame: RequestType.DOCUMENT,
      sub_frame: RequestType.SUBDOCUMENT,
      stylesheet: RequestType.STYLESHEET,
      script: RequestType.SCRIPT,
      image: RequestType.IMAGE,
      font: RequestType.FONT,
      object: RequestType.OBJECT,
      xmlhttprequest: RequestType.XHR,
      ping: RequestType.PING,
      csp_report: RequestType.CSP_REPORT,
      media: RequestType.MEDIA,
      websocket: RequestType.WEBSOCKET,
      other: RequestType.OTHER,
    };
    return typeMap[chromeType] || RequestType.OTHER;
  }

  private extractRequestBody(requestBody: any): any {
    if (!requestBody || !requestBody.raw) return undefined;

    try {
      const decoder = new TextDecoder();
      const bodyParts = requestBody.raw.map((part: any) => {
        if (part.bytes) {
          return decoder.decode(new Uint8Array(part.bytes));
        }
        return "";
      });
      return bodyParts.join("");
    } catch {
      return "[Binary Data]";
    }
  }

  private extractHeaders(
    headers?: chrome.webRequest.HttpHeader[]
  ): Record<string, string> {
    if (!headers) return {};

    const headerMap: Record<string, string> = {};
    headers.forEach((header) => {
      if (header.name && header.value) {
        headerMap[header.name.toLowerCase()] = header.value;
      }
    });
    return headerMap;
  }

  private calculateResponseSize(
    headers?: chrome.webRequest.HttpHeader[]
  ): number {
    if (!headers) return 0;

    const contentLength = headers.find(
      (h) => h.name?.toLowerCase() === "content-length"
    );

    return contentLength ? parseInt(contentLength.value || "0", 10) : 0;
  }

  private applyPrivacyFiltering(request: NetworkRequest): NetworkRequest {
    if (!this.monitoringConfig) return request;

    const filtered = { ...request };

    // Redact sensitive request body
    if (filtered.requestBody && typeof filtered.requestBody === "string") {
      filtered.requestBody = this.monitoringConfig.redactSensitiveData(
        filtered.requestBody
      );
    }

    // Filter sensitive headers (basic implementation)
    if (filtered.headers) {
      const sensitiveHeaders = ["authorization", "cookie", "x-api-key"];
      filtered.headers = Object.fromEntries(
        Object.entries(filtered.headers).map(([key, value]) => [
          key,
          sensitiveHeaders.includes(key.toLowerCase()) ? "[REDACTED]" : value,
        ])
      );
    }

    if (filtered.responseHeaders) {
      const sensitiveHeaders = ["set-cookie", "authorization"];
      filtered.responseHeaders = Object.fromEntries(
        Object.entries(filtered.responseHeaders).map(([key, value]) => [
          key,
          sensitiveHeaders.includes(key.toLowerCase()) ? "[REDACTED]" : value,
        ])
      );
    }

    return filtered;
  }

  private async notifyContentScript(
    tabId: number | undefined,
    type: string,
    data: any
  ): Promise<void> {
    if (!tabId || tabId < 0) return;

    try {
      await chrome.tabs.sendMessage(tabId, {
        type: `BACKGROUND_${type.toUpperCase()}`,
        data,
      });
    } catch (error) {
      // Content script might not be ready or tab might be closed
      console.debug("Failed to notify content script:", error);
    }
  }

  private async syncStorageAcrossTabs(): Promise<void> {
    if (!this.networkStorage) return;

    try {
      // Get all tabs
      const tabs = await chrome.tabs.query({});

      // Notify all tabs about storage sync
      const promises = tabs.map((tab) => {
        if (tab.id) {
          return this.notifyContentScript(tab.id, "storageSync", {});
        }
      });

      await Promise.allSettled(promises);
    } catch (error) {
      console.error("Failed to sync storage across tabs:", error);
    }
  }
}

// Initialize background script
new BackgroundScript();

// Handle extension lifecycle
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Extension installed/updated:", details.reason);
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Extension startup");
});

// Export for testing
export { BackgroundScript };
