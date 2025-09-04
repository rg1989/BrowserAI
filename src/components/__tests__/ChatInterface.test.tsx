import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInterface } from "../ChatInterface";

describe("ChatInterface", () => {
  const defaultProps = {
    workflowType: "ai-ask" as const,
    onSendMessage: jest.fn(),
    messages: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
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

    render(<ChatInterface {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Ask me anything...");

    await user.type(textarea, "Test message");
    await user.keyboard("{Enter}");

    // Should show loading dots
    await waitFor(() => {
      expect(document.querySelector(".loading-dots")).toBeInTheDocument();
    });
  });
});
