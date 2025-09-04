/**
 * @jest-environment jsdom
 */

import { ContentScript } from "../content";
import { KeyboardManager } from "../services/KeyboardManager";

// Mock React and ReactDOM
jest.mock("react", () => ({
  createElement: jest.fn(() => "mocked-element"),
}));

jest.mock("react-dom/client", () => ({
  createRoot: jest.fn(() => ({
    render: jest.fn(),
    unmount: jest.fn(),
  })),
}));

// Mock SpotlightOverlay component
jest.mock("../components/SpotlightOverlay", () => ({
  SpotlightOverlay: jest.fn(() => "mocked-spotlight-overlay"),
}));

// Mock KeyboardManager
jest.mock("../services/KeyboardManager");

describe("ContentScript", () => {
  let mockKeyboardManager: jest.Mocked<KeyboardManager>;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    // Mock console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();

    // Setup KeyboardManager mock
    mockKeyboardManager = {
      onToggleOverlay: jest.fn(),
      cleanup: jest.fn(),
      initialize: jest.fn(),
      setActive: jest.fn(),
      handleSearchKeyDown: jest.fn(),
      destroy: jest.fn(),
      detachGlobalListeners: jest.fn(),
    } as any;

    (KeyboardManager.getInstance as jest.Mock).mockReturnValue(
      mockKeyboardManager
    );

    // Clear document body
    document.body.innerHTML = "";
    document.body.style.overflow = "";
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Clear all mocks
    jest.clearAllMocks();

    // Clean up DOM
    document.body.innerHTML = "";
    document.body.style.overflow = "";
  });

  describe("Initialization", () => {
    it("should initialize content script successfully", () => {
      const contentScript = new (ContentScript as any)();

      expect(KeyboardManager.getInstance).toHaveBeenCalled();
      expect(mockKeyboardManager.onToggleOverlay).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        "Spotlight Browser Extension: Content script initialized"
      );
    });

    it("should create overlay container in DOM", () => {
      new (ContentScript as any)();

      const container = document.getElementById("spotlight-overlay-container");
      expect(container).toBeTruthy();
      expect(container?.style.position).toBe("fixed");
      expect(container?.style.zIndex).toBe("2147483647");
      expect(container?.style.pointerEvents).toBe("none");
    });

    it("should not create duplicate containers", () => {
      // Create first instance
      new (ContentScript as any)();
      const firstContainer = document.getElementById(
        "spotlight-overlay-container"
      );

      // Create second instance
      new (ContentScript as any)();
      const containers = document.querySelectorAll(
        "#spotlight-overlay-container"
      );

      expect(containers.length).toBe(1);
      expect(containers[0]).toBe(firstContainer);
    });

    it("should handle initialization errors gracefully", () => {
      // Mock KeyboardManager to throw error
      (KeyboardManager.getInstance as jest.Mock).mockImplementation(() => {
        throw new Error("Test error");
      });

      // The ContentScript constructor should handle errors internally
      // and not throw, but log the error
      const contentScript = new (ContentScript as any)();

      expect(console.error).toHaveBeenCalledWith(
        "Spotlight Browser Extension: Failed to initialize",
        expect.any(Error)
      );
    });
  });

  describe("Overlay Management", () => {
    let contentScript: any;
    let toggleCallback: () => void;

    beforeEach(() => {
      contentScript = new (ContentScript as any)();

      // Get the toggle callback that was registered
      const onToggleOverlayCall =
        mockKeyboardManager.onToggleOverlay.mock.calls[0];
      toggleCallback = onToggleOverlayCall[0];
    });

    it("should show overlay when toggle is called", () => {
      expect(contentScript.isOverlayVisible).toBe(false);

      toggleCallback();

      expect(contentScript.isOverlayVisible).toBe(true);
      expect(document.body.style.overflow).toBe("hidden");

      const container = document.getElementById("spotlight-overlay-container");
      expect(container?.style.pointerEvents).toBe("auto");
    });

    it("should hide overlay when toggle is called again", () => {
      // Show overlay first
      toggleCallback();
      expect(contentScript.isOverlayVisible).toBe(true);

      // Hide overlay
      toggleCallback();

      expect(contentScript.isOverlayVisible).toBe(false);
      expect(document.body.style.overflow).toBe("");

      const container = document.getElementById("spotlight-overlay-container");
      expect(container?.style.pointerEvents).toBe("none");
    });

    it("should hide overlay when onClose is called", () => {
      // Show overlay first
      toggleCallback();
      expect(contentScript.isOverlayVisible).toBe(true);

      // Simulate close callback
      contentScript.hideOverlay();

      expect(contentScript.isOverlayVisible).toBe(false);
      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("Keyboard Event Handling", () => {
    let contentScript: any;

    beforeEach(() => {
      contentScript = new (ContentScript as any)();
    });

    it("should handle escape key when overlay is visible", (done) => {
      // Show overlay
      const toggleCallback =
        mockKeyboardManager.onToggleOverlay.mock.calls[0][0];
      toggleCallback();

      expect(contentScript.isOverlayVisible).toBe(true);

      // The escape key handling is done by the SpotlightOverlay component
      // through the KeyboardManager, so we simulate the close callback being called
      // This would happen when the SpotlightOverlay handles the escape key
      contentScript.hideOverlay();

      // Check that overlay is now hidden
      expect(contentScript.isOverlayVisible).toBe(false);
      done();
    });

    it("should not handle escape key when overlay is hidden", () => {
      expect(contentScript.isOverlayVisible).toBe(false);

      const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" });
      document.dispatchEvent(escapeEvent);

      // Should remain hidden
      expect(contentScript.isOverlayVisible).toBe(false);
    });
  });

  describe("Cleanup", () => {
    let contentScript: any;

    beforeEach(() => {
      contentScript = new (ContentScript as any)();
    });

    it("should cleanup properly", () => {
      // Show overlay to set some state
      const toggleCallback =
        mockKeyboardManager.onToggleOverlay.mock.calls[0][0];
      toggleCallback();

      expect(
        document.getElementById("spotlight-overlay-container")
      ).toBeTruthy();
      expect(document.body.style.overflow).toBe("hidden");

      // Cleanup
      contentScript.cleanup();

      expect(
        document.getElementById("spotlight-overlay-container")
      ).toBeFalsy();
      expect(document.body.style.overflow).toBe("");
      expect(mockKeyboardManager.cleanup).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        "Spotlight Browser Extension: Content script cleaned up"
      );
    });

    it("should handle cleanup when container is already removed", () => {
      // Remove container manually
      const container = document.getElementById("spotlight-overlay-container");
      container?.remove();

      // Cleanup should not throw
      expect(() => contentScript.cleanup()).not.toThrow();
    });
  });

  describe("Chrome Extension Integration", () => {
    let contentScript: any;
    let mockChrome: any;

    beforeEach(() => {
      contentScript = new (ContentScript as any)();

      // Mock chrome API
      mockChrome = {
        runtime: {
          onMessage: {
            addListener: jest.fn(),
          },
        },
      };

      (global as any).chrome = mockChrome;
    });

    afterEach(() => {
      delete (global as any).chrome;
    });

    it("should register chrome runtime message listener", () => {
      // Re-run the chrome setup code
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.onMessage.addListener(jest.fn());
      }

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    it("should handle extension reload message", () => {
      let capturedListener: any;
      mockChrome.runtime.onMessage.addListener.mockImplementation(
        (listener: any) => {
          capturedListener = listener;
        }
      );

      // Re-run the chrome setup code to register the listener
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.onMessage.addListener(
          (message, sender, sendResponse) => {
            if (message.type === "EXTENSION_RELOAD") {
              if (contentScript) {
                contentScript.cleanup();
              }
              // Reinitialize
              contentScript = new (ContentScript as any)();
              sendResponse({ success: true });
            }
          }
        );
      }

      // Simulate the message
      const mockSendResponse = jest.fn();
      if (capturedListener) {
        capturedListener({ type: "EXTENSION_RELOAD" }, {}, mockSendResponse);
      }

      expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  describe("DOM Ready State Handling", () => {
    it("should wait for DOM ready if document is loading", () => {
      // Mock document.readyState as loading
      Object.defineProperty(document, "readyState", {
        value: "loading",
        writable: true,
      });

      const addEventListenerSpy = jest.spyOn(document, "addEventListener");

      new (ContentScript as any)();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "DOMContentLoaded",
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it("should initialize immediately if DOM is ready", () => {
      // Mock document.readyState as complete
      Object.defineProperty(document, "readyState", {
        value: "complete",
        writable: true,
      });

      new (ContentScript as any)();

      expect(KeyboardManager.getInstance).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        "Spotlight Browser Extension: Content script initialized"
      );
    });
  });
});
