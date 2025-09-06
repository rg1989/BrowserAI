/**
 * Fallback mechanism tests for ContextualAIService
 * Tests MVP-7 requirements: fallback to MockAIService when primary fails
 */

import { ContextualAIService } from "../ContextualAIService";
import { BrowserLLMService } from "../BrowserLLMService";
import { MockAIService } from "../AIService";
import { ContextProvider } from "../ContextProvider";
import { ErrorHandler } from "../../utils/ErrorHandler";

// Mock dependencies
jest.mock("../BrowserLLMService");
jest.mock("../ContextProvider");
jest.mock("../../utils/ErrorHandler");

const mockErrorHandler = {
  handleError: jest.fn(),
  getInstance: jest.fn(),
};
(ErrorHandler.getInstance as jest.Mock).mockReturnValue(mockErrorHandler);

describe("ContextualAIService Fallback Mechanism", () => {
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
    } as any;

    // Create mock ContextProvider
    mockContextProvider = {
      isReady: jest.fn().mockReturnValue(true),
      getAIFormattedContext: jest.fn().mockResolvedValue(null),
    } as any;

    (ContextProvider.getInstance as jest.Mock).mockReturnValue(
      mockContextProvider
    );

    contextualAIService = new ContextualAIService(
      mockBrowserLLMService,
      mockContextProvider
    );
  });

  describe("Primary Service Failure Scenarios", () => {
    it("should fallback to MockAIService when primary service fails", async () => {
      // Mock primary service to fail
      mockBrowserLLMService.sendMessage.mockRejectedValue(
        new Error("Primary service failed")
      );

      const response = await contextualAIService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      expect(response).toBeDefined();
      expect(response.message).toContain("fallback mode");
      expect(response.model).toContain("fallback mode");
      expect(contextualAIService.isUsingFallback()).toBe(true);

      // Should have logged the error
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });

    it("should fallback for streaming messages when primary fails", async () => {
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
      expect(chunks.length).toBeGreaterThan(0);
    }, 10000); // Increase timeout for streaming test

    it("should return error response when both services fail", async () => {
      // Mock both services to fail by overriding the fallback service
      mockBrowserLLMService.sendMessage.mockRejectedValue(
        new Error("Primary failed")
      );

      // Override the internal fallback service to also fail
      const mockFailingFallback = {
        sendMessage: jest.fn().mockRejectedValue(new Error("Fallback failed")),
        getServiceInfo: () => ({
          name: "Mock Fallback",
          version: "1.0.0",
          capabilities: [],
        }),
      };
      (contextualAIService as any).fallbackService = mockFailingFallback;

      const response = await contextualAIService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      expect(response.message).toContain("technical difficulties");
      expect(response.model).toBe("error-fallback");
      expect(response.finishReason).toBe("error");
    });

    it("should switch back to primary when it recovers", async () => {
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

      // Second call - should switch back to primary
      const response2 = await contextualAIService.sendContextualMessage(
        "Test message 2",
        "test-conversation"
      );
      expect(contextualAIService.isUsingFallback()).toBe(false);
      expect(response2.message).toBe("Primary service response");
    });
  });

  describe("Service Health Monitoring", () => {
    it("should report correct health status when primary is available", async () => {
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

    it("should report primary service errors", async () => {
      mockBrowserLLMService.validateConfig.mockRejectedValue(
        new Error("Config invalid")
      );

      const status = await contextualAIService.getServiceHealthStatus();

      expect(status.primaryService.available).toBe(false);
      expect(status.primaryService.error).toBe("Config invalid");
    });

    it("should indicate when using fallback", async () => {
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

      contextualAIService.switchToFallback();
      expect(contextualAIService.isUsingFallback()).toBe(true);

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

  describe("Error Handling with Context", () => {
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
  });

  describe("Retry and Recovery Mechanisms", () => {
    it("should handle temporary failures gracefully", async () => {
      // Simulate temporary network issue - first call fails, fallback is used
      mockBrowserLLMService.sendMessage.mockRejectedValue(
        new Error("Network timeout")
      );

      const response = await contextualAIService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      // Should fallback gracefully and provide a response
      expect(response).toBeDefined();
      expect(response.message).toContain("fallback mode");
      expect(contextualAIService.isUsingFallback()).toBe(true);
    });

    it("should provide clear error messages in fallback mode", async () => {
      mockBrowserLLMService.sendMessage.mockRejectedValue(
        new Error("Model loading failed")
      );

      const response = await contextualAIService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      expect(response.message).toContain("fallback mode");
      expect(response.message).toContain("limited capabilities");
    });
  });
});
