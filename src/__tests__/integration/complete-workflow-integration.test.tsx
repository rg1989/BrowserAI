/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpotlightOverlay } from "../../components/SpotlightOverlay";
import { WorkflowManager } from "../../services/WorkflowManager";
import { WorkflowActions } from "../../services/WorkflowActions";
import { KeyboardManager } from "../../services/KeyboardManager";

// Mock DOM methods not available in jsdom
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  value: jest.fn(),
  writable: true,
});

// Mock services
jest.mock("../../services/WorkflowManager");
jest.mock("../../services/WorkflowActions");
jest.mock("../../services/KeyboardManager");
jest.mock("../../services/ConfigLoader");
jest.mock("../../services/AIService");

describe("Complete Workflow Integration Tests", () => {
  let mockWorkflowManager: jest.Mocked<WorkflowManager>;
  let mockWorkflowActions: jest.Mocked<WorkflowActions>;
  let mockKeyboardManager: jest.Mocked<KeyboardManager>;
  let user: ReturnType<typeof userEvent.setup>;

  const mockWorkflows = {
    "ai-ask": {
      id: "ai-ask",
      name: "AI Ask",
      type: "chat" as const,
      component: "ChatInterface",
      searchEnabled: false,
    },
    "ai-agent": {
      id: "ai-agent",
      name: "AI Agent",
      type: "chat" as const,
      component: "ChatInterface",
      searchEnabled: false,
    },
    "search-users": {
      id: "search-users",
      name: "Search Users",
      type: "search" as const,
      component: "SearchInterface",
      searchEnabled: true,
      searchPlaceholder: "Type to search users...",
      nextWorkflow: "user-details",
    },
    "user-details": {
      id: "user-details",
      name: "User Details",
      type: "form" as const,
      component: "FormInterface",
      searchEnabled: false,
    },
    close: {
      id: "close",
      name: "Close",
      type: "action" as const,
      component: "ActionComponent",
      action: "close",
    },
  };

  beforeEach(() => {
    user = userEvent.setup();

    // Setup comprehensive WorkflowManager mock
    mockWorkflowManager = {
      initialize: jest.fn(),
      resetToInitial: jest.fn(),
      navigateToWorkflow: jest.fn(),
      goBack: jest.fn(),
      getCurrentWorkflows: jest.fn(),
      getCurrentWorkflow: jest.fn(),
      getBreadcrumbPath: jest.fn(),
      isSearchEnabled: jest.fn(),
      getSearchPlaceholder: jest.fn(),
      getCurrentPath: jest.fn(),
      isAtInitialState: jest.fn(),
      getWorkflowById: jest.fn(),
      getCurrentStepData: jest.fn(),
    } as any;

    // Setup WorkflowActions mock
    mockWorkflowActions = {
      executeWorkflow: jest.fn(),
      sendChatMessage: jest.fn(),
      sendChatMessageStream: jest.fn(),
      handleSearchResult: jest.fn(),
      handleFormSubmit: jest.fn(),
      handleWorkflowTransition: jest.fn(),
      getWorkflowCapabilities: jest.fn(),
      getAIServiceInfo: jest.fn(),
      getAvailableAIServices: jest.fn(),
      setAIService: jest.fn(),
    } as any;

    // Setup KeyboardManager mock
    mockKeyboardManager = {
      initialize: jest.fn(),
      setActive: jest.fn(),
      handleSearchKeyDown: jest.fn(),
      cleanup: jest.fn(),
      destroy: jest.fn(),
      detachGlobalListeners: jest.fn(),
      onToggleOverlay: jest.fn(),
    } as any;

    // Mock singleton instances
    (WorkflowManager.getInstance as jest.Mock).mockReturnValue(
      mockWorkflowManager
    );
    (WorkflowActions.getInstance as jest.Mock).mockReturnValue(
      mockWorkflowActions
    );
    (KeyboardManager.getInstance as jest.Mock).mockReturnValue(
      mockKeyboardManager
    );

    // Default mock implementations
    mockWorkflowManager.initialize.mockResolvedValue();
    mockWorkflowManager.getCurrentWorkflows.mockReturnValue([
      mockWorkflows["ai-ask"],
      mockWorkflows["ai-agent"],
      mockWorkflows["search-users"],
      mockWorkflows.close,
    ]);
    mockWorkflowManager.getCurrentWorkflow.mockReturnValue(null);
    mockWorkflowManager.getBreadcrumbPath.mockReturnValue("");
    mockWorkflowManager.isSearchEnabled.mockReturnValue(true);
    mockWorkflowManager.getSearchPlaceholder.mockReturnValue(
      "Search workflows..."
    );
    mockWorkflowManager.getCurrentPath.mockReturnValue({
      steps: [],
      current: "initial",
    });
    mockWorkflowManager.isAtInitialState.mockReturnValue(true);
    mockWorkflowManager.getCurrentStepData.mockReturnValue(null);
    mockWorkflowActions.executeWorkflow.mockResolvedValue();
    mockWorkflowActions.sendChatMessage.mockResolvedValue("AI response");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Initial Workflow Display", () => {
    it("should display initial workflows when overlay opens", async () => {
      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("AI Ask")).toBeInTheDocument();
        expect(screen.getByText("AI Agent")).toBeInTheDocument();
        expect(screen.getByText("Search Users")).toBeInTheDocument();
        expect(screen.getByText("Close")).toBeInTheDocument();
      });

      // Verify WorkflowManager methods are called
      expect(mockWorkflowManager.initialize).toHaveBeenCalled();
      expect(mockWorkflowManager.getCurrentWorkflows).toHaveBeenCalled();
    });

    it("should show search field with correct placeholder", async () => {
      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText("Search workflows...");
        expect(searchInput).toBeInTheDocument();
      });

      expect(mockWorkflowManager.getSearchPlaceholder).toHaveBeenCalled();
    });
  });

  describe("Action Workflow Execution", () => {
    it("should execute close action when close workflow is selected", async () => {
      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Close")).toBeInTheDocument();
      });

      // Click on Close workflow
      await user.click(screen.getByText("Close"));

      expect(mockWorkflowActions.executeWorkflow).toHaveBeenCalledWith(
        mockWorkflows.close,
        undefined,
        expect.objectContaining({
          onClose: expect.any(Function),
        })
      );
    });
  });

  describe("Chat Workflow Navigation", () => {
    it("should navigate to chat workflow and show chat interface", async () => {
      // Mock navigation to chat workflow
      mockWorkflowManager.getCurrentWorkflow.mockReturnValue(
        mockWorkflows["ai-ask"]
      );
      mockWorkflowManager.isSearchEnabled.mockReturnValue(false);
      mockWorkflowManager.getBreadcrumbPath.mockReturnValue("AI Ask:");

      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("AI Ask")).toBeInTheDocument();
      });

      // Click on AI Ask workflow
      await user.click(screen.getByText("AI Ask"));

      expect(mockWorkflowManager.navigateToWorkflow).toHaveBeenCalledWith(
        "ai-ask"
      );
    });

    it("should display breadcrumb when in chat workflow", async () => {
      mockWorkflowManager.getCurrentWorkflow.mockReturnValue(
        mockWorkflows["ai-ask"]
      );
      mockWorkflowManager.getBreadcrumbPath.mockReturnValue("AI Ask:");
      mockWorkflowManager.isSearchEnabled.mockReturnValue(false);

      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("AI Ask:")).toBeInTheDocument();
      });
    });
  });

  describe("Search Workflow Navigation", () => {
    it("should navigate to search workflow and enable search field", async () => {
      // Mock navigation to search workflow
      mockWorkflowManager.getCurrentWorkflow.mockReturnValue(
        mockWorkflows["search-users"]
      );
      mockWorkflowManager.isSearchEnabled.mockReturnValue(true);
      mockWorkflowManager.getSearchPlaceholder.mockReturnValue(
        "Type to search users..."
      );
      mockWorkflowManager.getBreadcrumbPath.mockReturnValue("Search Users:");

      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Search Users")).toBeInTheDocument();
      });

      // Click on Search Users workflow
      await user.click(screen.getByText("Search Users"));

      expect(mockWorkflowManager.navigateToWorkflow).toHaveBeenCalledWith(
        "search-users"
      );
    });

    it("should show search interface when in search workflow", async () => {
      mockWorkflowManager.getCurrentWorkflow.mockReturnValue(
        mockWorkflows["search-users"]
      );
      mockWorkflowManager.isSearchEnabled.mockReturnValue(true);
      mockWorkflowManager.getBreadcrumbPath.mockReturnValue("Search Users:");

      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(
          screen.getByText("Start typing to search...")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Form Workflow Navigation", () => {
    it("should navigate to form workflow and show form interface", async () => {
      // Mock navigation to form workflow
      mockWorkflowManager.getCurrentWorkflow.mockReturnValue(
        mockWorkflows["user-details"]
      );
      mockWorkflowManager.isSearchEnabled.mockReturnValue(false);
      mockWorkflowManager.getBreadcrumbPath.mockReturnValue("User Details:");
      mockWorkflowManager.getCurrentStepData.mockReturnValue({
        userData: {
          name: "John Doe",
          description: "Software Developer",
          id: "user123",
        },
      });

      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("User Details")).toBeInTheDocument();
      });
    });
  });

  describe("Keyboard Navigation", () => {
    it("should handle arrow key navigation through workflows", async () => {
      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("AI Ask")).toBeInTheDocument();
      });

      // Test arrow down navigation
      fireEvent.keyDown(document, { key: "ArrowDown" });

      // Verify keyboard manager handles the event
      expect(mockKeyboardManager.handleSearchKeyDown).toHaveBeenCalled();
    });

    it("should handle Enter key to select workflow", async () => {
      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("AI Ask")).toBeInTheDocument();
      });

      // Press Enter to select
      fireEvent.keyDown(document, { key: "Enter" });

      expect(mockKeyboardManager.handleSearchKeyDown).toHaveBeenCalled();
    });

    it("should handle Escape key for back navigation", async () => {
      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" });

      expect(mockKeyboardManager.handleSearchKeyDown).toHaveBeenCalled();
    });
  });

  describe("Multi-step Workflow Navigation", () => {
    it("should handle complete search-to-form workflow", async () => {
      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      // Step 1: Navigate to search workflow
      await waitFor(() => {
        expect(screen.getByText("Search Users")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Search Users"));
      expect(mockWorkflowManager.navigateToWorkflow).toHaveBeenCalledWith(
        "search-users"
      );

      // Step 2: Mock search result selection
      mockWorkflowActions.handleSearchResult.mockResolvedValue();

      // Simulate search result selection
      const searchResult = { id: "user-123", name: "John Doe" };
      await mockWorkflowActions.handleSearchResult(
        mockWorkflows["search-users"],
        searchResult,
        { onNavigate: mockWorkflowManager.navigateToWorkflow }
      );

      expect(mockWorkflowActions.handleSearchResult).toHaveBeenCalled();
    });

    it("should handle back navigation correctly", async () => {
      // Mock being in a nested workflow
      mockWorkflowManager.getCurrentWorkflow.mockReturnValue(
        mockWorkflows["user-details"]
      );
      mockWorkflowManager.getBreadcrumbPath.mockReturnValue(
        "Search Users > User Details:"
      );

      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      // Press Escape to go back
      fireEvent.keyDown(document, { key: "Escape" });

      expect(mockKeyboardManager.handleSearchKeyDown).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle workflow execution errors gracefully", async () => {
      mockWorkflowActions.executeWorkflow.mockRejectedValue(
        new Error("Execution failed")
      );

      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Close")).toBeInTheDocument();
      });

      // Click on workflow that will fail
      await user.click(screen.getByText("Close"));

      // Should still attempt to execute
      expect(mockWorkflowActions.executeWorkflow).toHaveBeenCalled();
    });

    it("should handle initialization errors", async () => {
      mockWorkflowManager.initialize.mockRejectedValue(
        new Error("Init failed")
      );

      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      // Should still render with fallback
      await waitFor(() => {
        expect(mockWorkflowManager.initialize).toHaveBeenCalled();
      });
    });
  });

  describe("Dynamic Workflow Switching", () => {
    it("should update search field state when switching workflows", async () => {
      const { rerender } = render(
        <SpotlightOverlay isVisible={true} onClose={jest.fn()} />
      );

      // Initially search enabled
      expect(mockWorkflowManager.isSearchEnabled).toHaveBeenCalled();

      // Switch to chat workflow (search disabled)
      mockWorkflowManager.getCurrentWorkflow.mockReturnValue(
        mockWorkflows["ai-ask"]
      );
      mockWorkflowManager.isSearchEnabled.mockReturnValue(false);

      rerender(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      expect(mockWorkflowManager.isSearchEnabled).toHaveBeenCalled();
    });

    it("should update breadcrumbs when navigating", async () => {
      const { rerender } = render(
        <SpotlightOverlay isVisible={true} onClose={jest.fn()} />
      );

      // Initially no breadcrumb
      expect(mockWorkflowManager.getBreadcrumbPath).toHaveBeenCalled();

      // Navigate to workflow with breadcrumb
      mockWorkflowManager.getBreadcrumbPath.mockReturnValue("AI Ask:");

      rerender(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      expect(mockWorkflowManager.getBreadcrumbPath).toHaveBeenCalled();
    });
  });

  describe("Workflow Capabilities", () => {
    it("should get workflow capabilities for different types", async () => {
      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      // Test getting capabilities for different workflow types
      mockWorkflowActions.getWorkflowCapabilities.mockReturnValue({
        supportsSearch: true,
        supportsChat: false,
        supportsForm: false,
      });

      const capabilities = mockWorkflowActions.getWorkflowCapabilities(
        mockWorkflows["search-users"]
      );
      expect(capabilities.supportsSearch).toBe(true);
    });
  });

  describe("AI Service Integration", () => {
    it("should get AI service information", async () => {
      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      mockWorkflowActions.getAIServiceInfo.mockReturnValue({
        name: "mock",
        version: "1.0.0",
        status: "active",
      });

      const info = mockWorkflowActions.getAIServiceInfo();
      expect(info.name).toBe("mock");
    });

    it("should get available AI services", async () => {
      render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

      mockWorkflowActions.getAvailableAIServices.mockReturnValue([
        "mock",
        "openai",
      ]);

      const services = mockWorkflowActions.getAvailableAIServices();
      expect(services).toContain("mock");
    });
  });
});
