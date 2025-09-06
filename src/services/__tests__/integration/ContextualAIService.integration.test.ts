import {
  ContextualAIService,
  ContextualAIServiceResponse,
} from "../../ContextualAIService";
import { BrowserLLMService } from "../../BrowserLLMService";
import { ContextProvider } from "../../ContextProvider";
import { MockAIService } from "../../AIService";

describe("ContextualAIService Integration", () => {
  let contextualAIService: ContextualAIService;

  beforeEach(() => {
    // Test with real components but mock external dependencies
    const mockAIService = new MockAIService();
    const contextProvider = ContextProvider.getInstance();

    contextualAIService = new ContextualAIService(
      mockAIService,
      contextProvider
    );
  });

  describe("Integration with BrowserLLMService", () => {
    it("should work with BrowserLLMService as AI backend", async () => {
      // Create a BrowserLLMService (will use mock transformers in test environment)
      const browserLLMService = new BrowserLLMService();

      // Mock the model loading to avoid actual model downloads in tests
      jest.spyOn(browserLLMService, "loadModel").mockResolvedValue();
      jest.spyOn(browserLLMService, "sendMessage").mockResolvedValue({
        message:
          "This is a response from the browser LLM about the current page context.",
        usage: {
          promptTokens: 50,
          completionTokens: 20,
          totalTokens: 70,
        },
        model: "tinyllama",
        finishReason: "stop",
      });

      const contextualServiceWithBrowserLLM = new ContextualAIService(
        browserLLMService,
        ContextProvider.getInstance()
      );

      const response =
        await contextualServiceWithBrowserLLM.sendContextualMessage(
          "What is this page about?",
          "test-conversation"
        );

      expect(response).toBeDefined();
      expect(response.message).toContain("browser LLM");
      expect(browserLLMService.sendMessage).toHaveBeenCalled();
    });
  });

  describe("Real-world usage scenarios", () => {
    it("should handle a typical contextual conversation flow", async () => {
      // Simulate a user asking about a form page
      const response1 = await contextualAIService.sendContextualMessage(
        "What forms are on this page?",
        "form-conversation"
      );

      expect(response1).toBeDefined();
      expect(response1.message).toBeTruthy();

      // Follow-up question
      const response2 = await contextualAIService.sendContextualMessage(
        "How do I fill out the email field?",
        "form-conversation"
      );

      expect(response2).toBeDefined();
      expect(response2.message).toBeTruthy();

      // Verify conversation history is maintained
      const conversation =
        contextualAIService.getConversation("form-conversation");
      expect(conversation).toBeDefined();
      expect(conversation!.messages.length).toBe(4); // 2 user messages + 2 AI responses
    });

    it("should generate contextual suggestions for different page types", async () => {
      const suggestions =
        await contextualAIService.generateContextualSuggestions();

      // Should return suggestions even if context provider is not fully initialized
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it("should provide context summary for UI display", async () => {
      const summary = await contextualAIService.getContextSummary();

      expect(summary).toBeDefined();
      expect(summary.hasContext).toBeDefined();
      expect(summary.pageTitle).toBeDefined();
      expect(summary.pageUrl).toBeDefined();
      expect(Array.isArray(summary.contextTypes)).toBe(true);
      expect(typeof summary.tokenCount).toBe("number");
      expect(summary.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe("Error resilience", () => {
    it("should gracefully handle AI service failures", async () => {
      // Create a failing AI service
      const failingAIService = new MockAIService();
      jest
        .spyOn(failingAIService, "sendMessage")
        .mockRejectedValue(new Error("AI service temporarily unavailable"));

      const contextualServiceWithFailingAI = new ContextualAIService(
        failingAIService,
        ContextProvider.getInstance()
      );

      const response =
        await contextualServiceWithFailingAI.sendContextualMessage(
          "Test message",
          "test-conversation"
        );

      // Should fallback gracefully instead of throwing
      expect(response).toBeDefined();
      expect(response.message).toContain("fallback mode");
      expect(contextualServiceWithFailingAI.isUsingFallback()).toBe(true);
    });

    it("should work when context provider is not ready", async () => {
      // Mock context provider as not ready
      const contextProvider = ContextProvider.getInstance();
      jest.spyOn(contextProvider, "isReady").mockReturnValue(false);

      const response = await contextualAIService.sendContextualMessage(
        "Hello without context",
        "no-context-conversation"
      );

      expect(response).toBeDefined();
      expect(response.message).toBeTruthy();
      expect(response.contextUsed).toBe(false);
    });
  });

  describe("Configuration and customization", () => {
    it("should respect custom context options", async () => {
      const customOptions = {
        includeNetworkData: false,
        includeInteractions: false,
        maxContextTokens: 500,
        useContext: true,
      };

      contextualAIService.setContextOptions(customOptions);

      const response = await contextualAIService.sendContextualMessage(
        "Test with custom options",
        "custom-conversation"
      );

      expect(response).toBeDefined();
      // The response should still work, just with different context inclusion
    });

    it("should allow switching AI services", () => {
      const originalServiceInfo = contextualAIService.getAIServiceInfo();
      expect(originalServiceInfo.name).toBe("Mock AI Service");

      const newAIService = new MockAIService();
      contextualAIService.setAIService(newAIService);

      const newServiceInfo = contextualAIService.getAIServiceInfo();
      expect(newServiceInfo.name).toBe("Mock AI Service");
    });
  });

  describe("Performance considerations", () => {
    it("should handle multiple concurrent conversations", async () => {
      const conversations = ["conv1", "conv2", "conv3"];

      const promises = conversations.map((convId) =>
        contextualAIService.sendContextualMessage(
          `Message for ${convId}`,
          convId
        )
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(3);
      responses.forEach((response) => {
        expect(response).toBeDefined();
        expect(response.message).toBeTruthy();
      });

      // Verify all conversations exist
      conversations.forEach((convId) => {
        const conversation = contextualAIService.getConversation(convId);
        expect(conversation).toBeDefined();
      });
    });

    it("should clean up conversations when requested", async () => {
      await contextualAIService.sendContextualMessage(
        "Test message",
        "cleanup-test"
      );

      let conversation = contextualAIService.getConversation("cleanup-test");
      expect(conversation).toBeDefined();

      contextualAIService.clearConversation("cleanup-test");

      conversation = contextualAIService.getConversation("cleanup-test");
      expect(conversation).toBeUndefined();
    });
  });
});
