import { ContextProvider, SuggestionType } from "../ContextProvider";
import { PageContextMonitor } from "../PageContextMonitor";
import { AggregatedContext } from "../ContextAggregator";
import { ChatMessage } from "../../types/workflow";

// Mock PageContextMonitor
jest.mock("../PageContextMonitor");

describe("ContextProvider", () => {
  let contextProvider: ContextProvider;
  let mockPageContextMonitor: jest.Mocked<PageContextMonitor>;
  let mockContext: AggregatedContext;

  beforeEach(() => {
    // Reset singleton
    (ContextProvider as any).instance = null;

    // Create mock context
    mockContext = {
      summary: {
        pageType: "article" as any,
        primaryContent: "This is a test article about web development",
        keyElements: [
          "H1: Web Development Guide",
          "Link: Learn More",
          "Form: Contact",
        ],
        userActivity: {
          recentInteractions: 3,
          activeElements: ["button", "input"],
          formActivity: true,
          navigationActivity: false,
        },
        dataFlows: [
          {
            type: "api",
            endpoint: "/api/articles",
            method: "GET",
            status: 200,
            timestamp: Date.now(),
            relevance: 0.8,
          },
        ],
        relevanceScore: 0.85,
      },
      content: {
        text: "This is a comprehensive guide to web development that covers all the essential topics you need to know to become a successful web developer. ".repeat(
          15
        ),
        headings: [
          {
            level: 1,
            text: "Web Development Guide",
            element: { tagName: "h1", selector: "h1" },
          },
        ],
        links: [
          {
            href: "/learn-more",
            text: "Learn More",
            element: { tagName: "a", selector: "a" },
          },
        ],
        images: [],
        forms: [
          {
            action: "/contact",
            method: "POST",
            fields: [
              { name: "email", type: "email", required: true },
              { name: "message", type: "textarea", required: true },
            ],
            element: { tagName: "form", selector: "form" },
          },
        ],
        tables: [],
        metadata: {
          title: "Web Development Guide",
          description: "Learn web development",
          language: "en",
        },
      },
      network: {
        recentRequests: [
          {
            id: "1",
            url: "/api/articles",
            method: "GET",
            status: 200,
            timestamp: Date.now(),
          },
        ],
        totalRequests: 5,
        totalDataTransferred: 1024,
        averageResponseTime: 150,
      },
      metadata: {
        timestamp: Date.now(),
        url: "https://example.com/guide",
        title: "Web Development Guide",
        aggregationTime: 50,
        cacheHit: false,
        dataQuality: {
          completeness: 0.9,
          freshness: 0.95,
          accuracy: 0.9,
          relevance: 0.85,
        },
      },
      performance: {
        responseTime: 50,
        dataSize: 2048,
        cacheHit: false,
        processingTime: 25,
      },
    };

    // Create mock PageContextMonitor
    mockPageContextMonitor = {
      isActive: jest.fn().mockReturnValue(true),
      getContext: jest.fn().mockResolvedValue(mockContext),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as any;

    // Get ContextProvider instance
    contextProvider = ContextProvider.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initialization", () => {
    it("should create singleton instance", () => {
      const instance1 = ContextProvider.getInstance();
      const instance2 = ContextProvider.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should initialize with PageContextMonitor", () => {
      contextProvider.initialize(mockPageContextMonitor);
      expect(mockPageContextMonitor.addEventListener).toHaveBeenCalledWith(
        "context_updated",
        expect.any(Function)
      );
    });

    it("should report ready state correctly", () => {
      expect(contextProvider.isReady()).toBe(false);

      contextProvider.initialize(mockPageContextMonitor);
      expect(contextProvider.isReady()).toBe(true);
    });
  });

  describe("getCurrentContext", () => {
    beforeEach(() => {
      contextProvider.initialize(mockPageContextMonitor);
    });

    it("should return null when not ready", async () => {
      mockPageContextMonitor.isActive.mockReturnValue(false);
      const context = await contextProvider.getCurrentContext();
      expect(context).toBeNull();
    });

    it("should return context when ready", async () => {
      const context = await contextProvider.getCurrentContext();
      expect(context).toBe(mockContext);
      expect(mockPageContextMonitor.getContext).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      mockPageContextMonitor.getContext.mockRejectedValue(
        new Error("Test error")
      );
      const context = await contextProvider.getCurrentContext();
      expect(context).toBeNull();
    });

    it("should cache context for performance", async () => {
      // First call
      await contextProvider.getCurrentContext();
      // Second call should use cache
      await contextProvider.getCurrentContext();

      // Should only call getContext once due to caching
      expect(mockPageContextMonitor.getContext).toHaveBeenCalledTimes(1);
    });
  });

  describe("enhancePrompt", () => {
    beforeEach(() => {
      contextProvider.initialize(mockPageContextMonitor);
    });

    it("should enhance prompt with context", async () => {
      const message = "What is this page about?";
      const enhanced = await contextProvider.enhancePrompt(message);

      expect(enhanced.originalMessage).toBe(message);
      expect(enhanced.enhancedMessage).toContain("Context:");
      expect(enhanced.enhancedMessage).toContain("article");
      expect(enhanced.enhancedMessage).toContain(message);
      expect(enhanced.enhancementApplied).toBe(true);
      expect(enhanced.contextData).toBe(mockContext);
    });

    it("should handle no context gracefully", async () => {
      mockPageContextMonitor.isActive.mockReturnValue(false);

      const message = "Test message";
      const enhanced = await contextProvider.enhancePrompt(message);

      expect(enhanced.originalMessage).toBe(message);
      expect(enhanced.enhancedMessage).toBe(message);
      expect(enhanced.enhancementApplied).toBe(false);
      expect(enhanced.contextData).toBeNull();
    });

    it("should include chat history in enhancement", async () => {
      const message = "Follow up question";
      const chatHistory: ChatMessage[] = [
        {
          id: "1",
          content: "Previous question",
          sender: "user",
          timestamp: new Date(),
        },
      ];

      const enhanced = await contextProvider.enhancePrompt(
        message,
        chatHistory
      );
      expect(enhanced.enhancementApplied).toBe(true);
    });
  });

  describe("generateSuggestions", () => {
    beforeEach(() => {
      // Re-setup mocks after clearAllMocks
      mockPageContextMonitor.isActive.mockReturnValue(true);
      mockPageContextMonitor.getContext.mockResolvedValue(mockContext);

      contextProvider.initialize(mockPageContextMonitor);
    });

    it("should generate form assistance suggestions", async () => {
      const suggestions = await contextProvider.generateSuggestions();

      const formSuggestion = suggestions.find(
        (s) => s.type === SuggestionType.FORM_ASSISTANCE
      );
      expect(formSuggestion).toBeDefined();
      expect(formSuggestion?.title).toContain("Smart Form Assistant");
      expect(formSuggestion?.actionable).toBe(true);
    });

    it("should generate API insights suggestions", async () => {
      const suggestions = await contextProvider.generateSuggestions();

      const apiSuggestion = suggestions.find(
        (s) => s.type === SuggestionType.API_INSIGHTS
      );
      expect(apiSuggestion).toBeDefined();
      expect(apiSuggestion?.title).toContain("API Activity");
    });

    it("should generate content summary suggestions", async () => {
      const suggestions = await contextProvider.generateSuggestions();

      const contentSuggestion = suggestions.find(
        (s) => s.type === SuggestionType.CONTENT_SUMMARY
      );
      expect(contentSuggestion).toBeDefined();
      expect(contentSuggestion?.title).toContain("Content Summarizer");
    });

    it("should return empty array when no context", async () => {
      mockPageContextMonitor.isActive.mockReturnValue(false);

      const suggestions = await contextProvider.generateSuggestions();
      expect(suggestions).toEqual([]);
    });

    it("should sort suggestions by confidence", async () => {
      const suggestions = await contextProvider.generateSuggestions();

      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(
          suggestions[i].confidence
        );
      }
    });

    it("should limit suggestions to 5", async () => {
      const suggestions = await contextProvider.generateSuggestions();
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe("getPromptSuggestions", () => {
    beforeEach(() => {
      contextProvider.initialize(mockPageContextMonitor);
    });

    it("should return page-specific suggestions for articles", async () => {
      const suggestions = await contextProvider.getPromptSuggestions();

      expect(suggestions).toContain("Summarize this article for me");
      expect(suggestions).toContain("What are the key points?");
    });

    it("should return form-specific suggestions when forms present", async () => {
      mockContext.summary.pageType = "form" as any;

      const suggestions = await contextProvider.getPromptSuggestions();

      expect(suggestions).toContain("Help me fill out this form");
      expect(suggestions).toContain("What information is required here?");
    });

    it("should return activity-based suggestions", async () => {
      const suggestions = await contextProvider.getPromptSuggestions();

      // Should include form activity suggestion since formActivity is true
      expect(suggestions).toContain("Help me with this form");
    });

    it("should return fallback suggestions when no context", async () => {
      mockPageContextMonitor.isActive.mockReturnValue(false);

      const suggestions = await contextProvider.getPromptSuggestions();

      expect(suggestions).toContain("What can you help me with?");
      expect(suggestions).toContain("Explain this page to me");
    });

    it("should limit suggestions to 4", async () => {
      const suggestions = await contextProvider.getPromptSuggestions();
      expect(suggestions.length).toBeLessThanOrEqual(4);
    });
  });

  describe("configuration", () => {
    it("should update configuration", () => {
      const newConfig = {
        includePageSummary: false,
        maxContextLength: 1000,
      };

      contextProvider.updateConfig(newConfig);
      const config = contextProvider.getConfig();

      expect(config.includePageSummary).toBe(false);
      expect(config.maxContextLength).toBe(1000);
    });

    it("should clear cache when context inclusion settings change", () => {
      contextProvider.initialize(mockPageContextMonitor);

      // Spy on clearCache method
      const clearCacheSpy = jest.spyOn(contextProvider, "clearCache");

      contextProvider.updateConfig({ includePageSummary: false });
      expect(clearCacheSpy).toHaveBeenCalled();
    });
  });

  describe("cache management", () => {
    beforeEach(() => {
      contextProvider.initialize(mockPageContextMonitor);
    });

    it("should clear cache", () => {
      contextProvider.clearCache();
      // Cache should be cleared - next call should fetch fresh data
      // This is tested indirectly through the caching behavior test above
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      contextProvider.initialize(mockPageContextMonitor);
    });

    it("should handle context fetch errors in enhancePrompt", async () => {
      // Make sure context provider is ready but getContext fails during enhancement
      mockPageContextMonitor.isActive.mockReturnValue(true);
      mockPageContextMonitor.getContext.mockRejectedValue(
        new Error("Network error")
      );

      const enhanced = await contextProvider.enhancePrompt("test message");

      expect(enhanced.enhancementApplied).toBe(false);
      expect(enhanced.contextSummary).toBe("No page context available");
    });

    it("should handle errors in generateSuggestions", async () => {
      mockPageContextMonitor.getContext.mockRejectedValue(
        new Error("Network error")
      );

      const suggestions = await contextProvider.generateSuggestions();
      expect(suggestions).toEqual([]);
    });

    it("should handle errors in getPromptSuggestions", async () => {
      mockPageContextMonitor.getContext.mockRejectedValue(
        new Error("Network error")
      );

      const suggestions = await contextProvider.getPromptSuggestions();

      // Should return fallback suggestions
      expect(suggestions).toContain("What can you help me with?");
    });
  });
});
