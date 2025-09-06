import { ChatMessage } from "../types/workflow";

export interface AIServiceConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface AIServiceResponse {
  message: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: string;
}

export interface AIServiceError {
  code: string;
  message: string;
  details?: any;
}

export abstract class AIService {
  protected config: AIServiceConfig;

  constructor(config: AIServiceConfig = {}) {
    this.config = {
      temperature: 0.7,
      maxTokens: 1000,
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Send a message to the AI service and get a response
   */
  abstract sendMessage(
    message: string,
    context?: ChatMessage[]
  ): Promise<AIServiceResponse>;

  /**
   * Send a message with streaming response
   */
  abstract sendMessageStream(
    message: string,
    context?: ChatMessage[],
    onChunk?: (chunk: string) => void
  ): Promise<AIServiceResponse>;

  /**
   * Validate the service configuration
   */
  abstract validateConfig(): Promise<boolean>;

  /**
   * Get service information
   */
  abstract getServiceInfo(): {
    name: string;
    version: string;
    capabilities: string[];
  };

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Omit<AIServiceConfig, "apiKey"> {
    const { apiKey, ...safeConfig } = this.config;
    return safeConfig;
  }
}

/**
 * Mock AI Service for development and testing
 */
export class MockAIService extends AIService {
  private responses: Record<string, string[]> = {
    "ai-ask": [
      "I understand your question. Here's a helpful response based on what you're asking about.",
      "That's an interesting question! Let me provide you with some insights.",
      "Based on your query, here's what I can tell you:",
      "Great question! Here's my analysis of what you're asking about.",
    ],
    "ai-agent": [
      "As your AI agent, I'm here to help you accomplish this task efficiently.",
      "I'll assist you with this request. Let me break down what we need to do:",
      "Perfect! I can help you with that. Here's my recommended approach:",
      "I'm ready to help you tackle this challenge. Let's work through it together:",
    ],
  };

  private responseIndex = 0;

  async sendMessage(
    message: string,
    context?: ChatMessage[]
  ): Promise<AIServiceResponse> {
    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, 800 + Math.random() * 1200)
    );

    // Determine response type based on context or message
    const workflowType = this.determineWorkflowType(message, context);
    const responses = this.responses[workflowType] || this.responses["ai-ask"];

    // Get response (cycle through available responses)
    const responseTemplate = responses[this.responseIndex % responses.length];
    this.responseIndex++;

    // Generate contextual response
    const response = this.generateContextualResponse(
      responseTemplate,
      message,
      context
    );

    return {
      message: response,
      usage: {
        promptTokens: Math.floor(message.length / 4),
        completionTokens: Math.floor(response.length / 4),
        totalTokens: Math.floor((message.length + response.length) / 4),
      },
      model: "mock-ai-model-v1",
      finishReason: "stop",
    };
  }

  async sendMessageStream(
    message: string,
    context?: ChatMessage[],
    onChunk?: (chunk: string) => void
  ): Promise<AIServiceResponse> {
    // Get the full response first
    const fullResponse = await this.sendMessage(message, context);

    if (onChunk) {
      // Simulate streaming by sending chunks
      const words = fullResponse.message.split(" ");
      for (let i = 0; i < words.length; i++) {
        await new Promise((resolve) =>
          setTimeout(resolve, 50 + Math.random() * 100)
        );
        const chunk = i === 0 ? words[i] : " " + words[i];
        onChunk(chunk);
      }
    }

    return fullResponse;
  }

  async validateConfig(): Promise<boolean> {
    // Mock service is always valid
    return true;
  }

  getServiceInfo() {
    return {
      name: "Mock AI Service",
      version: "1.0.0",
      capabilities: ["chat", "streaming", "context-aware"],
    };
  }

  private determineWorkflowType(
    message: string,
    context?: ChatMessage[]
  ): string {
    // Simple heuristics to determine workflow type
    if (context && context.length > 0) {
      // Look at the conversation history for clues
      const lastMessage = context[context.length - 1];
      if (lastMessage.content.toLowerCase().includes("agent")) {
        return "ai-agent";
      }
    }

    // Check message content for keywords
    const lowerMessage = message.toLowerCase();
    if (
      lowerMessage.includes("help me") ||
      lowerMessage.includes("assist") ||
      lowerMessage.includes("do this") ||
      lowerMessage.includes("task")
    ) {
      return "ai-agent";
    }

    return "ai-ask";
  }

  private generateContextualResponse(
    template: string,
    message: string,
    context?: ChatMessage[]
  ): string {
    // If template is empty (for testing scenarios), return empty
    if (template === "") {
      return "";
    }

    // Generate truly contextual response based on page content
    let response = template;

    // Add page-specific context
    const pageTitle = document.title;
    const pageUrl = window.location.href;
    const domain = window.location.hostname;

    // Analyze the user's question for context clues
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes("page") ||
      lowerMessage.includes("website") ||
      lowerMessage.includes("site")
    ) {
      response += ` Based on the current page "${pageTitle}" at ${domain}, I can see this appears to be `;

      // Determine page type from URL and title
      if (domain.includes("github")) {
        response += "a GitHub repository or development platform.";
      } else if (domain.includes("google")) {
        response += "Google's search engine or services.";
      } else if (domain.includes("stackoverflow")) {
        response += "a Stack Overflow programming Q&A page.";
      } else if (
        pageTitle.toLowerCase().includes("login") ||
        pageUrl.includes("login")
      ) {
        response += "a login or authentication page.";
      } else if (pageTitle.toLowerCase().includes("dashboard")) {
        response += "a dashboard or admin interface.";
      } else {
        response += `a ${domain} website with content related to "${pageTitle}".`;
      }
    } else {
      response += ` Regarding "${message.substring(0, 50)}${
        message.length > 50 ? "..." : ""
      }":`;
    }

