import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatInterface } from "../../components/ChatInterface";
import { ContextProvider } from "../../services/ContextProvider";
import { SuggestionEngine } from "../../services/SuggestionEngine";
import { ContextualAIService } from "../../services/ContextualAIService";

// Mock the services
jest.mock("../../services/ContextProvider");
jest.mock("../../services/SuggestionEngine");
jest.mock("../../services/ContextualAIService");

const mockContextProvider = {
  isReady: jest.fn(),
  generateSuggestions: jest.fn(),
  getPromptSuggestions: jest.fn(),
  generateProactiveInsights: jest.fn(),
  generateWorkflowRecommendations: jest.fn(),
  enhancePrompt: jest.fn(),
};

const mockSuggestionEngine = {
  generateContextualSuggestions: jest.fn(),
  generateProactiveInsights: jest.fn(),
  generateWorkflowRecommendations: jest.fn(),
  detectCommonPatterns: jest.fn(),
};

const mockContextualAIService = {
  sendContextualMessage: jest.fn(),
  getContextSummary: jest.fn(),
  generateContextualSuggestions: jest.fn(),
};

// Mock data
const mockContextSuggestions = [
  {
    type: "form_assistance",
    title: "Form Help Available",
    description: "I can help you fill out the 2 form(s) on this page",
    confidence: 0.9,
    actionable: true,
    context: "Forms detected: 5 fields, 3 fields",
  },
  {
    type: "data_analysis",
    title: "Data Analysis Available",
    description: "I can help analyze the 1 table(s) on this page",
    confidence: 0.8,
    actionable: true,
    context: "Tables with headers: Name, Age, City",
  },
  {
    type: "error_diagnosis",
    title: "Error Diagnosis Available",
    description: "I can help diagnose network errors on this page",
    confidence: 0.95,
    actionable: true,
    context: "HTTP errors detected in recent network activity",
  },
];

const mockProactiveInsights = [
  {
    type: "performance_issue",
    title: "Slow Network Requests Detected",
    description: "2 request(s) taking longer than 3 seconds",
    severity: "medium" as const,
    confidence: 0.9,
    actionable: true,
    recommendations: [
      "Check network connection",
      "Analyze request payload size",
      "Consider request optimization",
    ],
    context: "Network performance analysis",
    evidence: ["GET /api/data: 3500ms", "POST /api/upload: 4200ms"],
  },
  {
    type: "security_concern",
    title: "Mixed Content Warning",
    description: "HTTP requests detected on HTTPS page",
    severity: "high" as const,
    confidence: 0.95,
    actionable: true,
    recommendations: [
      "Update HTTP URLs to HTTPS",
      "Check for insecure resource loading",
    ],
    context: "Security analysis",
    evidence: ["http://insecure.example.com/data"],
  },
];

const mockWorkflowRecommendations = [
  {
    workflowType: "form-assistant",
    title: "Form Completion Assistant",
    description: "Get help filling out forms with smart suggestions",
    relevanceScore: 0.9,
    triggerContext: "2 form(s) detected",
    suggestedPrompts: [
      "Help me fill out this form",
      "What information is required?",
      "Check my form for errors",
    ],
  },
  {
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
  },
];

const mockPromptSuggestions = [
  "Help me fill out this form",
  "Analyze the data on this page",
  "What should I do next?",
  "Explain the recent API activity",
];

