import { AggregatedContext, PageType } from "./ContextAggregator";
import { ContextSuggestion, SuggestionType } from "./ContextProvider";
import { ChatMessage } from "../types/workflow";

/**
 * Insight types for proactive AI assistance
 */
export enum InsightType {
  PERFORMANCE_ISSUE = "performance_issue",
  SECURITY_CONCERN = "security_concern",
  ACCESSIBILITY_ISSUE = "accessibility_issue",
  UX_IMPROVEMENT = "ux_improvement",
  DATA_PATTERN = "data_pattern",
  WORKFLOW_OPTIMIZATION = "workflow_optimization",
  ERROR_PATTERN = "error_pattern",
  CONTENT_QUALITY = "content_quality",
}

/**
 * AI insight with actionable recommendations
 */
export interface AIInsight {
  type: InsightType;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  actionable: boolean;
  recommendations: string[];
  context: string;
  evidence: string[];
}

/**
 * Workflow recommendation based on page context
 */
export interface WorkflowRecommendation {
  workflowType: string;
  title: string;
  description: string;
  relevanceScore: number;
  triggerContext: string;
  suggestedPrompts: string[];
}

/**
 * Pattern detection result
 */
interface PatternDetection {
  pattern: string;
  confidence: number;
  occurrences: number;
  context: string;
  suggestions: string[];
}

/**
 * Suggestion engine for contextual AI insights and recommendations
 */
