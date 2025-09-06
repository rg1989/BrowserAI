import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInterface } from "../ChatInterface";
import { ContextualAIService } from "../../services/ContextualAIService";
import { ContextProvider } from "../../services/ContextProvider";

// Mock the ContextualAIService
jest.mock("../../services/ContextualAIService");
jest.mock("../../services/ContextProvider");

describe("ChatInterface", () => {
  const defaultProps = {
    workflowType: "ai-ask" as const,
    onSendMessage: jest.fn(),
    messages: [],
  };

  const mockContextualAIService = {
    sendContextualMessage: jest.fn(),
    getContextSummary: jest.fn(),
    generateContextualSuggestions: jest.fn(),
  };

  const mockContextProvider = {
    isReady: jest.fn(),
    generateSuggestions: jest.fn(),
    getPromptSuggestions: jest.fn(),
    generateProactiveInsights: jest.fn(),
    generateWorkflowRecommendations: jest.fn(),
    getInstance: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    (ContextualAIService as jest.Mock).mockImplementation(
      () => mockContextualAIService
    );
    (ContextProvider.getInstance as jest.Mock).mockReturnValue(
      mockContextProvider
    );

    mockContextProvider.isReady.mockReturnValue(true);
    mockContextProvider.generateSuggestions.mockResolvedValue([]);
    mockContextProvider.getPromptSuggestions.mockResolvedValue([]);
    mockContextProvider.generateProactiveInsights.mockResolvedValue([]);
    mockContextProvider.generateWorkflowRecommendations.mockResolvedValue([]);

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

  it("renders with correct title for ai-ask", () => {
    render(<ChatInterface {...defaultProps} />);

    expect(screen.getByText("AI Ask")).toBeInTheDocument();
    expect(
      screen.getByText("Ask questions and get instant answers")
    ).toBeInTheDocument();
  });

  it("renders with correct title for ai-agent", () => {
    render(<ChatInterface {...defaultProps} workflowType="ai-agent" />);

    expect(screen.getByText("AI Agent")).toBeInTheDocument();
    expect(
      screen.getByText("Get help with tasks and workflows")
    ).toBeInTheDocument();
  });

  it("shows empty state when no messages", () => {
    render(<ChatInterface {...defaultProps} />);

    expect(screen.getByText("Start a conversation")).toBeInTheDocument();
    expect(
      screen.getByText("Type a message below to get started")
    ).toBeInTheDocument();
  });

  it("displays initial messages", () => {
    const messages = [
      {
        id: "1",
        content: "Hello",
        sender: "user" as const,
        timestamp: new Date(),
      },
      {
        id: "2",
        content: "Hi there!",
        sender: "ai" as const,
        timestamp: new Date(),
      },
    ];

    render(<ChatInterface {...defaultProps} messages={messages} />);

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });

  it("sends message when clicking send button", async () => {
    const user = userEvent.setup();
    const mockOnSendMessage = jest.fn();

    render(
      <ChatInterface {...defaultProps} onSendMessage={mockOnSendMessage} />
    );

    const textarea = screen.getByPlaceholderText("Ask me anything...");
    const sendButton = screen.getByLabelText("Send message");

    await user.type(textarea, "Test message");
    await user.click(sendButton);

    expect(mockOnSendMessage).toHaveBeenCalledWith("Test message");
  });

  it("sends message when pressing Enter", async () => {
    const user = userEvent.setup();
    const mockOnSendMessage = jest.fn();

    render(
      <ChatInterface {...defaultProps} onSendMessage={mockOnSendMessage} />
    );

    const textarea = screen.getByPlaceholderText("Ask me anything...");

    await user.type(textarea, "Test message");
    await user.keyboard("{Enter}");

    expect(mockOnSendMessage).toHaveBeenCalledWith("Test message");
  });

  it("does not send empty messages", async () => {
    const user = userEvent.setup();
    const mockOnSendMessage = jest.fn();

    render(
      <ChatInterface {...defaultProps} onSendMessage={mockOnSendMessage} />
    );

    const sendButton = screen.getByLabelText("Send message");
    await user.click(sendButton);

    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it("shows loading state after sending message", async () => {
    const user = userEvent.setup();

    // Make the AI service take some time to respond
    mockContextualAIService.sendContextualMessage.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                message: "Response",
                contextUsed: true,
                contextTokens: 100,
              }),
            100
          )
        )
    );

    render(<ChatInterface {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Ask me anything...");

    await user.type(textarea, "Test message");
    await user.keyboard("{Enter}");

    // Input should be disabled during loading (indicating loading state)
    expect(textarea).toBeDisabled();
  });

  describe("Contextual AI Integration", () => {
    it("displays context toggle when context provider is ready", async () => {
      render(<ChatInterface {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Context: ON/)).toBeInTheDocument();
      });
    });

    it("shows context indicator in subtitle when context is enabled", async () => {
      render(<ChatInterface {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Context: content, forms/)).toBeInTheDocument();
      });
    });

    it("shows context disabled indicator when context is turned off", async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText(/Context: ON/)).toBeInTheDocument();
      });

      // Click context toggle to disable
      const contextToggle = screen.getByText(/Context: ON/);
      await user.click(contextToggle);

      await waitFor(() => {
        expect(screen.getByText(/Context: OFF/)).toBeInTheDocument();
        expect(screen.getByText(/Context disabled/)).toBeInTheDocument();
      });
    });

    it("sends contextual message when context is enabled", async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      const textarea = screen.getByPlaceholderText("Ask me anything...");

      await user.type(textarea, "What is this page about?");
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(
          mockContextualAIService.sendContextualMessage
        ).toHaveBeenCalledWith(
          "What is this page about?",
          expect.any(String),
          expect.objectContaining({
            useContext: true,
            maxContextTokens: 1000,
            includeNetworkData: true,
            includeDOMChanges: true,
            includeInteractions: true,
          })
        );
      });
    });

    it("sends message without context when context is disabled", async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      // Wait for component to load and disable context
      await waitFor(() => {
        expect(screen.getByText(/Context: ON/)).toBeInTheDocument();
      });

      const contextToggle = screen.getByText(/Context: ON/);
      await user.click(contextToggle);

      await waitFor(() => {
        expect(screen.getByText(/Context: OFF/)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText("Ask me anything...");
      await user.type(textarea, "Hello");
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(
          mockContextualAIService.sendContextualMessage
        ).toHaveBeenCalledWith(
          "Hello",
          expect.any(String),
          expect.objectContaining({
            useContext: false,
          })
        );
      });
    });

    it("displays AI response with context information", async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      const textarea = screen.getByPlaceholderText("Ask me anything...");

      await user.type(textarea, "Test message");
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(
          screen.getByText(/This is a test AI response/)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Context: 150 tokens used/)
        ).toBeInTheDocument();
      });
    });

    it("handles AI service errors gracefully", async () => {
      const user = userEvent.setup();
      mockContextualAIService.sendContextualMessage.mockRejectedValue(
        new Error("AI service error")
      );

      render(<ChatInterface {...defaultProps} />);

      const textarea = screen.getByPlaceholderText("Ask me anything...");

      await user.type(textarea, "Test message");
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(
          screen.getByText(/I'm sorry, I encountered an error/)
        ).toBeInTheDocument();
      });
    });

    it("loads context summary on mount", async () => {
      render(<ChatInterface {...defaultProps} />);

      await waitFor(() => {
        expect(mockContextualAIService.getContextSummary).toHaveBeenCalled();
      });
    });

    it("updates context summary when context is toggled", async () => {
      const user = userEvent.setup();
      render(<ChatInterface {...defaultProps} />);

      // Wait for initial load
      await waitFor(() => {
        expect(mockContextualAIService.getContextSummary).toHaveBeenCalled();
      });

      // Reset the mock to count only new calls
      mockContextualAIService.getContextSummary.mockClear();

      // Toggle context off and on
      const contextToggle = screen.getByText(/Context: ON/);
      await user.click(contextToggle);
      await user.click(screen.getByText(/Context: OFF/));

      await waitFor(() => {
        expect(
          mockContextualAIService.getContextSummary
        ).toHaveBeenCalledWith();
      });
    });

    it("shows correct placeholder text for different workflow types", () => {
      const { rerender } = render(
        <ChatInterface {...defaultProps} workflowType="ai-ask" />
      );
      expect(
        screen.getByPlaceholderText("Ask me anything...")
      ).toBeInTheDocument();

      rerender(<ChatInterface {...defaultProps} workflowType="ai-agent" />);
      expect(
        screen.getByPlaceholderText("What would you like me to help you with?")
      ).toBeInTheDocument();
    });

    it("disables input during loading state", async () => {
      const user = userEvent.setup();

      // Make the AI service take some time to respond
      mockContextualAIService.sendContextualMessage.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  message: "Response",
                  contextUsed: true,
                  contextTokens: 100,
                }),
              100
            )
          )
      );

      render(<ChatInterface {...defaultProps} />);

      const textarea = screen.getByPlaceholderText("Ask me anything...");

      await user.type(textarea, "Test message");
      await user.keyboard("{Enter}");

      // Input should be disabled during loading
      expect(textarea).toBeDisabled();
    });
  });

  describe("Context Provider Integration", () => {
    it("shows context status when context provider is not ready", () => {
      mockContextProvider.isReady.mockReturnValue(false);

      render(<ChatInterface {...defaultProps} />);

      // Should show context status indicator instead of controls
      expect(screen.getByText(/Context:/)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Context:/ })
      ).not.toBeInTheDocument();
    });

    it("handles context provider errors gracefully", async () => {
      mockContextProvider.generateSuggestions.mockRejectedValue(
        new Error("Context error")
      );

      render(<ChatInterface {...defaultProps} />);

      // Should still render without crashing
      expect(screen.getByText("AI Ask")).toBeInTheDocument();
    });
  });
});
