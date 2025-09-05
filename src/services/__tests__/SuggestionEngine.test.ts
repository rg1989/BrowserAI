import { SuggestionEngine, InsightType } from "../SuggestionEngine";
import { AggregatedContext, PageType } from "../ContextAggregator";
import { ChatMessage } from "../../types/workflow";

// Mock data for testing
const mockContext: AggregatedContext = {
  metadata: {
    url: "https://example.com/test-page",
    title: "Test Page",
    timestamp: Date.now(),
    aggregationTime: 50,
    cacheHit: false,
    dataQuality: {
      completeness: 0.9,
      freshness: 0.8,
      accuracy: 0.9,
      relevance: 0.8,
    },
  },
  summary: {
    pageType: PageType.FORM,
    primaryContent: "This is a test page with forms and data",
    keyElements: ["form", "table", "button"],
    userActivity: {
      recentInteractions: 5,
      activeElements: ["input", "button"],
      formActivity: true,
      navigationActivity: true,
    },
    dataFlows: [
      {
        type: "api",
        method: "POST",
        endpoint: "/api/users",
        status: 200,
        timestamp: Date.now(),
        relevance: 0.8,
      },
      {
        type: "api",
        method: "GET",
        endpoint: "/api/data",
        status: 500,
        timestamp: Date.now(),
        relevance: 0.9,
      },
    ],
    relevanceScore: 0.8,
  },
  content: {
    text: "This is a long piece of content that should trigger content summary suggestions. ".repeat(
      50
    ),
    headings: [
      {
        level: 1,
        text: "Main Title",
        element: { tagName: "H1", selector: "h1" },
      },
      {
        level: 2,
        text: "Section 1",
        element: { tagName: "H2", selector: "h2:nth-child(1)" },
      },
      {
        level: 2,
        text: "Section 2",
        element: { tagName: "H2", selector: "h2:nth-child(2)" },
      },
    ],
    links: [
      {
        text: "Home",
        href: "/",
        element: { tagName: "A", selector: "a[href='/']" },
      },
      {
        text: "About",
        href: "/about",
        element: { tagName: "A", selector: "a[href='/about']" },
      },
    ],
    images: [
      {
        src: "/image1.jpg",
        alt: "Test image",
        element: { tagName: "IMG", selector: "img:nth-child(1)" },
      },
      {
        src: "/image2.jpg",
        alt: "",
        element: { tagName: "IMG", selector: "img:nth-child(2)" },
      }, // Missing alt text
    ],
    forms: [
      {
        action: "/submit",
        method: "POST",
        element: { tagName: "FORM", selector: "form" },
        fields: [
          { name: "email", type: "email", required: true },
          { name: "password", type: "password", required: true }, // Missing label
        ],
      },
    ],
    tables: [
      {
        headers: ["Name", "Age", "City"],
        rows: [
          ["John", "25", "New York"],
          ["Jane", "30", "Los Angeles"],
        ],
        element: { tagName: "TABLE", selector: "table" },
      },
    ],
    metadata: {
      title: "Test Page",
      description: "Test page description",
      keywords: ["test", "page"],
      author: "Test Author",
    },
  },
  network: {
    recentRequests: [
      {
        id: "req1",
        url: "https://api.example.com/users",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"name":"test"}',
        timestamp: Date.now(),
        initiator: "fetch",
        type: "xhr",
        status: 200,
        responseTime: 150,
      },
      {
        id: "req2",
        url: "https://api.example.com/data",
        method: "GET",
        headers: { accept: "application/json" },
        timestamp: Date.now(),
        initiator: "fetch",
        type: "xhr",
        status: 500,
        responseTime: 3500, // Slow request
      },
      {
        id: "req3",
        url: "http://insecure.example.com/data", // HTTP on HTTPS page
        method: "GET",
        headers: {},
        timestamp: Date.now(),
        initiator: "img",
        type: "image",
        status: 200,
        responseTime: 100,
      },
    ],
    totalRequests: 3,
    totalDataTransferred: 1024,
    averageResponseTime: 1250,
  },
  semantics: {
    schema: [{ type: "Organization", properties: { name: "Test Org" } }],
    microdata: [],
    jsonLd: [],
    openGraph: {
      title: "Test Page",
      description: "Test description",
      image: "/og-image.jpg",
    },
    twitter: {
      card: "summary",
      title: "Test Page",
    },
    custom: [],
  },
  performance: {
    responseTime: 100,
    dataSize: 2048,
    cacheHit: false,
    processingTime: 50,
  },
};

