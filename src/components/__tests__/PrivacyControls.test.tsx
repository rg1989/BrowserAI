import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrivacyControls, PrivacyConfig } from "../PrivacyControls";

// Mock window.alert
global.alert = jest.fn();

describe("PrivacyControls", () => {
  const defaultConfig: PrivacyConfig = {
    excludedDomains: ["example.com", "test.org"],
    excludedPaths: ["/admin/*", "*/login"],
    redactSensitiveData: true,
    sensitiveDataPatterns: ["password", "token", "secret"],
    dataRetentionDays: 7,
  };

  const defaultProps = {
    config: defaultConfig,
    onConfigChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.alert as jest.Mock).mockImplementation(() => {});
  });

  describe("Rendering", () => {
    it("renders all privacy control sections", () => {
      render(<PrivacyControls {...defaultProps} />);

      expect(screen.getByText("Excluded Domains")).toBeInTheDocument();
      expect(screen.getByText("Excluded URL Patterns")).toBeInTheDocument();
      expect(screen.getByText("Sensitive Data Protection")).toBeInTheDocument();
      expect(screen.getByText("Data Retention")).toBeInTheDocument();
    });

    it("displays current excluded domains", () => {
      render(<PrivacyControls {...defaultProps} />);

      expect(screen.getByText("example.com")).toBeInTheDocument();
      expect(screen.getByText("test.org")).toBeInTheDocument();
    });

    it("displays current excluded paths", () => {
      render(<PrivacyControls {...defaultProps} />);

      expect(screen.getByText("/admin/*")).toBeInTheDocument();
      expect(screen.getByText("*/login")).toBeInTheDocument();
    });

    it("displays current sensitive data patterns", () => {
      render(<PrivacyControls {...defaultProps} />);

      expect(screen.getByText("password")).toBeInTheDocument();
      expect(screen.getByText("token")).toBeInTheDocument();
      expect(screen.getByText("secret")).toBeInTheDocument();
    });

    it("shows empty state when no domains are excluded", () => {
      const emptyConfig = { ...defaultConfig, excludedDomains: [] };
      render(<PrivacyControls {...defaultProps} config={emptyConfig} />);

      expect(screen.getByText("No domains excluded")).toBeInTheDocument();
    });

    it("shows empty state when no paths are excluded", () => {
      const emptyConfig = { ...defaultConfig, excludedPaths: [] };
      render(<PrivacyControls {...defaultProps} config={emptyConfig} />);

      expect(screen.getByText("No URL patterns excluded")).toBeInTheDocument();
    });
  });

  describe("Domain Management", () => {
    it("adds a new domain when valid domain is entered", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const input = screen.getByPlaceholderText("example.com");
      const addButton = screen.getAllByText("Add")[0];

      await user.type(input, "newdomain.com");
      await user.click(addButton);

      expect(defaultProps.onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        excludedDomains: [...defaultConfig.excludedDomains, "newdomain.com"],
      });
    });

    it("adds domain on Enter key press", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const input = screen.getByPlaceholderText("example.com");

      await user.type(input, "newdomain.com");
      await user.keyboard("{Enter}");

      expect(defaultProps.onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        excludedDomains: [...defaultConfig.excludedDomains, "newdomain.com"],
      });
    });

    it("validates domain format", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const input = screen.getByPlaceholderText("example.com");
      const addButton = screen.getAllByText("Add")[0];

      await user.type(input, "invalid-domain");
      await user.click(addButton);

      expect(global.alert).toHaveBeenCalledWith(
        "Please enter a valid domain (e.g., example.com)"
      );
      expect(defaultProps.onConfigChange).not.toHaveBeenCalled();
    });

    it("prevents adding duplicate domains", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const input = screen.getByPlaceholderText("example.com");
      const addButton = screen.getAllByText("Add")[0];

      await user.type(input, "example.com");
      await user.click(addButton);

      expect(global.alert).toHaveBeenCalledWith(
        "This domain is already excluded"
      );
      expect(defaultProps.onConfigChange).not.toHaveBeenCalled();
    });

    it("removes domain when remove button is clicked", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const removeButton = screen.getByLabelText(
        "Remove example.com from exclusion list"
      );
      await user.click(removeButton);

      expect(defaultProps.onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        excludedDomains: ["test.org"],
      });
    });

    it("disables add button when input is empty", () => {
      render(<PrivacyControls {...defaultProps} />);

      const addButton = screen.getAllByText("Add")[0];
      expect(addButton).toBeDisabled();
    });

    it("enables add button when input has content", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const input = screen.getByPlaceholderText("example.com");
      const addButton = screen.getAllByText("Add")[0];

      await user.type(input, "test");
      expect(addButton).not.toBeDisabled();
    });
  });

  describe("Path Management", () => {
    it("adds a new path pattern", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const input = screen.getByPlaceholderText("/admin/* or */login");
      const addButton = screen.getAllByText("Add")[1];

      await user.type(input, "/api/*");
      await user.click(addButton);

      expect(defaultProps.onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        excludedPaths: [...defaultConfig.excludedPaths, "/api/*"],
      });
    });

    it("prevents adding duplicate paths", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const input = screen.getByPlaceholderText("/admin/* or */login");
      const addButton = screen.getAllByText("Add")[1];

      await user.type(input, "/admin/*");
      await user.click(addButton);

      expect(global.alert).toHaveBeenCalledWith(
        "This path pattern is already excluded"
      );
      expect(defaultProps.onConfigChange).not.toHaveBeenCalled();
    });

    it("removes path when remove button is clicked", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const removeButton = screen.getByLabelText(
        "Remove /admin/* from exclusion list"
      );
      await user.click(removeButton);

      expect(defaultProps.onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        excludedPaths: ["*/login"],
      });
    });
  });

  describe("Sensitive Data Protection", () => {
    it("toggles sensitive data redaction", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const checkbox = screen.getByLabelText(
        "Automatically redact sensitive data"
      );
      await user.click(checkbox);

      expect(defaultProps.onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        redactSensitiveData: false,
      });
    });

    it("shows sensitive patterns section when redaction is enabled", () => {
      render(<PrivacyControls {...defaultProps} />);

      expect(screen.getByText("Sensitive Data Patterns")).toBeInTheDocument();
    });

    it("hides sensitive patterns section when redaction is disabled", () => {
      const disabledConfig = { ...defaultConfig, redactSensitiveData: false };
      render(<PrivacyControls {...defaultProps} config={disabledConfig} />);

      expect(
        screen.queryByText("Sensitive Data Patterns")
      ).not.toBeInTheDocument();
    });

    it("adds a new sensitive data pattern", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const input = screen.getByPlaceholderText("password, token, secret...");
      const addButton = screen.getAllByText("Add")[2];

      await user.type(input, "apikey");
      await user.click(addButton);

      expect(defaultProps.onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        sensitiveDataPatterns: [
          ...defaultConfig.sensitiveDataPatterns,
          "apikey",
        ],
      });
    });

    it("prevents adding duplicate patterns", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const input = screen.getByPlaceholderText("password, token, secret...");
      const addButton = screen.getAllByText("Add")[2];

      await user.type(input, "password");
      await user.click(addButton);

      expect(global.alert).toHaveBeenCalledWith(
        "This pattern is already included"
      );
      expect(defaultProps.onConfigChange).not.toHaveBeenCalled();
    });

    it("removes sensitive pattern when remove button is clicked", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const removeButton = screen.getByLabelText(
        "Remove password from sensitive patterns"
      );
      await user.click(removeButton);

      expect(defaultProps.onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        sensitiveDataPatterns: ["token", "secret"],
      });
    });
  });

  describe("Data Retention", () => {
    it("displays current retention period", () => {
      render(<PrivacyControls {...defaultProps} />);

      expect(screen.getByDisplayValue("1 week")).toBeInTheDocument();
    });

    it("updates retention period when changed", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const select = screen.getByDisplayValue("1 week");
      await user.selectOptions(select, "30");

      expect(defaultProps.onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        dataRetentionDays: 30,
      });
    });

    it("displays retention info text correctly for singular day", () => {
      const singleDayConfig = { ...defaultConfig, dataRetentionDays: 1 };
      render(<PrivacyControls {...defaultProps} config={singleDayConfig} />);

      expect(
        screen.getByText("Data older than 1 day will be automatically deleted.")
      ).toBeInTheDocument();
    });

    it("displays retention info text correctly for plural days", () => {
      render(<PrivacyControls {...defaultProps} />);

      expect(
        screen.getByText(
          "Data older than 7 days will be automatically deleted."
        )
      ).toBeInTheDocument();
    });
  });

  describe("Input Handling", () => {
    it("trims whitespace from domain input", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const input = screen.getByPlaceholderText("example.com");
      const addButton = screen.getAllByText("Add")[0];

      await user.type(input, "  newdomain.com  ");
      await user.click(addButton);

      expect(defaultProps.onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        excludedDomains: [...defaultConfig.excludedDomains, "newdomain.com"],
      });
    });

    it("converts domain to lowercase", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const input = screen.getByPlaceholderText("example.com");
      const addButton = screen.getAllByText("Add")[0];

      await user.type(input, "NEWDOMAIN.COM");
      await user.click(addButton);

      expect(defaultProps.onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        excludedDomains: [...defaultConfig.excludedDomains, "newdomain.com"],
      });
    });

    it("converts sensitive patterns to lowercase", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const input = screen.getByPlaceholderText("password, token, secret...");
      const addButton = screen.getAllByText("Add")[2];

      await user.type(input, "APIKEY");
      await user.click(addButton);

      expect(defaultProps.onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        sensitiveDataPatterns: [
          ...defaultConfig.sensitiveDataPatterns,
          "apikey",
        ],
      });
    });

    it("clears input after successful addition", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const input = screen.getByPlaceholderText("example.com");
      const addButton = screen.getAllByText("Add")[0];

      await user.type(input, "newdomain.com");
      await user.click(addButton);

      expect(input).toHaveValue("");
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels for all inputs", () => {
      render(<PrivacyControls {...defaultProps} />);

      expect(screen.getByLabelText("Add excluded domain")).toBeInTheDocument();
      expect(
        screen.getByLabelText("Add excluded URL pattern")
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Add sensitive data pattern")
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Select data retention period")
      ).toBeInTheDocument();
    });

    it("has proper ARIA labels for remove buttons", () => {
      render(<PrivacyControls {...defaultProps} />);

      expect(
        screen.getByLabelText("Remove example.com from exclusion list")
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Remove /admin/* from exclusion list")
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Remove password from sensitive patterns")
      ).toBeInTheDocument();
    });

    it("supports keyboard navigation for remove buttons", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const removeButton = screen.getByLabelText(
        "Remove example.com from exclusion list"
      );

      removeButton.focus();
      expect(removeButton).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(defaultProps.onConfigChange).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty input gracefully", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const input = screen.getByPlaceholderText("example.com");
      const addButton = screen.getAllByText("Add")[0];

      await user.type(input, "   ");
      await user.click(addButton);

      expect(defaultProps.onConfigChange).not.toHaveBeenCalled();
    });

    it("handles special characters in patterns", async () => {
      const user = userEvent.setup();
      render(<PrivacyControls {...defaultProps} />);

      const input = screen.getByPlaceholderText("password, token, secret...");
      const addButton = screen.getAllByText("Add")[2];

      await user.type(input, "api-key_123");
      await user.click(addButton);

      expect(defaultProps.onConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        sensitiveDataPatterns: [
          ...defaultConfig.sensitiveDataPatterns,
          "api-key_123",
        ],
      });
    });
  });
});
