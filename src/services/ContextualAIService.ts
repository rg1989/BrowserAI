import { AIService, AIServiceResponse } from "./AIService";
import { BrowserLLMService } from "./BrowserLLMService";
import { ContextProvider } from "./ContextProvider";
import { FormattedContext } from "./ContextFormatter";
import { ChatMessage } from "../types/workflow";

/**
 * Enhanced AI service response with contextual information
 */
export interface ContextualAIServiceResponse extends AIServiceResponse {
  contextUsed: boolean;
  contextTokens: number;
}

/**
 * Configuration options for contextual messages
 */
export interface ContextualMessageOptions {
  includeNetworkData?: boolean;
  includeDOMChanges?: boolean;
  includeInteractions?: boolean;
  maxContextTokens?: number;
  contextPriority?: ContextPriority;
  useContext?: boolean; // Allow disabling context for specific messages
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
 * Contextual suggestion for proactive AI assistance
 */
export interface ContextualSuggestion {
  id: string;
  type: "form-help" | "debug-assist" | "data-analysis" | "workflow";
  title: string;
  description: string;
  action?: SuggestionAction;
  confidence: number;
  context: ContextReference;
}

export interface SuggestionAction {
  type: "prompt" | "workflow" | "external";
  data: any;
}

export interface ContextReference {
  pageUrl: string;
  elementSelector?: string;
  contextType: string;
}

/**
 * Conversation context for maintaining state across messages
 */
export interface ConversationContext {
  id: string;
  messages: ChatMessage[];
  pageContext: FormattedContext | null;
  lastUpdated: Date;
  contextOptions: ContextualMessageOptions;
}

/**
 * Context summary for display purposes
 */
export interface ContextSummary {
  hasContext: boolean;
  pageTitle: string;
  pageUrl: string;
  contextTypes: string[];
  tokenCount: number;
  lastUpdated: Date;
}

/**
 * ContextualAIService orchestrates AI interactions with page context
 * Main integration point between AI services and context monitoring
 */
export class ContextualAIService {
  private aiService: AIService;
  private contextProvider: ContextProvider;
  private conversationContexts: Map<string, ConversationContext> = new Map();
  private defaultOptions: ContextualMessageOptions;

  constructor(
    aiService?: AIService,
    contextProvider?: ContextProvider,
    options?: Partial<ContextualMessageOptions>
  ) {
    // Use BrowserLLMService as default if no AI service provided
    this.aiService = aiService || new BrowserLLMService();
    this.contextProvider = contextProvider || ContextProvider.getInstance();

    this.defaultOptions = {
      includeNetworkData: true,
      includeDOMChanges: true,
      includeInteractions: true,
      maxContextTokens: 1000,
      useContext: true,
      contextPriority: {
        currentPage: 1.0,
        recentActivity: 0.8,
        userInteractions: 0.9,
        networkData: 0.7,
        semanticData: 0.6,
      },
      ...options,
    };
  }

  /**
   * Send a contextual message that includes current page context
   */
  async sendContextualMessage(
    message: string,
    conversationId: string,
    options?: ContextualMessageOptions
  ): Promise<ContextualAIServiceResponse> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    try {
      // Get conversation context
      let conversation = this.conversationContexts.get(conversationId);
      if (!conversation) {
        conversation = this.createNewConversation(
          conversationId,
          mergedOptions
        );
      }

      // Get current page context if enabled
      let contextualMessage = message;
      let currentContext: FormattedContext | null = null;

      if (mergedOptions.useContext && this.contextProvider.isReady()) {
        try {
          currentContext = await this.contextProvider.getAIFormattedContext(
            message,
            mergedOptions.maxContextTokens
          );

          if (currentContext) {
            contextualMessage = this.buildContextualMessage(
              message,
              currentContext,
              mergedOptions
            );
            conversation.pageContext = currentContext;
          }
        } catch (error) {
          console.warn(
            "Failed to get page context, proceeding without:",
            error
          );
        }
      }

      // Send message to AI service
      const response = await this.aiService.sendMessage(
        contextualMessage,
        conversation.messages
      );

      // Update conversation history
      this.updateConversationHistory(conversation, message, response.message);

      // Enhance response with context information
      const enhancedResponse = this.enhanceResponse(response, currentContext);

      return enhancedResponse;
    } catch (error) {
      console.error("Failed to send contextual message:", error);
      throw error;
    }
  }

