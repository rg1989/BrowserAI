import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { SettingsManager } from "../SettingsManager";

// Mock anchor element creation for file downloads
const mockLink = {
  href: "",
  download: "",
  click: jest.fn(),
  style: {},
};

// Store original createElement to restore later
const originalCreateElement = document.createElement;

// Mock createElement function
const mockCreateElement = jest.fn((tagName: string) => {
  if (tagName === "a") {
    return mockLink as any;
  }
  return originalCreateElement.call(document, tagName);
});

// Mock DOM manipulation methods
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();

// Mock window.confirm and alert
global.confirm = jest.fn();
global.alert = jest.fn();

// Mock URL methods
global.URL.createObjectURL = jest.fn(() => "mock-url");
global.URL.revokeObjectURL = jest.fn();

describe("SettingsManager", () => {
  const defaultProps = {
    onSettingsChange: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (global.chrome.storage.sync.get as jest.Mock).mockResolvedValue({});
    (global.chrome.storage.sync.set as jest.Mock).mockResolvedValue(undefined);
    (global.chrome.storage.local.clear as jest.Mock).mockResolvedValue(
      undefined
    );
    (global.chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 1 }]);
    (global.chrome.tabs.sendMessage as jest.Mock).mockResolvedValue(undefined);
    (global.confirm as jest.Mock).mockReturnValue(false);
    (global.alert as jest.Mock).mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Rendering", () => {
    it("renders the settings manager with all sections", async () => {
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Extension Settings")).toBeInTheDocument();
      });

      expect(screen.getByText("Data Management")).toBeInTheDocument();
      expect(screen.getByText("Import & Export")).toBeInTheDocument();
      expect(screen.getByText("Danger Zone")).toBeInTheDocument();
    });

    it("shows loading state initially", () => {
      (global.chrome.storage.sync.get as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      render(<SettingsManager {...defaultProps} />);

      expect(screen.getByText("Loading settings...")).toBeInTheDocument();
      expect(document.querySelector(".spinner")).toBeInTheDocument();
    });

    it("hides loading state after settings load", async () => {
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Settings Loading", () => {
    it("loads settings from Chrome storage on mount", async () => {
      const mockSettings = {
        enabled: false,
        privacy: {
          dataRetentionDays: 14,
          redactSensitiveData: false,
        },
      };

      (global.chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        monitoringSettings: mockSettings,
      });

      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(global.chrome.storage.sync.get).toHaveBeenCalledWith([
          "monitoringSettings",
        ]);
      });
    });

    it("handles storage loading errors gracefully", async () => {
      (global.chrome.storage.sync.get as jest.Mock).mockRejectedValue(
        new Error("Storage error")
      );

      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load settings")).toBeInTheDocument();
      });
    });
  });

  describe("Data Retention Settings", () => {
    it("displays data retention dropdown", async () => {
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Data Retention Period")).toBeInTheDocument();
      });

      const select = screen.getByDisplayValue("1 week");
      expect(select).toBeInTheDocument();
    });

    it("updates data retention when changed", async () => {
      const user = userEvent.setup();
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Data Retention Period")).toBeInTheDocument();
      });

      const select = screen.getByDisplayValue("1 week");
      await user.selectOptions(select, "14");

      expect(screen.getByText("• Unsaved changes")).toBeInTheDocument();
    });

    it("toggles sensitive data redaction", async () => {
      const user = userEvent.setup();
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Extension Settings")).toBeInTheDocument();
      });

      const checkbox = screen.getByLabelText(
        "Automatically redact sensitive data"
      );
      await user.click(checkbox);

      expect(screen.getByText("• Unsaved changes")).toBeInTheDocument();
    });
  });

  describe("Import & Export", () => {
    it("exports settings when export button is clicked", async () => {
      const user = userEvent.setup();
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Export Settings")).toBeInTheDocument();
      });

      const exportButton = screen.getByText("Export Settings");

      // Test that the button exists and can be clicked
      expect(exportButton).toBeInTheDocument();
      expect(exportButton).not.toBeDisabled();

      // Click should not throw an error
      await expect(user.click(exportButton)).resolves.not.toThrow();
    });

    it("handles file import", async () => {
      const user = userEvent.setup();
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Import Settings")).toBeInTheDocument();
      });

      const fileInput = document.querySelector(
        ".file-input"
      ) as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      const mockFile = new File(['{"enabled": false}'], "settings.json", {
        type: "application/json",
      });

      await user.upload(fileInput, mockFile);

      // Wait for file processing
      await waitFor(() => {
        expect(screen.getByText("• Unsaved changes")).toBeInTheDocument();
      });
    });

    it("handles invalid JSON import", async () => {
      const user = userEvent.setup();
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Import Settings")).toBeInTheDocument();
      });

      const fileInput = document.querySelector(
        ".file-input"
      ) as HTMLInputElement;

      // Mock FileReader to simulate invalid JSON
      const originalFileReader = global.FileReader;
      global.FileReader = class MockFileReader {
        result: string | ArrayBuffer | null = null;
        onload:
          | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
          | null = null;

        readAsText(file: Blob) {
          setTimeout(() => {
            this.result = "invalid json";
            if (this.onload) {
              const mockEvent = {
                target: this,
                type: "load",
                loaded: 0,
                total: 0,
                lengthComputable: false,
              } as unknown as ProgressEvent<FileReader>;
              this.onload.call(this as any, mockEvent);
            }
          }, 0);
        }

        // Add other required FileReader methods as no-ops
        abort() {}
        readAsArrayBuffer(file: Blob) {}
        readAsBinaryString(file: Blob) {}
        readAsDataURL(file: Blob) {}

        // Add required properties
        error: DOMException | null = null;
        readyState: number = 0;
        onabort:
          | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
          | null = null;
        onerror:
          | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
          | null = null;
        onloadend:
          | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
          | null = null;
        onloadstart:
          | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
          | null = null;
        onprogress:
          | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
          | null = null;

        // EventTarget methods
        addEventListener() {}
        removeEventListener() {}
        dispatchEvent() {
          return true;
        }

        // FileReader constants
        static readonly EMPTY = 0;
        static readonly LOADING = 1;
        static readonly DONE = 2;
        readonly EMPTY = 0;
        readonly LOADING = 1;
        readonly DONE = 2;
      } as any;

      const mockFile = new File(["invalid json"], "settings.json", {
        type: "application/json",
      });

      await user.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to parse settings file")
        ).toBeInTheDocument();
      });

      // Restore FileReader
      global.FileReader = originalFileReader;
    });
  });

  describe("Danger Zone Actions", () => {
    it("resets settings to defaults", async () => {
      const user = userEvent.setup();
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Reset to Defaults")).toBeInTheDocument();
      });

      const resetButton = screen.getByText("Reset to Defaults");
      await user.click(resetButton);

      expect(screen.getByText("• Unsaved changes")).toBeInTheDocument();
    });

    it("clears all data when confirmed", async () => {
      (global.confirm as jest.Mock).mockReturnValue(true);

      const user = userEvent.setup();
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Clear All Data")).toBeInTheDocument();
      });

      const clearButton = screen.getByText("Clear All Data");
      await user.click(clearButton);

      await waitFor(() => {
        expect(global.chrome.storage.local.clear).toHaveBeenCalled();
        expect(global.alert).toHaveBeenCalledWith(
          "All monitoring data has been cleared."
        );
      });
    });

    it("does not clear data when not confirmed", async () => {
      (global.confirm as jest.Mock).mockReturnValue(false);

      const user = userEvent.setup();
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Clear All Data")).toBeInTheDocument();
      });

      const clearButton = screen.getByText("Clear All Data");
      await user.click(clearButton);

      expect(global.chrome.storage.local.clear).not.toHaveBeenCalled();
    });
  });

  describe("Save and Cancel Actions", () => {
    it("saves settings when save button is clicked", async () => {
      const user = userEvent.setup();
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Extension Settings")).toBeInTheDocument();
      });

      // Make a change to enable save button
      const checkbox = screen.getByLabelText(
        "Automatically redact sensitive data"
      );
      await user.click(checkbox);

      const saveButton = screen.getByText("Save Changes");
      expect(saveButton).not.toBeDisabled();

      await user.click(saveButton);

      await waitFor(() => {
        expect(global.chrome.storage.sync.set).toHaveBeenCalled();
        expect(defaultProps.onSettingsChange).toHaveBeenCalled();
      });
    });

    it("disables save button when no changes", async () => {
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Save Changes")).toBeDisabled();
      });
    });

    it("calls onClose when cancel button is clicked", async () => {
      const user = userEvent.setup();
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Cancel")).toBeInTheDocument();
      });

      const cancelButton = screen.getByText("Cancel");
      await user.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("calls onClose when close button is clicked", async () => {
      const user = userEvent.setup();
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText("Close settings")).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText("Close settings");
      await user.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("shows error banner when save fails", async () => {
      (global.chrome.storage.sync.set as jest.Mock).mockRejectedValue(
        new Error("Save failed")
      );

      const user = userEvent.setup();
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Extension Settings")).toBeInTheDocument();
      });

      // Make a change and save
      const checkbox = screen.getByLabelText(
        "Automatically redact sensitive data"
      );
      await user.click(checkbox);

      const saveButton = screen.getByText("Save Changes");
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText("Failed to save settings")).toBeInTheDocument();
      });
    });

    it("dismisses error banner when dismiss button is clicked", async () => {
      (global.chrome.storage.sync.get as jest.Mock).mockRejectedValue(
        new Error("Load failed")
      );

      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load settings")).toBeInTheDocument();
      });

      const dismissButton = screen.getByLabelText("Dismiss error");
      fireEvent.click(dismissButton);

      expect(
        screen.queryByText("Failed to load settings")
      ).not.toBeInTheDocument();
    });
  });

  describe("Keyboard Shortcuts", () => {
    it("saves on Ctrl+S when there are unsaved changes", async () => {
      const user = userEvent.setup();
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Extension Settings")).toBeInTheDocument();
      });

      // Make a change
      const checkbox = screen.getByLabelText(
        "Automatically redact sensitive data"
      );
      await user.click(checkbox);

      // Press Ctrl+S
      fireEvent.keyDown(document, { key: "s", ctrlKey: true });

      await waitFor(() => {
        expect(global.chrome.storage.sync.set).toHaveBeenCalled();
      });
    });

    it("closes on Escape key", async () => {
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Extension Settings")).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: "Escape" });

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels for interactive elements", async () => {
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText("Close settings")).toBeInTheDocument();
      });

      expect(
        screen.getByLabelText("Automatically redact sensitive data")
      ).toBeInTheDocument();
    });

    it("supports keyboard navigation", async () => {
      const user = userEvent.setup();
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Extension Settings")).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText("Close settings");

      // Focus and activate with keyboard
      closeButton.focus();
      expect(closeButton).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("handles missing Chrome APIs gracefully", async () => {
      const originalChrome = global.chrome;
      // @ts-ignore
      global.chrome = undefined;

      render(<SettingsManager {...defaultProps} />);

      // Should render without crashing
      await waitFor(() => {
        expect(screen.getByText("Extension Settings")).toBeInTheDocument();
      });

      // Restore chrome mock
      global.chrome = originalChrome;
    });

    it("handles empty file selection", async () => {
      const user = userEvent.setup();
      render(<SettingsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Import Settings")).toBeInTheDocument();
      });

      const fileInput = document.querySelector(
        ".file-input"
      ) as HTMLInputElement;

      // Simulate selecting no file
      fireEvent.change(fileInput, { target: { files: [] } });

      // Should not crash or show error
      expect(
        screen.queryByText("Failed to parse settings file")
      ).not.toBeInTheDocument();
    });
  });
});
