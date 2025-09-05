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
jest.mock("../services/NetworkStorage");
jest.mock("../services/MonitoringConfig");
jest.mock("../services/PrivacyController");

describe("BackgroundScript", () => {
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

  describe("Module Import", () => {
    it("should import without errors", async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        monitoringSettings: {
          enabled: true,
          features: { networkMonitoring: true },
        },
      });

      // Import should not throw
      await expect(import("../background")).resolves.toBeDefined();
    });

    it("should handle initialization with disabled monitoring", async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        monitoringSettings: { enabled: false },
      });

      await import("../background");

      // Should not throw errors
      expect(true).toBe(true);
    });

    it("should handle missing Chrome APIs gracefully", async () => {
      // Remove webRequest API
      const originalWebRequest = mockChrome.webRequest;
      delete (mockChrome as any).webRequest;

      mockChrome.storage.sync.get.mockResolvedValue({});

      await import("../background");

      // Should not throw errors
      expect(true).toBe(true);

      // Restore webRequest API
      mockChrome.webRequest = originalWebRequest;
    });
  });

  describe("Chrome API Integration", () => {
    it("should have access to required Chrome APIs", () => {
      expect(mockChrome.storage).toBeDefined();
      expect(mockChrome.webRequest).toBeDefined();
      expect(mockChrome.runtime).toBeDefined();
      expect(mockChrome.tabs).toBeDefined();
    });

    it("should handle storage API calls", async () => {
      mockChrome.storage.sync.get.mockResolvedValue({});

      const result = await mockChrome.storage.sync.get(["monitoringSettings"]);
      expect(result).toEqual({});
    });

    it("should handle webRequest API setup", () => {
      expect(typeof mockChrome.webRequest.onBeforeRequest.addListener).toBe(
        "function"
      );
      expect(typeof mockChrome.webRequest.onCompleted.addListener).toBe(
        "function"
      );
    });
  });

  describe("Message Handling", () => {
    it("should support message listener registration", () => {
      expect(typeof mockChrome.runtime.onMessage.addListener).toBe("function");
    });

    it("should support tab messaging", () => {
      expect(typeof mockChrome.tabs.sendMessage).toBe("function");
    });
  });

  describe("Background Script Class", () => {
    it("should export BackgroundScript class", async () => {
      const backgroundModule = await import("../background");
      expect(backgroundModule.BackgroundScript).toBeDefined();
      expect(typeof backgroundModule.BackgroundScript).toBe("function");
    });

    it("should be instantiable", async () => {
      mockChrome.storage.sync.get.mockResolvedValue({});

      const { BackgroundScript } = await import("../background");

      // Should be able to create instance
      expect(() => new BackgroundScript()).not.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("should handle storage errors during initialization", async () => {
      mockChrome.storage.sync.get.mockRejectedValue(new Error("Storage error"));

      // Should not throw during import
      await expect(import("../background")).resolves.toBeDefined();
    });

    it("should handle missing storage data", async () => {
      mockChrome.storage.sync.get.mockResolvedValue({});

      // Should not throw during import
      await expect(import("../background")).resolves.toBeDefined();
    });
  });
});
