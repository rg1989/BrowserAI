import { ContextProvider } from "../../services/ContextProvider";
import { PageContextMonitor } from "../../services/PageContextMonitor";
import { AggregatedContext } from "../../services/ContextAggregator";

// Mock PageContextMonitor
const mockPageContextMonitor = {
  isActive: jest.fn().mockReturnValue(true),
  getContext: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
};

// Mock context data
const mockAggregatedContext: AggregatedContext = {
  summary: {
    pageType: "article" as any,
    primaryContent: "This is a test article about AI integration",
    keyElements: [
      "Article: AI Integration",
      "Heading: Introduction",
      "Paragraph: Content",
    ],
    userActivity: {
      recentInteractions: 1,
      activeElements: ["article"],
      formActivity: false,
      navigationActivity: false,
    },
    dataFlows: [],
    relevanceScore: 0.9,
  },
  content: {
    text: "This is a test article about AI integration with context providers. ".repeat(
      35
    ), // Make it longer than 2000 chars
    headings: [
      {
        level: 1,
        text: "AI Integration",
        element: { tagName: "h1", selector: "h1" },
      },
    ],
    links: [],
    images: [],
    forms: [],
    tables: [],
    metadata: {
      title: "AI Integration Test",
      description: "Test article",
      language: "en",
    },
  },
  metadata: {
    timestamp: Date.now(),
    url: "https://example.com/ai-integration",
    title: "AI Integration Test",
    aggregationTime: 25,
    cacheHit: false,
    dataQuality: {
      completeness: 0.95,
      freshness: 0.98,
      accuracy: 0.92,
      relevance: 0.9,
    },
  },
  performance: {
    responseTime: 25,
    dataSize: 2048,
    cacheHit: false,
    processingTime: 12,
  },
};

