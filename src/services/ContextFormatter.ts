import { PageContext, NetworkRequest, NetworkError } from "../types/monitoring";

export interface FormattedContext {
  summary: string;
  content: {
    title: string;
    url: string;
    mainContent: string;
    forms: FormInfo[];
    tables: TableInfo[];
    links: LinkInfo[];
  };
  network: {
    recentRequests: NetworkRequestSummary[];
    errors: NetworkError[];
    apiEndpoints: string[];
  };
  interactions: {
    recentActions: UserActionSummary[];
    focusedElements: ElementSummary[];
  };
  metadata: {
    pageType: string;
    technologies: string[];
    semanticData: SemanticSummary;
  };
  tokenCount: number;
}

export interface FormInfo {
  action?: string;
  method?: string;
  fieldCount: number;
  fields: string[];
}

export interface TableInfo {
  headers: string[];
  rowCount: number;
  caption?: string;
}

export interface LinkInfo {
  text: string;
  href: string;
  isExternal: boolean;
}

export interface NetworkRequestSummary {
  url: string;
  method: string;
  status?: number;
  type: string;
  timestamp: string;
}

export interface UserActionSummary {
  type: string;
  element: string;
  timestamp: string;
}

export interface ElementSummary {
  tagName: string;
  text: string;
  selector: string;
}

export interface SemanticSummary {
  hasStructuredData: boolean;
  schemaTypes: string[];
  openGraphTitle?: string;
  description?: string;
}

/**
 * ContextFormatter converts raw PageContext data into AI-consumable text format
 * Provides intelligent text summarization and token-efficient formatting
 */
export class ContextFormatter {
  private readonly MAX_CONTENT_LENGTH = 2000;
  private readonly MAX_NETWORK_REQUESTS = 10;
  private readonly MAX_INTERACTIONS = 5;
  private readonly CHARS_PER_TOKEN = 4; // Rough estimation

  /**
   * Format PageContext for AI consumption with optional query-specific prioritization
   */
  formatForAI(
    context: PageContext,
    query?: string,
    maxTokens: number = 1000
  ): FormattedContext {
    const formatted: FormattedContext = {
      summary: this.generateSummary(context),
      content: this.formatContent(context),
      network: this.formatNetworkActivity(context),
      interactions: this.formatInteractions(context),
      metadata: this.formatMetadata(context),
      tokenCount: 0,
    };

    // Calculate token count and trim if necessary
    formatted.tokenCount = this.estimateTokenCount(formatted);

    if (formatted.tokenCount > maxTokens) {
      return this.trimToTokenLimit(formatted, maxTokens, query);
    }

    return formatted;
  }

  /**
   * Generate a concise summary of the page context
   */
  private generateSummary(context: PageContext): string {
    const { title, url, content, network } = context;

    let summary = `Page: "${title}" at ${url}`;

    // Add content summary
    if (content.text) {
      const contentPreview = content.text.substring(0, 200).trim();
      summary += `\nContent: ${contentPreview}${
        content.text.length > 200 ? "..." : ""
      }`;
    }

    // Add form information
    if (content.forms && content.forms.length > 0) {
      summary += `\nForms: ${content.forms.length} form(s) detected`;
    }

    // Add network activity summary
    if (network.recentRequests && network.recentRequests.length > 0) {
      summary += `\nNetwork: ${network.recentRequests.length} recent requests`;
    }

    return summary;
  }

  /**
   * Format page content information
   */
  private formatContent(context: PageContext): FormattedContext["content"] {
    const { content } = context;

    return {
      title: context.title,
      url: context.url,
      mainContent: this.summarizeContent(content.text),
      forms:
        content.forms?.map((form) => ({
          action: form.action,
          method: form.method,
          fieldCount: form.fields.length,
          fields: form.fields.map((field) => `${field.name} (${field.type})`),
        })) || [],
      tables:
        content.tables?.map((table) => ({
          headers: table.headers,
          rowCount: table.rows.length,
          caption: table.caption,
        })) || [],
      links:
        content.links?.slice(0, 10).map((link) => ({
          text: link.text,
          href: link.href,
          isExternal: this.isExternalLink(link.href, context.url),
        })) || [],
    };
  }

  /**
   * Format network activity information
   */
  private formatNetworkActivity(
    context: PageContext
  ): FormattedContext["network"] {
    const { network } = context;

    const recentRequests = (network.recentRequests || [])
      .slice(0, this.MAX_NETWORK_REQUESTS)
      .map((req: any) => ({
        url: this.sanitizeUrl(req.url),
        method: req.method || "GET",
        status: req.statusCode,
        type: req.type || "unknown",
        timestamp: new Date(req.timestamp).toISOString(),
      }));

    // Extract API endpoints (non-static resources)
    const apiEndpoints = recentRequests
      .filter((req) => this.isApiRequest(req.url, req.type))
      .map((req) => req.url)
      .filter((url, index, arr) => arr.indexOf(url) === index); // Remove duplicates

    return {
      recentRequests,
      errors: [], // TODO: Extract from network errors when available
      apiEndpoints,
    };
  }

