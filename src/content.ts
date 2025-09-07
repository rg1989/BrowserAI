import React from "react";
import { createRoot } from "react-dom/client";
import { SpotlightOverlay } from "./components/SpotlightOverlay";
import { KeyboardManager } from "./services/KeyboardManager";
import {
  PageContextMonitor,
  MonitoringEvent,
} from "./services/PageContextMonitor";
import { MonitoringConfigManager } from "./services/MonitoringConfig";
import { ContextProvider } from "./services/ContextProvider";
import { ContextualAIService } from "./services/ContextualAIService";
import { AIServiceManager } from "./services/AIService";

// Content script for Spotlight Browser Extension
// This script injects the SpotlightOverlay component into web pages

class ContentScript {
  private overlayContainer: HTMLDivElement | null = null;
  private root: any = null;
  private keyboardManager: KeyboardManager | null = null;
  private isOverlayVisible = false;
  private pageContextMonitor: PageContextMonitor | null = null;
  private monitoringConfig: MonitoringConfigManager | null = null;
  private _contextProvider: ContextProvider | null = null;
  private _contextualAIService: ContextualAIService | null = null;
  private _aiServiceManager: AIServiceManager | null = null;
  private isMonitoringEnabled = false;

  constructor() {
    try {
      this.keyboardManager = KeyboardManager.getInstance();
      this.init();
    } catch (error) {
      console.error("Spotlight Browser Extension: Failed to initialize", error);
    }
  }

