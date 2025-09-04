import React from "react";
import { createRoot } from "react-dom/client";
import { SpotlightOverlay } from "./components/SpotlightOverlay";
import { KeyboardManager } from "./services/KeyboardManager";

// Content script for Spotlight Browser Extension
// This script injects the SpotlightOverlay component into web pages

class ContentScript {
  private overlayContainer: HTMLDivElement | null = null;
  private root: any = null;
  private keyboardManager: KeyboardManager;
  private isOverlayVisible = false;

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
      document.addEventListener("DOMContentLoaded", () => this.setupOverlay());
    } else {
      this.setupOverlay();
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

      console.log("Spotlight Browser Extension: Content script initialized");
    } catch (error) {
      console.error("Spotlight Browser Extension: Failed to initialize", error);
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
    this.keyboardManager.onToggleOverlay(() => {
      this.toggleOverlay();
    });

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

  private renderOverlay(): void {
    if (!this.root) return;

    this.root.render(
      React.createElement(SpotlightOverlay, {
        isVisible: this.isOverlayVisible,
        onClose: () => this.hideOverlay(),
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

  public cleanup(): void {
    // Cleanup method for extension unload
    if (this.overlayContainer && this.overlayContainer.parentNode) {
      this.overlayContainer.parentNode.removeChild(this.overlayContainer);
    }

    if (this.root) {
      this.root.unmount();
    }

    // Restore page styles
    document.body.style.overflow = "";

    // Cleanup keyboard manager
    this.keyboardManager.cleanup();

    console.log("Spotlight Browser Extension: Content script cleaned up");
  }
}

// Initialize content script
let contentScript: ContentScript | null = null;

// Initialize function
function initializeContentScript(): void {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    try {
      contentScript = new ContentScript();
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
  initializeContentScript();
}

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (contentScript) {
    contentScript.cleanup();
  }
});

// Handle extension updates/reloads
if (typeof chrome !== "undefined" && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "EXTENSION_RELOAD") {
      if (contentScript) {
        contentScript.cleanup();
      }
      // Reinitialize
      contentScript = new ContentScript();
      sendResponse({ success: true });
    }
  });
}

// Export for testing purposes
export { ContentScript };
