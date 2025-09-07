import { PageContextMonitor, MonitoringEvent } from "./PageContextMonitor";
import { AggregatedContext, ContextSummary } from "./ContextAggregator";
import { ChatMessage } from "../types/workflow";
import {
  SuggestionEngine,
  AIInsight,
  WorkflowRecommendation,
} from "./SuggestionEngine";
import { ContextFormatter, FormattedContext } from "./ContextFormatter";
import { PageContext } from "../types/monitoring";
import { PrivacyConfig } from "../types/privacy";

/**
 * Context enhancement configuration for AI chat
 */
export interface ContextEnhancementConfig {
  includePageSummary: boolean;
  includeNetworkActivity: boolean;
  includeUserInteractions: boolean;
  includeSemanticData: boolean;
  maxContextLength: number;
  contextPriority: ContextPriority;
}

/**
 * Context priority settings for AI integration
 */
export interface ContextPriority {
  currentPage: number;
  recentActivity: number;
  userInteractions: number;
  networkData: number;
  semanticData: number;
}

/**
 * Enhanced prompt with context
 */
export interface EnhancedPrompt {
  originalMessage: string;
  enhancedMessage: string;
  contextSummary: string;
  contextData: AggregatedContext | null;
  enhancementApplied: boolean;
}

/**
 * Context suggestion for proactive AI assistance
 */
export interface ContextSuggestion {
  type: SuggestionType;
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  context: string;
}

/**
 * Suggestion types based on page context
 */
export enum SuggestionType {
  FORM_ASSISTANCE = "form_assistance",
  DATA_ANALYSIS = "data_analysis",
  ERROR_DIAGNOSIS = "error_diagnosis",
  WORKFLOW_OPTIMIZATION = "workflow_optimization",
  CONTENT_SUMMARY = "content_summary",
  API_INSIGHTS = "api_insights",
  NAVIGATION_HELP = "navigation_help",
}

/**
 * Context provider for AI chat integration
 * Bridges page monitoring system with AI chat interface
 */
export class ContextProvider {
  private static instance: ContextProvider;
  private pageContextMonitor: PageContextMonitor | null = null;
  private config: ContextEnhancementConfig;
  private lastContextUpdate: number = 0;
  private contextCache: AggregatedContext | null = null;
  private cacheTimeout: number = 30000; // 30 seconds
  private suggestionEngine: SuggestionEngine;
  private contextFormatter: ContextFormatter;
  private privacyConfig: PrivacyConfig;
  private aiFormattedContextCache: FormattedContext | null = null;
  private aiContextCacheTimeout: number = 15000; // 15 seconds for AI context cache
  private lastAIContextUpdate: number = 0;