describe("Contextual Suggestions Integration", () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup ContextProvider mock
    (ContextProvider.getInstance as jest.Mock).mockReturnValue(
      mockContextProvider
    );
    mockContextProvider.isReady.mockReturnValue(true);
    mockContextProvider.generateSuggestions.mockResolvedValue(
      mockContextSuggestions
    );
    mockContextProvider.getPromptSuggestions.mockResolvedValue(
      mockPromptSuggestions
    );
    mockContextProvider.generateProactiveInsights.mockResolvedValue(
      mockProactiveInsights
    );
    mockContextProvider.generateWorkflowRecommendations.mockResolvedValue(
      mockWorkflowRecommendations
    );
    mockContextProvider.enhancePrompt.mockResolvedValue({
      originalMessage: "test message",
      enhancedMessage: "Enhanced: test message",
      contextSummary: "Page context summary",
      contextData: null,
      enhancementApplied: true,
    });

    // Setup SuggestionEngine mock
    (SuggestionEngine.getInstance as jest.Mock).mockReturnValue(
      mockSuggestionEngine
    );

    // Setup ContextualAIService mock
    (ContextualAIService as jest.Mock).mockImplementation(
      () => mockContextualAIService
    );
    mockContextualAIService.getContextSummary.mockResolvedValue({
      hasContext: true,
      pageTitle: "Test Page",
      pageUrl: "https://example.com",
      contextTypes: ["content", "forms"],
      tokenCount: 150,
      lastUpdated: new Date(),
    });
    mockContextualAIService.sendContextualMessage.mockResolvedValue({
      message: "This is a test AI response",
      contextUsed: true,
      contextTokens: 150,
    });
  });

  const renderChatInterface = (props = {}) => {
    const defaultProps = {
      workflowType: "ai-ask" as const,
      onSendMessage: jest.fn(),
      messages: [],
    };

    return render(<ChatInterface {...defaultProps} {...props} />);
  };

  describe("Context Suggestions Display", () => {
    it("should show context toggle button when context provider is ready", async () => {
      renderChatInterface();

      await waitFor(() => {
        expect(
          screen.getByTitle("Toggle context information")
        ).toBeInTheDocument();
      });
    });

    it("should show insights toggle button when context provider is ready", async () => {
      renderChatInterface();

      await waitFor(() => {
        expect(screen.getByTitle("Toggle AI insights")).toBeInTheDocument();
      });
    });

    it("should display context suggestions when context panel is opened", async () => {
      renderChatInterface();

      await waitFor(() => {
        const contextToggle = screen.getByTitle("Toggle context information");
        fireEvent.click(contextToggle);
      });

      await waitFor(() => {
        expect(screen.getByText("Smart Suggestions")).toBeInTheDocument();
        expect(screen.getByText("Form Help Available")).toBeInTheDocument();
        expect(screen.getByText("Data Analysis Available")).toBeInTheDocument();
        expect(
          screen.getByText("Error Diagnosis Available")
        ).toBeInTheDocument();
      });
    });

    it("should display workflow recommendations in context panel", async () => {
      renderChatInterface();

      await waitFor(() => {
        const contextToggle = screen.getByTitle("Toggle context information");
        fireEvent.click(contextToggle);
      });

      await waitFor(() => {
        expect(screen.getByText("Recommended Workflows")).toBeInTheDocument();
        expect(
          screen.getByText("Form Completion Assistant")
        ).toBeInTheDocument();
        expect(screen.getByText("API Debugging Assistant")).toBeInTheDocument();
      });
    });

    it("should display AI insights when insights panel is opened", async () => {
      renderChatInterface();

      await waitFor(() => {
        const insightsToggle = screen.getByTitle("Toggle AI insights");
        fireEvent.click(insightsToggle);
      });

      await waitFor(() => {
        expect(screen.getByText("AI Insights")).toBeInTheDocument();
        expect(
          screen.getByText("Slow Network Requests Detected")
        ).toBeInTheDocument();
        expect(screen.getByText("Mixed Content Warning")).toBeInTheDocument();
      });
    });

    it("should show severity indicators for insights", async () => {
      renderChatInterface();

      await waitFor(() => {
        const insightsToggle = screen.getByTitle("Toggle AI insights");
        fireEvent.click(insightsToggle);
      });

      await waitFor(() => {
        expect(screen.getByText("medium")).toBeInTheDocument();
        expect(screen.getByText("high")).toBeInTheDocument();
      });
    });

    it("should display prompt suggestions for new conversations", async () => {
      renderChatInterface();

      await waitFor(() => {
        expect(
          screen.getByText("Help me fill out this form")
        ).toBeInTheDocument();
        expect(
          screen.getByText("Analyze the data on this page")
        ).toBeInTheDocument();
        expect(screen.getByText("What should I do next?")).toBeInTheDocument();
      });
    });
  });

  describe("Suggestion Interactions", () => {
    it("should populate input when context suggestion is clicked", async () => {
      renderChatInterface();

      await waitFor(() => {
        const contextToggle = screen.getByTitle("Toggle context information");
        fireEvent.click(contextToggle);
      });

      await waitFor(() => {
        const formSuggestion = screen.getByText("Form Help Available");
        fireEvent.click(formSuggestion);
      });

      const input = screen.getByPlaceholderText("Ask me anything...");
      expect(input).toHaveValue("Help me fill out this form");
    });

    it("should populate input when AI insight is clicked", async () => {
      renderChatInterface();

      await waitFor(() => {
        const insightsToggle = screen.getByTitle("Toggle AI insights");
        fireEvent.click(insightsToggle);
      });

      await waitFor(() => {
        const performanceInsight = screen.getByText(
          "Slow Network Requests Detected"
        );
        fireEvent.click(performanceInsight);
      });

      const input = screen.getByPlaceholderText("Ask me anything...");
      expect(input).toHaveValue(
        "Help me fix the performance issues on this page"
      );
    });

    it("should populate input when workflow recommendation is clicked", async () => {
      renderChatInterface();

      await waitFor(() => {
        const contextToggle = screen.getByTitle("Toggle context information");
        fireEvent.click(contextToggle);
      });

      await waitFor(() => {
        const workflowRec = screen.getByText("Form Completion Assistant");
        fireEvent.click(workflowRec);
      });

      const input = screen.getByPlaceholderText("Ask me anything...");
      expect(input).toHaveValue("Help me fill out this form");
    });

    it("should populate input when prompt suggestion chip is clicked", async () => {
      renderChatInterface();

      await waitFor(() => {
        const promptChip = screen.getByText("Help me fill out this form");
        fireEvent.click(promptChip);
      });

      const input = screen.getByPlaceholderText("Ask me anything...");
      expect(input).toHaveValue("Help me fill out this form");
    });
  });

  describe("Context Enhancement", () => {
    it("should enhance messages with context when sending", async () => {
      const onSendMessage = jest.fn();
      renderChatInterface({ onSendMessage });

      const input = screen.getByPlaceholderText("Ask me anything...");
      const sendButton = screen.getByRole("button", { name: /send/i });

      fireEvent.change(input, { target: { value: "test message" } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(
          mockContextualAIService.sendContextualMessage
        ).toHaveBeenCalledWith(
          "test message",
          expect.any(String),
          expect.objectContaining({
            useContext: true,
            maxContextTokens: 1000,
          })
        );
      });
    });

    it("should show context indicator when context is available", async () => {
      renderChatInterface();

      await waitFor(() => {
        expect(screen.getByText(/Context: content, forms/)).toBeInTheDocument();
      });
    });

    it("should refresh suggestions after sending a message", async () => {
      const onSendMessage = jest.fn();
      renderChatInterface({ onSendMessage });

      const input = screen.getByPlaceholderText("Ask me anything...");
      const sendButton = screen.getByRole("button", { name: /send/i });

      fireEvent.change(input, { target: { value: "test message" } });
      fireEvent.click(sendButton);

      await waitFor(
        () => {
          expect(mockContextProvider.generateSuggestions).toHaveBeenCalledTimes(
            2
          ); // Initial + after message
          expect(
            mockContextProvider.generateProactiveInsights
          ).toHaveBeenCalledTimes(2);
          expect(
            mockContextProvider.generateWorkflowRecommendations
          ).toHaveBeenCalledTimes(2);
        },
        { timeout: 2000 }
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle context provider not ready", async () => {
      mockContextProvider.isReady.mockReturnValue(false);
      renderChatInterface();

      await waitFor(() => {
        expect(
          screen.queryByTitle("Toggle context information")
        ).not.toBeInTheDocument();
        expect(
          screen.queryByTitle("Toggle AI insights")
        ).not.toBeInTheDocument();
        // Should show error message when context provider is not ready
        expect(screen.queryByText(/Context:/)).toBeInTheDocument();
        expect(
          screen.getByText(/Context system not ready/)
        ).toBeInTheDocument(); // Appears in subtitle
        expect(screen.getByText(/Loading\.\.\./)).toBeInTheDocument(); // Status indicator shows loading
      });
    });

    it("should handle suggestion loading errors gracefully", async () => {
      mockContextProvider.generateSuggestions.mockRejectedValue(
        new Error("Failed to load")
      );
      renderChatInterface();

      // Should not crash and should still render the interface
      await waitFor(() => {
        expect(screen.getByText("AI Ask")).toBeInTheDocument();
      });
    });

    it("should handle insight loading errors gracefully", async () => {
      mockContextProvider.generateProactiveInsights.mockResolvedValue([]);
      renderChatInterface();

      await waitFor(() => {
        const insightsToggle = screen.getByTitle("Toggle AI insights");
        fireEvent.click(insightsToggle);
      });

      // Should show insights panel even if loading failed
      await waitFor(() => {
        expect(screen.getByText("AI Insights")).toBeInTheDocument();
        expect(
          screen.getByText("No insights available for this page")
        ).toBeInTheDocument();
      });
    });

    it("should handle context enhancement errors gracefully", async () => {
      mockContextualAIService.sendContextualMessage.mockRejectedValue(
        new Error("Enhancement failed")
      );
      const onSendMessage = jest.fn();
      renderChatInterface({ onSendMessage });

      const input = screen.getByPlaceholderText("Ask me anything...");
      const sendButton = screen.getByRole("button", { name: /send/i });

      fireEvent.change(input, { target: { value: "test message" } });
      fireEvent.click(sendButton);

      // Should show user message and error message, but not call parent callback on error
      await waitFor(() => {
        expect(screen.getByText("test message")).toBeInTheDocument();
        expect(
          screen.getByText(/I'm sorry, I encountered an error/)
        ).toBeInTheDocument();
        expect(onSendMessage).not.toHaveBeenCalled();
      });
    });
  });

  describe("UI State Management", () => {
    it("should toggle context panel visibility", async () => {
      renderChatInterface();

      const contextToggle = screen.getByTitle("Toggle context information");

      // Initially closed
      expect(screen.queryByText("Smart Suggestions")).not.toBeInTheDocument();

      // Open panel
      fireEvent.click(contextToggle);
      await waitFor(() => {
        expect(screen.getByText("Smart Suggestions")).toBeInTheDocument();
      });

      // Close panel
      fireEvent.click(contextToggle);
      await waitFor(() => {
        expect(screen.queryByText("Smart Suggestions")).not.toBeInTheDocument();
      });
    });

    it("should toggle insights panel visibility", async () => {
      renderChatInterface();

      const insightsToggle = screen.getByTitle("Toggle AI insights");

      // Initially closed
      expect(screen.queryByText("AI Insights")).not.toBeInTheDocument();

      // Open panel
      fireEvent.click(insightsToggle);
      await waitFor(() => {
        expect(screen.getByText("AI Insights")).toBeInTheDocument();
      });

      // Close panel
      fireEvent.click(insightsToggle);
      await waitFor(() => {
        expect(screen.queryByText("AI Insights")).not.toBeInTheDocument();
      });
    });

    it("should hide prompt suggestions after first message", async () => {
      const onSendMessage = jest.fn();
      renderChatInterface({ onSendMessage, messages: [] });

      // Initially shows prompt suggestions
      await waitFor(() => {
        expect(
          screen.getByText("Help me fill out this form")
        ).toBeInTheDocument();
      });

      // Send a message
      const input = screen.getByPlaceholderText("Ask me anything...");
      const sendButton = screen.getByRole("button", { name: /send/i });

      fireEvent.change(input, { target: { value: "test message" } });
      fireEvent.click(sendButton);

      // Prompt suggestions should be hidden after message is sent
      await waitFor(() => {
        expect(
          screen.queryByText("Help me fill out this form")
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels for toggle buttons", async () => {
      renderChatInterface();

      await waitFor(() => {
        const contextToggle = screen.getByTitle("Toggle context information");
        const insightsToggle = screen.getByTitle("Toggle AI insights");

        expect(contextToggle).toHaveAttribute(
          "title",
          "Toggle context information"
        );
        expect(insightsToggle).toHaveAttribute("title", "Toggle AI insights");
      });
    });

    it("should have proper tooltips for suggestions", async () => {
      renderChatInterface();

      await waitFor(() => {
        const contextToggle = screen.getByTitle("Toggle context information");
        fireEvent.click(contextToggle);
      });

      await waitFor(() => {
        const formSuggestion = screen.getByText("Form Help Available");
        expect(formSuggestion.closest("button")).toHaveAttribute(
          "title",
          "Forms detected: 5 fields, 3 fields"
        );
      });
    });
  });
});
