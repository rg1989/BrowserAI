/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormInterface } from "../FormInterface";
import { Workflow } from "../../types/workflow";

// Mock WorkflowManager
jest.mock("../../services/WorkflowManager", () => ({
  WorkflowManager: {
    getInstance: jest.fn(() => ({
      getCurrentStepData: jest.fn(() => ({
        userData: {
          name: "John Doe",
          description: "Software Developer",
          id: "user123",
        },
      })),
    })),
  },
}));

describe("FormInterface", () => {
  const mockWorkflow: Workflow = {
    id: "test-form",
    name: "Test Form",
    type: "form",
    component: "FormInterface",
    description: "A test form for validation",
  };

  const defaultProps = {
    workflow: mockWorkflow,
    searchValue: "",
    selectedIndex: 0,
    onNavigate: jest.fn(),
    onBack: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render user details title", () => {
      render(<FormInterface {...defaultProps} />);

      expect(screen.getByText("User Details")).toBeInTheDocument();
    });

    it("should render user data fields", () => {
      render(<FormInterface {...defaultProps} />);

      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Description")).toBeInTheDocument();
      expect(screen.getByText("Software Developer")).toBeInTheDocument();
      expect(screen.getByText("ID")).toBeInTheDocument();
      expect(screen.getByText("user123")).toBeInTheDocument();
    });

    it("should render edit and close buttons", () => {
      render(<FormInterface {...defaultProps} />);

      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /close/i })
      ).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle close button click", () => {
      render(<FormInterface {...defaultProps} />);

      const closeButton = screen.getByRole("button", { name: /close/i });
      fireEvent.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should handle edit button click", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      render(<FormInterface {...defaultProps} />);

      const editButton = screen.getByRole("button", { name: /edit/i });
      fireEvent.click(editButton);

      expect(consoleSpy).toHaveBeenCalledWith("Edit user:", {
        name: "John Doe",
        description: "Software Developer",
        id: "user123",
      });

      consoleSpy.mockRestore();
    });
  });
});