describe("Context-AI Integration", () => {
  let contextProvider: ContextProvider;

  beforeEach(() => {
    // Reset singleton
    (ContextProvider as any).instance = null;

    // Reset mocks
    jest.clearAllMocks();

    // Setup mock to return context
    mockPageContextMonitor.getContext.mockResolvedValue(mockAggregatedContext);
    mockPageContextMonitor.isActive.mockReturnValue(true);

    // Get ContextProvider instance
    contextProvider = ContextProvider.getInstance();

    // Initialize with mock PageContextMonitor
    contextProvider.initialize(mockPageContextMonitor as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (contextProvider) {
      contextProvider.clearCache();
    }
  });

  describe("ContextProvider initialization with PageContextMonitor", () => {
    it("should initialize successfully with PageContextMonitor", () => {
      expect(contextProvider.isReady()).toBe(true);
      expect(mockPageContextMonitor.addEventListener).toHaveBeenCalled();
    });

    it("should not be ready when PageContextMonitor is not active", () => {
      mockPageContextMonitor.isActive.mockReturnValue(false);

      const newProvider = ContextProvider.getInstance();
      newProvider.initialize(mockPageContextMonitor as any);

      expect(newProvider.isReady()).toBe(false);
    });
  });

  describe("Context retrieval integration", () => {
    it("should get context from PageContextMonitor", async () => {
      const context = await contextProvider.getCurrentContext();

      expect(context).toEqual(mockAggregatedContext);
      expect(mockPageContextMonitor.getContext).toHaveBeenCalled();
    });

    it("should handle PageContextMonitor errors gracefully", async () => {
      mockPageContextMonitor.getContext.mockRejectedValue(
        new Error("Monitor error")
      );

      const context = await contextProvider.getCurrentContext();

      expect(context).toBeNull();
    });

    it("should cache context for performance", async () => {
      // First call
      await contextProvider.getCurrentContext();

      // Second call should use cache
      await contextProvider.getCurrentContext();

      // Should only call PageContextMonitor once
      expect(mockPageContextMonitor.getContext).toHaveBeenCalledTimes(1);
    });
  });

  describe("Prompt enhancement integration", () => {
    it("should enhance prompts with context from PageContextMonitor", async () => {
      const enhanced = await contextProvider.enhancePrompt(
        "What is this article about?"
      );

      expect(enhanced.originalMessage).toBe("What is this article about?");
      expect(enhanced.enhancementApplied).toBe(true);
      expect(enhanced.enhancedMessage).toContain("Context:");
      expect(enhanced.enhancedMessage).toContain("article");
      expect(enhanced.enhancedMessage).toContain("AI integration");
      expect(enhanced.contextSummary).toContain("Page Type: article");
    });

    it("should include chat history in enhancement", async () => {
      const chatHistory = [
        {
          id: "1",
          content: "Previous question about AI",
          sender: "user" as const,
          timestamp: new Date(),
        },
      ];

      const enhanced = await contextProvider.enhancePrompt(
        "Follow up question",
        chatHistory
      );

      expect(enhanced.enhancementApplied).toBe(true);
      expect(enhanced.enhancedMessage).toContain("Follow up question");
    });
  });

  describe("Contextual suggestions integration", () => {
    it("should generate suggestions based on PageContextMonitor context", async () => {
      const suggestions = await contextProvider.generateSuggestions();

      expect(Array.isArray(suggestions)).toBe(true);

      // Should generate content summary suggestion for article
      const contentSuggestion = suggestions.find(
        (s) => s.type === "content_summary"
      );
      expect(contentSuggestion).toBeDefined();
      expect(contentSuggestion?.title).toBe("Content Summarizer");
    });

    it("should generate prompt suggestions based on page type", async () => {
      const suggestions = await contextProvider.getPromptSuggestions();

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(4);

      // Should include article-specific suggestions
      expect(suggestions).toContain("Summarize this article for me");
    });
  });

  describe("Event handling integration", () => {
    it("should listen for context updates from PageContextMonitor", () => {
      // Verify event listener was registered
      expect(mockPageContextMonitor.addEventListener).toHaveBeenCalledWith(
        "context_updated",
        expect.any(Function)
      );
    });

    it("should handle context update events", () => {
      // Get the event listener function
      const eventListener =
        mockPageContextMonitor.addEventListener.mock.calls.find(
          (call) => call[0] === "context_updated"
        )?.[1];

      expect(eventListener).toBeDefined();

      // Simulate context update event
      if (eventListener) {
        expect(() =>
          eventListener("context_updated", mockAggregatedContext)
        ).not.toThrow();
      }
    });
  });

  describe("Configuration integration", () => {
    it("should update configuration and clear cache appropriately", () => {
      // Update config that affects context inclusion
      contextProvider.updateConfig({
        includeNetworkActivity: false,
        maxContextLength: 1000,
      });

      const config = contextProvider.getConfig();
      expect(config.includeNetworkActivity).toBe(false);
      expect(config.maxContextLength).toBe(1000);
    });

    it("should maintain configuration consistency", () => {
      const originalConfig = contextProvider.getConfig();

      contextProvider.updateConfig({
        includePageSummary: false,
      });

      const updatedConfig = contextProvider.getConfig();
      expect(updatedConfig.includePageSummary).toBe(false);
      expect(updatedConfig.includeNetworkActivity).toBe(
        originalConfig.includeNetworkActivity
      );
    });
  });

  describe("Error resilience", () => {
    it("should handle PageContextMonitor initialization errors", () => {
      // Reset singleton to get a fresh instance
      (ContextProvider as any).instance = null;
      const errorProvider = ContextProvider.getInstance();

      // Initialize with null (simulating error)
      expect(() => errorProvider.initialize(null as any)).not.toThrow();
      // ContextProvider is now ready in fallback mode even with null initialization
      expect(errorProvider.isReady()).toBe(true);
    });

    it("should gracefully handle context retrieval failures", async () => {
      mockPageContextMonitor.getContext.mockRejectedValue(
        new Error("Network error")
      );

      const enhanced = await contextProvider.enhancePrompt("Test message");

      expect(enhanced.enhancementApplied).toBe(false);
      expect(enhanced.originalMessage).toBe("Test message");
      expect(enhanced.enhancedMessage).toBe("Test message");
    });

    it("should handle suggestion generation errors", async () => {
      mockPageContextMonitor.getContext.mockRejectedValue(
        new Error("Context error")
      );

      const suggestions = await contextProvider.generateSuggestions();
      const promptSuggestions = await contextProvider.getPromptSuggestions();

      expect(suggestions).toEqual([]);
      expect(promptSuggestions.length).toBeGreaterThan(0); // Should return fallback suggestions
    });
  });
});