    // Add contextual analysis
    const contextualInsights = [
      `\n\n**Page Context**: Currently viewing "${pageTitle}" on ${domain}`,
      `\n**URL**: ${pageUrl}`,
    ];

    // Add page-specific insights
    if (document.forms.length > 0) {
      contextualInsights.push(
        `\n📝 **Forms**: Found ${document.forms.length} form(s) on this page`
      );
    }

    if (document.images.length > 0) {
      contextualInsights.push(
        `\n🖼️ **Media**: Contains ${document.images.length} image(s)`
      );
    }

    const links = document.querySelectorAll("a").length;
    if (links > 0) {
      contextualInsights.push(
        `\n🔗 **Navigation**: ${links} link(s) available`
      );
    }

    // Add contextual recommendations based on page type
    if (lowerMessage.includes("help") || lowerMessage.includes("how")) {
      response += `\n\n**Contextual Suggestions:**`;

      if (document.forms.length > 0) {
        response += `\n• I notice there are forms on this page - I can help you fill them out`;
      }

      if (
        pageTitle.toLowerCase().includes("error") ||
        pageUrl.includes("error")
      ) {
        response += `\n• This appears to be an error page - I can help troubleshoot the issue`;
      }

      if (domain.includes("github")) {
        response += `\n• For GitHub pages, I can help with repository navigation, code review, or development workflows`;
      }

      response += `\n• I can analyze the page content and provide specific guidance for this ${domain} page`;
    }

    // Add some of the contextual insights
    response += contextualInsights.slice(0, 2).join("");

    // Add conversation context if available
    if (context && context.length > 0) {
      response += `\n\n**Conversation**: Building on our previous conversation with ${context.length} message(s).`;
    }

    // Add mock network activity (since we can't access real network data in MockAI)
    const mockNetworkActivity = Math.floor(Math.random() * 5) + 1;
    response += `\n**Activity**: Detected ${mockNetworkActivity} recent network request(s)`;

    return response;
  }

  /**
   * Simulate different response scenarios for testing
   */
  setResponseScenario(scenario: "normal" | "slow" | "error" | "empty"): void {
    switch (scenario) {
      case "slow":
        // Increase delay for slow responses
        break;
      case "error":
        // This would be handled in a real implementation
        break;
      case "empty":
        this.responses = {
          "ai-ask": [""],
          "ai-agent": [""],
        };
        break;
      default:
        // Reset to normal responses
        this.responses = {
          "ai-ask": [
            "I understand your question. Here's a helpful response based on what you're asking about.",
            "That's an interesting question! Let me provide you with some insights.",
            "Based on your query, here's what I can tell you:",
            "Great question! Here's my analysis of what you're asking about.",
          ],
          "ai-agent": [
            "As your AI agent, I'm here to help you accomplish this task efficiently.",
            "I'll assist you with this request. Let me break down what we need to do:",
            "Perfect! I can help you with that. Here's my recommended approach:",
            "I'm ready to help you tackle this challenge. Let's work through it together:",
          ],
        };
    }
  }
}

/**
 * AI Service Factory for creating different AI service implementations
 */
export class AIServiceFactory {
  private static services: Map<string, () => AIService> = new Map();

  static register(name: string, factory: () => AIService): void {
    this.services.set(name, factory);
  }

  static create(name: string, config?: AIServiceConfig): AIService {
    const factory = this.services.get(name);
    if (!factory) {
      throw new Error(
        `AI service "${name}" not found. Available services: ${Array.from(
          this.services.keys()
        ).join(", ")}`
      );
    }
    return factory();
  }

  static getAvailableServices(): string[] {
    return Array.from(this.services.keys());
  }

  static createDefault(config?: AIServiceConfig): AIService {
    return new MockAIService(config);
  }
}

// Register the mock service
AIServiceFactory.register("mock", () => new MockAIService());

/**
 * AI Service Manager for handling multiple AI services
 */
export class AIServiceManager {
  private static instance: AIServiceManager;
  private currentService: AIService;
  private services: Map<string, AIService> = new Map();

  private constructor() {
    this.currentService = AIServiceFactory.createDefault();
  }

  static getInstance(): AIServiceManager {
    if (!AIServiceManager.instance) {
      AIServiceManager.instance = new AIServiceManager();
    }
    return AIServiceManager.instance;
  }

  async setService(name: string, config?: AIServiceConfig): Promise<void> {
    try {
      const service = AIServiceFactory.create(name, config);
      const isValid = await service.validateConfig();

      if (!isValid) {
        throw new Error(`Invalid configuration for AI service "${name}"`);
      }

      this.currentService = service;
      this.services.set(name, service);
    } catch (error) {
      console.error(`Failed to set AI service "${name}":`, error);
      throw error;
    }
  }

  getCurrentService(): AIService {
    return this.currentService;
  }

  async sendMessage(
    message: string,
    context?: ChatMessage[]
  ): Promise<AIServiceResponse> {
    return this.currentService.sendMessage(message, context);
  }

  async sendMessageStream(
    message: string,
    context?: ChatMessage[],
    onChunk?: (chunk: string) => void
  ): Promise<AIServiceResponse> {
    return this.currentService.sendMessageStream(message, context, onChunk);
  }

  getServiceInfo() {
    return this.currentService.getServiceInfo();
  }

  getAvailableServices(): string[] {
    return AIServiceFactory.getAvailableServices();
  }
}
