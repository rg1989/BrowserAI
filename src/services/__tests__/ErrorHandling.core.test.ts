/**
 * Core error handling functionality tests for MVP-7
 * Tests the essential error handling features without complex mocking
 */

import { ContextualAIService } from "../ContextualAIService";
import { BrowserLLMService } from "../BrowserLLMService";
import { MockAIService } from "../AIService";
import { ContextProvider } from "../ContextProvider";

// Mock ContextProvider
jest.mock("../ContextProvider");

describe("Core Error Handling Features", () => {
  let mockContextProvider: jest.Mocked<ContextProvider>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock ContextProvider
    mockContextProvider = {
      isReady: jest.fn().mockReturnValue(true),
      getAIFormattedContext: jest.fn().mockResolvedValue(null),
      getInstance: jest.fn(),
    } as any;

    (ContextProvider.getInstance as jest.Mock).mockReturnValue(
      mockContextProvider
    );
  });

  describe("MVP-7 Requirements Validation", () => {
    it("should implement graceful fallback when browser LLM fails to load (Req 10.1)", async () => {
      // Create a failing BrowserLLM service
      const failingBrowserLLM = new BrowserLLMService();
      jest
        .spyOn(failingBrowserLLM, "sendMessage")
        .mockRejectedValue(new Error("Browser LLM failed to load model"));

      const contextualService = new ContextualAIService(
        failingBrowserLLM,
        mockContextProvider
      );

      // Should fallback gracefully
      const response = await contextualService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      expect(response).toBeDefined();
      expect(response.message).toContain("fallback mode");
      expect(contextualService.isUsingFallback()).toBe(true);
    });

    it("should provide clear error messages for model loading issues (Req 10.2)", async () => {
      const failingBrowserLLM = new BrowserLLMService();
      jest
        .spyOn(failingBrowserLLM, "sendMessage")
        .mockRejectedValue(new Error("Model loading timeout"));

      const contextualService = new ContextualAIService(
        failingBrowserLLM,
        mockContextProvider
      );

      const response = await contextualService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      // Should provide clear fallback message
      expect(response.message).toContain("fallback mode");
      expect(response.message).toContain("limited capabilities");
    });

    it("should fallback to existing MockAIService when needed (Req 3.4)", async () => {
      const failingBrowserLLM = new BrowserLLMService();
      jest
        .spyOn(failingBrowserLLM, "sendMessage")
        .mockRejectedValue(new Error("Service unavailable"));

      const contextualService = new ContextualAIService(
        failingBrowserLLM,
        mockContextProvider
      );

      const response = await contextualService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      // Should use MockAIService as fallback
      expect(response).toBeDefined();
      expect(response.model).toContain("fallback mode");
      expect(contextualService.isUsingFallback()).toBe(true);
    });

    it("should implement retry mechanisms for failed AI requests", async () => {
      const recoveringBrowserLLM = new BrowserLLMService();

      // First call fails, second succeeds
      jest
        .spyOn(recoveringBrowserLLM, "sendMessage")
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValueOnce({
          message: "Success after recovery",
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          model: "browser-llm",
          finishReason: "stop",
        });

      const contextualService = new ContextualAIService(
        recoveringBrowserLLM,
        mockContextProvider
      );

      // First call - should use fallback
      const response1 = await contextualService.sendContextualMessage(
        "Test message 1",
        "test-conversation"
      );
      expect(contextualService.isUsingFallback()).toBe(true);

      // Second call - should recover to primary
      const response2 = await contextualService.sendContextualMessage(
        "Test message 2",
        "test-conversation"
      );
      expect(contextualService.isUsingFallback()).toBe(false);
      expect(response2.message).toBe("Success after recovery");
    });
  });

  describe("Error Scenario Coverage", () => {
    it("should handle network timeouts gracefully", async () => {
      const failingService = new BrowserLLMService();
      jest
        .spyOn(failingService, "sendMessage")
        .mockRejectedValue(new Error("Network timeout"));

      const contextualService = new ContextualAIService(
        failingService,
        mockContextProvider
      );

      const response = await contextualService.sendContextualMessage(
        "Test network error",
        "test-network"
      );

      expect(response).toBeDefined();
      expect(response.message).toContain("fallback mode");
    });

    it("should handle memory errors gracefully", async () => {
      const failingService = new BrowserLLMService();
      jest
        .spyOn(failingService, "sendMessage")
        .mockRejectedValue(new Error("Out of memory"));

      const contextualService = new ContextualAIService(
        failingService,
        mockContextProvider
      );

      const response = await contextualService.sendContextualMessage(
        "Test memory error",
        "test-memory"
      );

      expect(response).toBeDefined();
      expect(response.message).toContain("fallback mode");
    });

    it("should handle WebGPU errors gracefully", async () => {
      const failingService = new BrowserLLMService();
      jest
        .spyOn(failingService, "sendMessage")
        .mockRejectedValue(new Error("WebGPU not supported"));

      const contextualService = new ContextualAIService(
        failingService,
        mockContextProvider
      );

      const response = await contextualService.sendContextualMessage(
        "Test WebGPU error",
        "test-webgpu"
      );

      expect(response).toBeDefined();
      expect(response.message).toContain("fallback mode");
    });

    it("should handle streaming errors consistently", async () => {
      const failingService = new BrowserLLMService();
      jest
        .spyOn(failingService, "sendMessageStream")
        .mockRejectedValue(new Error("Streaming failed"));

      const contextualService = new ContextualAIService(
        failingService,
        mockContextProvider
      );

      const chunks: string[] = [];
      const response = await contextualService.sendContextualMessageStream(
        "Test streaming error",
        "test-streaming",
        (chunk) => chunks.push(chunk)
      );

      expect(response).toBeDefined();
      expect(response.message).toContain("fallback mode");
      expect(chunks.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe("Service Management", () => {
    it("should provide service health status", async () => {
      const workingService = new MockAIService();
      const contextualService = new ContextualAIService(
        workingService,
        mockContextProvider
      );

      const status = await contextualService.getServiceHealthStatus();

      expect(status).toBeDefined();
      expect(status.primaryService).toBeDefined();
      expect(status.fallbackService).toBeDefined();
      expect(status.currentlyUsing).toBeDefined();
    });

    it("should allow manual service switching", () => {
      const contextualService = new ContextualAIService(
        new MockAIService(),
        mockContextProvider
      );

      expect(contextualService.isUsingFallback()).toBe(false);

      contextualService.switchToFallback();
      expect(contextualService.isUsingFallback()).toBe(true);
    });

    it("should support service recovery attempts", async () => {
      const workingService = new MockAIService();
      jest.spyOn(workingService, "validateConfig").mockResolvedValue(true);

      const contextualService = new ContextualAIService(
        workingService,
        mockContextProvider
      );

      contextualService.switchToFallback();
      expect(contextualService.isUsingFallback()).toBe(true);

      const recovered = await contextualService.tryPrimaryService();
      expect(recovered).toBe(true);
      expect(contextualService.isUsingFallback()).toBe(false);
    });
  });

  describe("Context Error Handling", () => {
    it("should continue without context when context provider fails", async () => {
      mockContextProvider.getAIFormattedContext.mockRejectedValue(
        new Error("Context collection failed")
      );

      const contextualService = new ContextualAIService(
        new MockAIService(),
        mockContextProvider
      );

      const response = await contextualService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      expect(response).toBeDefined();
      expect(response.contextUsed).toBe(false);
      expect(response.contextTokens).toBe(0);
    });

    it("should handle context provider not ready", async () => {
      mockContextProvider.isReady.mockReturnValue(false);

      const contextualService = new ContextualAIService(
        new MockAIService(),
        mockContextProvider
      );

      const response = await contextualService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      expect(response.contextUsed).toBe(false);
      expect(mockContextProvider.getAIFormattedContext).not.toHaveBeenCalled();
    });

    it("should provide context summary even when context fails", async () => {
      mockContextProvider.isReady.mockReturnValue(false);

      const contextualService = new ContextualAIService(
        new MockAIService(),
        mockContextProvider
      );

      const summary = await contextualService.getContextSummary();

      expect(summary).toBeDefined();
      expect(summary.hasContext).toBe(false);
      expect(summary.contextTypes).toEqual([]);
    });
  });

  describe("Performance and Reliability", () => {
    it("should not hang when services fail repeatedly", async () => {
      const alwaysFailingService = new BrowserLLMService();
      jest
        .spyOn(alwaysFailingService, "sendMessage")
        .mockRejectedValue(new Error("Persistent failure"));

      const contextualService = new ContextualAIService(
        alwaysFailingService,
        mockContextProvider
      );

      const startTime = Date.now();

      // Make multiple concurrent requests
      const promises = Array.from({ length: 3 }, (_, i) =>
        contextualService.sendContextualMessage(
          `Message ${i}`,
          `conversation-${i}`
        )
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // Should complete quickly (fallback is fast)
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds max

      // All should have fallback responses
      responses.forEach((response) => {
        expect(response.message).toContain("fallback mode");
      });
    });

    it("should maintain conversation state across errors", async () => {
      const failingService = new BrowserLLMService();
      jest
        .spyOn(failingService, "sendMessage")
        .mockRejectedValue(new Error("Service error"));

      const contextualService = new ContextualAIService(
        failingService,
        mockContextProvider
      );

      // Send multiple messages to same conversation
      await contextualService.sendContextualMessage(
        "Message 1",
        "test-conversation"
      );
      await contextualService.sendContextualMessage(
        "Message 2",
        "test-conversation"
      );

      const conversation =
        contextualService.getConversation("test-conversation");

      expect(conversation).toBeDefined();
      expect(conversation?.messages.length).toBe(4); // 2 user + 2 AI messages
    });
  });
});
