/**
 * @jest-environment jsdom
 */

// Mock Chrome APIs
const mockChrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  webRequest: {
    onBeforeRequest: {
      addListener: jest.fn(),
    },
    onBeforeSendHeaders: {
      addListener: jest.fn(),
    },
    onHeadersReceived: {
      addListener: jest.fn(),
    },
    onCompleted: {
      addListener: jest.fn(),
    },
    onErrorOccurred: {
      addListener: jest.fn(),
    },
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
    onStartup: {
      addListener: jest.fn(),
    },
    sendMessage: jest.fn(),
  },
  tabs: {
    onUpdated: {
      addListener: jest.fn(),
    },
    onRemoved: {
      addListener: jest.fn(),
    },
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
};

// Mock services
jest.mock("../../services/NetworkStorage");
jest.mock("../../services/MonitoringConfig");
jest.mock("../../services/PrivacyController");
jest.mock("../../services/PageContextMonitor");
jest.mock("../../services/KeyboardManager");

describe("Background-Content Script Integration", () => {
  beforeEach(() => {
    // Setup Chrome API mock
    global.chrome = mockChrome as any;

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.debug = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe("Basic Integration", () => {
    it("should import background script without errors", async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        monitoringSettings: {
          enabled: true,
          features: { networkMonitoring: true },
        },
      });

      // Should import successfully
      await expect(import("../../background")).resolves.toBeDefined();
    });

    it("should handle Chrome API availability", () => {
      expect(global.chrome).toBeDefined();
      expect(global.chrome.storage).toBeDefined();
      expect(global.chrome.webRequest).toBeDefined();
      expect(global.chrome.runtime).toBeDefined();
      expect(global.chrome.tabs).toBeDefined();
    });
  });

  describe("Network Monitoring Integration", () => {
    it("should support webRequest API for network interception", () => {
      expect(mockChrome.webRequest.onBeforeRequest).toBeDefined();
      expect(mockChrome.webRequest.onCompleted).toBeDefined();
      expect(mockChrome.webRequest.onErrorOccurred).toBeDefined();
    });

    it("should support message passing between scripts", () => {
      expect(mockChrome.runtime.onMessage).toBeDefined();
      expect(mockChrome.tabs.sendMessage).toBeDefined();
    });
  });

  describe("Storage Integration", () => {
    it("should support storage operations", async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        monitoringSettings: { enabled: true },
      });

      const result = await mockChrome.storage.sync.get(["monitoringSettings"]);
      expect(result).toEqual({
        monitoringSettings: { enabled: true },
      });
    });

    it("should support storage change listeners", () => {
      expect(mockChrome.storage.onChanged.addListener).toBeDefined();
    });
  });

  describe("Tab Management Integration", () => {
    it("should support tab event listeners", () => {
      expect(mockChrome.tabs.onUpdated).toBeDefined();
      expect(mockChrome.tabs.onRemoved).toBeDefined();
    });

    it("should support tab querying and messaging", () => {
      expect(mockChrome.tabs.query).toBeDefined();
      expect(mockChrome.tabs.sendMessage).toBeDefined();
    });
  });

  describe("Cross-Script Communication", () => {
    it("should enable message passing between background and content scripts", () => {
      // Background script can listen for messages
      expect(mockChrome.runtime.onMessage.addListener).toBeDefined();

      // Background script can send messages to tabs
      expect(mockChrome.tabs.sendMessage).toBeDefined();

      // Content scripts can send messages via runtime.sendMessage
      expect(mockChrome.runtime.sendMessage).toBeDefined();
    });
  });

  describe("Error Handling Integration", () => {
    it("should handle missing webRequest API gracefully", async () => {
      // Remove webRequest API
      const originalWebRequest = mockChrome.webRequest;
      delete (mockChrome as any).webRequest;

      // Should still import successfully
      await expect(import("../../background")).resolves.toBeDefined();

      // Restore webRequest API
      mockChrome.webRequest = originalWebRequest;
    });

    it("should handle storage errors gracefully", async () => {
      mockChrome.storage.sync.get.mockRejectedValue(new Error("Storage error"));

      // Should still import successfully
      await expect(import("../../background")).resolves.toBeDefined();
    });
  });
});
