import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatInterface } from "../ChatInterface";
import { ContextProvider } from "../../services/ContextProvider";
import { AggregatedContext } from "../../services/ContextAggregator";

// Mock ContextProvider
jest.mock("../../services/ContextProvider");

describe("ChatInterface with Context Integration", () => {
  let mockContextProvider: jest.Mocked<ContextProvider>;
  let mockOnSendMessage: jest.Mock;
  let mockContext: AggregatedContext;

  beforeEach(() => {
    // Create mock context
    mockContext = {
      summary: {
        pageType: "form" as any,
        primaryContent: "Contact form for customer support",
        keyElements: ["Form: Contact Us", "Input: Email", "Input: Message"],
        userActivity: {
          recentInteractions: 2,
          activeElements: ["input", "button"],
          formActivity: true,
          navigationActivity: false,
        },
        dataFlows: [],
        relevanceScore: 0.8,
      },
      content: {
        text: "Please fill out this form to contact our support team",
        headings: [
          {
            level: 1,
            text: "Contact Us",
            element: { tagName: "h1", selector: "h1" },
          },
        ],
        links: [],
        images: [],
        forms: [
          {
            action: "/contact",
            method: "POST",
            fields: [
              { name: "email", type: "email", required: true },
              { name: "message", type: "textarea", required: true },
            ],
            element: { tagName: "form", selector: "form" },
          },
        ],
        tables: [],
        metadata: {
          title: "Contact Us",
          description: "Contact form",
          language: "en",
        },
      },
      metadata: {
        timestamp: Date.now(),
        url: "https://example.com/contact",
        title: "Contact Us",
        aggregationTime: 30,
        cacheHit: false,
        dataQuality: {
          completeness: 0.9,
          freshness: 0.95,
          accuracy: 0.9,
          relevance: 0.8,
        },
      },
      performance: {
        responseTime: 30,
        dataSize: 1024,
        cacheHit: false,
        processingTime: 15,
      },
    };

    // Create mock ContextProvider
    mockContextProvider = {
      isReady: jest.fn().mockReturnValue(true),
      getCurrentContext: jest.fn().mockResolvedValue(mockContext),
      enhancePrompt: jest.fn().mockImplementation((message) =>
        Promise.resolve({
          originalMessage: message,
          enhancedMessage: `Context: form page\n\nUser question: ${message}`,
          contextSummary: "Page Type: form\nURL: https://example.com/contact",
          contextData: mockContext,
          enhancementApplied: true,
        })
      ),
      generateSuggestions: jest.fn().mockResolvedValue([
        {
          type: "form_assistance",
          title: "Form Help Available",
          description: "I can help you fill out this form",
          confidence: 0.9,
          actionable: true,
          context: "Contact form detected",
        },
      ]),
      getPromptSuggestions: jest
        .fn()
        .mockResolvedValue([
          "Help me fill out this form",
          "What information is required here?",
          "Check if I've filled everything correctly",
        ]),
      updateConfig: jest.fn(),
      clearCache: jest.fn(),
      getConfig: jest.fn().mockReturnValue({
        includePageSummary: true,
        includeNetworkActivity: true,
        includeUserInteractions: true,
        includeSemanticData: true,
        maxContextLength: 2000,
        contextPriority: {
          currentPage: 1.0,
          recentActivity: 0.8,
          userInteractions: 0.9,
          networkData: 0.7,
          semanticData: 0.6,
        },
      }),
    } as any;

    // Mock the getInstance method
    (ContextProvider.getInstance as jest.Mock).mockReturnValue(
      mockContextProvider
    );

    mockOnSendMessage = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("context-aware features", () => {
    it("should show context indicator when context provider is ready", () => {
      render(
        <ChatInterface
          workflowType="ai-ask"
          onSendMessage={mockOnSendMessage}
          messages={[]}
        />
      );

      expect(screen.getByText("• Context-aware")).toBeInTheDocument();
    });

    it("should show context toggle button when context provider is ready", () => {
      render(
        <ChatInterface
          workflowType="ai-ask"
          onSendMessage={mockOnSendMessage}
          messages={[]}
        />
      );

      const toggleButton = screen.getByTitle("Toggle context information");
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton).toHaveTextContent("🔍");
    });

    it("should not show context features when context provider is not ready", () => {
      mockContextProvider.isReady.mockReturnValue(false);

      render(
        <ChatInterface
          workflowType="ai-ask"
          onSendMessage={mockOnSendMessage}
          messages={[]}
        />
      );

      expect(screen.queryByText("• Context-aware")).not.toBeInTheDocument();
      expect(
        screen.queryByTitle("Toggle context information")
      ).not.toBeInTheDocument();
    });
  });

  describe("context panel", () => {
    it("should show context panel when toggle is clicked", async () => {
      render(
        <ChatInterface
          workflowType="ai-ask"
          onSendMessage={mockOnSendMessage}
          messages={[]}
        />
      );

      const toggleButton = screen.getByTitle("Toggle context information");
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText("Smart Suggestions")).toBeInTheDocument();
      });
    });

    it("should hide context panel when toggle is clicked again", async () => {
      render(
        <ChatInterface
          workflowType="ai-ask"
          onSendMessage={mockOnSendMessage}
          messages={[]}
        />
      );

      const toggleButton = screen.getByTitle("Toggle context information");

      // Show panel
      fireEvent.click(toggleButton);
      await waitFor(() => {
        expect(screen.getByText("Smart Suggestions")).toBeInTheDocument();
      });

      // Hide panel
      fireEvent.click(toggleButton);
      await waitFor(() => {
        expect(screen.queryByText("Smart Suggestions")).not.toBeInTheDocument();
      });
    });

    it("should display context suggestions in panel", async () => {
      render(
        <ChatInterface
          workflowType="ai-ask"
          onSendMessage={mockOnSendMessage}
          messages={[]}
        />
      );

      const toggleButton = screen.getByTitle("Toggle context information");
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText("Form Help Available")).toBeInTheDocument();
        expect(
          screen.getByText("I can help you fill out this form")
        ).toBeInTheDocument();
      });
    });
  });

  describe("prompt suggestions", () => {
    it("should show prompt suggestions when no messages", async () => {
      render(
        <ChatInterface
          workflowType="ai-ask"
          onSendMessage={mockOnSendMessage}
          messages={[]}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText("Help me fill out this form")
        ).toBeInTheDocument();
        expect(
          screen.getByText("What information is required here?")
        ).toBeInTheDocument();
      });
    });

    it("should hide prompt suggestions when messages exist", async () => {
      render(
        <ChatInterface
          workflowType="ai-ask"
          onSendMessage={mockOnSendMessage}
          messages={[
            {
              id: "1",
              content: "Test message",
              sender: "user",
              timestamp: new Date(),
            },
          ]}
        />
      );

      await waitFor(() => {
        expect(
          screen.queryByText("Help me fill out this form")
        ).not.toBeInTheDocument();
      });
    });

    it("should set input value when prompt suggestion is clicked", async () => {
      render(
        <ChatInterface
          workflowType="ai-ask"
          onSendMessage={mockOnSendMessage}
          messages={[]}
        />
      );

      await waitFor(() => {
        const suggestion = screen.getByText("Help me fill out this form");
        fireEvent.click(suggestion);
      });

      const input = screen.getByPlaceholderText("Ask me anything...");
      expect(input).toHaveValue("Help me fill out this form");
    });
  });

  describe("context-enhanced messaging", () => {
    it("should enhance messages with context before sending", async () => {
      render(
        <ChatInterface
          workflowType="ai-ask"
          onSendMessage={mockOnSendMessage}
          messages={[]}
        />
      );

      const input = screen.getByPlaceholderText("Ask me anything...");
      const sendButton = screen.getByRole("button", { name: /send/i });

      fireEvent.change(input, {
        target: { value: "What is this page about?" },
      });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockContextProvider.enhancePrompt).toHaveBeenCalledWith(
          "What is this page about?",
          []
        );
      });

      expect(mockOnSendMessage).toHaveBeenCalledWith(
        "Context: form page\n\nUser question: What is this page about?"
      );
    });

    it("should show context information in AI response", async () => {
      render(
        <ChatInterface
          workflowType="ai-ask"
          onSendMessage={mockOnSendMessage}
          messages={[]}
        />
      );

      const input = screen.getByPlaceholderText("Ask me anything...");
      const sendButton = screen.getByRole("button", { name: /send/i });

      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.click(sendButton);

      await waitFor(
        () => {
          expect(
            screen.getByText(/Context used: Page Type: form/)
          ).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it("should handle context enhancement errors gracefully", async () => {
      mockContextProvider.enhancePrompt.mockRejectedValue(
        new Error("Context error")
      );

      render(
        <ChatInterface
          workflowType="ai-ask"
          onSendMessage={mockOnSendMessage}
          messages={[]}
        />
      );

      const input = screen.getByPlaceholderText("Ask me anything...");
      const sendButton = screen.getByRole("button", { name: /send/i });

      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.click(sendButton);

      // Should still send the original message
      await waitFor(() => {
        expect(mockOnSendMessage).toHaveBeenCalledWith("Test message");
      });
    });
  });

  describe("context suggestion interactions", () => {
    it("should set appropriate prompt when context suggestion is clicked", async () => {
      render(
        <ChatInterface
          workflowType="ai-ask"
          onSendMessage={mockOnSendMessage}
          messages={[]}
        />
      );

      const toggleButton = screen.getByTitle("Toggle context information");
      fireEvent.click(toggleButton);

      await waitFor(() => {
        const suggestion = screen.getByText("Form Help Available");
        fireEvent.click(suggestion);
      });

      const input = screen.getByPlaceholderText("Ask me anything...");
      expect(input).toHaveValue("Help me fill out this form");
    });
  });

  describe("context loading and refresh", () => {
    it("should load context suggestions on mount", async () => {
      render(
        <ChatInterface
          workflowType="ai-ask"
          onSendMessage={mockOnSendMessage}
          messages={[]}
        />
      );

      await waitFor(() => {
        expect(mockContextProvider.generateSuggestions).toHaveBeenCalled();
        expect(mockContextProvider.getPromptSuggestions).toHaveBeenCalled();
      });
    });

    it("should refresh suggestions after sending a message", async () => {
      render(
        <ChatInterface
          workflowType="ai-ask"
          onSendMessage={mockOnSendMessage}
          messages={[]}
        />
      );

      const input = screen.getByPlaceholderText("Ask me anything...");
      const sendButton = screen.getByRole("button", { name: /send/i });

      // Clear initial calls
      jest.clearAllMocks();

      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.click(sendButton);

      // Wait for message to be processed and suggestions to refresh
      await waitFor(
        () => {
          expect(mockContextProvider.generateSuggestions).toHaveBeenCalled();
          expect(mockContextProvider.getPromptSuggestions).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
    });
  });

  describe("error handling", () => {
    it("should handle context suggestion loading errors", async () => {
      mockContextProvider.generateSuggestions.mockRejectedValue(
        new Error("Context error")
      );
      mockContextProvider.getPromptSuggestions.mockRejectedValue(
        new Error("Context error")
      );

      render(
        <ChatInterface
          workflowType="ai-ask"
          onSendMessage={mockOnSendMessage}
          messages={[]}
        />
      );

      // Should not crash and should still render the interface
      expect(screen.getByText("AI Ask")).toBeInTheDocument();
    });
  });
});