  private init(): void {
    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.setupExtension()
      );
    } else {
      this.setupExtension();
    }
  }

  private async setupExtension(): Promise<void> {
    try {
      // Setup overlay first
      this.setupOverlay();

      // Initialize monitoring system
      await this.initializeMonitoring();

      console.log("Spotlight Browser Extension: Content script initialized");
    } catch (error) {
      console.error("Spotlight Browser Extension: Failed to initialize", error);
    }
  }

  private setupOverlay(): void {
    try {
      // Create overlay container
      this.createOverlayContainer();

      // Setup keyboard listeners
      this.setupKeyboardListeners();

      // Initialize React root
      this.initializeReactRoot();
    } catch (error) {
      console.error(
        "Spotlight Browser Extension: Failed to setup overlay",
        error
      );
    }
  }

  private createOverlayContainer(): void {
    // Check if container already exists (prevent duplicate injection)
    const existingContainer = document.getElementById(
      "spotlight-overlay-container"
    );
    if (existingContainer) {
      this.overlayContainer = existingContainer as HTMLDivElement;
      return;
    }

    // Create overlay container
    this.overlayContainer = document.createElement("div");
    this.overlayContainer.id = "spotlight-overlay-container";

    // Set container styles to ensure proper positioning
    this.overlayContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2147483647;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Append to document body
    document.body.appendChild(this.overlayContainer);
  }

  private setupKeyboardListeners(): void {
    // Setup global keyboard event listeners
    if (this.keyboardManager) {
      this.keyboardManager.onToggleOverlay(() => {
        this.toggleOverlay();
      });
    }

    // Escape key handling is managed by the SpotlightOverlay component
    // through the KeyboardManager, so no additional handling needed here
  }

  private initializeReactRoot(): void {
    if (!this.overlayContainer) {
      throw new Error("Overlay container not found");
    }

    // Create React root
    this.root = createRoot(this.overlayContainer);

    // Initial render with overlay hidden
    this.renderOverlay();
  }

  private async initializeMonitoring(): Promise<void> {
    // Always initialize ContextProvider first - it can work in fallback mode
    try {
      this._contextProvider = ContextProvider.getInstance();
      console.log("Content Script: ContextProvider instance created");
    } catch (error) {
      console.error("Content Script: Failed to create ContextProvider:", error);
      return; // Can't continue without ContextProvider
    }

    try {
      // Load monitoring settings from Chrome storage
      const settings = await this.loadMonitoringSettings();

      // Default to enabled if no settings found (first time use)
      const isEnabled = settings ? settings.enabled !== false : true;

      console.log("Content Script: Monitoring initialization", {
        settings,
        isEnabled,
        url: window.location.href,
      });

      if (!isEnabled) {
        console.log(
          "Page context monitoring is disabled - using fallback mode"
        );
        this._contextProvider.initialize(null);
        await this.initializeContextualAI();
        return;
      }

      // Create monitoring configuration with defaults
      this.monitoringConfig = new MonitoringConfigManager({
        enabled: isEnabled,
        features: settings?.features || {},
        privacy: settings?.privacy || {},
        performance: settings?.performance || {},
        storage: settings?.storage || {},
      });

      // Check if current domain/path should be excluded
      if (this.shouldExcludeCurrentPage()) {
        console.log(
          "Current page excluded from monitoring - using fallback mode"
        );
        this._contextProvider.initialize(null);
        await this.initializeContextualAI();
        return;
      }

      // Initialize PageContextMonitor
      this.pageContextMonitor = new PageContextMonitor(
        this.monitoringConfig.getConfig()
      );

      // Setup monitoring event listeners
      this.setupMonitoringEventListeners();

      // Start monitoring with timeout
      console.log("Content Script: Starting page context monitoring...");
      const startTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Monitoring start timeout")), 10000); // 10 second timeout
      });

      await Promise.race([this.pageContextMonitor.start(), startTimeout]);
      console.log(
        "Content Script: Page context monitoring started successfully"
      );

      this.isMonitoringEnabled = true;

      // Initialize ContextProvider with the PageContextMonitor
      this._contextProvider.initialize(this.pageContextMonitor);

      // Initialize AI services and ContextualAIService
      await this.initializeContextualAI();

      console.log(
        "Content Script: All monitoring components initialized successfully",
        {
          monitoringEnabled: this.isMonitoringEnabled,
          pageContextMonitor: !!this.pageContextMonitor,
          contextProvider: !!this._contextProvider,
          contextProviderReady: this._contextProvider?.isReady(),
          aiServiceManager: !!this._aiServiceManager,
          contextualAIService: !!this._contextualAIService,
        }
      );
    } catch (error) {
      console.error(
        "Content Script: Failed to initialize page context monitoring:",
        error
      );
      console.error("Content Script: Error details:", {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        settings: await this.loadMonitoringSettings().catch(() => null),
      });

      // Clean up failed monitoring attempt
      if (this.pageContextMonitor) {
        try {
          await this.pageContextMonitor.stop();
        } catch (stopError) {
          console.warn("Error stopping failed monitoring:", stopError);
        }
        this.pageContextMonitor = null;
      }

      this.isMonitoringEnabled = false;

      // Initialize ContextProvider in fallback mode since monitoring failed
      try {
        this._contextProvider.initialize(null);
        console.log(
          "Content Script: Initialized ContextProvider in fallback mode"
        );

        // Still initialize AI services even if monitoring failed
        await this.initializeContextualAI();
      } catch (fallbackError) {
        console.warn(
          "Content Script: Failed to initialize fallback ContextProvider:",
          fallbackError
        );
      }

      // Don't throw - monitoring failure shouldn't break the extension
    }
  }

  /**
   * Initialize ContextualAIService with AI service manager
   */
  private async initializeContextualAI(): Promise<void> {
    try {
      // Initialize AI service manager
      this._aiServiceManager = AIServiceManager.getInstance();

      // Load AI service configuration from storage
      const aiConfig = await this.loadAIServiceConfig();

      if (aiConfig && aiConfig.serviceName) {
        try {
          await this._aiServiceManager.setService(
            aiConfig.serviceName,
            aiConfig.config
          );
          console.log(
            `AI service "${aiConfig.serviceName}" initialized successfully`
          );
        } catch (error) {
          console.warn(
            `Failed to initialize AI service "${aiConfig.serviceName}", using default:`,
            error
          );
          // Fall back to default service (MockAIService)
        }
      }

      // Initialize ContextualAIService with AI service and context provider
      this._contextualAIService = new ContextualAIService(
        this._aiServiceManager.getCurrentService(),
        this._contextProvider || undefined
      );

      console.log("ContextualAIService initialized successfully");
    } catch (error) {
      console.error("Failed to initialize ContextualAIService:", error);
      // Don't throw - AI service failure shouldn't break the extension
    }
  }

  /**
   * Load AI service configuration from Chrome storage
   */
  private async loadAIServiceConfig(): Promise<any> {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        const result = await chrome.storage.sync.get(["aiServiceConfig"]);
        return result.aiServiceConfig || null;
      }
    } catch (error) {
      console.warn("Failed to load AI service configuration:", error);
    }
    return null;
  }

  private async loadMonitoringSettings(): Promise<any> {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        const result = await chrome.storage.sync.get(["monitoringSettings"]);
        return result.monitoringSettings || null;
      }
    } catch (error) {
      console.warn("Failed to load monitoring settings:", error);
    }
    return null;
  }

  private shouldExcludeCurrentPage(): boolean {
    if (!this.monitoringConfig) return false;

    const currentDomain = window.location.hostname;
    const currentPath = window.location.pathname;

    return (
      this.monitoringConfig.isDomainExcluded(currentDomain) ||
      this.monitoringConfig.isPathExcluded(currentPath)
    );
  }

  private setupMonitoringEventListeners(): void {
    if (!this.pageContextMonitor) return;

    this.pageContextMonitor.addEventListener(MonitoringEvent.STARTED, () => {
      console.log("Page context monitoring started");
    });

    this.pageContextMonitor.addEventListener(MonitoringEvent.STOPPED, () => {
      console.log("Page context monitoring stopped");
    });

    this.pageContextMonitor.addEventListener(
      MonitoringEvent.ERROR,
      (_event, data) => {
        console.error("Page context monitoring error:", data);
      }
    );

    this.pageContextMonitor.addEventListener(
      MonitoringEvent.CONTEXT_UPDATED,
      (_event, _context) => {
        // Context updated - could be used for real-time features
        console.debug("Page context updated");
      }
    );

    // Listen for Chrome storage changes to update monitoring settings
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "sync" && changes.monitoringSettings) {
          this.handleSettingsChange(changes.monitoringSettings.newValue);
        }
      });
    }
  }

  private async handleSettingsChange(newSettings: any): Promise<void> {
    try {
      if (!newSettings || !newSettings.enabled) {
        // Monitoring disabled
        await this.disableMonitoring();
        return;
      }

      // Check if current page should be excluded with new settings
      if (this.monitoringConfig) {
        this.monitoringConfig.updateConfig({
          enabled: newSettings.enabled,
          features: newSettings.features || {},
          privacy: newSettings.privacy || {},
          performance: newSettings.performance || {},
          storage: newSettings.storage || {},
        });

        if (this.shouldExcludeCurrentPage()) {
          await this.disableMonitoring();
          return;
        }
      }

      // Update monitoring configuration
      if (this.pageContextMonitor) {
        this.pageContextMonitor.updateConfig(
          this.monitoringConfig?.getConfig() || {}
        );

        // Restart monitoring if it was running
        if (this.isMonitoringEnabled) {
          await this.pageContextMonitor.stop();
          await this.pageContextMonitor.start();
        }
      } else {
        // Initialize monitoring if it wasn't running
        await this.initializeMonitoring();
      }

      console.log("Monitoring settings updated");
    } catch (error) {
      console.error("Failed to handle settings change:", error);
    }
  }

  public async enableMonitoring(): Promise<void> {
    if (this.isMonitoringEnabled || !this.pageContextMonitor) {
      return;
    }

    try {
      await this.pageContextMonitor.start();
      this.isMonitoringEnabled = true;
      console.log("Page context monitoring enabled");
    } catch (error) {
      console.error("Failed to enable monitoring:", error);
    }
  }

  public async disableMonitoring(): Promise<void> {
    if (!this.isMonitoringEnabled || !this.pageContextMonitor) {
      return;
    }

    try {
      await this.pageContextMonitor.stop();
      this.isMonitoringEnabled = false;

      // Clear context provider cache when monitoring is disabled
      if (this._contextProvider) {
        this._contextProvider.clearCache();
      }

      console.log("Page context monitoring disabled");
    } catch (error) {
      console.error("Failed to disable monitoring:", error);
    }
  }

  public async getPageContext(): Promise<any> {
    if (!this.pageContextMonitor || !this.isMonitoringEnabled) {
      return null;
    }

    try {
      return await this.pageContextMonitor.getContext();
    } catch (error) {
      console.error("Failed to get page context:", error);
      return null;
    }
  }

  /**
   * Get ContextualAIService instance
   */
  public get contextualAIService(): ContextualAIService | null {
    return this._contextualAIService;
  }

  /**
   * Get ContextProvider instance
   */
  public get contextProvider(): ContextProvider | null {
    return this._contextProvider;
  }

  /**
   * Get AIServiceManager instance
   */
  public get aiServiceManager(): AIServiceManager | null {
    return this._aiServiceManager;
  }

  /**
   * Get monitoring enabled status
   */
  public get monitoringEnabled(): boolean {
    return this.isMonitoringEnabled;
  }

  /**
   * Get PageContextMonitor instance
   */
  public getPageContextMonitor(): PageContextMonitor | null {
    return this.pageContextMonitor;
  }

  /**
   * Get detailed status information for debugging
   */
  public getDetailedStatus(): any {
    return {
      isMonitoringEnabled: this.isMonitoringEnabled,
      hasPageContextMonitor: !!this.pageContextMonitor,
      monitoringState: this.pageContextMonitor?.getState() || "NONE",
      hasContextProvider: !!this._contextProvider,
      contextProviderReady: this._contextProvider?.isReady() || false,
      hasAIServiceManager: !!this._aiServiceManager,
      hasContextualAIService: !!this._contextualAIService,
      currentUrl: window.location.href,
      timestamp: new Date().toISOString(),
    };
  }

  private renderOverlay(): void {
    if (!this.root) return;

    this.root.render(
      React.createElement(SpotlightOverlay, {
        isVisible: this.isOverlayVisible,
        onClose: () => this.hideOverlay(),
        contextualAIService: this._contextualAIService,
      })
    );
  }

  private toggleOverlay(): void {
    if (this.isOverlayVisible) {
      this.hideOverlay();
    } else {
      this.showOverlay();
    }
  }

  private showOverlay(): void {
    if (this.isOverlayVisible) return;

    this.isOverlayVisible = true;

    // Enable pointer events when overlay is visible
    if (this.overlayContainer) {
      this.overlayContainer.style.pointerEvents = "auto";
    }

    // Prevent page scrolling when overlay is open
    document.body.style.overflow = "hidden";

    // Re-render with overlay visible
    this.renderOverlay();

    console.log("Spotlight Browser Extension: Overlay shown");
  }

  private hideOverlay(): void {
    if (!this.isOverlayVisible) return;

    this.isOverlayVisible = false;

    // Disable pointer events when overlay is hidden
    if (this.overlayContainer) {
      this.overlayContainer.style.pointerEvents = "none";
    }

    // Restore page scrolling
    document.body.style.overflow = "";

    // Re-render with overlay hidden
    this.renderOverlay();

    console.log("Spotlight Browser Extension: Overlay hidden");
  }

  public async cleanup(): Promise<void> {
    // Cleanup method for extension unload
    try {
      // Stop monitoring
      if (this.pageContextMonitor) {
        await this.pageContextMonitor.destroy();
        this.pageContextMonitor = null;
      }

      // Cleanup overlay
      if (this.overlayContainer && this.overlayContainer.parentNode) {
        this.overlayContainer.parentNode.removeChild(this.overlayContainer);
      }

      if (this.root) {
        this.root.unmount();
      }

      // Restore page styles
      document.body.style.overflow = "";

      // Cleanup keyboard manager
      if (this.keyboardManager) {
        this.keyboardManager.cleanup();
      }

      // Remove global references
      delete (window as any).__spotlightContentScript;
      delete (window as any).__spotlightTest;

      console.log("Spotlight Browser Extension: Content script cleaned up");
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }
}