  private constructor(config?: Partial<ContextEnhancementConfig>) {
    this.config = {
      includePageSummary: true,
      includeNetworkActivity: true,
      includeUserInteractions: true,
      includeSemanticData: true,
      maxContextLength: 2000,
      contextPriority: {
        currentPage: 1.0,
        recentActivity: 0.8,
        userInteractions: 0.9,
        networkData: 0.7,
        semanticData: 0.6,
      },
      ...config,
    };
    this.suggestionEngine = SuggestionEngine.getInstance();
    this.contextFormatter = new ContextFormatter();

    // Initialize privacy config with sensible defaults
    this.privacyConfig = {
      excludedDomains: [
        "banking.com",
        "paypal.com",
        "stripe.com",
        "login.microsoftonline.com",
        "accounts.google.com",
        "auth0.com",
        "okta.com",
      ],
      excludedPaths: [
        "/login",
        "/signin",
        "/signup",
        "/register",
        "/password",
        "/payment",
        "/checkout",
        "/billing",
      ],
      redactSensitiveData: true,
      sensitiveDataPatterns: [
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card numbers
        /\b\d{3}-\d{2}-\d{4}\b/, // SSN
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
        /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone numbers
      ],
      dataRetentionDays: 7,
      enableDataExport: false,
      enableDataDeletion: true,
      requireExplicitConsent: false,
      consentRenewalDays: 365,
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(
    config?: Partial<ContextEnhancementConfig>
  ): ContextProvider {
    if (!ContextProvider.instance) {
      ContextProvider.instance = new ContextProvider(config);
    }
    return ContextProvider.instance;
  }

  /**
   * Initialize with page context monitor
   */
  initialize(pageContextMonitor: PageContextMonitor | null): void {
    this.pageContextMonitor = pageContextMonitor;

    // Listen for context updates if monitor is available
    if (this.pageContextMonitor && this.pageContextMonitor.addEventListener) {
      this.pageContextMonitor.addEventListener(
        MonitoringEvent.CONTEXT_UPDATED,
        (event, data) => {
          this.handleContextUpdate(data);
        }
      );
    }
  }

  /**
   * Check if context provider is ready
   */
  isReady(): boolean {
    // If we have a pageContextMonitor, check if it's active
    if (this.pageContextMonitor !== null) {
      return this.pageContextMonitor.isActive();
    }

    // If no pageContextMonitor, we're in fallback mode - still considered ready
    // This allows the extension to work with limited functionality
    return true;
  }

  /**
   * Get current page context for AI
   */
  async getCurrentContext(): Promise<AggregatedContext | null> {
    // If no pageContextMonitor, return basic fallback context
    if (!this.pageContextMonitor) {
      console.log(
        "ContextProvider: Running in fallback mode - limited context available"
      );
      return {
        content: {
          title: document.title || "Unknown Page",
          url: window.location.href,
          text:
            document.body?.innerText?.substring(0, 1000) ||
            "No content available",
          forms: [], // Add empty forms array for SuggestionEngine
          links: [], // Add empty links array
          images: [], // Add empty images array
          pageType: "unknown", // Add pageType for prompt suggestions
          metadata: {
            timestamp: new Date().toISOString(),
            source: "fallback_mode",
          },
        },
        metadata: {
          url: window.location.href,
          title: document.title || "Unknown Page",
          timestamp: new Date().toISOString(),
          source: "fallback_mode",
        },
        summary: {
          pageType: "unknown",
          totalElements: 0,
          hasInteractiveElements: false,
        },
        network: {
          requests: [],
          summary: { totalRequests: 0, errorCount: 0, avgResponseTime: 0 },
        },
        interactions: {
          events: [],
          summary: { totalEvents: 0, clickCount: 0, scrollCount: 0 },
        },
        performance: { metrics: {}, summary: "No performance data available" },
        errors: {
          jsErrors: [],
          networkErrors: [],
          summary: { totalErrors: 0, criticalErrors: 0 },
        },
      };
    }

    if (!this.isReady()) {
      console.warn("ContextProvider not ready - page monitoring not active");
      return null;
    }

    try {
      // Check cache first
      if (this.isCacheValid()) {
        return this.contextCache;
      }

      // Get fresh context from monitor
      const context = await this.pageContextMonitor!.getContext();
      if (context) {
        this.contextCache = context;
        this.lastContextUpdate = Date.now();
      }

      return context;
    } catch (error) {
      console.error("Failed to get current context:", error);
      return null;
    }
  }

  /**
   * Get AI-formatted context with privacy filtering and caching
   * This is the main method for AI integration
   */
  async getAIFormattedContext(
    query?: string,
    maxTokens: number = 1000
  ): Promise<FormattedContext | null> {
    if (!this.isReady()) {
      console.warn("ContextProvider not ready - page monitoring not active");
      return null;
    }

    try {
      // Check AI context cache first
      if (this.isAIContextCacheValid() && !query) {
        return this.aiFormattedContextCache;
      }

      // Get current aggregated context
      const aggregatedContext = await this.getCurrentContext();
      if (!aggregatedContext) {
        return null;
      }

      // Convert to PageContext for formatter (extract from aggregated context)
      const pageContext =
        this.extractPageContextFromAggregated(aggregatedContext);

      // Apply privacy filtering
      const filteredContext = this.applyPrivacyFiltering(pageContext);

      // Format for AI consumption
      const formattedContext = this.contextFormatter.formatForAI(
        filteredContext,
        query,
        maxTokens
      );

      // Cache the result if no specific query (general context)
      if (!query) {
        this.aiFormattedContextCache = formattedContext;
        this.lastAIContextUpdate = Date.now();
      }

      return formattedContext;
    } catch (error) {
      console.error("Failed to get AI formatted context:", error);
      return null;
    }
  }

  /**
   * Get context summary for AI with privacy filtering
   */
  async getAIContextSummary(maxTokens: number = 200): Promise<string> {
    const formattedContext = await this.getAIFormattedContext(
      undefined,
      maxTokens
    );

    if (!formattedContext) {
      return "No page context available";
    }

    return formattedContext.summary;
  }

  /**
   * Check if current domain should be excluded from context collection
   */
  isDomainExcluded(url?: string): boolean {
    const currentUrl = url || window.location.href;

    try {
      const urlObj = new URL(currentUrl);
      const domain = urlObj.hostname.toLowerCase();
      const path = urlObj.pathname.toLowerCase();

      // Check excluded domains
      const isExcludedDomain = this.privacyConfig.excludedDomains.some(
        (excludedDomain) => domain.includes(excludedDomain.toLowerCase())
      );

      // Check excluded paths
      const isExcludedPath = this.privacyConfig.excludedPaths.some(
        (excludedPath) => path.includes(excludedPath.toLowerCase())
      );

      return isExcludedDomain || isExcludedPath;
    } catch (error) {
      console.warn("Failed to parse URL for privacy check:", error);
      return false;
    }
  }

  /**
   * Update privacy configuration
   */
  updatePrivacyConfig(newConfig: Partial<PrivacyConfig>): void {
    this.privacyConfig = { ...this.privacyConfig, ...newConfig };

    // Clear AI context cache when privacy settings change
    this.clearAIContextCache();
  }

  /**
   * Get current privacy configuration
   */
  getPrivacyConfig(): PrivacyConfig {
    return { ...this.privacyConfig };
  }

  /**
   * Clear AI context cache (public method for testing)
   */
  clearAIContextCache(): void {
    this.aiFormattedContextCache = null;
    this.lastAIContextUpdate = 0;
  }

  /**
   * Enhance user message with page context
   */
  async enhancePrompt(
    message: string,
    chatHistory?: ChatMessage[]
  ): Promise<EnhancedPrompt> {
    const context = await this.getCurrentContext();

    if (!context) {
      return {
        originalMessage: message,
        enhancedMessage: message,
        contextSummary: "No page context available",
        contextData: null,
        enhancementApplied: false,
      };
    }

    try {
      const contextSummary = this.generateContextSummary(context);
      const enhancedMessage = this.buildEnhancedMessage(
        message,
        context,
        chatHistory
      );

      return {
        originalMessage: message,
        enhancedMessage,
        contextSummary,
        contextData: context,
        enhancementApplied: true,
      };
    } catch (error) {
      console.error("Failed to enhance prompt:", error);
      return {
        originalMessage: message,
        enhancedMessage: message,
        contextSummary: "Context enhancement failed",
        contextData: context,
        enhancementApplied: false,
      };
    }
  }

  /**
   * Generate contextual suggestions based on current page
   */
  async generateSuggestions(
    chatHistory?: ChatMessage[]
  ): Promise<ContextSuggestion[]> {
    const context = await this.getCurrentContext();
    if (!context) {
      return [];
    }

    try {
      // Use the enhanced suggestion engine for better contextual suggestions
      return await this.suggestionEngine.generateContextualSuggestions(
        context,
        chatHistory
      );
    } catch (error) {
      console.error("Failed to generate suggestions:", error);
      return [];
    }
  }

  /**
   * Generate proactive AI insights based on detected patterns
   */
  async generateProactiveInsights(
    chatHistory?: ChatMessage[]
  ): Promise<AIInsight[]> {
    const context = await this.getCurrentContext();
    if (!context) {
      return [];
    }

    try {
      return await this.suggestionEngine.generateProactiveInsights(
        context,
        chatHistory
      );
    } catch (error) {
      console.error("Failed to generate proactive insights:", error);
      return [];
    }
  }

  /**
   * Generate workflow recommendations based on current context
   */
  async generateWorkflowRecommendations(): Promise<WorkflowRecommendation[]> {
    const context = await this.getCurrentContext();
    if (!context) {
      return [];
    }

    try {
      return await this.suggestionEngine.generateWorkflowRecommendations(
        context
      );
    } catch (error) {
      console.error("Failed to generate workflow recommendations:", error);
      return [];
    }
  }

  /**
   * Detect common patterns and provide insights
   */
  async detectCommonPatterns(): Promise<{
    patterns: any[];
    insights: AIInsight[];
    recommendations: WorkflowRecommendation[];
  }> {
    const context = await this.getCurrentContext();
    if (!context) {
      return { patterns: [], insights: [], recommendations: [] };
    }

    try {
      const [patterns, insights, recommendations] = await Promise.all([
        this.suggestionEngine.detectCommonPatterns(context),
        this.suggestionEngine.generateProactiveInsights(context),
        this.suggestionEngine.generateWorkflowRecommendations(context),
      ]);

      return { patterns, insights, recommendations };
    } catch (error) {
      console.error("Failed to detect patterns:", error);
      return { patterns: [], insights: [], recommendations: [] };
    }
  }

  /**
   * Get context-aware prompt suggestions
   */
  async getPromptSuggestions(): Promise<string[]> {
    const context = await this.getCurrentContext();
    if (!context) {
      return [
        "What can you help me with?",
        "Explain this page to me",
        "What should I do next?",
      ];
    }

    const suggestions: string[] = [];

    try {
      // Page-specific suggestions based on content
      if (context.summary.pageType === "form") {
        suggestions.push(
          "Help me fill out this form",
          "What information is required here?",
          "Check if I've filled everything correctly"
        );
      } else if (context.summary.pageType === "ecommerce") {
        suggestions.push(
          "Tell me about this product",
          "Compare this with similar items",
          "Is this a good deal?"
        );
      } else if (context.summary.pageType === "article") {
        suggestions.push(
          "Summarize this article for me",
          "What are the key points?",
          "Explain the main concepts"
        );
      } else if (context.summary.pageType === "dashboard") {
        suggestions.push(
          "Explain this dashboard",
          "What do these metrics mean?",
          "Help me analyze this data"
        );
      }

      // Activity-based suggestions
      if (context.summary.userActivity.formActivity) {
        suggestions.push("Help me with this form");
      }

      if (context.summary.dataFlows.length > 0) {
        suggestions.push("Explain the recent API activity");
      }

      // Fallback suggestions
      if (suggestions.length === 0) {
        suggestions.push(
          "What's on this page?",
          "Help me understand this content",
          "What can I do here?"
        );
      }

      return suggestions.slice(0, 4); // Return top 4 suggestions
    } catch (error) {
      console.error("Failed to get prompt suggestions:", error);
      return [
        "What can you help me with?",
        "Explain this page to me",
        "What should I do next?",
      ];
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ContextEnhancementConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Clear cache if context inclusion settings changed
    if (
      newConfig.includePageSummary !== undefined ||
      newConfig.includeNetworkActivity !== undefined ||
      newConfig.includeUserInteractions !== undefined ||
      newConfig.includeSemanticData !== undefined
    ) {
      this.clearCache();
    }
  }

  /**
   * Clear context cache
   */
  clearCache(): void {
    this.contextCache = null;
    this.lastContextUpdate = 0;
    this.clearAIContextCache();
  }

  /**
   * Get configuration
   */
  getConfig(): ContextEnhancementConfig {
    return { ...this.config };
  }

  /**
   * Private methods
   */

  /**
   * Handle context updates from page monitor
   */
  private handleContextUpdate(context: AggregatedContext): void {
    this.contextCache = context;
    this.lastContextUpdate = Date.now();
  }

  /**
   * Check if cached context is still valid
   */
  private isCacheValid(): boolean {
    return (
      this.contextCache !== null &&
      Date.now() - this.lastContextUpdate < this.cacheTimeout
    );
  }

  /**
   * Generate human-readable context summary
   */
  private generateContextSummary(context: AggregatedContext): string {
    const parts: string[] = [];

    // Page type and basic info
    parts.push(`Page Type: ${context.summary.pageType}`);
    parts.push(`URL: ${context.metadata.url}`);

    // Content summary
    if (this.config.includePageSummary && context.summary.primaryContent) {
      const contentPreview = context.summary.primaryContent.substring(0, 200);
      parts.push(
        `Content: ${contentPreview}${
          contentPreview.length === 200 ? "..." : ""
        }`
      );
    }

    // Key elements
    if (context.summary.keyElements.length > 0) {
      parts.push(
        `Key Elements: ${context.summary.keyElements.slice(0, 3).join(", ")}`
      );
    }

    // Recent activity
    if (
      this.config.includeUserInteractions &&
      context.summary.userActivity.recentInteractions > 0
    ) {
      parts.push(
        `Recent Activity: ${context.summary.userActivity.recentInteractions} interactions`
      );
    }

    // Network activity
    if (
      this.config.includeNetworkActivity &&
      context.summary.dataFlows.length > 0
    ) {
      const apiCalls = context.summary.dataFlows.filter(
        (df) => df.type === "api"
      ).length;
      if (apiCalls > 0) {
        parts.push(`API Activity: ${apiCalls} recent calls`);
      }
    }

    return parts.join("\n");
  }

  /**
   * Build enhanced message with context
   */
  private buildEnhancedMessage(
    originalMessage: string,
    context: AggregatedContext,
    chatHistory?: ChatMessage[]
  ): string {
    const contextParts: string[] = [];

    // Add page context
    if (this.config.includePageSummary) {
      contextParts.push(
        `Current page: ${context.summary.pageType} at ${context.metadata.url}`
      );

      if (context.summary.primaryContent) {
        const content = context.summary.primaryContent.substring(
          0,
          this.config.maxContextLength / 2
        );
        contextParts.push(`Page content: ${content}`);
      }
    }

    // Add key elements
    if (context.summary.keyElements.length > 0) {
      contextParts.push(
        `Key page elements: ${context.summary.keyElements
          .slice(0, 5)
          .join(", ")}`
      );
    }

    // Add recent activity context
    if (
      this.config.includeUserInteractions &&
      context.summary.userActivity.recentInteractions > 0
    ) {
      const activity = context.summary.userActivity;
      contextParts.push(
        `Recent user activity: ${
          activity.recentInteractions
        } interactions with ${activity.activeElements.join(", ")}`
      );
    }

    // Add network context
    if (
      this.config.includeNetworkActivity &&
      context.summary.dataFlows.length > 0
    ) {
      const recentAPIs = context.summary.dataFlows
        .filter((df) => df.type === "api")
        .slice(0, 3)
        .map((df) => `${df.method} ${df.endpoint} (${df.status})`)
        .join(", ");

      if (recentAPIs) {
        contextParts.push(`Recent API calls: ${recentAPIs}`);
      }
    }

    // Add semantic context
    if (this.config.includeSemanticData && context.semantics) {
      const schemaTypes = context.semantics.schema
        .map((s) => s.type)
        .slice(0, 3);
      if (schemaTypes.length > 0) {
        contextParts.push(`Page schema: ${schemaTypes.join(", ")}`);
      }
    }

    // Build final enhanced message
    const contextString = contextParts.join("\n");
    const truncatedContext =
      contextString.length > this.config.maxContextLength
        ? contextString.substring(0, this.config.maxContextLength) + "..."
        : contextString;

    return `Context: ${truncatedContext}\n\nUser question: ${originalMessage}`;
  }

  /**
   * Check if AI context cache is still valid
   */
  private isAIContextCacheValid(): boolean {
    return (
      this.aiFormattedContextCache !== null &&
      Date.now() - this.lastAIContextUpdate < this.aiContextCacheTimeout
    );
  }

  /**
   * Extract PageContext from AggregatedContext for formatter
   */
  private extractPageContextFromAggregated(
    aggregated: AggregatedContext
  ): PageContext {
    return {
      url:
        aggregated.metadata?.url ||
        aggregated.content?.url ||
        window.location.href,
      title:
        aggregated.metadata?.title ||
        aggregated.content?.title ||
        document.title,
      timestamp: aggregated.metadata?.timestamp || new Date().toISOString(),
      content: aggregated.content,
      layout: {
        viewport: {
          width: 0,
          height: 0,
          scrollX: 0,
          scrollY: 0,
          devicePixelRatio: 1,
        },
        visibleElements: [],
        scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 0 },
        modals: [],
        overlays: [],
      },
      network: aggregated.network || {
        recentRequests: [],
        totalRequests: 0,
        totalDataTransferred: 0,
        averageResponseTime: 0,
      },
      interactions: [],
      metadata: {
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        scrollPosition: { x: window.scrollX, y: window.scrollY },
      },
      semantics: aggregated.semantics,
    };
  }

  /**
   * Apply privacy filtering to context data
   */
  private applyPrivacyFiltering(context: PageContext): PageContext {
    // Check if current domain/path should be excluded
    if (this.isDomainExcluded(context.url)) {
      // Return minimal context for excluded domains
      return {
        ...context,
        content: {
          ...context.content,
          text: "[Content filtered for privacy]",
          forms: [],
          tables: [],
        },
        network: {
          ...context.network,
          recentRequests: [],
        },
        interactions: [],
      };
    }

    // Apply data redaction if enabled
    if (this.privacyConfig.redactSensitiveData) {
      return this.redactSensitiveData(context);
    }

    return context;
  }

  /**
   * Redact sensitive data from context using configured patterns
   */
  private redactSensitiveData(context: PageContext): PageContext {
    const redactedContext = { ...context };

    // Redact sensitive data from text content
    if (redactedContext.content.text) {
      let redactedText = redactedContext.content.text;

      this.privacyConfig.sensitiveDataPatterns.forEach((pattern) => {
        redactedText = redactedText.replace(pattern, "[REDACTED]");
      });

      redactedContext.content = {
        ...redactedContext.content,
        text: redactedText,
      };
    }

    // Redact sensitive data from form fields
    if (redactedContext.content.forms) {
      redactedContext.content.forms = redactedContext.content.forms.map(
        (form) => ({
          ...form,
          fields: form.fields.map((field) => {
            // Redact values from sensitive field types
            const sensitiveFieldTypes = ["password", "email", "tel", "number"];
            if (
              sensitiveFieldTypes.includes(field.type.toLowerCase()) &&
              field.value
            ) {
              return { ...field, value: "[REDACTED]" };
            }
            return field;
          }),
        })
      );
    }

    // Redact sensitive data from network requests
    if (redactedContext.network.recentRequests) {
      redactedContext.network.recentRequests =
        redactedContext.network.recentRequests.map((request: any) => {
          let redactedUrl = request.url;

          // Redact sensitive URL parameters
          try {
            const url = new URL(redactedUrl);
            const sensitiveParams = [
              "token",
              "key",
              "password",
              "secret",
              "auth",
              "session",
              "api_key",
            ];

            sensitiveParams.forEach((param) => {
              if (url.searchParams.has(param)) {
                url.searchParams.set(param, "[REDACTED]");
              }
            });

            redactedUrl = url.toString();
          } catch (error) {
            // If URL parsing fails, leave as is
          }

          return {
            ...request,
            url: redactedUrl,
          };
        });
    }

    return redactedContext;
  }
}
