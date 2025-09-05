import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeatureToggles, FeatureConfig } from "../FeatureToggles";

describe("FeatureToggles", () => {
  const defaultFeatures: FeatureConfig = {
    networkMonitoring: true,
    domObservation: true,
    contextCollection: true,
    pluginIntegration: true,
    interactionTracking: true,
  };

  const defaultProps = {
    enabled: true,
    features: defaultFeatures,
    onMasterToggle: jest.fn(),
    onFeatureToggle: jest.fn(),
    performanceLevel: "low" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders the component with all elements", () => {
      render(<FeatureToggles {...defaultProps} />);

      expect(screen.getByText("Spotlight Extension")).toBeInTheDocument();
      expect(screen.getByText("Enable Extension")).toBeInTheDocument();
      expect(screen.getByText("Performance Impact:")).toBeInTheDocument();
    });

    it("renders all feature toggles", () => {
      render(<FeatureToggles {...defaultProps} />);

      expect(
        screen.getByLabelText("Toggle Network Monitoring")
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Toggle DOM Observation")
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Toggle Context Collection")
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Toggle Plugin Integration")
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Toggle Interaction Tracking")
      ).toBeInTheDocument();
    });

    it("displays correct feature descriptions", () => {
      render(<FeatureToggles {...defaultProps} />);

      expect(
        screen.getAllByText("Track API calls and network requests")
      ).toHaveLength(2); // visible + sr-only
      expect(
        screen.getAllByText("Monitor page changes and interactions")
      ).toHaveLength(2);
      expect(
        screen.getAllByText("Analyze page content and structure")
      ).toHaveLength(2);
      expect(
        screen.getAllByText("Enhanced context from compatible sites")
      ).toHaveLength(2);
      expect(
        screen.getAllByText("Monitor user interactions and form usage")
      ).toHaveLength(2);
    });
  });

  describe("Master Toggle", () => {
    it("calls onMasterToggle when master toggle is clicked", async () => {
      const user = userEvent.setup();
      render(<FeatureToggles {...defaultProps} />);

      const masterToggle = screen.getByLabelText(
        "Enable or disable the entire extension"
      );
      await user.click(masterToggle);

      expect(defaultProps.onMasterToggle).toHaveBeenCalledWith(false);
    });

    it("shows correct status when enabled", () => {
      render(<FeatureToggles {...defaultProps} />);

      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.queryByText("Inactive")).not.toBeInTheDocument();
    });

    it("shows correct status when disabled", () => {
      render(<FeatureToggles {...defaultProps} enabled={false} />);

      expect(screen.getByText("Inactive")).toBeInTheDocument();
      expect(screen.queryByText("Active")).not.toBeInTheDocument();
    });

    it("shows partial status when some features are disabled", () => {
      const partialFeatures = {
        ...defaultFeatures,
        networkMonitoring: false,
        domObservation: false,
      };

      render(<FeatureToggles {...defaultProps} features={partialFeatures} />);

      expect(screen.getByText("3/5 Features Active")).toBeInTheDocument();
    });

    it("shows monitoring disabled status when no features are enabled", () => {
      const noFeatures = {
        networkMonitoring: false,
        domObservation: false,
        contextCollection: false,
        pluginIntegration: false,
        interactionTracking: false,
      };

      render(<FeatureToggles {...defaultProps} features={noFeatures} />);

      expect(screen.getByText("Monitoring Disabled")).toBeInTheDocument();
    });
  });

  describe("Feature Toggles", () => {
    it("calls onFeatureToggle when a feature toggle is clicked", async () => {
      const user = userEvent.setup();
      render(<FeatureToggles {...defaultProps} />);

      const networkToggle = screen.getByLabelText("Toggle Network Monitoring");
      await user.click(networkToggle);

      expect(defaultProps.onFeatureToggle).toHaveBeenCalledWith(
        "networkMonitoring",
        false
      );
    });

    it("disables feature toggles when master toggle is disabled", () => {
      render(<FeatureToggles {...defaultProps} enabled={false} />);

      const networkToggle = screen.getByLabelText("Toggle Network Monitoring");
      expect(networkToggle).toBeDisabled();
    });

    it("does not call onFeatureToggle when disabled and clicked", async () => {
      const user = userEvent.setup();
      render(<FeatureToggles {...defaultProps} enabled={false} />);

      const networkToggle = screen.getByLabelText("Toggle Network Monitoring");
      await user.click(networkToggle);

      expect(defaultProps.onFeatureToggle).not.toHaveBeenCalled();
    });

    it("reflects the correct checked state for each feature", () => {
      const mixedFeatures = {
        networkMonitoring: true,
        domObservation: false,
        contextCollection: true,
        pluginIntegration: false,
        interactionTracking: true,
      };

      render(<FeatureToggles {...defaultProps} features={mixedFeatures} />);

      expect(screen.getByLabelText("Toggle Network Monitoring")).toBeChecked();
      expect(screen.getByLabelText("Toggle DOM Observation")).not.toBeChecked();
      expect(screen.getByLabelText("Toggle Context Collection")).toBeChecked();
      expect(
        screen.getByLabelText("Toggle Plugin Integration")
      ).not.toBeChecked();
      expect(
        screen.getByLabelText("Toggle Interaction Tracking")
      ).toBeChecked();
    });
  });

  describe("Performance Indicator", () => {
    it("displays low performance level correctly", () => {
      render(<FeatureToggles {...defaultProps} performanceLevel="low" />);

      const performanceLevel = screen.getByText("Low");
      expect(performanceLevel).toBeInTheDocument();
      expect(performanceLevel).toHaveClass("performance-level", "low");
    });

    it("displays medium performance level correctly", () => {
      render(<FeatureToggles {...defaultProps} performanceLevel="medium" />);

      const performanceLevel = screen.getByText("Medium");
      expect(performanceLevel).toBeInTheDocument();
      expect(performanceLevel).toHaveClass("performance-level", "medium");
    });

    it("displays high performance level correctly", () => {
      render(<FeatureToggles {...defaultProps} performanceLevel="high" />);

      const performanceLevel = screen.getByText("High");
      expect(performanceLevel).toBeInTheDocument();
      expect(performanceLevel).toHaveClass("performance-level", "high");
    });
  });

  describe("Visual States", () => {
    it("applies disabled class when extension is disabled", () => {
      const { container } = render(
        <FeatureToggles {...defaultProps} enabled={false} />
      );

      const featureToggles = container.querySelector(".feature-toggles");
      expect(featureToggles).toHaveClass("disabled");
    });

    it("applies transitioning class during state changes", async () => {
      const { container } = render(<FeatureToggles {...defaultProps} />);

      const masterToggle = screen.getByLabelText(
        "Enable or disable the entire extension"
      );
      fireEvent.click(masterToggle);

      const featureToggles = container.querySelector(".feature-toggles");
      expect(featureToggles).toHaveClass("transitioning");

      // Wait for transition to complete
      await waitFor(
        () => {
          expect(featureToggles).not.toHaveClass("transitioning");
        },
        { timeout: 500 }
      );
    });

    it("shows inactive status dot when disabled", () => {
      render(<FeatureToggles {...defaultProps} enabled={false} />);

      const statusDot = document.querySelector(".status-dot");
      expect(statusDot).toHaveClass("inactive");
    });

    it("shows active status dot when enabled", () => {
      render(<FeatureToggles {...defaultProps} enabled={true} />);

      const statusDot = document.querySelector(".status-dot");
      expect(statusDot).not.toHaveClass("inactive");
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels for all toggles", () => {
      render(<FeatureToggles {...defaultProps} />);

      expect(
        screen.getByLabelText("Enable or disable the entire extension")
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Toggle Network Monitoring")
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Toggle DOM Observation")
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Toggle Context Collection")
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Toggle Plugin Integration")
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Toggle Interaction Tracking")
      ).toBeInTheDocument();
    });

    it("has proper describedby attributes for feature descriptions", () => {
      render(<FeatureToggles {...defaultProps} />);

      const networkToggle = screen.getByLabelText("Toggle Network Monitoring");
      expect(networkToggle).toHaveAttribute(
        "aria-describedby",
        "network-monitoring-description"
      );
    });

    it("includes screen reader only descriptions", () => {
      render(<FeatureToggles {...defaultProps} />);

      const description = document.getElementById(
        "network-monitoring-description"
      );
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass("sr-only");
      expect(description).toHaveTextContent(
        "Track API calls and network requests"
      );
    });

    it("supports keyboard navigation", async () => {
      const user = userEvent.setup();
      render(<FeatureToggles {...defaultProps} />);

      const masterToggle = screen.getByLabelText(
        "Enable or disable the entire extension"
      );

      // Focus and activate with keyboard
      masterToggle.focus();
      expect(masterToggle).toHaveFocus();

      await user.keyboard(" "); // Space key to toggle
      expect(defaultProps.onMasterToggle).toHaveBeenCalledWith(false);
    });
  });

  describe("Edge Cases", () => {
    it("handles missing feature gracefully", async () => {
      const user = userEvent.setup();

      // Mock console.error to avoid test noise
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      render(<FeatureToggles {...defaultProps} />);

      // Try to trigger a feature that doesn't exist
      const toggle = screen.getByLabelText("Toggle Network Monitoring");
      toggle.setAttribute("data-feature", "nonExistentFeature");

      await user.click(toggle);

      // Should not crash
      expect(defaultProps.onFeatureToggle).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("handles rapid toggle clicks gracefully", async () => {
      const user = userEvent.setup();
      render(<FeatureToggles {...defaultProps} />);

      const masterToggle = screen.getByLabelText(
        "Enable or disable the entire extension"
      );

      // Rapid clicks
      await user.click(masterToggle);
      await user.click(masterToggle);
      await user.click(masterToggle);

      expect(defaultProps.onMasterToggle).toHaveBeenCalledTimes(3);
    });
  });
});