// Initialize content script
let contentScript: ContentScript | null = null;

// Initialize function
async function initializeContentScript(): Promise<void> {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    try {
      contentScript = new ContentScript();

      // Wait for content script to fully initialize with timeout
      const initTimeout = new Promise<void>((resolve) => {
        setTimeout(() => {
          console.log(
            "Content script initialization timeout - proceeding anyway"
          );
          resolve();
        }, 8000); // 8 second timeout
      });

      const initComplete = new Promise<void>((resolve) => {
        let checkCount = 0;
        const maxChecks = 80; // 8 seconds (80 * 100ms)

        const checkInitialization = () => {
          checkCount++;

          // Check if context provider is ready OR if we have basic extension functionality
          const hasBasicFunctionality =
            contentScript &&
            (contentScript.contextProvider?.isReady() ||
              contentScript.monitoringEnabled);

          if (hasBasicFunctionality || checkCount >= maxChecks) {
            console.log("Content script initialization complete", {
              contextReady: contentScript?.contextProvider?.isReady() || false,
              monitoringEnabled: contentScript?.monitoringEnabled || false,
              checkCount,
              proceededAnyway: checkCount >= maxChecks,
            });
            resolve();
          } else {
            // Check again in 100ms
            setTimeout(checkInitialization, 100);
          }
        };

        // Start checking after a short delay to allow initial setup
        setTimeout(checkInitialization, 200);
      });

      // Wait for either completion or timeout
      await Promise.race([initComplete, initTimeout]);

      // Expose content script globally for ChatInterface access
      (window as any).__spotlightContentScript = contentScript;

      // Add a simple test method
      (window as any).__spotlightTest = () => {
        const testResult = {
          contentScriptReady: !!contentScript,
          contextProviderReady:
            contentScript?.contextProvider?.isReady() || false,
          monitoringEnabled: contentScript?.monitoringEnabled || false,
          monitoringState:
            contentScript?.getPageContextMonitor()?.getState() || "UNKNOWN",
          pageContextMonitor: !!contentScript?.getPageContextMonitor(),
          contextProvider: !!contentScript?.contextProvider,
        };
        console.log("Content Script: Test method called", testResult);
        return testResult;
      };

      // Dispatch a custom event to notify that the extension is ready
      const readyEvent = new CustomEvent("spotlightExtensionReady", {
        detail: {
          contextReady: contentScript?.contextProvider?.isReady() || false,
          monitoringEnabled: contentScript?.monitoringEnabled || false,
        },
      });
      window.dispatchEvent(readyEvent);

      console.log("Content Script: Initialized and exposed globally", {
        monitoringEnabled: contentScript?.monitoringEnabled,
        hasPageContextMonitor: !!contentScript?.getPageContextMonitor(),
        hasContextProvider: !!contentScript?.contextProvider,
        contextProviderReady: contentScript?.contextProvider?.isReady(),
      });
    } catch (error) {
      console.error(
        "Spotlight Browser Extension: Failed to initialize content script",
        error
      );
    }
  }
}

