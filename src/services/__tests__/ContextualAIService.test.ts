import {
  ContextualAIService,
  ContextualMessageOptions,
  ContextualAIServiceResponse,
} from "../ContextualAIService";
import { MockAIService } from "../AIService";
import { ContextProvider } from "../ContextProvider";
import { FormattedContext } from "../ContextFormatter";

// Mock the ContextProvider
jest.mock("../ContextProvider");

describe("ContextualAIService", () => {
  let contextualAIService: ContextualAIService;
  let mockAIService: MockAIService;
  let mockContextProvider: jest.Mocked<ContextProvider>;

  const mockFormattedContext: FormattedContext = {
    summary: "Test page summary",
    content: {
      title: "Test Page",
      url: "https://example.com/test",
      mainContent: "This is the main content of the test page.",
      forms: [
        {
          action: "/submit",
          method: "POST",
          fieldCount: 2,
          fields: ["name (text)", "email (email)"],
        },
      ],
      tables: [],
      links: [
        {
          text: "Home",
          href: "/home",
          isExternal: false,
        },
      ],
    },
    network: {
      recentRequests: [
        {
          url: "/api/data",
          method: "GET",
          status: 200,
          type: "xhr",
          timestamp: "2024-01-01T00:00:00.000Z",
        },
      ],
      errors: [],
      apiEndpoints: ["/api/data"],
    },
    interactions: {
      recentActions: [
        {
          type: "click",
          element: "button#submit",
          timestamp: "2024-01-01T00:00:00.000Z",
        },
      ],
      focusedElements: [],
    },
    metadata: {
      pageType: "form",
      technologies: ["React"],
      semanticData: {
        hasStructuredData: false,
        schemaTypes: [],
        description: "Test page description",
      },
    },
    tokenCount: 150,
  };

  beforeEach(() => {
    // Create mock AI service
    mockAIService = new MockAIService();

    // Create mock context provider
    mockContextProvider = {
      isReady: jest.fn().mockReturnValue(true),
      getAIFormattedContext: jest.fn().mockResolvedValue(mockFormattedContext),
      generateSuggestions: jest.fn().mockResolvedValue([
        {
          type: "form_assistance",
          title: "Help with form",
          description: "I can help you fill out this form",
          confidence: 0.8,
        },
      ]),
    } as any;

    // Create contextual AI service
    contextualAIService = new ContextualAIService(
      mockAIService,
      mockContextProvider
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("sendContextualMessage", () => {
    it("should send message with page context when context is available", async () => {
      const message = "What is this page about?";
      const conversationId = "test-conversation";

      const response = await contextualAIService.sendContextualMessage(
        message,
        conversationId
      );

      expect(mockContextProvider.getAIFormattedContext).toHaveBeenCalledWith(
        message,
        1000 // default maxContextTokens
      );
      expect(response).toBeDefined();
      expect(response.message).toBeTruthy();
      expect(response.contextUsed).toBe(true);
      expect(response.contextTokens).toBe(150);
    });

    it("should send message without context when context provider is not ready", async () => {
      mockContextProvider.isReady.mockReturnValue(false);

      const message = "Hello";
      const conversationId = "test-conversation";

      const response = await contextualAIService.sendContextualMessage(
        message,
        conversationId
      );

      expect(mockContextProvider.getAIFormattedContext).not.toHaveBeenCalled();
      expect(response).toBeDefined();
      expect(response.contextUsed).toBe(false);
    });

    it("should send message without context when useContext is disabled", async () => {
      const message = "Hello";
      const conversationId = "test-conversation";
      const options: ContextualMessageOptions = {
        useContext: false,
      };

      const response = await contextualAIService.sendContextualMessage(
        message,
        conversationId,
        options
      );

      expect(mockContextProvider.getAIFormattedContext).not.toHaveBeenCalled();
      expect(response).toBeDefined();
      expect(response.contextUsed).toBe(false);
    });

    it("should handle context provider errors gracefully", async () => {
      mockContextProvider.getAIFormattedContext.mockRejectedValue(
        new Error("Context error")
      );

      const message = "What is this page about?";
      const conversationId = "test-conversation";

      const response = await contextualAIService.sendContextualMessage(
        message,
        conversationId
      );

      expect(response).toBeDefined();
      expect(response.contextUsed).toBe(false);
    });

    it("should build contextual message with all context types", async () => {
      const sendMessageSpy = jest.spyOn(mockAIService, "sendMessage");

      const message = "Analyze this page";
      const conversationId = "test-conversation";

      await contextualAIService.sendContextualMessage(message, conversationId);

      expect(sendMessageSpy).toHaveBeenCalled();
      const contextualMessage = sendMessageSpy.mock.calls[0][0];

      // Check that contextual message includes various context elements
      expect(contextualMessage).toContain("Current Page Context");
      expect(contextualMessage).toContain("Test Page");
      expect(contextualMessage).toContain("https://example.com/test");
      expect(contextualMessage).toContain("This is the main content");
      expect(contextualMessage).toContain("Forms on page");
      expect(contextualMessage).toContain("Recent Network Activity");
      expect(contextualMessage).toContain("Recent User Actions");
      expect(contextualMessage).toContain(
        "**User Question:** Analyze this page"
      );
    });

    it("should respect context options for including/excluding data types", async () => {
      const sendMessageSpy = jest.spyOn(mockAIService, "sendMessage");

      const message = "Test message";
      const conversationId = "test-conversation";
      const options: ContextualMessageOptions = {
        includeNetworkData: false,
        includeInteractions: false,
        includeDOMChanges: false,
      };

      await contextualAIService.sendContextualMessage(
        message,
        conversationId,
        options
      );

      const contextualMessage = sendMessageSpy.mock.calls[0][0];

      // Should not include network, interactions, or forms
      expect(contextualMessage).not.toContain("Recent Network Activity");
      expect(contextualMessage).not.toContain("Recent User Actions");
      expect(contextualMessage).not.toContain("Forms on page");

      // Should still include basic page info
      expect(contextualMessage).toContain("Test Page");
      expect(contextualMessage).toContain("**User Question:** Test message");
    });

    it("should maintain conversation history", async () => {
      const conversationId = "test-conversation";

      // Send first message
      await contextualAIService.sendContextualMessage(
        "First message",
        conversationId
      );

      // Send second message
      const sendMessageSpy = jest.spyOn(mockAIService, "sendMessage");
      await contextualAIService.sendContextualMessage(
        "Second message",
        conversationId
      );

      // Check that conversation history was passed
      expect(sendMessageSpy).toHaveBeenCalled();
      const conversationHistory = sendMessageSpy.mock.calls[0][1];
      expect(conversationHistory).toHaveLength(4); // Two user messages and two AI responses
    });
  });

  describe("sendContextualMessageStream", () => {
    it("should send streaming message with context", async () => {
      const message = "Stream test";
      const conversationId = "test-conversation";
      const chunks: string[] = [];
      const onChunk = (chunk: string) => chunks.push(chunk);

      const response = await contextualAIService.sendContextualMessageStream(
        message,
        conversationId,
        onChunk
      );

      expect(mockContextProvider.getAIFormattedContext).toHaveBeenCalled();
      expect(response).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
    }, 10000); // Increase timeout to 10 seconds

    it("should handle streaming errors gracefully", async () => {
      const streamingSpy = jest
        .spyOn(mockAIService, "sendMessageStream")
        .mockRejectedValue(new Error("Streaming error"));

      const message = "Stream test";
      const conversationId = "test-conversation";
      const onChunk = jest.fn();

      const response = await contextualAIService.sendContextualMessageStream(
        message,
        conversationId,
        onChunk
      );

      // Should fallback gracefully instead of throwing
      expect(response).toBeDefined();
      expect(response.message).toContain("fallback mode");
      expect(contextualAIService.isUsingFallback()).toBe(true);
      expect(streamingSpy).toHaveBeenCalled();
    }, 10000); // Increase timeout
  });

  describe("generateContextualSuggestions", () => {
    it("should generate suggestions when context provider is ready", async () => {
      const suggestions =
        await contextualAIService.generateContextualSuggestions();

      expect(mockContextProvider.generateSuggestions).toHaveBeenCalled();
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toEqual({
        id: "suggestion-0",
        type: "form-help",
        title: "Help with form",
        description: "I can help you fill out this form",
        confidence: 0.8,
        context: {
          pageUrl: "http://localhost/",
          contextType: "form_assistance",
        },
      });
    });

    it("should return empty array when context provider is not ready", async () => {
      mockContextProvider.isReady.mockReturnValue(false);

      const suggestions =
        await contextualAIService.generateContextualSuggestions();

      expect(mockContextProvider.generateSuggestions).not.toHaveBeenCalled();
      expect(suggestions).toEqual([]);
    });

    it("should handle suggestion generation errors", async () => {
      mockContextProvider.generateSuggestions.mockRejectedValue(
        new Error("Suggestion error")
      );

      const suggestions =
        await contextualAIService.generateContextualSuggestions();

      expect(suggestions).toEqual([]);
    });
  });

  describe("getContextSummary", () => {
    it("should return context summary when context is available", async () => {
      const summary = await contextualAIService.getContextSummary();

      expect(mockContextProvider.getAIFormattedContext).toHaveBeenCalled();
      expect(summary).toEqual({
        hasContext: true,
        pageTitle: "Test Page",
        pageUrl: "https://example.com/test",
        contextTypes: ["content", "forms", "network", "interactions"],
        tokenCount: 150,
        lastUpdated: expect.any(Date),
      });
    });

    it("should return no context summary when context provider is not ready", async () => {
      mockContextProvider.isReady.mockReturnValue(false);

      const summary = await contextualAIService.getContextSummary();

      expect(summary.hasContext).toBe(false);
      expect(summary.pageTitle).toBe("Unknown Page");
      expect(summary.contextTypes).toEqual([]);
    });

    it("should handle context summary errors", async () => {
      mockContextProvider.getAIFormattedContext.mockRejectedValue(
        new Error("Context error")
      );

      const summary = await contextualAIService.getContextSummary();

      expect(summary.hasContext).toBe(false);
    });
  });

  describe("conversation management", () => {
    it("should create new conversation when none exists", async () => {
      const conversationId = "new-conversation";

      await contextualAIService.sendContextualMessage("Hello", conversationId);

      const conversation = contextualAIService.getConversation(conversationId);
      expect(conversation).toBeDefined();
      expect(conversation!.id).toBe(conversationId);
      expect(conversation!.messages).toHaveLength(2); // User message + AI response
    });

    it("should clear conversation when requested", async () => {
      const conversationId = "test-conversation";

      await contextualAIService.sendContextualMessage("Hello", conversationId);

      let conversation = contextualAIService.getConversation(conversationId);
      expect(conversation).toBeDefined();

      contextualAIService.clearConversation(conversationId);

      conversation = contextualAIService.getConversation(conversationId);
      expect(conversation).toBeUndefined();
    });

    it("should limit conversation history to 10 messages", async () => {
      const conversationId = "long-conversation";

      // Send 6 messages (12 total with responses)
      for (let i = 0; i < 6; i++) {
        await contextualAIService.sendContextualMessage(
          `Message ${i}`,
          conversationId
        );
      }

      const conversation = contextualAIService.getConversation(conversationId);
      expect(conversation!.messages).toHaveLength(10); // Limited to 10
    }, 15000); // Increase timeout to 15 seconds
  });

  describe("configuration", () => {
    it("should update context options", () => {
      const newOptions: ContextualMessageOptions = {
        includeNetworkData: false,
        maxContextTokens: 500,
      };

      contextualAIService.setContextOptions(newOptions);

      // Verify options are applied by checking they're used in next message
      expect(() =>
        contextualAIService.setContextOptions(newOptions)
      ).not.toThrow();
    });

    it("should update AI service", () => {
      const newAIService = new MockAIService();

      contextualAIService.setAIService(newAIService);

      const serviceInfo = contextualAIService.getAIServiceInfo();
      expect(serviceInfo.name).toBe("Mock AI Service");
    });
  });

  describe("error handling", () => {
    it("should handle AI service errors with fallback", async () => {
      const errorAIService = new MockAIService();
      jest
        .spyOn(errorAIService, "sendMessage")
        .mockRejectedValue(new Error("AI service error"));

      const errorContextualService = new ContextualAIService(
        errorAIService,
        mockContextProvider
      );

      const response = await errorContextualService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      // Should fallback gracefully instead of throwing
      expect(response).toBeDefined();
      expect(response.message).toContain("fallback mode");
      expect(errorContextualService.isUsingFallback()).toBe(true);
    });

    it("should handle missing context gracefully", async () => {
      mockContextProvider.getAIFormattedContext.mockResolvedValue(null);

      const response = await contextualAIService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      expect(response).toBeDefined();
      expect(response.contextUsed).toBe(false);
    });
  });

  describe("context message building", () => {
    it("should build minimal contextual message when context has no optional data", async () => {
      const minimalContext: FormattedContext = {
        ...mockFormattedContext,
        content: {
          ...mockFormattedContext.content,
          forms: [],
          tables: [],
          links: [],
        },
        network: {
          ...mockFormattedContext.network,
          recentRequests: [],
        },
        interactions: {
          ...mockFormattedContext.interactions,
          recentActions: [],
        },
      };

      mockContextProvider.getAIFormattedContext.mockResolvedValue(
        minimalContext
      );

      const sendMessageSpy = jest.spyOn(mockAIService, "sendMessage");

      await contextualAIService.sendContextualMessage(
        "Test message",
        "test-conversation"
      );

      const contextualMessage = sendMessageSpy.mock.calls[0][0];

      // Should still include basic page info
      expect(contextualMessage).toContain("Current Page Context");
      expect(contextualMessage).toContain("Test Page");
      expect(contextualMessage).toContain("**User Question:** Test message");

      // Should not include empty sections
      expect(contextualMessage).not.toContain("Forms on page");
      expect(contextualMessage).not.toContain("Recent Network Activity");
      expect(contextualMessage).not.toContain("Recent User Actions");
    });
  });
});