  /**
   * Send a contextual message with streaming response
   */
  async sendContextualMessageStream(
    message: string,
    conversationId: string,
    onChunk: (chunk: string) => void,
    options?: ContextualMessageOptions
  ): Promise<ContextualAIServiceResponse> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    try {
      // Get conversation context
      let conversation = this.conversationContexts.get(conversationId);
      if (!conversation) {
        conversation = this.createNewConversation(
          conversationId,
          mergedOptions
        );
      }

      // Get current page context if enabled
      let contextualMessage = message;
      let currentContext: FormattedContext | null = null;

      if (mergedOptions.useContext && this.contextProvider.isReady()) {
        try {
          currentContext = await this.contextProvider.getAIFormattedContext(
            message,
            mergedOptions.maxContextTokens
          );

          if (currentContext) {
            contextualMessage = this.buildContextualMessage(
              message,
              currentContext,
              mergedOptions
            );
            conversation.pageContext = currentContext;
          }
        } catch (error) {
          console.warn(
            "Failed to get page context, proceeding without:",
            error
          );
        }
      }

      // Send streaming message to AI service
      const response = await this.aiService.sendMessageStream(
        contextualMessage,
        conversation.messages,
        onChunk
      );

      // Update conversation history
      this.updateConversationHistory(conversation, message, response.message);

      // Enhance response with context information
      const enhancedResponse = this.enhanceResponse(response, currentContext);

      return enhancedResponse;
    } catch (error) {
      console.error("Failed to send contextual streaming message:", error);
      throw error;
    }
  }

  /**
   * Generate contextual suggestions based on current page
   */
  async generateContextualSuggestions(): Promise<ContextualSuggestion[]> {
    if (!this.contextProvider.isReady()) {
      return [];
    }

    try {
      const suggestions = await this.contextProvider.generateSuggestions();

      // Convert to ContextualSuggestion format
      return suggestions.map((suggestion, index) => ({
        id: `suggestion-${index}`,
        type: this.mapSuggestionType(suggestion.type),
        title: suggestion.title,
        description: suggestion.description,
        confidence: suggestion.confidence,
        context: {
          pageUrl: window.location.href,
          contextType: suggestion.type,
        },
      }));
    } catch (error) {
      console.error("Failed to generate contextual suggestions:", error);
      return [];
    }
  }

  /**
   * Set context options for future messages
   */
  setContextOptions(options: ContextualMessageOptions): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Get current context summary for display
   */
  async getContextSummary(): Promise<ContextSummary> {
    if (!this.contextProvider.isReady()) {
      return {
        hasContext: false,
        pageTitle: document.title || "Unknown Page",
        pageUrl: window.location.href,
        contextTypes: [],
        tokenCount: 0,
        lastUpdated: new Date(),
      };
    }

    try {
      const context = await this.contextProvider.getAIFormattedContext();

      if (!context) {
        return {
          hasContext: false,
          pageTitle: document.title || "Unknown Page",
          pageUrl: window.location.href,
          contextTypes: [],
          tokenCount: 0,
          lastUpdated: new Date(),
        };
      }

      const contextTypes: string[] = [];
      if (context.content.mainContent) contextTypes.push("content");
      if (context.content.forms.length > 0) contextTypes.push("forms");
      if (context.network.recentRequests.length > 0)
        contextTypes.push("network");
      if (context.interactions.recentActions.length > 0)
        contextTypes.push("interactions");

      return {
        hasContext: true,
        pageTitle: context.content.title,
        pageUrl: context.content.url,
        contextTypes,
        tokenCount: context.tokenCount,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error("Failed to get context summary:", error);
      return {
        hasContext: false,
        pageTitle: document.title || "Unknown Page",
        pageUrl: window.location.href,
        contextTypes: [],
        tokenCount: 0,
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Update the AI service (for switching between services)
   */
  setAIService(aiService: AIService): void {
    this.aiService = aiService;
  }

  /**
   * Get current AI service info
   */
  getAIServiceInfo() {
    return this.aiService.getServiceInfo();
  }

  /**
   * Clear conversation context
   */
  clearConversation(conversationId: string): void {
    this.conversationContexts.delete(conversationId);
  }

  /**
   * Get conversation context
   */
  getConversation(conversationId: string): ConversationContext | undefined {
    return this.conversationContexts.get(conversationId);
  }

  /**
   * Private helper methods
   */

  /**
   * Create a new conversation context
   */
  private createNewConversation(
    conversationId: string,
    options: ContextualMessageOptions
  ): ConversationContext {
    const conversation: ConversationContext = {
      id: conversationId,
      messages: [],
      pageContext: null,
      lastUpdated: new Date(),
      contextOptions: options,
    };

    this.conversationContexts.set(conversationId, conversation);
    return conversation;
  }

  /**
   * Build contextual message by combining user message with page context
   */
  private buildContextualMessage(
    message: string,
    context: FormattedContext,
    options: ContextualMessageOptions
  ): string {
    let contextualMessage = "";

    // Add context header
    contextualMessage += "# Current Page Context\n\n";

    // Add page summary
    contextualMessage += `**Page:** ${context.content.title}\n`;
    contextualMessage += `**URL:** ${context.content.url}\n\n`;

    // Add main content if available
    if (context.content.mainContent) {
      contextualMessage += `**Content Summary:**\n${context.content.mainContent}\n\n`;
    }

    // Add forms if present and enabled
    if (options.includeDOMChanges && context.content.forms.length > 0) {
      contextualMessage += `**Forms on page:**\n`;
      context.content.forms.forEach((form, i) => {
        contextualMessage += `- Form ${i + 1}: ${form.fieldCount} fields\n`;
      });
      contextualMessage += "\n";
    }

    // Add network activity if enabled
    if (
      options.includeNetworkData &&
      context.network.recentRequests.length > 0
    ) {
      contextualMessage += `**Recent Network Activity:**\n`;
      context.network.recentRequests.slice(0, 3).forEach((req) => {
        contextualMessage += `- ${req.method} ${req.url}\n`;
      });
      contextualMessage += "\n";
    }

    // Add user interactions if enabled
    if (
      options.includeInteractions &&
      context.interactions.recentActions.length > 0
    ) {
      contextualMessage += `**Recent User Actions:**\n`;
      context.interactions.recentActions.forEach((action) => {
        contextualMessage += `- ${action.type} on ${action.element}\n`;
      });
      contextualMessage += "\n";
    }

    // Add separator and user message
    contextualMessage += "---\n\n";
    contextualMessage += `**User Question:** ${message}\n\n`;
    contextualMessage +=
      "Please answer the user's question using the page context above when relevant.";

    return contextualMessage;
  }

  /**
   * Update conversation history with new message and response
   */
  private updateConversationHistory(
    conversation: ConversationContext,
    userMessage: string,
    aiResponse: string
  ): void {
    const timestamp = new Date();

    // Add user message
    conversation.messages.push({
      id: this.generateMessageId(),
      content: userMessage,
      sender: "user",
      timestamp,
    });

    // Add AI response
    conversation.messages.push({
      id: this.generateMessageId(),
      content: aiResponse,
      sender: "ai",
      timestamp,
    });

    // Keep only last 10 messages to manage memory
    if (conversation.messages.length > 10) {
      conversation.messages = conversation.messages.slice(-10);
    }

    conversation.lastUpdated = new Date();
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Enhance AI response with context metadata
   */
  private enhanceResponse(
    response: AIServiceResponse,
    context: FormattedContext | null
  ): ContextualAIServiceResponse {
    // Add context information to response metadata
    const enhancedResponse = {
      ...response,
      contextUsed: context !== null,
      contextTokens: context?.tokenCount || 0,
    };

    return enhancedResponse;
  }

  /**
   * Map suggestion types from ContextProvider to ContextualAIService format
   */
  private mapSuggestionType(
    type: string
  ): "form-help" | "debug-assist" | "data-analysis" | "workflow" {
    switch (type) {
      case "form_assistance":
        return "form-help";
      case "error_diagnosis":
        return "debug-assist";
      case "data_analysis":
        return "data-analysis";
      default:
        return "workflow";
    }
  }
}