// Initialize when script loads (only in browser environment, not in tests)
if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
  initializeContentScript().catch((error) => {
    console.error("Failed to initialize content script:", error);
  });
}

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (contentScript) {
    // Note: beforeunload doesn't wait for async operations
    // but we still call cleanup for synchronous cleanup
    contentScript.cleanup().catch((error) => {
      console.error("Error during page unload cleanup:", error);
    });
    // Remove global references
    delete (window as any).__spotlightContentScript;
    delete (window as any).__spotlightTest;
  }
});

// Handle extension updates/reloads and monitoring control
if (typeof chrome !== "undefined" && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!contentScript) {
      sendResponse({ success: false, error: "Content script not initialized" });
      return;
    }

    switch (message.type) {
      case "EXTENSION_RELOAD":
        contentScript
          .cleanup()
          .then(() => {
            // Reinitialize
            contentScript = new ContentScript();
            sendResponse({ success: true });
          })
          .catch((error) => {
            console.error("Failed to reload extension:", error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Keep message channel open for async response

      case "ENABLE_MONITORING":
        contentScript
          .enableMonitoring()
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((error: Error) => {
            sendResponse({ success: false, error: error.message });
          });
        return true;

      case "DISABLE_MONITORING":
        contentScript
          .disableMonitoring()
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((error: Error) => {
            sendResponse({ success: false, error: error.message });
          });
        return true;

      case "GET_PAGE_CONTEXT":
        contentScript
          .getPageContext()
          .then((context) => {
            sendResponse({ success: true, context });
          })
          .catch((error) => {
            sendResponse({ success: false, error: error.message });
          });
        return true;

      case "UPDATE_MONITORING_SETTINGS":
      case "SETTINGS_UPDATED":
        // Reinitialize monitoring with new settings
        contentScript
          .disableMonitoring()
          .then(() => {
            return (contentScript as any).initializeMonitoring();
          })
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((error: Error) => {
            sendResponse({ success: false, error: error.message });
          });
        return true;

      case "GET_CONTEXTUAL_AI_STATUS":
        const aiStatus = {
          available: !!contentScript.contextualAIService,
          contextReady: contentScript.contextProvider?.isReady() || false,
          monitoringEnabled: contentScript.monitoringEnabled,
          monitoringState:
            contentScript.getPageContextMonitor()?.getState() || "STOPPED",
          aiServiceInfo: contentScript.contextualAIService
            ? contentScript.aiServiceManager?.getServiceInfo()
            : null,
        };
        sendResponse({ success: true, status: aiStatus });
        return true;

      case "UPDATE_AI_SERVICE_CONFIG":
        if (contentScript.aiServiceManager && message.config) {
          contentScript.aiServiceManager
            .setService(message.config.serviceName, message.config.config)
            .then(() => {
              // Update ContextualAIService with new AI service
              if (contentScript && contentScript.contextualAIService) {
                contentScript.contextualAIService.setAIService(
                  contentScript.aiServiceManager!.getCurrentService()
                );
              }
              sendResponse({ success: true });
            })
            .catch((error: Error) => {
              sendResponse({ success: false, error: error.message });
            });
        } else {
          sendResponse({
            success: false,
            error: "Invalid AI service configuration",
          });
        }
        return true;

      default:
        sendResponse({ success: false, error: "Unknown message type" });
    }
  });
}

// Export for testing purposes
export { ContentScript };
