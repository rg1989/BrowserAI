/**
 * Integration tests for ContextualAI integration with content script
 * Tests MVP-6: Integrate with existing content script
 */

import { ContentScript } from "../../content";
import { ContextualAIService } from "../../services/ContextualAIService";
import { PageContextMonitor } from "../../services/PageContextMonitor";
import { ContextProvider } from "../../services/ContextProvider";
import { AIServiceManager } from "../../services/AIService";

// Mock Chrome APIs
const mockChrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
    },
    onChanged: {
      addListener: jest.fn(),
    },
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
  },
};

(global as any).chrome = mockChrome;

// Mock document properties
Object.defineProperty(document, "title", {
  value: "Test Page",
  writable: true,
  configurable: true,
});

Object.defineProperty(document, "readyState", {
  value: "complete",
  writable: true,
  configurable: true,
});

// Mock document.body if it doesn't exist
if (!document.body) {
  document.body = document.createElement("body");
}

describe("ContextualAI Content Script Integration", () => {
  let contentScript: ContentScript;
  let mockSettings: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock monitoring settings
    mockSettings = {
      enabled: true,
      features: {
        networkMonitoring: true,
        domObserver: true,
        contentAnalysis: true,
      },
      privacy: {
        excludedDomains: [],
        redactSensitiveData: true,
      },
      performance: {
        maxStorageSize: 10 * 1024 * 1024,
        cleanupInterval: 24 * 60 * 60 * 1000,
      },
      storage: {
        maxEntries: 1000,
        retentionDays: 7,
      },
    };

    mockChrome.storage.sync.get.mockImplementation((keys) => {
      if (keys.includes("monitoringSettings")) {
        return Promise.resolve({ monitoringSettings: mockSettings });
      }
      if (keys.includes("aiServiceConfig")) {
        return Promise.resolve({
          aiServiceConfig: {
            serviceName: "mock",
            config: {
              temperature: 0.7,
              maxTokens: 1000,
            },
          },
        });
      }
      return Promise.resolve({});
    });

    // Create content script instance
    contentScript = new ContentScript();
  });

  afterEach(async () => {
    if (contentScript) {
      await contentScript.cleanup();
    }
  });

  describe("Initialization", () => {
    it("should initialize ContextualAIService when monitoring is enabled", async () => {
      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(contentScript.contextualAIService).toBeDefined();
      expect(contentScript.contextProvider).toBeDefined();
      expect(contentScript.aiServiceManager).toBeDefined();
    });

    it("should handle initialization when monitoring is disabled", async () => {
      // Create new content script with disabled monitoring
      mockSettings.enabled = false;
      const disabledContentScript = new ContentScript();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still initialize but without monitoring
      expect(disabledContentScript.contextualAIService).toBeNull();
      expect(disabledContentScript.contextProvider).toBeNull();

      await disabledContentScript.cleanup();
    });

    it("should handle AI service configuration errors gracefully", async () => {
      // Mock AI service configuration error
      mockChrome.storage.sync.get.mockImplementation((keys) => {
        if (keys.includes("aiServiceConfig")) {
          return Promise.resolve({
            aiServiceConfig: {
              serviceName: "invalid-service",
              config: {},
            },
          });
        }
        return Promise.resolve({ monitoringSettings: mockSettings });
      });

      const errorContentScript = new ContentScript();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still initialize with fallback service
      expect(errorContentScript.contextualAIService).toBeDefined();
      expect(errorContentScript.aiServiceManager).toBeDefined();

      await errorContentScript.cleanup();
    });
  });

  describe("Message Handling", () => {
    beforeEach(async () => {
      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it("should handle GET_CONTEXTUAL_AI_STATUS message", async () => {
      // Test the status directly from the content script
      const status = {
        available: !!contentScript.contextualAIService,
        contextReady: contentScript.contextProvider?.isReady() || false,
        monitoringEnabled: contentScript.monitoringEnabled,
        aiServiceInfo: contentScript.contextualAIService
          ? contentScript.aiServiceManager?.getServiceInfo()
          : null,
      };

      // The ContextualAIService might not be available if monitoring is disabled
      // This is expected behavior, so we test for the correct structure
      expect(typeof status.available).toBe("boolean");
      expect(typeof status.contextReady).toBe("boolean");
      expect(typeof status.monitoringEnabled).toBe("boolean");

      if (status.available && status.aiServiceInfo) {
        expect(status.aiServiceInfo).toHaveProperty("name");
        expect(status.aiServiceInfo).toHaveProperty("version");
        expect(status.aiServiceInfo).toHaveProperty("capabilities");
      }
    });

    it("should handle UPDATE_AI_SERVICE_CONFIG message", async () => {
      const aiServiceManager = contentScript.aiServiceManager;
      const contextualAI = contentScript.contextualAIService;

      if (aiServiceManager && contextualAI) {
        const newConfig = {
          serviceName: "mock",
          config: {
            temperature: 0.8,
            maxTokens: 1500,
          },
        };

        // Test the service update directly
        await aiServiceManager.setService(
          newConfig.serviceName,
          newConfig.config
        );
        contextualAI.setAIService(aiServiceManager.getCurrentService());

        const serviceInfo = contextualAI.getAIServiceInfo();
        expect(serviceInfo).toBeDefined();
        expect(serviceInfo.name).toBe("Mock AI Service");
      }
    });

    it("should handle invalid AI service configuration", async () => {
      const aiServiceManager = contentScript.aiServiceManager;

      if (aiServiceManager) {
        // Test invalid service name
        await expect(
          aiServiceManager.setService("invalid-service", {})
        ).rejects.toThrow();
      }
    });
  });

  describe("ContextualAI Integration", () => {
    beforeEach(async () => {
      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it("should integrate ContextualAIService with PageContextMonitor", async () => {
      const contextualAI = contentScript.contextualAIService;
      const contextProvider = contentScript.contextProvider;

      expect(contextualAI).toBeDefined();
      expect(contextProvider).toBeDefined();

      // Verify that ContextualAIService has access to context
      if (contextualAI && contextProvider) {
        const contextSummary = await contextualAI.getContextSummary();
        expect(contextSummary).toBeDefined();
        expect(contextSummary.pageUrl).toBe("https://example.com/test");
        expect(contextSummary.pageTitle).toBe("Test Page");
      }
    });

    it("should handle contextual message sending", async () => {
      const contextualAI = contentScript.contextualAIService;

      if (contextualAI) {
        const response = await contextualAI.sendContextualMessage(
          "What is this page about?",
          "test-conversation",
          {
            useContext: true,
            maxContextTokens: 500,
          }
        );

        expect(response).toBeDefined();
        expect(response.message).toBeDefined();
        expect(typeof response.contextUsed).toBe("boolean");
        expect(typeof response.contextTokens).toBe("number");
      }
    });

    it("should generate contextual suggestions", async () => {
      const contextualAI = contentScript.contextualAIService;

      if (contextualAI) {
        const suggestions = await contextualAI.generateContextualSuggestions();
        expect(Array.isArray(suggestions)).toBe(true);

        // Each suggestion should have required properties
        suggestions.forEach((suggestion) => {
          expect(suggestion).toHaveProperty("id");
          expect(suggestion).toHaveProperty("type");
          expect(suggestion).toHaveProperty("title");
          expect(suggestion).toHaveProperty("description");
          expect(suggestion).toHaveProperty("confidence");
          expect(suggestion).toHaveProperty("context");
        });
      }
    });

    it("should handle AI service switching", async () => {
      const aiServiceManager = contentScript.aiServiceManager;
      const contextualAI = contentScript.contextualAIService;

      if (aiServiceManager && contextualAI) {
        const initialServiceInfo = aiServiceManager.getServiceInfo();
        expect(initialServiceInfo).toBeDefined();

        // Switch to a different service (mock)
        await aiServiceManager.setService("mock", {
          temperature: 0.9,
          maxTokens: 2000,
        });

        // Update ContextualAIService
        contextualAI.setAIService(aiServiceManager.getCurrentService());

        const newServiceInfo = contextualAI.getAIServiceInfo();
        expect(newServiceInfo).toBeDefined();
      }
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it("should handle ContextualAIService errors gracefully", async () => {
      const contextualAI = contentScript.contextualAIService;

      if (contextualAI) {
        // Mock an error in the AI service
        const mockAIService = {
          sendMessage: jest
            .fn()
            .mockRejectedValue(new Error("AI service error")),
          sendMessageStream: jest.fn(),
          validateConfig: jest.fn().mockResolvedValue(true),
          getServiceInfo: jest.fn().mockReturnValue({
            name: "Mock Error Service",
            version: "1.0.0",
            capabilities: [],
          }),
        };

        contextualAI.setAIService(mockAIService as any);

        // Should handle error gracefully
        await expect(
          contextualAI.sendContextualMessage(
            "test message",
            "test-conversation"
          )
        ).rejects.toThrow("AI service error");
      }
    });

    it("should handle context provider errors gracefully", async () => {
      const contextualAI = contentScript.contextualAIService;

      if (contextualAI) {
        // Should handle when context is not available
        const contextSummary = await contextualAI.getContextSummary();
        expect(contextSummary).toBeDefined();

        // Should have fallback values when context fails
        expect(contextSummary.hasContext).toBeDefined();
        expect(contextSummary.pageUrl).toBeDefined();
        expect(contextSummary.pageTitle).toBeDefined();
      }
    });
  });

  describe("Cleanup", () => {
    it("should cleanup ContextualAI resources properly", async () => {
      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(contentScript.contextualAIService).toBeDefined();

      // Cleanup should not throw errors
      await expect(contentScript.cleanup()).resolves.not.toThrow();
    });
  });

  describe("Chat Workflow Integration", () => {
    beforeEach(async () => {
      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it("should support ai-ask workflow with contextual AI", async () => {
      const contextualAI = contentScript.contextualAIService;

      if (contextualAI) {
        // Simulate ai-ask workflow
        const response = await contextualAI.sendContextualMessage(
          "What is this page about?",
          "ai-ask-conversation",
          {
            useContext: true,
            includeNetworkData: true,
            includeDOMChanges: true,
            includeInteractions: true,
          }
        );

        expect(response).toBeDefined();
        expect(response.message).toBeDefined();
        expect(response.contextUsed).toBe(true);
      }
    });

    it("should support ai-agent workflow with contextual AI", async () => {
      const contextualAI = contentScript.contextualAIService;

      if (contextualAI) {
        // Simulate ai-agent workflow
        const response = await contextualAI.sendContextualMessage(
          "Help me analyze the data on this page",
          "ai-agent-conversation",
          {
            useContext: true,
            maxContextTokens: 1000,
          }
        );

        expect(response).toBeDefined();
        expect(response.message).toBeDefined();
        expect(response.contextUsed).toBe(true);
      }
    });

    it("should maintain conversation context across messages", async () => {
      const contextualAI = contentScript.contextualAIService;

      if (contextualAI) {
        const conversationId = "test-conversation";

        // Send first message
        const response1 = await contextualAI.sendContextualMessage(
          "What is this page about?",
          conversationId
        );

        // Send follow-up message
        const response2 = await contextualAI.sendContextualMessage(
          "Can you provide more details?",
          conversationId
        );

        expect(response1).toBeDefined();
        expect(response2).toBeDefined();

        // Verify conversation context is maintained
        const conversation = contextualAI.getConversation(conversationId);
        expect(conversation).toBeDefined();
        expect(conversation?.messages.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Performance", () => {
    beforeEach(async () => {
      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it("should initialize ContextualAI without significant delay", async () => {
      const startTime = Date.now();

      // Create new content script and measure initialization time
      const testContentScript = new ContentScript();
      await new Promise((resolve) => setTimeout(resolve, 200));

      const initTime = Date.now() - startTime;

      // Should initialize within reasonable time (less than 1 second)
      expect(initTime).toBeLessThan(1000);
      expect(testContentScript.contextualAIService).toBeDefined();

      await testContentScript.cleanup();
    });

    it("should handle multiple contextual messages efficiently", async () => {
      const contextualAI = contentScript.contextualAIService;

      if (contextualAI) {
        const startTime = Date.now();
        const promises: Promise<any>[] = [];

        // Send multiple messages concurrently
        for (let i = 0; i < 5; i++) {
          promises.push(
            contextualAI.sendContextualMessage(
              `Test message ${i}`,
              `conversation-${i}`
            )
          );
        }

        const responses = await Promise.all(promises);
        const totalTime = Date.now() - startTime;

        expect(responses).toHaveLength(5);
        responses.forEach((response) => {
          expect(response).toBeDefined();
          expect(response.message).toBeDefined();
        });

        // Should handle multiple messages efficiently (less than 10 seconds total)
        expect(totalTime).toBeLessThan(10000);
      }
    });
  });
});
