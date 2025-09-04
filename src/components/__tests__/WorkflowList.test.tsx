import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkflowList } from "../WorkflowList";
import { Workflow } from "../../types/workflow";

const mockWorkflows: Workflow[] = [
  {
    id: "ai-ask",
    name: "AI Ask",
    type: "chat",
    component: "ChatInterface",
  },
  {
    id: "search-users",
    name: "Search Users",
    type: "search",
    component: "SearchInterface",
  },
  {
    id: "close",
    name: "Close",
    type: "action",
    component: "ActionComponent",
    action: "close",
  },
];

describe("WorkflowList", () => {
  const defaultProps = {
    workflows: mockWorkflows,
    selectedIndex: 0,
    searchValue: "",
    onNavigate: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all workflows", () => {
    render(<WorkflowList {...defaultProps} />);

    expect(screen.getByText("AI Ask")).toBeInTheDocument();
    expect(screen.getByText("Search Users")).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("filters workflows based on search value", () => {
    render(<WorkflowList {...defaultProps} searchValue="AI" />);

    expect(screen.getByText("AI Ask")).toBeInTheDocument();
    expect(screen.queryByText("Search Users")).not.toBeInTheDocument();
    expect(screen.queryByText("Close")).not.toBeInTheDocument();
  });

  it("shows empty state when no workflows match search", () => {
    render(<WorkflowList {...defaultProps} searchValue="nonexistent" />);

    expect(screen.getByText("No workflows found")).toBeInTheDocument();
  });

  it("calls onNavigate when clicking non-action workflow", () => {
    const mockOnNavigate = jest.fn();
    render(<WorkflowList {...defaultProps} onNavigate={mockOnNavigate} />);

    fireEvent.click(screen.getByText("AI Ask"));

    expect(mockOnNavigate).toHaveBeenCalledWith("ai-ask");
  });

  it("calls onClose when clicking close action workflow", () => {
    const mockOnClose = jest.fn();
    render(<WorkflowList {...defaultProps} onClose={mockOnClose} />);

    fireEvent.click(screen.getByText("Close"));

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("highlights selected workflow", () => {
    render(<WorkflowList {...defaultProps} selectedIndex={1} />);

    const searchUsersItem = screen
      .getByText("Search Users")
      .closest(".workflow-item");
    expect(searchUsersItem).toHaveClass("workflow-item-selected");
  });
});
