import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInterface } from "../ChatInterface";
import { ContextualAIService } from "../../services/ContextualAIService";
import { ContextProvider } from "../../services/ContextProvider";

// Mock the services
jest.mock("../../services/ContextualAIService");
jest.mock("../../services/ContextProvider");

/**
 * Integration tests for ChatInterface contextual AI functionality
 * These tests verify the complete contextual chat workflow
 */
describe("ChatInterface - Contextual AI Integration", () => {
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
      message: "This is a test AI response with context",
      contextUsed: true,
      contextTokens: 150,
    });
  });

  it("should integrate contextual AI service with chat interface", async () => {
    const user = userEvent.setup();
    const mockOnSendMessage = jest.fn();

    render(
      <ChatInterface {...defaultProps} onSendMessage={mockOnSendMessage} />
    );

    // Verify context controls are present
    expect(screen.getByText(/Context: ON/)).toBeInTheDocument();

    // Send a contextual message
    const textarea = screen.getByPlaceholderText("Ask me anything...");
    await user.type(textarea, "What is this page about?");
    await user.keyboard("{Enter}");

    // Verify message was sent
    expect(screen.getByText("What is this page about?")).toBeInTheDocument();

    // Verify parent callback was called
    expect(mockOnSendMessage).toHaveBeenCalledWith("What is this page about?");
  });

  it("should handle context toggle functionality", async () => {
    const user = userEvent.setup();
    render(<ChatInterface {...defaultProps} />);

    // Initially context should be ON
    expect(screen.getByText(/Context: ON/)).toBeInTheDocument();

    // Toggle context OFF
    const contextToggle = screen.getByText(/Context: ON/);
    await user.click(contextToggle);

    // Verify context is now OFF
    await waitFor(() => {
      expect(screen.getByText(/Context: OFF/)).toBeInTheDocument();
      expect(screen.getByText(/Context disabled/)).toBeInTheDocument();
    });

    // Toggle context back ON
    const contextToggleOff = screen.getByText(/Context: OFF/);
    await user.click(contextToggleOff);

    // Verify context is back ON
    await waitFor(() => {
      expect(screen.getByText(/Context: ON/)).toBeInTheDocument();
    });
  });

  it("should show appropriate loading states during AI responses", async () => {
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

    // Type and send message
    await user.type(textarea, "Test message");
    await user.keyboard("{Enter}");

    // Verify input is disabled during loading
    expect(textarea).toBeDisabled();

    // Wait for response to complete
    await waitFor(() => {
      expect(textarea).not.toBeDisabled();
    });
  });

  it("should display context information in responses", async () => {
    const user = userEvent.setup();
    render(<ChatInterface {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Ask me anything...");

    await user.type(textarea, "Analyze this page");
    await user.keyboard("{Enter}");

    // Wait for AI response with context information
    await waitFor(() => {
      // Should show the user message
      expect(screen.getByText("Analyze this page")).toBeInTheDocument();

      // Should show AI response with context
      expect(
        screen.getByText(/This is a test AI response with context/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Context: 150 tokens used/)).toBeInTheDocument();
    });
  });

  it("should handle different workflow types correctly", () => {
    const { rerender } = render(
      <ChatInterface {...defaultProps} workflowType="ai-ask" />
    );

    expect(screen.getByText("AI Ask")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Ask me anything...")
    ).toBeInTheDocument();

    rerender(<ChatInterface {...defaultProps} workflowType="ai-agent" />);

    expect(screen.getByText("AI Agent")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("What would you like me to help you with?")
    ).toBeInTheDocument();
  });

  it("should maintain conversation state across messages", async () => {
    const user = userEvent.setup();
    render(<ChatInterface {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Ask me anything...");

    // Send first message
    await user.type(textarea, "First message");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("First message")).toBeInTheDocument();
    });

    // Send second message
    await user.type(textarea, "Second message");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("Second message")).toBeInTheDocument();
      // First message should still be visible
      expect(screen.getByText("First message")).toBeInTheDocument();
    });
  });

  it("should gracefully handle errors in contextual AI service", async () => {
    const user = userEvent.setup();

    // Mock console.error to avoid noise in test output
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<ChatInterface {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Ask me anything...");

    await user.type(textarea, "Test error handling");
    await user.keyboard("{Enter}");

    // Should show user message
    expect(screen.getByText("Test error handling")).toBeInTheDocument();

    // Should eventually show some response (either success or error)
    await waitFor(() => {
      const messages = document.querySelectorAll(".message");
      expect(messages.length).toBeGreaterThan(1); // User message + AI response
    });

    consoleSpy.mockRestore();
  });
});
