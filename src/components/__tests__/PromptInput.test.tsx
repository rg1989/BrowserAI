/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PromptInput } from "../PromptInput";

describe("PromptInput", () => {
  const defaultProps = {
    value: "",
    onChange: jest.fn(),
    onSend: jest.fn(),
    placeholder: "Type your message...",
    disabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render input field with placeholder", () => {
      render(<PromptInput {...defaultProps} />);
      const input = screen.getByPlaceholderText("Type your message...");
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue("");
    });

    it("should render with initial value", () => {
      render(<PromptInput {...defaultProps} value="Initial text" />);
      const input = screen.getByDisplayValue("Initial text");
      expect(input).toBeInTheDocument();
    });

    it("should render submit button", () => {
      render(<PromptInput {...defaultProps} />);
      const submitButton = screen.getByRole("button", { name: /send/i });
      expect(submitButton).toBeInTheDocument();
    });

    it("should disable input and button when disabled prop is true", () => {
      render(<PromptInput {...defaultProps} disabled={true} />);
      const input = screen.getByPlaceholderText("Type your message...");
      const submitButton = screen.getByRole("button", { name: /send/i });
      expect(input).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });
  });

  describe("User Interactions", () => {
    it("should call onChange when typing", () => {
      render(<PromptInput {...defaultProps} />);
      const input = screen.getByPlaceholderText("Type your message...");
      fireEvent.change(input, { target: { value: "Hello world" } });
      expect(defaultProps.onChange).toHaveBeenCalledWith("Hello world");
    });

    it("should call onSend when clicking submit button", () => {
      render(<PromptInput {...defaultProps} value="Test message" />);
      const submitButton = screen.getByRole("button", { name: /send/i });
      fireEvent.click(submitButton);
      expect(defaultProps.onSend).toHaveBeenCalledWith("Test message");
    });

    it("should call onSend when pressing Enter", () => {
      render(<PromptInput {...defaultProps} value="Test message" />);
      const input = screen.getByPlaceholderText("Type your message...");
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
      expect(defaultProps.onSend).toHaveBeenCalledWith("Test message");
    });

    it("should not call onSend when pressing Enter with Shift", () => {
      render(<PromptInput {...defaultProps} value="Test message" />);
      const input = screen.getByPlaceholderText("Type your message...");
      fireEvent.keyDown(input, { key: "Enter", code: "Enter", shiftKey: true });
      expect(defaultProps.onSend).not.toHaveBeenCalled();
    });

    it("should not send empty message", () => {
      render(<PromptInput {...defaultProps} value="" />);
      const submitButton = screen.getByRole("button", { name: /send/i });
      fireEvent.click(submitButton);
      expect(defaultProps.onSend).not.toHaveBeenCalled();
    });

    it("should not send whitespace-only message", () => {
      render(<PromptInput {...defaultProps} value="   " />);
      const submitButton = screen.getByRole("button", { name: /send/i });
      fireEvent.click(submitButton);
      expect(defaultProps.onSend).not.toHaveBeenCalled();
    });
  });

  describe("Button States", () => {
    it("should disable submit button when input is empty", () => {
      render(<PromptInput {...defaultProps} value="" />);
      const submitButton = screen.getByRole("button", { name: /send/i });
      expect(submitButton).toBeDisabled();
    });

    it("should disable submit button when input contains only whitespace", () => {
      render(<PromptInput {...defaultProps} value="   " />);
      const submitButton = screen.getByRole("button", { name: /send/i });
      expect(submitButton).toBeDisabled();
    });

    it("should enable submit button when input has content", () => {
      render(<PromptInput {...defaultProps} value="Hello" />);
      const submitButton = screen.getByRole("button", { name: /send/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      render(<PromptInput {...defaultProps} />);
      const sendButton = screen.getByLabelText(/send message/i);
      expect(sendButton).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long messages", () => {
      const longMessage = "a".repeat(1000);
      render(<PromptInput {...defaultProps} value={longMessage} />);
      const input = screen.getByDisplayValue(longMessage);
      expect(input).toBeInTheDocument();
      const submitButton = screen.getByRole("button", { name: /send/i });
      fireEvent.click(submitButton);
      expect(defaultProps.onSend).toHaveBeenCalledWith(longMessage);
    });

    it("should handle special characters", () => {
      const specialMessage = "Hello! @#$%^&*()_+ 🚀 emoji test";
      render(<PromptInput {...defaultProps} value={specialMessage} />);
      const submitButton = screen.getByRole("button", { name: /send/i });
      fireEvent.click(submitButton);
      expect(defaultProps.onSend).toHaveBeenCalledWith(specialMessage);
    });

    it("should have proper CSS classes", () => {
      render(<PromptInput {...defaultProps} />);
      const container = screen
        .getByPlaceholderText("Type your message...")
        .closest(".prompt-input");
      expect(container).toHaveClass("prompt-input");
    });

    it("should accept custom placeholder", () => {
      render(
        <PromptInput {...defaultProps} placeholder="Custom placeholder" />
      );
      const input = screen.getByPlaceholderText("Custom placeholder");
      expect(input).toBeInTheDocument();
    });
  });
});
