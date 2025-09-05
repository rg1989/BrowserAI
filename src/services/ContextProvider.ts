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
  initialize(pageContextMonitor: PageContextMonitor): void {
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
    return (
      this.pageContextMonitor !== null && this.pageContextMonitor.isActive()
    );
  }

  /**
   * Get current page context for AI
   */
  async getCurrentContext(): Promise<AggregatedContext | null> {
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
}
