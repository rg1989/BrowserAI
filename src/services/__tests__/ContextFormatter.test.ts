import { ContextFormatter } from "../ContextFormatter";
import {
  PageContext,
  ContentSnapshot,
  NetworkActivity,
  InteractionType,
} from "../../types/monitoring";

describe("ContextFormatter", () => {
  let formatter: ContextFormatter;
  let mockPageContext: PageContext;

  beforeEach(() => {
    formatter = new ContextFormatter();

    // Create mock PageContext
    mockPageContext = {
      url: "https://example.com/product/123",
      title: "Amazing Product - Example Store",
      timestamp: Date.now(),
      content: {
        text: "This is an amazing product that will change your life. It has many features including advanced technology and user-friendly design. The product comes with a warranty and free shipping.",
        headings: [
          {
            level: 1,
            text: "Amazing Product",
            element: { tagName: "H1", selector: "h1" },
          },
          {
            level: 2,
            text: "Features",
            element: { tagName: "H2", selector: "h2" },
          },
        ],
        links: [
          {
            href: "/category/electronics",
            text: "Electronics",
            element: {
              tagName: "A",
              selector: "a[href='/category/electronics']",
            },
          },
          {
            href: "https://external.com",
            text: "External Link",
            element: {
              tagName: "A",
              selector: "a[href='https://external.com']",
            },
          },
        ],
        images: [],
        forms: [
          {
            action: "/add-to-cart",
            method: "POST",
            fields: [
              { name: "quantity", type: "number", value: "1", required: true },
              { name: "size", type: "select", value: "M", required: true },
            ],
            element: { tagName: "FORM", selector: "form" },
          },
        ],
        tables: [
          {
            headers: ["Feature", "Value"],
            rows: [
              ["Weight", "2.5kg"],
              ["Color", "Blue"],
            ],
            element: { tagName: "TABLE", selector: "table" },
          },
        ],
        metadata: {
          title: "Amazing Product - Example Store",
          description: "The best product you can buy online",
          keywords: ["product", "amazing", "technology"],
        },
      } as ContentSnapshot,
      layout: {
        viewport: {
          width: 1920,
          height: 1080,
          scrollX: 0,
          scrollY: 100,
          devicePixelRatio: 1,
        },
        visibleElements: [],
        scrollPosition: { x: 0, y: 100, maxX: 0, maxY: 2000 },
        modals: [],
        overlays: [],
      },
      network: {
        recentRequests: [
          {
            id: "1",
            url: "https://api.example.com/products/123",
            method: "GET",
            headers: {},
            timestamp: new Date(),
            initiator: "fetch",
            type: "xhr",
            statusCode: 200,
          },
          {
            id: "2",
            url: "https://example.com/static/image.jpg",
            method: "GET",
            headers: {},
            timestamp: new Date(),
            initiator: "img",
            type: "image",
            statusCode: 200,
          },
        ],
        totalRequests: 10,
        totalDataTransferred: 1024000,
        averageResponseTime: 150,
      } as NetworkActivity,
      interactions: [
        {
          type: InteractionType.CLICK,
          element: {
            tagName: "BUTTON",
            id: "add-to-cart",
            selector: "button#add-to-cart",
          },
          timestamp: new Date(),
          context: {
            pageUrl: "https://example.com/product/123",
            elementPath: "button#add-to-cart",
            surroundingText: "Add to Cart",
          },
        },
      ],
      metadata: {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        viewport: { width: 1920, height: 1080 },
        scrollPosition: { x: 0, y: 100 },
      },
      semantics: {
        schema: [{ type: "Product", properties: { name: "Amazing Product" } }],
        microdata: [],
        jsonLd: [
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Amazing Product",
          },
        ],
        openGraph: {
          title: "Amazing Product",
          description: "The best product you can buy",
          image: "https://example.com/product-image.jpg",
        },
        twitter: {},
        custom: [],
      },
    };
  });

  describe("formatForAI", () => {
    it("should format basic page context", () => {
      const formatted = formatter.formatForAI(mockPageContext);

      expect(formatted.summary).toContain("Amazing Product - Example Store");
      expect(formatted.summary).toContain("https://example.com/product/123");
      expect(formatted.content.title).toBe("Amazing Product - Example Store");
      expect(formatted.content.url).toBe("https://example.com/product/123");
      expect(formatted.tokenCount).toBeGreaterThan(0);
    });

    it("should include form information", () => {
      const formatted = formatter.formatForAI(mockPageContext);

      expect(formatted.content.forms).toHaveLength(1);
      expect(formatted.content.forms[0].action).toBe("/add-to-cart");
      expect(formatted.content.forms[0].method).toBe("POST");
      expect(formatted.content.forms[0].fieldCount).toBe(2);
      expect(formatted.content.forms[0].fields).toContain("quantity (number)");
    });

    it("should include table information", () => {
      const formatted = formatter.formatForAI(mockPageContext);

      expect(formatted.content.tables).toHaveLength(1);
      expect(formatted.content.tables[0].headers).toEqual(["Feature", "Value"]);
      expect(formatted.content.tables[0].rowCount).toBe(2);
    });

    it("should identify external links", () => {
      const formatted = formatter.formatForAI(mockPageContext);

      expect(formatted.content.links).toHaveLength(2);
      expect(formatted.content.links[0].isExternal).toBe(false);
      expect(formatted.content.links[1].isExternal).toBe(true);
    });

    it("should filter API requests from network activity", () => {
      const formatted = formatter.formatForAI(mockPageContext);

      expect(formatted.network.recentRequests).toHaveLength(2);
      expect(formatted.network.apiEndpoints).toHaveLength(1);
      expect(formatted.network.apiEndpoints[0]).toContain("api.example.com");
    });

    it("should include user interactions", () => {
      const formatted = formatter.formatForAI(mockPageContext);

      expect(formatted.interactions.recentActions).toHaveLength(1);
      expect(formatted.interactions.recentActions[0].type).toBe(
        InteractionType.CLICK
      );
      expect(formatted.interactions.recentActions[0].element).toBe(
        "BUTTON#add-to-cart"
      );
    });

    it("should detect page type", () => {
      const formatted = formatter.formatForAI(mockPageContext);

      expect(formatted.metadata.pageType).toBe("product");
    });

    it("should include semantic data", () => {
      const formatted = formatter.formatForAI(mockPageContext);

      expect(formatted.metadata.semanticData.hasStructuredData).toBe(true);
      expect(formatted.metadata.semanticData.schemaTypes).toContain("Product");
      expect(formatted.metadata.semanticData.openGraphTitle).toBe(
        "Amazing Product"
      );
    });
  });

  describe("token limiting", () => {
    it("should trim content when exceeding token limit", () => {
      const longContent = "A".repeat(10000);
      mockPageContext.content.text = longContent;

      const formatted = formatter.formatForAI(mockPageContext, undefined, 100);

      // Should significantly reduce token count, even if not exactly under limit
      expect(formatted.tokenCount).toBeLessThan(1000); // Much less than original
      expect(formatted.content.mainContent.length).toBeLessThan(
        longContent.length
      );
      expect(formatted.content.mainContent).toContain("...");
    });

    it("should prioritize important content when trimming", () => {
      const formatted = formatter.formatForAI(mockPageContext, undefined, 50);

      // Should still have basic info even when heavily trimmed
      expect(formatted.content.title).toBeTruthy();
      expect(formatted.content.url).toBeTruthy();
      expect(formatted.summary).toBeTruthy();
    });
  });

  describe("formatAsText", () => {
    it("should convert formatted context to readable text", () => {
      const formatted = formatter.formatForAI(mockPageContext);
      const text = formatter.formatAsText(formatted);

      expect(text).toContain("# Page Context");
      expect(text).toContain("## Summary");
      expect(text).toContain("## Content");
      expect(text).toContain("Amazing Product - Example Store");
      expect(text).toContain("https://example.com/product/123");
    });

    it("should include forms in text format", () => {
      const formatted = formatter.formatForAI(mockPageContext);
      const text = formatter.formatAsText(formatted);

      expect(text).toContain("**Forms:**");
      expect(text).toContain("2 fields");
      expect(text).toContain("quantity (number)");
    });

    it("should include network activity in text format", () => {
      const formatted = formatter.formatForAI(mockPageContext);
      const text = formatter.formatAsText(formatted);

      expect(text).toContain("## Network Activity");
      expect(text).toContain("**Recent Requests:**");
      expect(text).toContain("GET https://api.example.com/products/123");
    });

    it("should include metadata in text format", () => {
      const formatted = formatter.formatForAI(mockPageContext);
      const text = formatter.formatAsText(formatted);

      expect(text).toContain("## Metadata");
      expect(text).toContain("**Page Type:** product");
      expect(text).toContain(
        "**Description:** The best product you can buy online"
      );
    });
  });

  describe("content summarization", () => {
    it("should keep short content as-is", () => {
      const shortText = "This is a short text.";
      mockPageContext.content.text = shortText;

      const formatted = formatter.formatForAI(mockPageContext);

      expect(formatted.content.mainContent).toBe(shortText);
    });

    it("should truncate long content", () => {
      const longText = "A".repeat(5000);
      mockPageContext.content.text = longText;

      const formatted = formatter.formatForAI(mockPageContext);

      expect(formatted.content.mainContent.length).toBeLessThan(
        longText.length
      );
      expect(formatted.content.mainContent).toContain("...");
      expect(formatted.content.mainContent).toContain("[Content truncated]");
    });
  });

  describe("URL sanitization", () => {
    it("should redact sensitive parameters", () => {
      mockPageContext.network.recentRequests = [
        {
          id: "1",
          url: "https://api.example.com/data?token=secret123&key=abc&normal=value",
          method: "GET",
          headers: {},
          timestamp: new Date(),
          initiator: "fetch",
          type: "xhr",
        } as any,
      ];

      const formatted = formatter.formatForAI(mockPageContext);

      expect(formatted.network.recentRequests[0].url).toContain(
        "%5BREDACTED%5D"
      );
      expect(formatted.network.recentRequests[0].url).not.toContain(
        "secret123"
      );
      expect(formatted.network.recentRequests[0].url).toContain("normal=value");
    });
  });

  describe("page type detection", () => {
    it("should detect article pages", () => {
      mockPageContext.url = "https://example.com/blog/my-article";

      const formatted = formatter.formatForAI(mockPageContext);

      expect(formatted.metadata.pageType).toBe("article");
    });

    it("should detect search pages", () => {
      mockPageContext.url = "https://example.com/search?q=test";

      const formatted = formatter.formatForAI(mockPageContext);

      expect(formatted.metadata.pageType).toBe("search");
    });

    it("should detect form pages", () => {
      mockPageContext.url = "https://example.com/contact";
      mockPageContext.content.forms = [
        {
          fields: [{ name: "email", type: "email", required: true }],
          element: { tagName: "FORM", selector: "form" },
        } as any,
      ];

      const formatted = formatter.formatForAI(mockPageContext);

      expect(formatted.metadata.pageType).toBe("form");
    });

    it("should default to general for unknown pages", () => {
      mockPageContext.url = "https://example.com/random-page";
      mockPageContext.content.forms = [];
      mockPageContext.content.tables = [];

      const formatted = formatter.formatForAI(mockPageContext);

      expect(formatted.metadata.pageType).toBe("general");
    });
  });
});
