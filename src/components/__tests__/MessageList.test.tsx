/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { MessageList } from "../MessageList";
import { ChatMessage } from "../../types/workflow";

describe("MessageList", () => {
  const mockMessages: ChatMessage[] = [
    {
      id: "1",
      content: "Hello, how can I help you?",
      sender: "ai",
      timestamp: new Date("2023-01-01T12:00:00Z"),
    },
    {
      id: "2",
      content: "I need help with my project",
      sender: "user",
      timestamp: new Date("2023-01-01T12:01:00Z"),
    },
  ];

  const defaultProps = {
    messages: mockMessages,
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render all messages", () => {
      render(<MessageList {...defaultProps} />);

      expect(
        screen.getByText("Hello, how can I help you?")
      ).toBeInTheDocument();
      expect(
        screen.getByText("I need help with my project")
      ).toBeInTheDocument();
    });

    it("should apply correct CSS classes for different senders", () => {
      render(<MessageList {...defaultProps} />);

      const aiMessage = screen
        .getByText("Hello, how can I help you?")
        .closest(".message");
      const userMessage = screen
        .getByText("I need help with my project")
        .closest(".message");

      expect(aiMessage).toHaveClass("message-ai");
      expect(userMessage).toHaveClass("message-user");
    });

    it("should show formatted timestamps", () => {
      render(<MessageList {...defaultProps} />);

      // Should show formatted time - check for any time format
      const timeElements = document.querySelectorAll(".message-time");
      expect(timeElements).toHaveLength(2);
      expect(timeElements[0].textContent).toMatch(/\d{1,2}:\d{2} [AP]M/);
      expect(timeElements[1].textContent).toMatch(/\d{1,2}:\d{2} [AP]M/);
    });

    it("should show empty state when no messages", () => {
      render(<MessageList messages={[]} isLoading={false} />);

      expect(screen.getByText("Start a conversation")).toBeInTheDocument();
      expect(
        screen.getByText("Type a message below to get started")
      ).toBeInTheDocument();
    });

    it("should show loading indicator", () => {
      render(<MessageList {...defaultProps} isLoading={true} />);

      const loadingDots = document.querySelector(".loading-dots");
      expect(loadingDots).toBeInTheDocument();
    });

    it("should not show empty state when loading", () => {
      render(<MessageList messages={[]} isLoading={true} />);

      expect(
        screen.queryByText("Start a conversation")
      ).not.toBeInTheDocument();
      expect(document.querySelector(".loading-dots")).toBeInTheDocument();
    });
  });

  describe("Message Structure", () => {
    it("should render message content and time", () => {
      render(<MessageList {...defaultProps} />);

      const aiMessage = screen
        .getByText("Hello, how can I help you?")
        .closest(".message");
      expect(aiMessage?.querySelector(".message-content")).toBeInTheDocument();
      expect(aiMessage?.querySelector(".message-text")).toBeInTheDocument();
      expect(aiMessage?.querySelector(".message-time")).toBeInTheDocument();
    });

    it("should handle messages with different content types", () => {
      const specialMessages: ChatMessage[] = [
        {
          id: "1",
          content: "Message with special chars: @#$%^&*()",
          sender: "user",
          timestamp: new Date(),
        },
        {
          id: "2",
          content: "Message with emoji 🚀 🎉",
          sender: "ai",
          timestamp: new Date(),
        },
      ];

      render(<MessageList messages={specialMessages} isLoading={false} />);

      expect(
        screen.getByText("Message with special chars: @#$%^&*()")
      ).toBeInTheDocument();
      expect(screen.getByText("Message with emoji 🚀 🎉")).toBeInTheDocument();
    });
  });

  describe("Loading States", () => {
    it("should show loading animation when isLoading is true", () => {
      render(<MessageList messages={mockMessages} isLoading={true} />);

      const loadingElement = document.querySelector(".loading-dots");
      expect(loadingElement).toBeInTheDocument();

      // Should have three loading dots
      const dots = loadingElement?.querySelectorAll("span");
      expect(dots).toHaveLength(3);
    });

    it("should not show loading animation when isLoading is false", () => {
      render(<MessageList messages={mockMessages} isLoading={false} />);

      expect(document.querySelector(".loading-dots")).not.toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty message content", () => {
      const emptyMessage: ChatMessage = {
        id: "empty",
        content: "",
        sender: "user",
        timestamp: new Date(),
      };

      render(<MessageList messages={[emptyMessage]} isLoading={false} />);

      const messageElement = document.querySelector(".message-text");
      expect(messageElement).toBeInTheDocument();
      expect(messageElement?.textContent).toBe("");
    });

    it("should handle very long messages", () => {
      const longMessage: ChatMessage = {
        id: "long",
        content: "A".repeat(1000),
        sender: "user",
        timestamp: new Date(),
      };

      render(<MessageList messages={[longMessage]} isLoading={false} />);

      expect(screen.getByText("A".repeat(1000))).toBeInTheDocument();
    });
  });
});