  /**
   * Format user interaction information
   */
  private formatInteractions(
    context: PageContext
  ): FormattedContext["interactions"] {
    const { interactions } = context;

    const recentActions = (interactions || [])
      .slice(0, this.MAX_INTERACTIONS)
      .map((interaction) => ({
        type: interaction.type,
        element:
          interaction.element.tagName +
          (interaction.element.id ? `#${interaction.element.id}` : ""),
        timestamp: interaction.timestamp.toISOString(),
      }));

    // Get currently focused or recently interacted elements
    const focusedElements = (interactions || [])
      .filter((interaction) =>
        ["focus", "click", "input"].includes(interaction.type)
      )
      .slice(0, 3)
      .map((interaction) => ({
        tagName: interaction.element.tagName,
        text: interaction.context.surroundingText || "",
        selector: interaction.element.selector,
      }));

    return {
      recentActions,
      focusedElements,
    };
  }

  /**
   * Format metadata and semantic information
   */
  private formatMetadata(context: PageContext): FormattedContext["metadata"] {
    const { content, semantics } = context;

    // Detect page type based on content
    const pageType = this.detectPageType(context);

    // Extract technologies from various sources
    const technologies = this.detectTechnologies(context);

    // Summarize semantic data
    const semanticData: SemanticSummary = {
      hasStructuredData: Boolean(
        semantics?.schema?.length || semantics?.jsonLd?.length
      ),
      schemaTypes: semantics?.schema?.map((s) => s.type) || [],
      openGraphTitle: semantics?.openGraph?.title,
      description:
        content.metadata.description || semantics?.openGraph?.description,
    };

    return {
      pageType,
      technologies,
      semanticData,
    };
  }

  /**
   * Summarize content text to fit within limits
   */
  private summarizeContent(text: string): string {
    if (!text) return "";

    if (text.length <= this.MAX_CONTENT_LENGTH) {
      return text;
    }

    // Extract key sentences (first and last parts)
    const firstPart = text.substring(0, this.MAX_CONTENT_LENGTH * 0.7);
    const lastPart = text.substring(
      text.length - this.MAX_CONTENT_LENGTH * 0.3
    );

    return `${firstPart.trim()}...\n\n[Content truncated]\n\n...${lastPart.trim()}`;
  }

  /**
   * Check if a URL is external to the current domain
   */
  private isExternalLink(href: string, currentUrl: string): boolean {
    try {
      const linkUrl = new URL(href, currentUrl);
      const currentDomain = new URL(currentUrl).hostname;
      return linkUrl.hostname !== currentDomain;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize URL for AI consumption (remove sensitive parameters)
   */
  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      // Remove sensitive parameters
      const sensitiveParams = [
        "token",
        "key",
        "password",
        "secret",
        "auth",
        "session",
      ];
      sensitiveParams.forEach((param) => {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, "[REDACTED]");
        }
      });

      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Determine if a request is likely an API call
   */
  private isApiRequest(url: string, type: string): boolean {
    // Skip static resources
    const staticTypes = ["image", "stylesheet", "script", "font", "media"];
    if (staticTypes.includes(type)) {
      return false;
    }

    // Check for API patterns in URL
    const apiPatterns = [
      "/api/",
      "/v1/",
      "/v2/",
      "/graphql",
      "/rest/",
      ".json",
    ];
    const hasApiPattern = apiPatterns.some((pattern) => url.includes(pattern));

    // Also consider XHR and fetch requests as potential API calls
    const isXhrOrFetch = ["xhr", "fetch"].includes(type);

    return hasApiPattern || isXhrOrFetch;
  }

  /**
   * Detect page type based on content and structure
   */
  private detectPageType(context: PageContext): string {
    const { content, url } = context;

    // Check URL patterns
    if (url.includes("/product/") || url.includes("/item/")) return "product";
    if (url.includes("/article/") || url.includes("/blog/")) return "article";
    if (url.includes("/search")) return "search";
    if (url.includes("/checkout") || url.includes("/cart")) return "ecommerce";
    if (url.includes("/docs/") || url.includes("/documentation"))
      return "documentation";

    // Check content patterns
    if (
      content.forms?.some((form) =>
        form.fields.some((field) => field.type === "email")
      )
    ) {
      return "form";
    }

    if (content.tables?.length > 0) return "data";
    if (content.headings?.length > 5) return "article";

    return "general";
  }

  /**
   * Detect technologies used on the page
   */
  private detectTechnologies(context: PageContext): string[] {
    const technologies: string[] = [];

    // Check semantic data for framework indicators
    if (
      context.semantics?.jsonLd?.some((ld) => ld["@type"] === "WebApplication")
    ) {
      technologies.push("WebApp");
    }

    // Check for common patterns (this could be enhanced with more detection)
    if (context.content.metadata.description?.includes("React")) {
      technologies.push("React");
    }

    return technologies;
  }

