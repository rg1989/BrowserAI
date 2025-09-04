import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SpotlightOverlay } from "../SpotlightOverlay";
import { WorkflowManager } from "../../services/WorkflowManager";
import { KeyboardManager } from "../../services/KeyboardManager";

// Mock the services
jest.mock("../../services/WorkflowManager");
jest.mock("../../services/KeyboardManager");

describe("SpotlightOverlay", () => {
  let mockWorkflowManager: jest.Mocked<WorkflowManager>;
  let mockKeyboardManager: jest.Mocked<KeyboardManager>;

  beforeEach(() => {
    mockWorkflowManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getCurrentWorkflows: jest.fn().mockReturnValue([]),
      getCurrentWorkflow: jest.fn().mockReturnValue(null),
      getBreadcrumbPath: jest.fn().mockReturnValue(""),
      isSearchEnabled: jest.fn().mockReturnValue(true),
      getSearchPlaceholder: jest.fn().mockReturnValue("Search..."),
      navigateToWorkflow: jest.fn(),
      goBack: jest.fn().mockReturnValue(false),
    } as any;

    mockKeyboardManager = {
      initialize: jest.fn(),
      setActive: jest.fn(),
      handleSearchKeyDown: jest.fn(),
    } as any;

    (WorkflowManager.getInstance as jest.Mock).mockReturnValue(
      mockWorkflowManager
    );
    (KeyboardManager.getInstance as jest.Mock).mockReturnValue(
      mockKeyboardManager
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("does not render when not visible", () => {
    render(<SpotlightOverlay isVisible={false} onClose={jest.fn()} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders when visible", async () => {
    render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });

  it("initializes workflow manager when visible", async () => {
    render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(mockWorkflowManager.initialize).toHaveBeenCalled();
    });
  });

  it("sets up keyboard manager", async () => {
    render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(mockKeyboardManager.initialize).toHaveBeenCalled();
      expect(mockKeyboardManager.setActive).toHaveBeenCalledWith(true);
    });
  });

  it("calls onClose when clicking overlay background", async () => {
    const mockOnClose = jest.fn();
    render(<SpotlightOverlay isVisible={true} onClose={mockOnClose} />);

    const overlay = document.querySelector(".spotlight-overlay");
    fireEvent.click(overlay!);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("does not close when clicking container", async () => {
    const mockOnClose = jest.fn();
    render(<SpotlightOverlay isVisible={true} onClose={mockOnClose} />);

    await waitFor(() => {
      const container = document.querySelector(".spotlight-container");
      fireEvent.click(container!);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  it("updates search value", async () => {
    render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

    await waitFor(() => {
      const searchInput = screen.getByRole("textbox");
      fireEvent.change(searchInput, { target: { value: "test" } });

      expect(searchInput).toHaveValue("test");
    });
  });

  it("shows chat interface for chat workflows", async () => {
    mockWorkflowManager.getCurrentWorkflow.mockReturnValue({
      id: "ai-ask",
      type: "chat",
      name: "AI Ask",
      component: "ChatInterface",
    });

    render(<SpotlightOverlay isVisible={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("AI Ask")).toBeInTheDocument();
    });
  });
});
