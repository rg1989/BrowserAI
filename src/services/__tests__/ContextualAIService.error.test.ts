/**
 * Error handling tests for ContextualAIService
 * Tests MVP-7 requirements: fallback to MockAIService, error recovery
 */

import { ContextualAIService } from "../ContextualAIService";
import { BrowserLLMService } from "../BrowserLLMService";
import { MockAIService } from "../AIService";
import { ContextProvider } from "../ContextProvider";
import {
  ErrorHandler,
  ErrorCategory,
  ErrorSeverity,
} from "../../utils/ErrorHandler";

// Mock dependencies
jest.mock("../BrowserLLMService");
jest.mock("../ContextProvider");
jest.mock("../../utils/ErrorHandler");

const mockErrorHandler = {
  handleError: jest.fn(),
  getInstance: jest.fn(),
};
(ErrorHandler.getInstance as jest.Mock).mockReturnValue(mockErrorHandler);

describe("ContextualAIService Error Handling", () => {
  let contextualAIService: ContextualAIService;
  let mockBrowserLLMService: jest.Mocked<BrowserLLMService>;
  let mockContextProvider: jest.Mocked<ContextProvider>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock BrowserLLMService
    mockBrowserLLMService = {
      sendMessage: jest.fn(),
      sendMessageStream: jest.fn(),
      validateConfig: jest.fn(),
      getServiceInfo: jest.fn().mockReturnValue({
        name: "Browser LLM Service",
        version: "1.0.0",
        capabilities: ["chat", "offline"],
      }),
      loadModel: jest.fn(),
      unloadModel: jest.fn(),
      isServiceAvailable: jest.fn(),
      getLastError: jest.fn(),
      canFallback: jest.fn(),
      getHealthStatus: jest.fn(),
      getModelInfo: jest.fn(),
      getMemoryUsage: jest.fn(),
      updateConfig: jest.fn(),
      getConfig: jest.fn(),
    } as any;

    // Create mock ContextProvider
    mockContextProvider = {
      isReady: jest.fn().mockReturnValue(true),
      getAIFormattedContext: jest.fn(),
      generateSuggestions: jest.fn().mockResolvedValue([]),
      getInstance: jest.fn(),
    } as any;

    (ContextProvider.getInstance as jest.Mock).mockReturnValue(
      mockContextProvider
    );

    contextualAIService = new ContextualAIService(
      mockBrowserLLMService,
      mockContextProvider
    );
  });

  describe("Primary Service Failure and Fallback", () => {
    it("should fallback to MockAIService when primary service fails", async () => {
      // Mock primary service to fail
      mockBrowserLLMService.sendMessage.mockRejectedValue(
        new Error("Primary service failed")
      );

      // Mock context provider
      mockContextProvider.getAIFormattedContext.mockResolvedValue({
        summary: "Test page",
        content: {
          title: "Test Page",
          url: "https://example.com",
          mainContent: "Test content",
          forms: [],
          tables: [],
          links: [],
        },
        network: {
          recentRequests: [],
          errors: [],
          apiEndpoints: [],
        },
        interactions: {
          recentActions: [],
          focusedElements: [],
        },
        metadata: {
          pageType: "webpage",
          technologies: [],
          semanticData: {},
        },
        tokenCount: 100,
      });

      const response = await contextualAIService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      expect(response).toBeDefined();
      expect(response.message).toContain("fallback mode");
      expect(response.model).toContain("fallback mode");
      expect(contextualAIService.isUsingFallback()).toBe(true);
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        ErrorCategory.CONTEXT,
        ErrorSeverity.MEDIUM,
        expect.stringContaining("Primary AI service failed"),
        "ContextualAIService",
        expect.any(Error),
        expect.any(Object)
      );
    });

    it("should fallback to MockAIService for streaming when primary fails", async () => {
      // Mock primary service to fail
      mockBrowserLLMService.sendMessageStream.mockRejectedValue(
        new Error("Streaming failed")
      );

      const chunks: string[] = [];
      const onChunk = (chunk: string) => chunks.push(chunk);

      const response = await contextualAIService.sendContextualMessageStream(
        "Test message",
        "test-conversation",
        onChunk
      );

      expect(response).toBeDefined();
      expect(response.message).toContain("fallback mode");
      expect(contextualAIService.isUsingFallback()).toBe(true);
      expect(chunks.length).toBeGreaterThan(0); // Should have received chunks from fallback
    }, 10000); // Increase timeout for streaming test

    it("should return error response when both services fail", async () => {
      // Mock both services to fail
      mockBrowserLLMService.sendMessage.mockRejectedValue(
        new Error("Primary failed")
      );

      // Mock the fallback service by overriding the internal fallback
      const originalFallback = (contextualAIService as any).fallbackService;
      (contextualAIService as any).fallbackService = {
        sendMessage: jest.fn().mockRejectedValue(new Error("Fallback failed")),
        getServiceInfo: () => ({
          name: "Mock Fallback",
          version: "1.0.0",
          capabilities: [],
        }),
      };

      const response = await contextualAIService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      expect(response.message).toContain("technical difficulties");
      expect(response.model).toBe("error-fallback");
      expect(response.finishReason).toBe("error");

      // Restore original fallback
      (contextualAIService as any).fallbackService = originalFallback;
    });

    it("should switch back to primary service when it recovers", async () => {
      // First call fails, second succeeds
      mockBrowserLLMService.sendMessage
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValueOnce({
          message: "Primary service response",
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          model: "browser-llm",
          finishReason: "stop",
        });

      // First call - should use fallback
      const response1 = await contextualAIService.sendContextualMessage(
        "Test message 1",
        "test-conversation"
      );
      expect(contextualAIService.isUsingFallback()).toBe(true);
      expect(response1.message).toContain("fallback mode");

      // Second call - should switch back to primary
      const response2 = await contextualAIService.sendContextualMessage(
        "Test message 2",
        "test-conversation"
      );
      expect(contextualAIService.isUsingFallback()).toBe(false);
      expect(response2.message).toBe("Primary service response");
    });
  });

  describe("Context Provider Error Handling", () => {
    it("should continue without context when context provider fails", async () => {
      mockContextProvider.getAIFormattedContext.mockRejectedValue(
        new Error("Context failed")
      );
      mockBrowserLLMService.sendMessage.mockResolvedValue({
        message: "Response without context",
        usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
        model: "browser-llm",
        finishReason: "stop",
      });

      const response = await contextualAIService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      expect(response.message).toBe("Response without context");
      expect(response.contextUsed).toBe(false);
      expect(response.contextTokens).toBe(0);

      // Should have called AI service with original message (no context)
      expect(mockBrowserLLMService.sendMessage).toHaveBeenCalledWith(
        "Test message",
        expect.any(Array)
      );
    });

    it("should handle context provider not ready", async () => {
      mockContextProvider.isReady.mockReturnValue(false);
      mockBrowserLLMService.sendMessage.mockResolvedValue({
        message: "Response without context",
        usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
        model: "browser-llm",
        finishReason: "stop",
      });

      const response = await contextualAIService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      expect(response.contextUsed).toBe(false);
      expect(mockContextProvider.getAIFormattedContext).not.toHaveBeenCalled();
    });

    it("should handle null context gracefully", async () => {
      mockContextProvider.getAIFormattedContext.mockResolvedValue(null);
      mockBrowserLLMService.sendMessage.mockResolvedValue({
        message: "Response with null context",
        usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
        model: "browser-llm",
        finishReason: "stop",
      });

      const response = await contextualAIService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      expect(response.contextUsed).toBe(false);
      expect(response.contextTokens).toBe(0);
    });
  });

  describe("Service Health and Status", () => {
    it("should report service health status correctly", async () => {
      mockBrowserLLMService.validateConfig.mockResolvedValue(true);

      const status = await contextualAIService.getServiceHealthStatus();

      expect(status).toEqual({
        primaryService: {
          name: "Browser LLM Service",
          available: true,
          error: undefined,
        },
        fallbackService: {
          name: "Mock AI Service",
          available: true,
        },
        currentlyUsing: "primary",
      });
    });

    it("should report primary service errors in health status", async () => {
      mockBrowserLLMService.validateConfig.mockRejectedValue(
        new Error("Config invalid")
      );

      const status = await contextualAIService.getServiceHealthStatus();

      expect(status.primaryService.available).toBe(false);
      expect(status.primaryService.error).toBe("Config invalid");
    });

    it("should indicate when using fallback service", async () => {
      // Force fallback mode
      contextualAIService.switchToFallback();

      const status = await contextualAIService.getServiceHealthStatus();
      expect(status.currentlyUsing).toBe("fallback");
    });
  });

  describe("Manual Service Management", () => {
    it("should allow manual switch to fallback", () => {
      expect(contextualAIService.isUsingFallback()).toBe(false);

      contextualAIService.switchToFallback();

      expect(contextualAIService.isUsingFallback()).toBe(true);
    });

    it("should allow trying primary service recovery", async () => {
      mockBrowserLLMService.validateConfig.mockResolvedValue(true);

      // Start in fallback mode
      contextualAIService.switchToFallback();
      expect(contextualAIService.isUsingFallback()).toBe(true);

      // Try to recover
      const recovered = await contextualAIService.tryPrimaryService();

      expect(recovered).toBe(true);
      expect(contextualAIService.isUsingFallback()).toBe(false);
    });

    it("should fail to recover when primary service still invalid", async () => {
      mockBrowserLLMService.validateConfig.mockRejectedValue(
        new Error("Still invalid")
      );

      contextualAIService.switchToFallback();

      const recovered = await contextualAIService.tryPrimaryService();

      expect(recovered).toBe(false);
      expect(contextualAIService.isUsingFallback()).toBe(true);
    });
  });

  describe("Context Summary Error Handling", () => {
    it("should return basic summary when context provider not ready", async () => {
      mockContextProvider.isReady.mockReturnValue(false);

      const summary = await contextualAIService.getContextSummary();

      expect(summary).toEqual({
        hasContext: false,
        pageTitle: expect.any(String),
        pageUrl: expect.any(String),
        contextTypes: [],
        tokenCount: 0,
        lastUpdated: expect.any(Date),
      });
    });

    it("should handle context provider errors in summary", async () => {
      mockContextProvider.getAIFormattedContext.mockRejectedValue(
        new Error("Context error")
      );

      const summary = await contextualAIService.getContextSummary();

      expect(summary.hasContext).toBe(false);
      expect(summary.contextTypes).toEqual([]);
    });

    it("should handle null context in summary", async () => {
      mockContextProvider.getAIFormattedContext.mockResolvedValue(null);

      const summary = await contextualAIService.getContextSummary();

      expect(summary.hasContext).toBe(false);
    });
  });

  describe("Suggestion Generation Error Handling", () => {
    it("should return empty suggestions when context provider not ready", async () => {
      mockContextProvider.isReady.mockReturnValue(false);

      const suggestions =
        await contextualAIService.generateContextualSuggestions();

      expect(suggestions).toEqual([]);
      expect(mockContextProvider.generateSuggestions).not.toHaveBeenCalled();
    });

    it("should handle suggestion generation errors", async () => {
      mockContextProvider.generateSuggestions.mockRejectedValue(
        new Error("Suggestion error")
      );

      const suggestions =
        await contextualAIService.generateContextualSuggestions();

      expect(suggestions).toEqual([]);
    });

    it("should map suggestion types correctly", async () => {
      mockContextProvider.generateSuggestions.mockResolvedValue([
        {
          type: "form_assistance",
          title: "Help with form",
          description: "Fill out this form",
          confidence: 0.8,
        },
        {
          type: "error_diagnosis",
          title: "Debug error",
          description: "Fix this error",
          confidence: 0.9,
        },
      ]);

      const suggestions =
        await contextualAIService.generateContextualSuggestions();

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].type).toBe("form-help");
      expect(suggestions[1].type).toBe("debug-assist");
    });
  });

  describe("Conversation Management Error Handling", () => {
    it("should handle conversation context gracefully", () => {
      const conversation = contextualAIService.getConversation("non-existent");
      expect(conversation).toBeUndefined();
    });

    it("should clear conversation context without errors", () => {
      expect(() => {
        contextualAIService.clearConversation("test-conversation");
      }).not.toThrow();
    });

    it("should create new conversation when none exists", async () => {
      mockBrowserLLMService.sendMessage.mockResolvedValue({
        message: "New conversation response",
        usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
        model: "browser-llm",
        finishReason: "stop",
      });

      await contextualAIService.sendContextualMessage(
        "First message",
        "new-conversation"
      );

      const conversation =
        contextualAIService.getConversation("new-conversation");
      expect(conversation).toBeDefined();
      expect(conversation?.messages).toHaveLength(2); // User message + AI response
    });
  });
});