  /**
   * Estimate token count for the formatted context
   */
  private estimateTokenCount(formatted: FormattedContext): number {
    // Convert to text format for more accurate estimation
    const text = this.formatAsText(formatted);
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  /**
   * Trim formatted context to fit within token limit
   */
  private trimToTokenLimit(
    formatted: FormattedContext,
    maxTokens: number,
    query?: string
  ): FormattedContext {
    // Deep copy to avoid modifying original
    const trimmed = JSON.parse(JSON.stringify(formatted));

    // Iteratively trim until we're under the limit
    let iterations = 0;
    const maxIterations = 10;

    while (
      this.estimateTokenCount(trimmed) > maxTokens &&
      iterations < maxIterations
    ) {
      // First, aggressively trim content
      if (trimmed.content.mainContent.length > 200) {
        trimmed.content.mainContent =
          trimmed.content.mainContent.substring(0, 200) + "...";
      }

      // Then trim network requests
      if (trimmed.network.recentRequests.length > 3) {
        trimmed.network.recentRequests = trimmed.network.recentRequests.slice(
          0,
          3
        );
      }

      // Then trim interactions
      if (trimmed.interactions.recentActions.length > 1) {
        trimmed.interactions.recentActions =
          trimmed.interactions.recentActions.slice(0, 1);
      }

      // Trim links and tables
      if (trimmed.content.links.length > 2) {
        trimmed.content.links = trimmed.content.links.slice(0, 2);
      }

      if (trimmed.content.tables.length > 0) {
        trimmed.content.tables = [];
      }

      // If still too large, trim forms
      if (
        this.estimateTokenCount(trimmed) > maxTokens &&
        trimmed.content.forms.length > 0
      ) {
        trimmed.content.forms = trimmed.content.forms.slice(0, 1);
      }

      // Final aggressive trim - reduce content further
      if (
        this.estimateTokenCount(trimmed) > maxTokens &&
        trimmed.content.mainContent.length > 100
      ) {
        trimmed.content.mainContent =
          trimmed.content.mainContent.substring(0, 100) + "...";
      }

      iterations++;
    }

    trimmed.tokenCount = this.estimateTokenCount(trimmed);
    return trimmed;
  }

  /**
   * Convert formatted context to plain text for AI consumption
   */
  formatAsText(formatted: FormattedContext): string {
    let text = `# Page Context\n\n`;

    text += `## Summary\n${formatted.summary}\n\n`;

    // Content section
    text += `## Content\n`;
    text += `**Title:** ${formatted.content.title}\n`;
    text += `**URL:** ${formatted.content.url}\n\n`;

    if (formatted.content.mainContent) {
      text += `**Main Content:**\n${formatted.content.mainContent}\n\n`;
    }

    // Forms
    if (formatted.content.forms.length > 0) {
      text += `**Forms:**\n`;
      formatted.content.forms.forEach((form, i) => {
        text += `- Form ${i + 1}: ${form.fieldCount} fields (${form.fields.join(
          ", "
        )})\n`;
      });
      text += "\n";
    }

    // Tables
    if (formatted.content.tables.length > 0) {
      text += `**Tables:**\n`;
      formatted.content.tables.forEach((table, i) => {
        text += `- Table ${i + 1}: ${
          table.rowCount
        } rows, headers: ${table.headers.join(", ")}\n`;
      });
      text += "\n";
    }

    // Network activity
    if (formatted.network.recentRequests.length > 0) {
      text += `## Network Activity\n`;
      text += `**Recent Requests:**\n`;
      formatted.network.recentRequests.forEach((req) => {
        text += `- ${req.method} ${req.url} (${req.status || "pending"})\n`;
      });
      text += "\n";
    }

    // API endpoints
    if (formatted.network.apiEndpoints.length > 0) {
      text += `**API Endpoints:**\n`;
      formatted.network.apiEndpoints.forEach((endpoint) => {
        text += `- ${endpoint}\n`;
      });
      text += "\n";
    }

    // Recent interactions
    if (formatted.interactions.recentActions.length > 0) {
      text += `## User Interactions\n`;
      formatted.interactions.recentActions.forEach((action) => {
        text += `- ${action.type} on ${action.element}\n`;
      });
      text += "\n";
    }

    // Metadata
    text += `## Metadata\n`;
    text += `**Page Type:** ${formatted.metadata.pageType}\n`;
    if (formatted.metadata.technologies.length > 0) {
      text += `**Technologies:** ${formatted.metadata.technologies.join(
        ", "
      )}\n`;
    }
    if (formatted.metadata.semanticData.description) {
      text += `**Description:** ${formatted.metadata.semanticData.description}\n`;
    }

    return text;
  }
}
