import React, { useState, useRef, useEffect } from "react";
import { ChatInterfaceProps, ChatMessage } from "../types/workflow";
import { MessageList } from "./MessageList";
import { PromptInput } from "./PromptInput";
import {
  ContextProvider,
  ContextSuggestion,
} from "../services/ContextProvider";
import {
  AIInsight,
  WorkflowRecommendation,
} from "../services/SuggestionEngine";
import {
  ContextualAIService,
  ContextualAIServiceResponse,
  ContextSummary,
} from "../services/ContextualAIService";
import "./ChatInterface.css";

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  workflowType,
  onSendMessage,
  messages: initialMessages = [],
  contextualAIService: externalContextualAIService,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contextSuggestions, setContextSuggestions] = useState<
    ContextSuggestion[]
  >([]);
  const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);
  const [proactiveInsights, setProactiveInsights] = useState<AIInsight[]>([]);
  const [workflowRecommendations, setWorkflowRecommendations] = useState<
    WorkflowRecommendation[]
  >([]);
  const [showContextInfo, setShowContextInfo] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [contextEnabled, setContextEnabled] = useState(true);
  const [contextSummary, setContextSummary] = useState<ContextSummary | null>(
    null
  );
  const [contextStatus, setContextStatus] = useState<{
    isReady: boolean;
    error?: string;
    isLoading: boolean;
  }>({ isReady: false, isLoading: true });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contextProvider = ContextProvider.getInstance();
  const contextualAIService =
    externalContextualAIService || useRef(new ContextualAIService()).current;
  const conversationId = useRef(`chat_${Date.now()}`).current;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load context suggestions when component mounts
  useEffect(() => {
    // Listen for extension ready event
    const handleExtensionReady = (event: CustomEvent) => {
      console.log(
        "ChatInterface: Extension ready event received",
        event.detail
      );

      // Accept the extension as ready if either context is ready OR monitoring is enabled
      // This allows the extension to work even with partial functionality
      const isExtensionReady =
        event.detail.contextReady || event.detail.monitoringEnabled;

      if (isExtensionReady) {
        setContextStatus({ isReady: true, isLoading: false });
        loadContextSuggestions();
        loadPromptSuggestions();
        loadProactiveInsights();
        loadWorkflowRecommendations();
        loadContextSummary();
      } else {
        // Extension loaded but not fully functional - still better than loading state
        setContextStatus({
          isReady: false,
          isLoading: false,
          error: "Extension loaded with limited functionality",
        });
      }
    };

    window.addEventListener(
      "spotlightExtensionReady",
      handleExtensionReady as EventListener
    );

    // Initial check
    loadContextSuggestions();
    loadPromptSuggestions();
    loadProactiveInsights();
    loadWorkflowRecommendations();
    loadContextSummary();
    checkContextStatus();

    return () => {
      window.removeEventListener(
        "spotlightExtensionReady",
        handleExtensionReady as EventListener
      );
    };
  }, []);

  // Periodically check context status with timeout - only if still loading
  useEffect(() => {
    let statusInterval: NodeJS.Timeout;
    let timeoutCounter = 0;
    const maxChecks = 8; // Maximum 16 seconds (8 checks * 2 seconds)
    let isMounted = true;

    const checkWithTimeout = async () => {
      // Stop checking if component unmounted
      if (!isMounted) {
        return;
      }

      // Check if context is now ready (avoid stale state)
      const isContextReady = contextProvider.isReady();

      if (isContextReady) {
        if (isMounted) {
          setContextStatus({ isReady: true, isLoading: false });
        }
        if (statusInterval) {
          clearInterval(statusInterval);
        }
        return;
      }

      timeoutCounter++;

      if (timeoutCounter >= maxChecks) {
        // Stop checking after timeout and show error
        if (isMounted) {
          setContextStatus({
            isReady: false,
            isLoading: false,
            error: "Context loading timed out - please refresh the page",
          });
        }
        if (statusInterval) {
          clearInterval(statusInterval);
        }
        return;
      }

      // Only check if still mounted and we haven't found context ready
      if (isMounted && !isContextReady) {
        await checkContextStatus();
      }
    };

    // Start interval only if context is not ready initially
    if (!contextProvider.isReady() && contextStatus.isLoading) {
      statusInterval = setInterval(checkWithTimeout, 2000); // Check every 2 seconds
    }

    return () => {
      isMounted = false;
      if (statusInterval) {
        clearInterval(statusInterval);
      }
    };
  }, []); // Empty dependency array to run only once

  // Update context summary when context is enabled/disabled
  useEffect(() => {
    if (contextEnabled) {
      loadContextSummary();
    }
  }, [contextEnabled]);

  const loadContextSuggestions = async () => {
    if (contextProvider.isReady()) {
      try {
        const suggestions = await contextProvider.generateSuggestions(messages);
        setContextSuggestions(suggestions);
      } catch (error) {
        console.error("Failed to load context suggestions:", error);
      }
    }
  };

  const loadPromptSuggestions = async () => {
    if (contextProvider.isReady()) {
      try {
        const suggestions = await contextProvider.getPromptSuggestions();
        setPromptSuggestions(suggestions);
      } catch (error) {
        console.error("Failed to load prompt suggestions:", error);
      }
    }
  };

  const loadProactiveInsights = async () => {
    if (contextProvider.isReady()) {
      try {
        const insights = await contextProvider.generateProactiveInsights(
          messages
        );
        setProactiveInsights(insights);
      } catch (error) {
        console.error("Failed to load proactive insights:", error);
      }
    }
  };

  const loadWorkflowRecommendations = async () => {
    if (contextProvider.isReady()) {
      try {
        const recommendations =
          await contextProvider.generateWorkflowRecommendations();
        setWorkflowRecommendations(recommendations);
      } catch (error) {
        console.error("Failed to load workflow recommendations:", error);
      }
    }
  };

  const loadContextSummary = async () => {
    try {
      const summary = await contextualAIService.getContextSummary();
      setContextSummary(summary);
    } catch (error) {
      console.error("Failed to load context summary:", error);
    }
  };

  const checkContextStatus = async () => {
    try {
      console.log("ChatInterface: Checking context status...");

      // Step 1: Check if the singleton contextProvider is ready
      let isReady = contextProvider.isReady();
      console.log("ChatInterface: Singleton contextProvider ready:", isReady);

      // Step 2: If not ready, check the global content script
      if (!isReady) {
        const globalContentScript = (window as any).__spotlightContentScript;
        if (globalContentScript) {
          // Get detailed status for debugging
          const detailedStatus = globalContentScript.getDetailedStatus
            ? globalContentScript.getDetailedStatus()
            : { error: "getDetailedStatus not available" };
          console.log(
            "ChatInterface: Content script detailed status:",
            detailedStatus
          );

          if (globalContentScript.contextProvider) {
            isReady = globalContentScript.contextProvider.isReady();
            console.log(
              "ChatInterface: Global contextProvider ready:",
              isReady
            );
          }
        } else {
          console.log("ChatInterface: No global content script found");
        }
      }

      // Step 3: If context is ready, we're good to go
      if (isReady) {
        console.log("ChatInterface: Context is ready!");
        setContextStatus({ isReady: true, isLoading: false });
        return;
      }

      // Step 4: Context not ready - check if extension is working at all
      // Simple check: Can we access Chrome APIs and is monitoring enabled in settings?
      if (typeof chrome !== "undefined" && chrome.storage) {
        try {
          const result = await new Promise<any>((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error("Storage timeout")),
              2000
            );
            chrome.storage.sync.get(["monitoringSettings"], (result) => {
              clearTimeout(timeout);
              resolve(result);
            });
          });

          const settings = result.monitoringSettings;
          const settingsEnabled = settings ? settings.enabled !== false : true;

          console.log("ChatInterface: Storage check result:", {
            settings,
            settingsEnabled,
          });

          if (!settingsEnabled) {
            console.log("ChatInterface: Monitoring disabled in settings");
            setContextStatus({
              isReady: false,
              isLoading: false,
              error: "Page monitoring disabled in settings",
            });
            return;
          }

          // Settings are enabled, but context isn't ready yet
          // Check if we have a content script with basic functionality
          const globalContentScript = (window as any).__spotlightContentScript;
          if (globalContentScript) {
            // Extension is loaded, even if context isn't fully ready
            // This allows basic functionality to work
            console.log(
              "ChatInterface: Extension loaded, accepting with limited context"
            );
            setContextStatus({
              isReady: true,
              isLoading: false,
            });
            return;
          }

          // Don't keep setting loading state - let the interval handle retries
          console.log(
            "ChatInterface: Context still initializing, will retry..."
          );
        } catch (e) {
          console.log("ChatInterface: Storage check failed:", e);
          setContextStatus({
            isReady: false,
            isLoading: false,
            error: "Extension not available",
          });
        }
      } else {
        // No Chrome APIs available
        console.log("ChatInterface: Chrome APIs not available");
        setContextStatus({
          isReady: false,
          isLoading: false,
          error: "Extension not loaded",
        });
      }
    } catch (error) {
      console.error("ChatInterface: checkContextStatus failed:", error);
      setContextStatus({
        isReady: false,
        isLoading: false,
        error: "Context system error",
      });
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: message.trim(),
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Use ContextualAIService to send message with context
      const response: ContextualAIServiceResponse =
        await contextualAIService.sendContextualMessage(
          message.trim(),
          conversationId,
          {
            useContext: contextEnabled,
            maxContextTokens: 1000,
            includeNetworkData: true,
            includeDOMChanges: true,
            includeInteractions: true,
          }
        );

      // Create AI response message
      let responseContent = response.message;

      // Add context indicator if context was used
      if (response.contextUsed && contextEnabled) {
        responseContent += `\n\n*Context: ${response.contextTokens} tokens used*`;
      }

      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: responseContent,
        sender: "ai",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiResponse]);
      setIsLoading(false);

      // Call the parent's onSendMessage handler for any additional processing
      onSendMessage(message.trim());

      // Refresh suggestions and context summary after conversation
      setTimeout(() => {
        loadContextSuggestions();
        loadPromptSuggestions();
        loadProactiveInsights();
        loadWorkflowRecommendations();
        loadContextSummary();
      }, 100);
    } catch (error) {
      console.error("Failed to send contextual message:", error);

      // Fallback to basic response on error
      const errorResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content:
          "I'm sorry, I encountered an error processing your message. Please try again.",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorResponse]);
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const handleContextSuggestionClick = (suggestion: ContextSuggestion) => {
    let prompt = "";
    switch (suggestion.type) {
      case "form_assistance":
        prompt = "Help me fill out this form";
        break;
      case "data_analysis":
        prompt = "Help me analyze the data on this page";
        break;
      case "error_diagnosis":
        prompt = "Help me diagnose the errors on this page";
        break;
      case "api_insights":
        prompt = "Explain the recent API activity";
        break;
      case "content_summary":
        prompt = "Summarize the content on this page";
        break;
      case "workflow_optimization":
        prompt = "Help me optimize my workflow";
        break;
      case "navigation_help":
        prompt = "Help me navigate this page";
        break;
      default:
        prompt = suggestion.description;
    }
    setInputValue(prompt);
  };

  const handleInsightClick = (insight: AIInsight) => {
    let prompt = "";
    switch (insight.type) {
      case "performance_issue":
        prompt = "Help me fix the performance issues on this page";
        break;
      case "security_concern":
        prompt = "Explain the security concerns and how to fix them";
        break;
      case "accessibility_issue":
        prompt = "Help me improve accessibility on this page";
        break;
      case "ux_improvement":
        prompt = "Suggest UX improvements for this page";
        break;
      case "data_pattern":
        prompt = "Analyze the data patterns on this page";
        break;
      case "error_pattern":
        prompt = "Help me understand and fix these error patterns";
        break;
      case "content_quality":
        prompt = "Help me improve the content quality";
        break;
      default:
        prompt = insight.description;
    }
    setInputValue(prompt);
  };

  const handleWorkflowRecommendationClick = (
    recommendation: WorkflowRecommendation
  ) => {
    const prompt =
      recommendation.suggestedPrompts[0] || recommendation.description;
    setInputValue(prompt);
  };

  const getPlaceholder = () => {
    switch (workflowType) {
      case "ai-ask":
        return "Ask me anything...";
      case "ai-agent":
        return "What would you like me to help you with?";
      default:
        return "Type your message...";
    }
  };

  return (
    <div className="chat-interface" data-testid="chat-interface">
      <div className="chat-header">
        <div className="chat-title-row">
          <h3 className="chat-title">
            {workflowType === "ai-ask" ? "AI Ask" : "AI Agent"}
          </h3>
          {contextProvider.isReady() ? (
            <div className="context-controls">
              <button
                className={`context-toggle ${
                  contextEnabled ? "enabled" : "disabled"
                }`}
                onClick={() => setContextEnabled(!contextEnabled)}
                title={`Context: ${contextEnabled ? "ON" : "OFF"}`}
              >
                {contextEnabled ? "🔗" : "🔗"} Context:{" "}
                {contextEnabled ? "ON" : "OFF"}
              </button>
              <button
                className="context-info-toggle"
                onClick={() => setShowContextInfo(!showContextInfo)}
                title="Toggle context information"
              >
                🔍
              </button>
              <button
                className="insights-toggle"
                onClick={() => setShowInsights(!showInsights)}
                title="Toggle AI insights"
              >
                💡
              </button>
            </div>
          ) : (
            <div className="context-status">
              <span
                className={`context-status-indicator ${
                  contextStatus.isLoading ? "loading" : "error"
                }`}
                title={contextStatus.error || "Context system not ready"}
              >
                {contextStatus.isLoading ? (
                  <>🔄 Context: {contextStatus.error || "Loading..."}</>
                ) : (
                  <>⚠️ Context: {contextStatus.error || "Not Available"}</>
                )}
              </span>
              {!contextStatus.isLoading && !contextStatus.isReady && (
                <button
                  className="context-retry-button"
                  onClick={async () => {
                    console.log("ChatInterface: Manual retry triggered");
                    setContextStatus({
                      isReady: false,
                      isLoading: true,
                      error: "Retrying...",
                    });
                    // Single retry attempt, no loop
                    try {
                      await checkContextStatus();
                      // If still not ready after check, set final error state
                      if (!contextProvider.isReady()) {
                        setTimeout(() => {
                          setContextStatus({
                            isReady: false,
                            isLoading: false,
                            error:
                              "Context loading failed - please refresh the page",
                          });
                        }, 1000);
                      }
                    } catch (error) {
                      setContextStatus({
                        isReady: false,
                        isLoading: false,
                        error: "Retry failed",
                      });
                    }
                  }}
                  title="Retry context initialization"
                >
                  🔄
                </button>
              )}
            </div>
          )}
        </div>
        <div className="chat-subtitle">
          {workflowType === "ai-ask"
            ? "Ask questions and get instant answers"
            : "Get help with tasks and workflows"}
          {contextProvider.isReady() &&
            contextEnabled &&
            contextSummary?.hasContext && (
              <span className="context-indicator">
                {" "}
                • Context:{" "}
                {contextSummary?.contextTypes?.join(", ") ||
                  "content, network, interactions"}
              </span>
            )}
          {contextProvider.isReady() && !contextEnabled && (
            <span className="context-disabled"> • Context disabled</span>
          )}
          {!contextProvider.isReady() && (
            <span className="context-status-subtitle">
              {" "}
              • {contextStatus.error || "Context system not ready"}
            </span>
          )}
        </div>
      </div>

      {/* Context suggestions */}
      {showContextInfo && contextProvider.isReady() && (
        <div className="context-panel">
          {contextSuggestions.length > 0 && (
            <div className="context-suggestions">
              <h4>Smart Suggestions</h4>
              <div className="suggestion-list">
                {contextSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    className="context-suggestion"
                    onClick={() => handleContextSuggestionClick(suggestion)}
                    title={suggestion.context}
                  >
                    <span className="suggestion-title">{suggestion.title}</span>
                    <span className="suggestion-description">
                      {suggestion.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {workflowRecommendations.length > 0 && (
            <div className="workflow-recommendations">
              <h4>Recommended Workflows</h4>
              <div className="recommendation-list">
                {workflowRecommendations.map((recommendation, index) => (
                  <button
                    key={index}
                    className="workflow-recommendation"
                    onClick={() =>
                      handleWorkflowRecommendationClick(recommendation)
                    }
                    title={recommendation.triggerContext}
                  >
                    <span className="recommendation-title">
                      {recommendation.title}
                    </span>
                    <span className="recommendation-description">
                      {recommendation.description}
                    </span>
                    <span className="recommendation-score">
                      {Math.round(recommendation.relevanceScore * 100)}%
                      relevant
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Insights */}
      {showInsights && contextProvider.isReady() && (
        <div className="insights-panel">
          <div className="proactive-insights">
            <h4>AI Insights</h4>
            {proactiveInsights.length > 0 ? (
              <div className="insight-list">
                {proactiveInsights.map((insight, index) => (
                  <button
                    key={index}
                    className={`ai-insight severity-${insight.severity}`}
                    onClick={() => handleInsightClick(insight)}
                    title={insight.evidence.join("; ")}
                  >
                    <div className="insight-header">
                      <span className="insight-title">{insight.title}</span>
                      <span className={`insight-severity ${insight.severity}`}>
                        {insight.severity}
                      </span>
                    </div>
                    <span className="insight-description">
                      {insight.description}
                    </span>
                    {insight.recommendations.length > 0 && (
                      <div className="insight-recommendations">
                        <strong>Recommendations:</strong>
                        <ul>
                          {insight.recommendations.slice(0, 2).map((rec, i) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="no-insights">
                <span>No insights available for this page</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="chat-messages">
        <MessageList messages={messages} isLoading={isLoading} />
        <div ref={messagesEndRef} />
      </div>

      {/* Prompt suggestions */}
      {messages.length === 0 && promptSuggestions.length > 0 && (
        <div className="prompt-suggestions">
          <div className="suggestion-chips">
            {promptSuggestions.map((suggestion, index) => (
              <button
                key={index}
                className="suggestion-chip"
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={isLoading}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="chat-input">
        <PromptInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSendMessage}
          placeholder={getPlaceholder()}
          disabled={isLoading}
        />
      </div>
    </div>
  );
};
