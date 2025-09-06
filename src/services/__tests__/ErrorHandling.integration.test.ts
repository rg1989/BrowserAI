/**
 * Integration tests for MVP-7 error handling and fallback mechanisms
 * Tests the complete error handling system across all components
 */

import { ContextualAIService } from "../ContextualAIService";
import { BrowserLLMService } from "../BrowserLLMService";
import { MockAIService } from "../AIService";
import { ContextProvider } from "../ContextProvider";

// Mock ContextProvider
jest.mock("../ContextProvider");

describe("Error Handling Integration Tests", () => {
  let contextualAIService: ContextualAIService;
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

  describe("Complete Fallback Chain", () => {
    it("should demonstrate complete error handling flow", async () => {
      // Create a BrowserLLMService that will fail
      const failingBrowserLLM = new BrowserLLMService();

      // Mock the internal methods to simulate failures
      jest
        .spyOn(failingBrowserLLM, "sendMessage")
        .mockRejectedValue(new Error("Browser LLM failed to load model"));
      jest.spyOn(failingBrowserLLM, "validateConfig").mockResolvedValue(false);
      jest.spyOn(failingBrowserLLM, "getServiceInfo").mockReturnValue({
        name: "Browser LLM Service",
        version: "1.0.0",
        capabilities: ["chat", "offline"],
      });

      // Create ContextualAIService with the failing BrowserLLM
      contextualAIService = new ContextualAIService(
        failingBrowserLLM,
        mockContextProvider
      );

      // Test that it falls back to MockAIService
      const response = await contextualAIService.sendContextualMessage(
        "What is this page about?",
        "test-conversation"
      );

      // Verify fallback worked
      expect(response).toBeDefined();
      expect(response.message).toContain("fallback mode");
      expect(contextualAIService.isUsingFallback()).toBe(true);

      // Verify service health status
      const healthStatus = await contextualAIService.getServiceHealthStatus();
      expect(healthStatus.fallbackService.available).toBe(true);
      expect(healthStatus.currentlyUsing).toBe("fallback");
    });

    it("should handle graceful degradation when context fails", async () => {
      // Create working AI service but failing context
      const workingAI = new MockAIService();
      mockContextProvider.getAIFormattedContext.mockRejectedValue(
        new Error("Context collection failed")
      );

      contextualAIService = new ContextualAIService(
        workingAI,
        mockContextProvider
      );

      const response = await contextualAIService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      // Should work without context
      expect(response).toBeDefined();
      expect(response.contextUsed).toBe(false);
      expect(response.contextTokens).toBe(0);
    });

    it("should provide meaningful error messages", async () => {
      const failingBrowserLLM = new BrowserLLMService();
      jest
        .spyOn(failingBrowserLLM, "sendMessage")
        .mockRejectedValue(new Error("Model loading timeout"));

      contextualAIService = new ContextualAIService(
        failingBrowserLLM,
        mockContextProvider
      );

      const response = await contextualAIService.sendContextualMessage(
        "Help me understand this error",
        "test-conversation"
      );

      // Should provide helpful fallback message
      expect(response.message).toContain("fallback mode");
      expect(response.message).toContain("limited capabilities");
    });
  });

  describe("Service Recovery", () => {
    it("should detect when primary service recovers", async () => {
      const recoveringBrowserLLM = new BrowserLLMService();

      // Mock validateConfig to succeed on recovery attempt
      jest
        .spyOn(recoveringBrowserLLM, "validateConfig")
        .mockResolvedValue(true);

      contextualAIService = new ContextualAIService(
        recoveringBrowserLLM,
        mockContextProvider
      );

      // Force fallback mode
      contextualAIService.switchToFallback();
      expect(contextualAIService.isUsingFallback()).toBe(true);

      // Try to recover
      const recovered = await contextualAIService.tryPrimaryService();
      expect(recovered).toBe(true);
      expect(contextualAIService.isUsingFallback()).toBe(false);
    });

    it("should maintain fallback when primary still fails", async () => {
      const stillFailingBrowserLLM = new BrowserLLMService();
      jest
        .spyOn(stillFailingBrowserLLM, "validateConfig")
        .mockResolvedValue(false);

      contextualAIService = new ContextualAIService(
        stillFailingBrowserLLM,
        mockContextProvider
      );

      contextualAIService.switchToFallback();

      const recovered = await contextualAIService.tryPrimaryService();
      expect(recovered).toBe(false);
      expect(contextualAIService.isUsingFallback()).toBe(true);
    });
  });

  describe("Error Scenarios Coverage", () => {
    it("should handle all types of AI service errors", async () => {
      const scenarios = [
        "Network timeout",
        "Model loading failed",
        "Out of memory",
      ];

      for (const errorMessage of scenarios) {
        const failingService = new BrowserLLMService();
        jest
          .spyOn(failingService, "sendMessage")
          .mockRejectedValue(new Error(errorMessage));

        const service = new ContextualAIService(
          failingService,
          mockContextProvider
        );

        const response = await service.sendContextualMessage(
          `Test error: ${errorMessage}`,
          `test-${errorMessage.replace(/\s+/g, "-")}`
        );

        // All should fallback gracefully
        expect(response).toBeDefined();
        expect(response.message).toContain("fallback mode");
        expect(service.isUsingFallback()).toBe(true);
      }
    }, 10000); // Increase timeout to 10 seconds

    it("should handle streaming errors consistently", async () => {
      const failingService = new BrowserLLMService();
      jest
        .spyOn(failingService, "sendMessageStream")
        .mockRejectedValue(new Error("Streaming failed"));

      const service = new ContextualAIService(
        failingService,
        mockContextProvider
      );

      const chunks: string[] = [];
      const response = await service.sendContextualMessageStream(
        "Test streaming error",
        "test-streaming",
        (chunk) => chunks.push(chunk)
      );

      expect(response).toBeDefined();
      expect(response.message).toContain("fallback mode");
      expect(chunks.length).toBeGreaterThan(0);
      expect(service.isUsingFallback()).toBe(true);
    }, 10000);
  });

  describe("Context Error Handling", () => {
    it("should handle context provider initialization errors", async () => {
      mockContextProvider.isReady.mockReturnValue(false);

      const service = new ContextualAIService(
        new MockAIService(),
        mockContextProvider
      );

      const summary = await service.getContextSummary();

      expect(summary.hasContext).toBe(false);
      expect(summary.contextTypes).toEqual([]);
    });

    it("should handle suggestion generation errors", async () => {
      mockContextProvider.isReady.mockReturnValue(false);

      const service = new ContextualAIService(
        new MockAIService(),
        mockContextProvider
      );

      const suggestions = await service.generateContextualSuggestions();

      expect(suggestions).toEqual([]);
    });
  });

  describe("Performance Under Error Conditions", () => {
    it("should not hang when services fail repeatedly", async () => {
      const alwaysFailingService = new BrowserLLMService();
      jest
        .spyOn(alwaysFailingService, "sendMessage")
        .mockRejectedValue(new Error("Persistent failure"));

      const service = new ContextualAIService(
        alwaysFailingService,
        mockContextProvider
      );

      const startTime = Date.now();

      // Make multiple requests
      const promises = Array.from({ length: 3 }, (_, i) =>
        service.sendContextualMessage(`Message ${i}`, `conversation-${i}`)
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
  });
});