export class SuggestionEngine {
  private static instance: SuggestionEngine;
  private insightCache: Map<string, AIInsight[]> = new Map();
  private cacheTimeout: number = 60000; // 1 minute

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): SuggestionEngine {
    if (!SuggestionEngine.instance) {
      SuggestionEngine.instance = new SuggestionEngine();
    }
    return SuggestionEngine.instance;
  }

  /**
   * Generate contextual suggestions based on current page state
   */
  async generateContextualSuggestions(
    context: AggregatedContext,
    chatHistory?: ChatMessage[]
  ): Promise<ContextSuggestion[]> {
    const suggestions: ContextSuggestion[] = [];

    try {
      // Form-related suggestions
      suggestions.push(...this.generateFormSuggestions(context));

      // Data analysis suggestions
      suggestions.push(...this.generateDataAnalysisSuggestions(context));

      // API and network suggestions
      suggestions.push(...this.generateNetworkSuggestions(context));

      // Error diagnosis suggestions
      suggestions.push(...this.generateErrorSuggestions(context));

      // Content and navigation suggestions
      suggestions.push(...this.generateContentSuggestions(context));

      // Workflow optimization suggestions
      suggestions.push(
        ...this.generateWorkflowSuggestions(context, chatHistory)
      );

      // Sort by confidence and relevance
      return suggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 8); // Return top 8 suggestions
    } catch (error) {
      console.error("Failed to generate contextual suggestions:", error);
      return [];
    }
  }

  /**
   * Generate proactive AI insights based on detected patterns
   */
  async generateProactiveInsights(
    context: AggregatedContext,
    _chatHistory?: ChatMessage[]
  ): Promise<AIInsight[]> {
    const cacheKey = this.generateCacheKey(context);

    // Check cache first
    if (this.insightCache.has(cacheKey)) {
      const cached = this.insightCache.get(cacheKey)!;
      return cached;
    }

    const insights: AIInsight[] = [];

    try {
      // Performance insights
      insights.push(...this.detectPerformanceIssues(context));

      // Security insights
      insights.push(...this.detectSecurityConcerns(context));

      // Accessibility insights
      insights.push(...this.detectAccessibilityIssues(context));

      // UX improvement insights
      insights.push(...this.detectUXImprovements(context));

      // Data pattern insights
      insights.push(...this.detectDataPatterns(context));

      // Error pattern insights
      insights.push(...this.detectErrorPatterns(context));

      // Content quality insights
      insights.push(...this.detectContentQualityIssues(context));

      // Cache results
      this.insightCache.set(cacheKey, insights);
      setTimeout(() => this.insightCache.delete(cacheKey), this.cacheTimeout);

      return insights.sort((a, b) => b.confidence - a.confidence).slice(0, 6); // Return top 6 insights
    } catch (error) {
      console.error("Failed to generate proactive insights:", error);
      return [];
    }
  }

  /**
   * Generate workflow recommendations based on context
   */
  async generateWorkflowRecommendations(
    context: AggregatedContext
  ): Promise<WorkflowRecommendation[]> {
    const recommendations: WorkflowRecommendation[] = [];

    try {
      // Form workflow recommendations
      if (context.content.forms.length > 0) {
        recommendations.push({
          workflowType: "form-assistant",
          title: "Form Completion Assistant",
          description: "Get help filling out forms with smart suggestions",
          relevanceScore: 0.9,
          triggerContext: `${context.content.forms.length} form(s) detected`,
          suggestedPrompts: [
            "Help me fill out this form",
            "What information is required?",
            "Check my form for errors",
          ],
        });
      }

      // Data analysis workflow recommendations
      if (context.content.tables.length > 0) {
        recommendations.push({
          workflowType: "data-analyzer",
          title: "Data Analysis Assistant",
          description: "Analyze and extract insights from page data",
          relevanceScore: 0.8,
          triggerContext: `${context.content.tables.length} data table(s) found`,
          suggestedPrompts: [
            "Analyze this data for patterns",
            "Export this data to CSV",
            "Create a summary of this data",
          ],
        });
      }

      // API debugging workflow recommendations
      if (
        context.network &&
        context.network.recentRequests.some((req) => req.status >= 400)
      ) {
        recommendations.push({
          workflowType: "api-debugger",
          title: "API Debugging Assistant",
          description: "Debug API issues and network problems",
          relevanceScore: 0.95,
          triggerContext: "API errors detected",
          suggestedPrompts: [
            "Debug these API errors",
            "Explain what went wrong",
            "Suggest fixes for these issues",
          ],
        });
      }

      // Content optimization workflow recommendations
      if (
        context.summary.pageType === PageType.ARTICLE ||
        context.summary.pageType === PageType.DOCUMENTATION
      ) {
        recommendations.push({
          workflowType: "content-optimizer",
          title: "Content Optimization Assistant",
          description: "Improve content quality and SEO",
          relevanceScore: 0.7,
          triggerContext: "Content page detected",
          suggestedPrompts: [
            "Analyze this content for SEO",
            "Suggest improvements",
            "Check readability score",
          ],
        });
      }

      return recommendations
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 4);
    } catch (error) {
      console.error("Failed to generate workflow recommendations:", error);
      return [];
    }
  }

  /**
   * Detect common patterns and errors on the page
   */
  async detectCommonPatterns(
    context: AggregatedContext
  ): Promise<PatternDetection[]> {
    const patterns: PatternDetection[] = [];

    try {
      // Detect form validation patterns
      const formPatterns = this.detectFormPatterns(context);
      patterns.push(...formPatterns);

      // Detect API usage patterns
      const apiPatterns = this.detectAPIPatterns(context);
      patterns.push(...apiPatterns);

      // Detect navigation patterns
      const navPatterns = this.detectNavigationPatterns(context);
      patterns.push(...navPatterns);

      // Detect content patterns
      const contentPatterns = this.detectContentPatterns(context);
      patterns.push(...contentPatterns);

      return patterns.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error("Failed to detect patterns:", error);
      return [];
    }
  }

  /**
   * Private helper methods for generating specific types of suggestions
   */

  private generateFormSuggestions(
    context: AggregatedContext
  ): ContextSuggestion[] {
    const suggestions: ContextSuggestion[] = [];

    if (context.content.forms.length > 0) {
      const totalFields = context.content.forms.reduce(
        (sum, form) => sum + form.fields.length,
        0
      );

      suggestions.push({
        type: SuggestionType.FORM_ASSISTANCE,
        title: "Smart Form Assistant",
        description: `Help with ${totalFields} form field(s) across ${context.content.forms.length} form(s)`,
        confidence: 0.9,
        actionable: true,
        context: `Forms: ${context.content.forms
          .map((f) => `${f.fields.length} fields`)
          .join(", ")}`,
      });

      // Check for required fields
      const requiredFields = context.content.forms.flatMap((f) =>
        f.fields.filter((field) => field.required)
      );

      if (requiredFields.length > 0) {
        suggestions.push({
          type: SuggestionType.FORM_ASSISTANCE,
          title: "Required Field Checker",
          description: `Validate ${requiredFields.length} required field(s)`,
          confidence: 0.8,
          actionable: true,
          context: `Required fields: ${requiredFields
            .map((f) => f.name)
            .join(", ")}`,
        });
      }
    }

    return suggestions;
  }

  private generateDataAnalysisSuggestions(
    context: AggregatedContext
  ): ContextSuggestion[] {
    const suggestions: ContextSuggestion[] = [];

    if (context.content.tables.length > 0) {
      const totalRows = context.content.tables.reduce(
        (sum, table) => sum + table.rows.length,
        0
      );

      suggestions.push({
        type: SuggestionType.DATA_ANALYSIS,
        title: "Data Table Analyzer",
        description: `Analyze ${totalRows} rows across ${context.content.tables.length} table(s)`,
        confidence: 0.8,
        actionable: true,
        context: `Tables with headers: ${context.content.tables
          .map((t) => t.headers.join(", "))
          .join("; ")}`,
      });

      // Check for sortable/filterable data
      if (context.content.tables.some((t) => t.headers.length > 3)) {
        suggestions.push({
          type: SuggestionType.DATA_ANALYSIS,
          title: "Advanced Data Operations",
          description: "Sort, filter, and export table data",
          confidence: 0.7,
          actionable: true,
          context: "Complex tables detected with multiple columns",
        });
      }
    }

    return suggestions;
  }

  private generateNetworkSuggestions(
    context: AggregatedContext
  ): ContextSuggestion[] {
    const suggestions: ContextSuggestion[] = [];

    if (context.network && context.network.recentRequests.length > 0) {
      const apiRequests = context.network.recentRequests.filter(
        (req) =>
          req.url.includes("/api/") ||
          req.url.includes(".json") ||
          req.headers["content-type"]?.includes("application/json")
      );

      if (apiRequests.length > 0) {
        suggestions.push({
          type: SuggestionType.API_INSIGHTS,
          title: "API Activity Monitor",
          description: `Monitor ${apiRequests.length} API call(s) and responses`,
          confidence: 0.8,
          actionable: true,
          context: `API endpoints: ${apiRequests
            .map((req) => {
              try {
                return new URL(req.url).pathname;
              } catch {
                return req.url;
              }
            })
            .join(", ")}`,
        });
      }

      // Check for slow requests
      const slowRequests = context.network.recentRequests.filter(
        (req) => req.responseTime && req.responseTime > 2000
      );

      if (slowRequests.length > 0) {
        suggestions.push({
          type: SuggestionType.API_INSIGHTS,
          title: "Performance Analysis",
          description: `Analyze ${slowRequests.length} slow request(s)`,
          confidence: 0.9,
          actionable: true,
          context: "Slow network requests detected (>2s response time)",
        });
      }

      // If no API requests but has network activity, still suggest API insights
      if (
        apiRequests.length === 0 &&
        context.network.recentRequests.length > 0
      ) {
        suggestions.push({
          type: SuggestionType.API_INSIGHTS,
          title: "Network Activity Analysis",
          description: `Analyze ${context.network.recentRequests.length} network request(s)`,
          confidence: 0.6,
          actionable: true,
          context: "Network requests detected",
        });
      }
    }

    return suggestions;
  }

  private generateErrorSuggestions(
    context: AggregatedContext
  ): ContextSuggestion[] {
    const suggestions: ContextSuggestion[] = [];

    if (context.network && context.network.recentRequests.length > 0) {
      const errorRequests = context.network.recentRequests.filter(
        (req) => req.status >= 400
      );

      if (errorRequests.length > 0) {
        const errorTypes = new Set(
          errorRequests.map((req) => Math.floor(req.status / 100) * 100)
        );

        suggestions.push({
          type: SuggestionType.ERROR_DIAGNOSIS,
          title: "Error Diagnostic Assistant",
          description: `Diagnose ${errorRequests.length} HTTP error(s)`,
          confidence: 0.95,
          actionable: true,
          context: `Error types: ${Array.from(errorTypes)
            .map((code) => `${code}xx`)
            .join(", ")}`,
        });
      }
    }

    // Note: JavaScript error detection would require additional monitoring
    // This is a placeholder for future implementation

    return suggestions;
  }

  private generateContentSuggestions(
    context: AggregatedContext
  ): ContextSuggestion[] {
    const suggestions: ContextSuggestion[] = [];

    // Content summary for long pages
    if (context.content.text.length > 2000) {
      suggestions.push({
        type: SuggestionType.CONTENT_SUMMARY,
        title: "Content Summarizer",
        description: "Get a concise summary of this page",
        confidence: 0.7,
        actionable: true,
        context: `${
          Math.round(context.content.text.length / 100) * 100
        }+ characters of content`,
      });
    }

    // Navigation help for complex pages
    if (context.content.headings.length > 5) {
      suggestions.push({
        type: SuggestionType.NAVIGATION_HELP,
        title: "Page Navigation Assistant",
        description: `Navigate through ${context.content.headings.length} sections`,
        confidence: 0.6,
        actionable: true,
        context: `Sections: ${context.content.headings
          .slice(0, 3)
          .map((h) => h.text)
          .join(", ")}...`,
      });
    }

    return suggestions;
  }

  private generateWorkflowSuggestions(
    context: AggregatedContext,
    chatHistory?: ChatMessage[]
  ): ContextSuggestion[] {
    const suggestions: ContextSuggestion[] = [];

    // Analyze chat history for workflow patterns
    if (chatHistory && chatHistory.length > 0) {
      const recentUserMessages = chatHistory
        .filter((msg) => msg.sender === "user")
        .slice(-3)
        .map((msg) => msg.content.toLowerCase());

      // Detect repetitive tasks
      const taskPatterns = this.detectTaskPatterns(recentUserMessages);
      if (taskPatterns.length > 0) {
        suggestions.push({
          type: SuggestionType.WORKFLOW_OPTIMIZATION,
          title: "Workflow Automation",
          description: "Automate repetitive tasks you've been doing",
          confidence: 0.8,
          actionable: true,
          context: `Detected patterns: ${taskPatterns.join(", ")}`,
        });
      }
    }

    // Suggest workflows based on page type
    if (context.summary.pageType === PageType.ECOMMERCE) {
      suggestions.push({
        type: SuggestionType.WORKFLOW_OPTIMIZATION,
        title: "Shopping Assistant",
        description: "Compare prices, find deals, track items",
        confidence: 0.7,
        actionable: true,
        context: "E-commerce page detected",
      });
    }

    return suggestions;
  }

  /**
   * Private helper methods for generating insights
   */

  private detectPerformanceIssues(context: AggregatedContext): AIInsight[] {
    const insights: AIInsight[] = [];

    // Check for slow network requests
    if (context.network && context.network.recentRequests.length > 0) {
      const slowRequests = context.network.recentRequests.filter(
        (req) => req.responseTime && req.responseTime > 3000
      );

      if (slowRequests.length > 0) {
        insights.push({
          type: InsightType.PERFORMANCE_ISSUE,
          title: "Slow Network Requests Detected",
          description: `${slowRequests.length} request(s) taking longer than 3 seconds`,
          severity: "medium",
          confidence: 0.9,
          actionable: true,
          recommendations: [
            "Check network connection",
            "Analyze request payload size",
            "Consider request optimization",
            "Implement caching strategies",
          ],
          context: "Network performance analysis",
          evidence: slowRequests.map(
            (req) => `${req.method} ${req.url}: ${req.responseTime}ms`
          ),
        });
      }
    }

    return insights;
  }

  private detectSecurityConcerns(context: AggregatedContext): AIInsight[] {
    const insights: AIInsight[] = [];

    // Check for HTTP requests on HTTPS pages
    if (context.metadata.url.startsWith("https://") && context.network) {
      const httpRequests = context.network.recentRequests.filter((req) =>
        req.url.startsWith("http://")
      );

      if (httpRequests.length > 0) {
        insights.push({
          type: InsightType.SECURITY_CONCERN,
          title: "Mixed Content Warning",
          description: "HTTP requests detected on HTTPS page",
          severity: "high",
          confidence: 0.95,
          actionable: true,
          recommendations: [
            "Update HTTP URLs to HTTPS",
            "Check for insecure resource loading",
            "Review Content Security Policy",
          ],
          context: "Security analysis",
          evidence: httpRequests.map((req) => req.url),
        });
      }
    }

    return insights;
  }

  private detectAccessibilityIssues(context: AggregatedContext): AIInsight[] {
    const insights: AIInsight[] = [];

    // Check for images without alt text
    const imagesWithoutAlt = context.content.images.filter(
      (img) => !img.alt || img.alt.trim() === ""
    );

    if (imagesWithoutAlt.length > 0) {
      insights.push({
        type: InsightType.ACCESSIBILITY_ISSUE,
        title: "Missing Alt Text",
        description: `${imagesWithoutAlt.length} image(s) missing alt text`,
        severity: "medium",
        confidence: 0.8,
        actionable: true,
        recommendations: [
          "Add descriptive alt text to images",
          'Use empty alt="" for decorative images',
          "Consider image context and purpose",
        ],
        context: "Accessibility analysis",
        evidence: imagesWithoutAlt.map((img) => img.src),
      });
    }

    return insights;
  }

  private detectUXImprovements(context: AggregatedContext): AIInsight[] {
    const insights: AIInsight[] = [];

    // Check for forms with missing placeholders or poor UX
    if (context.content.forms.length > 0) {
      const formsWithUXIssues = context.content.forms.filter((form) =>
        form.fields.some(
          (field) => !field.placeholder || field.placeholder.trim() === ""
        )
      );

      if (formsWithUXIssues.length > 0) {
        insights.push({
          type: InsightType.UX_IMPROVEMENT,
          title: "Form Usability Issues",
          description: "Forms with missing placeholder text detected",
          severity: "medium",
          confidence: 0.7,
          actionable: true,
          recommendations: [
            "Add helpful placeholder text to form fields",
            "Provide clear field descriptions",
            "Include field validation messages",
            "Consider adding field labels for better accessibility",
          ],
          context: "User experience analysis",
          evidence: [`${formsWithUXIssues.length} form(s) with UX issues`],
        });
      }
    }

    return insights;
  }

  private detectDataPatterns(context: AggregatedContext): AIInsight[] {
    const insights: AIInsight[] = [];

    // Analyze data tables for patterns
    if (context.content.tables.length > 0) {
      const largeTables = context.content.tables.filter(
        (table) => table.rows.length > 50
      );

      if (largeTables.length > 0) {
        insights.push({
          type: InsightType.DATA_PATTERN,
          title: "Large Dataset Detected",
          description: `Table(s) with ${largeTables.reduce(
            (sum, t) => sum + t.rows.length,
            0
          )} total rows`,
          severity: "low",
          confidence: 0.8,
          actionable: true,
          recommendations: [
            "Consider data pagination",
            "Implement search and filtering",
            "Add data export functionality",
            "Optimize table rendering performance",
          ],
          context: "Data analysis",
          evidence: largeTables.map((t) => `Table with ${t.rows.length} rows`),
        });
      }
    }

    return insights;
  }

  private detectErrorPatterns(context: AggregatedContext): AIInsight[] {
    const insights: AIInsight[] = [];

    if (context.network && context.network.recentRequests.length > 0) {
      // Group errors by status code
      const errorGroups = new Map<
        number,
        typeof context.network.recentRequests
      >();

      context.network.recentRequests
        .filter((req) => req.status >= 400)
        .forEach((req) => {
          if (!errorGroups.has(req.status)) {
            errorGroups.set(req.status, []);
          }
          errorGroups.get(req.status)!.push(req);
        });

      errorGroups.forEach((requests, status) => {
        if (requests.length > 1) {
          insights.push({
            type: InsightType.ERROR_PATTERN,
            title: `Recurring ${status} Errors`,
            description: `${requests.length} requests failing with ${status} status`,
            severity: status >= 500 ? "high" : "medium",
            confidence: 0.9,
            actionable: true,
            recommendations: [
              "Check API endpoint availability",
              "Verify request parameters",
              "Review authentication tokens",
              "Check server logs for details",
            ],
            context: "Error pattern analysis",
            evidence: requests.map((req) => `${req.method} ${req.url}`),
          });
        } else if (requests.length === 1 && status >= 500) {
          // Also detect single high-severity errors
          insights.push({
            type: InsightType.ERROR_PATTERN,
            title: `${status} Error Detected`,
            description: `Server error detected: ${status} status`,
            severity: "high",
            confidence: 0.8,
            actionable: true,
            recommendations: [
              "Check server availability",
              "Review server logs",
              "Verify API endpoint",
              "Check request parameters",
            ],
            context: "Error analysis",
            evidence: requests.map((req) => `${req.method} ${req.url}`),
          });
        }
      });
    }

    return insights;
  }

  private detectContentQualityIssues(context: AggregatedContext): AIInsight[] {
    const insights: AIInsight[] = [];

    // Check for very long paragraphs (readability)
    const longContent = context.content.text.length > 5000;
    const hasHeadings = context.content.headings.length > 0;

    if (longContent && !hasHeadings) {
      insights.push({
        type: InsightType.CONTENT_QUALITY,
        title: "Content Structure Issues",
        description: "Long content without proper heading structure",
        severity: "low",
        confidence: 0.6,
        actionable: true,
        recommendations: [
          "Add section headings for better structure",
          "Break content into smaller paragraphs",
          "Use bullet points for lists",
          "Consider adding a table of contents",
        ],
        context: "Content quality analysis",
        evidence: [
          `${Math.round(
            context.content.text.length / 1000
          )}k characters without headings`,
        ],
      });
    }

    return insights;
  }

  /**
   * Pattern detection helper methods
   */

  private detectFormPatterns(context: AggregatedContext): PatternDetection[] {
    const patterns: PatternDetection[] = [];

    if (context.content.forms.length > 0) {
      // Detect validation patterns based on required fields
      const formsWithValidation = context.content.forms.filter((form) =>
        form.fields.some((field) => field.required)
      );

      if (formsWithValidation.length > 0) {
        patterns.push({
          pattern: "form_validation",
          confidence: 0.8,
          occurrences: formsWithValidation.length,
          context: "Forms with validation rules detected",
          suggestions: [
            "Provide real-time validation feedback",
            "Show clear error messages",
            "Highlight required fields",
          ],
        });
      }
    }

    return patterns;
  }

  private detectAPIPatterns(context: AggregatedContext): PatternDetection[] {
    const patterns: PatternDetection[] = [];

    if (context.network && context.network.recentRequests.length > 0) {
      // Detect REST API patterns
      const restRequests = context.network.recentRequests.filter(
        (req) =>
          (req.url.includes("/api/") || req.url.includes("api.")) &&
          ["GET", "POST", "PUT", "DELETE"].includes(req.method)
      );

      if (restRequests.length >= 2) {
        patterns.push({
          pattern: "rest_api_usage",
          confidence: 0.9,
          occurrences: restRequests.length,
          context: "RESTful API usage detected",
          suggestions: [
            "Monitor API response times",
            "Implement error handling",
            "Add request caching",
          ],
        });
      }
    }

    return patterns;
  }

  private detectNavigationPatterns(
    context: AggregatedContext
  ): PatternDetection[] {
    const patterns: PatternDetection[] = [];

    // Detect SPA navigation patterns based on navigation activity
    if (context.summary.userActivity.navigationActivity) {
      patterns.push({
        pattern: "spa_navigation",
        confidence: 0.7,
        occurrences: 1, // Based on activity flag
        context: "Single-page application navigation detected",
        suggestions: [
          "Implement loading states",
          "Add navigation breadcrumbs",
          "Optimize route transitions",
        ],
      });
    }

    return patterns;
  }

  private detectContentPatterns(
    context: AggregatedContext
  ): PatternDetection[] {
    const patterns: PatternDetection[] = [];

    // Detect dynamic content patterns based on interaction count
    if (context.summary.userActivity.recentInteractions >= 3) {
      patterns.push({
        pattern: "dynamic_content",
        confidence: 0.8,
        occurrences: context.summary.userActivity.recentInteractions,
        context: "Frequent user interactions detected",
        suggestions: [
          "Implement smooth transitions",
          "Add loading indicators",
          "Optimize interaction performance",
        ],
      });
    }

    return patterns;
  }

  private detectTaskPatterns(messages: string[]): string[] {
    const patterns: string[] = [];

    // Simple pattern detection for common tasks
    const taskKeywords = {
      "form filling": ["fill", "form", "complete", "submit"],
      "data analysis": ["analyze", "data", "table", "chart"],
      debugging: ["error", "debug", "fix", "problem"],
      navigation: ["find", "go to", "navigate", "search"],
    };

    Object.entries(taskKeywords).forEach(([task, keywords]) => {
      const matches = messages.filter((msg) =>
        keywords.some((keyword) => msg.includes(keyword))
      );

      if (matches.length >= 2) {
        patterns.push(task);
      }
    });

    return patterns;
  }

  private generateCacheKey(context: AggregatedContext): string {
    const url = context.metadata?.url || context.content?.url || "unknown";
    const timestamp = context.metadata?.timestamp || new Date().toISOString();
    const pageType =
      context.summary?.pageType || context.content?.pageType || "unknown";
    return `${url}_${timestamp}_${pageType}`;
  }
}