const mockChatHistory: ChatMessage[] = [
  {
    id: "1",
    content: "Help me fill out this form",
    sender: "user",
    timestamp: new Date(),
  },
  {
    id: "2",
    content: "I can help you with that form",
    sender: "ai",
    timestamp: new Date(),
  },
  {
    id: "3",
    content: "Fill out the form again",
    sender: "user",
    timestamp: new Date(),
  },
];

describe("SuggestionEngine", () => {
  let suggestionEngine: SuggestionEngine;

  beforeEach(() => {
    suggestionEngine = SuggestionEngine.getInstance();
  });

  describe("generateContextualSuggestions", () => {
    it("should generate form assistance suggestions", async () => {
      const suggestions = await suggestionEngine.generateContextualSuggestions(
        mockContext
      );

      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);

      const formSuggestion = suggestions.find(
        (s) => s.type === "form_assistance"
      );
      expect(formSuggestion).toBeDefined();
      expect(formSuggestion?.title).toContain("Form");
      expect(formSuggestion?.actionable).toBe(true);
    });

    it("should generate data analysis suggestions for tables", async () => {
      const suggestions = await suggestionEngine.generateContextualSuggestions(
        mockContext
      );

      const dataSuggestion = suggestions.find(
        (s) => s.type === "data_analysis"
      );
      expect(dataSuggestion).toBeDefined();
      expect(dataSuggestion?.description).toContain("table");
    });

    it("should generate API insights suggestions", async () => {
      const suggestions = await suggestionEngine.generateContextualSuggestions(
        mockContext
      );

      const apiSuggestion = suggestions.find((s) => s.type === "api_insights");
      expect(apiSuggestion).toBeDefined();
      expect(apiSuggestion?.description).toMatch(/API|slow|request|network/i);
    });

    it("should generate error diagnosis suggestions", async () => {
      const suggestions = await suggestionEngine.generateContextualSuggestions(
        mockContext
      );

      const errorSuggestion = suggestions.find(
        (s) => s.type === "error_diagnosis"
      );
      expect(errorSuggestion).toBeDefined();
      expect(errorSuggestion?.confidence).toBeGreaterThan(0.8);
    });

    it("should generate content summary suggestions for long content", async () => {
      const suggestions = await suggestionEngine.generateContextualSuggestions(
        mockContext
      );

      const contentSuggestion = suggestions.find(
        (s) => s.type === "content_summary"
      );
      expect(contentSuggestion).toBeDefined();
      expect(contentSuggestion?.description).toContain("summary");
    });

    it("should generate workflow optimization suggestions based on chat history", async () => {
      const suggestions = await suggestionEngine.generateContextualSuggestions(
        mockContext,
        mockChatHistory
      );

      const workflowSuggestion = suggestions.find(
        (s) => s.type === "workflow_optimization"
      );
      expect(workflowSuggestion).toBeDefined();
      expect(workflowSuggestion?.description).toContain("repetitive");
    });

    it("should sort suggestions by confidence", async () => {
      const suggestions = await suggestionEngine.generateContextualSuggestions(
        mockContext
      );

      for (let i = 0; i < suggestions.length - 1; i++) {
        expect(suggestions[i].confidence).toBeGreaterThanOrEqual(
          suggestions[i + 1].confidence
        );
      }
    });

    it("should limit the number of suggestions returned", async () => {
      const suggestions = await suggestionEngine.generateContextualSuggestions(
        mockContext
      );

      expect(suggestions.length).toBeLessThanOrEqual(8);
    });
  });

  describe("generateProactiveInsights", () => {
    it("should detect performance issues", async () => {
      const insights = await suggestionEngine.generateProactiveInsights(
        mockContext
      );

      const performanceInsight = insights.find(
        (i) => i.type === InsightType.PERFORMANCE_ISSUE
      );
      expect(performanceInsight).toBeDefined();
      expect(performanceInsight?.severity).toBe("medium");
      expect(performanceInsight?.recommendations.length).toBeGreaterThan(0);
    });

    it("should detect security concerns", async () => {
      const insights = await suggestionEngine.generateProactiveInsights(
        mockContext
      );

      const securityInsight = insights.find(
        (i) => i.type === InsightType.SECURITY_CONCERN
      );
      expect(securityInsight).toBeDefined();
      expect(securityInsight?.severity).toBe("high");
      expect(securityInsight?.title).toContain("Mixed Content");
    });

    it("should detect accessibility issues", async () => {
      const insights = await suggestionEngine.generateProactiveInsights(
        mockContext
      );

      const accessibilityInsight = insights.find(
        (i) => i.type === InsightType.ACCESSIBILITY_ISSUE
      );
      expect(accessibilityInsight).toBeDefined();
      expect(accessibilityInsight?.title).toContain("Alt Text");
    });

    it("should detect UX improvements", async () => {
      const insights = await suggestionEngine.generateProactiveInsights(
        mockContext
      );

      const uxInsight = insights.find(
        (i) => i.type === InsightType.UX_IMPROVEMENT
      );
      expect(uxInsight).toBeDefined();
      expect(uxInsight?.title).toContain("Form Usability");
    });

    it("should detect error patterns", async () => {
      const insights = await suggestionEngine.generateProactiveInsights(
        mockContext
      );

      const errorInsight = insights.find(
        (i) => i.type === InsightType.ERROR_PATTERN
      );
      expect(errorInsight).toBeDefined();
      expect(errorInsight?.title).toMatch(/500.*Error/);
    });

    it("should provide actionable recommendations", async () => {
      const insights = await suggestionEngine.generateProactiveInsights(
        mockContext
      );

      insights.forEach((insight) => {
        if (insight.actionable) {
          expect(insight.recommendations.length).toBeGreaterThan(0);
          expect(insight.evidence.length).toBeGreaterThan(0);
        }
      });
    });

    it("should sort insights by confidence", async () => {
      const insights = await suggestionEngine.generateProactiveInsights(
        mockContext
      );

      for (let i = 0; i < insights.length - 1; i++) {
        expect(insights[i].confidence).toBeGreaterThanOrEqual(
          insights[i + 1].confidence
        );
      }
    });

    it("should limit the number of insights returned", async () => {
      const insights = await suggestionEngine.generateProactiveInsights(
        mockContext
      );

      expect(insights.length).toBeLessThanOrEqual(6);
    });
  });

  describe("generateWorkflowRecommendations", () => {
    it("should recommend form assistant workflow", async () => {
      const recommendations =
        await suggestionEngine.generateWorkflowRecommendations(mockContext);

      const formWorkflow = recommendations.find(
        (r) => r.workflowType === "form-assistant"
      );
      expect(formWorkflow).toBeDefined();
      expect(formWorkflow?.relevanceScore).toBeGreaterThan(0.8);
      expect(formWorkflow?.suggestedPrompts.length).toBeGreaterThan(0);
    });

    it("should recommend data analyzer workflow", async () => {
      const recommendations =
        await suggestionEngine.generateWorkflowRecommendations(mockContext);

      const dataWorkflow = recommendations.find(
        (r) => r.workflowType === "data-analyzer"
      );
      expect(dataWorkflow).toBeDefined();
      expect(dataWorkflow?.triggerContext).toContain("table");
    });

    it("should recommend API debugger workflow for errors", async () => {
      const recommendations =
        await suggestionEngine.generateWorkflowRecommendations(mockContext);

      const apiWorkflow = recommendations.find(
        (r) => r.workflowType === "api-debugger"
      );
      expect(apiWorkflow).toBeDefined();
      expect(apiWorkflow?.relevanceScore).toBeGreaterThan(0.9);
    });

    it("should sort recommendations by relevance score", async () => {
      const recommendations =
        await suggestionEngine.generateWorkflowRecommendations(mockContext);

      for (let i = 0; i < recommendations.length - 1; i++) {
        expect(recommendations[i].relevanceScore).toBeGreaterThanOrEqual(
          recommendations[i + 1].relevanceScore
        );
      }
    });

    it("should limit the number of recommendations returned", async () => {
      const recommendations =
        await suggestionEngine.generateWorkflowRecommendations(mockContext);

      expect(recommendations.length).toBeLessThanOrEqual(4);
    });
  });

  describe("detectCommonPatterns", () => {
    it("should detect form validation patterns", async () => {
      const patterns = await suggestionEngine.detectCommonPatterns(mockContext);

      const formPattern = patterns.find((p) => p.pattern === "form_validation");
      expect(formPattern).toBeDefined();
      expect(formPattern?.confidence).toBeGreaterThan(0.7);
      expect(formPattern?.suggestions.length).toBeGreaterThan(0);
    });

    it("should detect REST API usage patterns", async () => {
      const patterns = await suggestionEngine.detectCommonPatterns(mockContext);

      const apiPattern = patterns.find((p) => p.pattern === "rest_api_usage");
      expect(apiPattern).toBeDefined();
      expect(apiPattern?.occurrences).toBeGreaterThan(1);
    });

    it("should detect SPA navigation patterns", async () => {
      const patterns = await suggestionEngine.detectCommonPatterns(mockContext);

      const navPattern = patterns.find((p) => p.pattern === "spa_navigation");
      expect(navPattern).toBeDefined();
      expect(navPattern?.context).toContain("navigation");
    });

    it("should detect dynamic content patterns", async () => {
      const patterns = await suggestionEngine.detectCommonPatterns(mockContext);

      const contentPattern = patterns.find(
        (p) => p.pattern === "dynamic_content"
      );
      expect(contentPattern).toBeDefined();
      expect(contentPattern?.occurrences).toBeGreaterThanOrEqual(3);
    });

    it("should sort patterns by confidence", async () => {
      const patterns = await suggestionEngine.detectCommonPatterns(mockContext);

      for (let i = 0; i < patterns.length - 1; i++) {
        expect(patterns[i].confidence).toBeGreaterThanOrEqual(
          patterns[i + 1].confidence
        );
      }
    });
  });

  describe("error handling", () => {
    it("should handle empty context gracefully", async () => {
      const emptyContext = {
        ...mockContext,
        content: {
          ...mockContext.content,
          forms: [],
          tables: [],
          text: "",
        },
        network: {
          recentRequests: [],
          totalRequests: 0,
          totalDataTransferred: 0,
          averageResponseTime: 0,
        },
      };

      const suggestions = await suggestionEngine.generateContextualSuggestions(
        emptyContext
      );
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it("should handle missing network data", async () => {
      const contextWithoutNetwork = {
        ...mockContext,
        network: undefined,
      };

      const insights = await suggestionEngine.generateProactiveInsights(
        contextWithoutNetwork as any
      );
      expect(insights).toBeDefined();
      expect(Array.isArray(insights)).toBe(true);
    });

    it("should handle invalid URLs gracefully", async () => {
      const contextWithInvalidUrls = {
        ...mockContext,
        network: {
          recentRequests: [
            {
              ...mockContext.network!.recentRequests[0],
              url: "invalid-url",
            },
          ],
          totalRequests: 1,
          totalDataTransferred: 512,
          averageResponseTime: 150,
        },
      };

      const suggestions = await suggestionEngine.generateContextualSuggestions(
        contextWithInvalidUrls
      );
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe("caching", () => {
    it("should cache insights for the same context", async () => {
      const insights1 = await suggestionEngine.generateProactiveInsights(
        mockContext
      );
      const insights2 = await suggestionEngine.generateProactiveInsights(
        mockContext
      );

      expect(insights1).toEqual(insights2);
    });
  });

  describe("singleton pattern", () => {
    it("should return the same instance", () => {
      const instance1 = SuggestionEngine.getInstance();
      const instance2 = SuggestionEngine.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});
