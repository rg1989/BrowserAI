import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PopupInterface } from "../PopupInterface";

// Mock Chrome APIs
const mockChrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
  runtime: {
    openOptionsPage: jest.fn(),
  },
};

// @ts-ignore
global.chrome = mockChrome;

describe("PopupInterface", () => {
  const defaultSettings = {
    enabled: true,
    features: {
      networkMonitoring: true,
      domObservation: true,
      contextCollection: true,
      pluginIntegration: true,
      interactionTracking: true,
    },
    performanceLevel: "low" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockChrome.storage.sync.get.mockResolvedValue({
      monitoringSettings: defaultSettings,
    });
    mockChrome.storage.sync.set.mockResolvedValue(undefined);
    mockChrome.tabs.query.mockResolvedValue([{ id: 1 }]);
    mockChrome.tabs.sendMessage.mockResolvedValue(undefined);
  });

  describe("Loading State", () => {
    it("shows loading spinner initially", async () => {
      mockChrome.storage.sync.get.mockImplementation(
        () => new Promise(() => {})
      ); // Never resolves

      render(<PopupInterface />);

      expect(screen.getByText("Loading settings...")).toBeInTheDocument();
      expect(document.querySelector(".spinner")).toBeInTheDocument();
    });

    it("hides loading spinner after settings load", async () => {
      render(<PopupInterface />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });

      expect(screen.getByText("Spotlight Extension")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("shows error message when settings fail to load", async () => {
      mockChrome.storage.sync.get.mockRejectedValue(new Error("Storage error"));

      render(<PopupInterface />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load settings")).toBeInTheDocument();
      });

      expect(screen.getByText("Retry")).toBeInTheDocument();
    });

    it("retries loading settings when retry button is clicked", async () => {
      mockChrome.storage.sync.get
        .mockRejectedValueOnce(new Error("Storage error"))
        .mockResolvedValueOnce({ monitoringSettings: defaultSettings });

      render(<PopupInterface />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load settings")).toBeInTheDocument();
      });

      const retryButton = screen.getByText("Retry");
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText("Spotlight Extension")).toBeInTheDocument();
      });
    });
  });

  describe("Settings Management", () => {
    it("loads settings from Chrome storage on mount", async () => {
      render(<PopupInterface />);

      await waitFor(() => {
        expect(mockChrome.storage.sync.get).toHaveBeenCalledWith([
          "monitoringSettings",
        ]);
      });
    });

    it("saves settings when master toggle is changed", async () => {
      const user = userEvent.setup();
      render(<PopupInterface />);

      await waitFor(() => {
        expect(screen.getByText("Spotlight Extension")).toBeInTheDocument();
      });

      const masterToggle = screen.getByLabelText(
        "Enable or disable the entire extension"
      );
      await user.click(masterToggle);

      await waitFor(() => {
        expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
          monitoringSettings: expect.objectContaining({
            enabled: false,
          }),
        });
      });
    });

    it("saves settings when feature toggle is changed", async () => {
      const user = userEvent.setup();
      render(<PopupInterface />);

      await waitFor(() => {
        expect(screen.getByText("Spotlight Extension")).toBeInTheDocument();
      });

      const networkToggle = screen.getByLabelText("Toggle Network Monitoring");
      await user.click(networkToggle);

      await waitFor(() => {
        expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
          monitoringSettings: expect.objectContaining({
            features: expect.objectContaining({
              networkMonitoring: false,
            }),
          }),
        });
      });
    });

    it("calls onSettingsChange callback when settings change", async () => {
      const onSettingsChange = jest.fn();
      const user = userEvent.setup();

      render(<PopupInterface onSettingsChange={onSettingsChange} />);

      await waitFor(() => {
        expect(screen.getByText("Spotlight Extension")).toBeInTheDocument();
      });

      const masterToggle = screen.getByLabelText(
        "Enable or disable the entire extension"
      );
      await user.click(masterToggle);

      await waitFor(() => {
        expect(onSettingsChange).toHaveBeenCalledWith(
          expect.objectContaining({
            enabled: false,
          })
        );
      });
    });
  });

  describe("Performance Level Calculation", () => {
    it("calculates low performance level with few features enabled", async () => {
      const lowPerfSettings = {
        ...defaultSettings,
        features: {
          ...defaultSettings.features,
          networkMonitoring: true,
          domObservation: false,
          contextCollection: false,
          pluginIntegration: false,
          interactionTracking: false,
        },
      };

      mockChrome.storage.sync.get.mockResolvedValue({
        monitoringSettings: lowPerfSettings,
      });

      render(<PopupInterface />);

      await waitFor(() => {
        expect(screen.getByText("Low")).toBeInTheDocument();
      });
    });

    it("calculates medium performance level with moderate features enabled", async () => {
      const mediumPerfSettings = {
        ...defaultSettings,
        features: {
          ...defaultSettings.features,
          networkMonitoring: true,
          domObservation: true,
          contextCollection: true,
          pluginIntegration: false,
          interactionTracking: false,
        },
      };

      mockChrome.storage.sync.get.mockResolvedValue({
        monitoringSettings: mediumPerfSettings,
      });

      render(<PopupInterface />);

      await waitFor(() => {
        expect(screen.getByText("Medium")).toBeInTheDocument();
      });
    });

    it("calculates high performance level with all features enabled", async () => {
      render(<PopupInterface />);

      await waitFor(() => {
        expect(screen.getByText("High")).toBeInTheDocument();
      });
    });

    it("updates performance level when features are toggled", async () => {
      const user = userEvent.setup();
      render(<PopupInterface />);

      await waitFor(() => {
        expect(screen.getByText("High")).toBeInTheDocument();
      });

      // Disable some features to reduce performance level to medium (3 features enabled)
      const networkToggle = screen.getByLabelText("Toggle Network Monitoring");
      const domToggle = screen.getByLabelText("Toggle DOM Observation");

      await user.click(networkToggle);
      await user.click(domToggle);

      await waitFor(() => {
        expect(screen.getByText("Medium")).toBeInTheDocument();
      });
    });
  });

  describe("Privacy Settings", () => {
    it("opens Chrome options page when privacy button is clicked", async () => {
      const user = userEvent.setup();
      render(<PopupInterface />);

      await waitFor(() => {
        expect(screen.getByText("Spotlight Extension")).toBeInTheDocument();
      });

      const privacyButton = screen.getByLabelText("Open privacy settings");
      await user.click(privacyButton);

      expect(mockChrome.runtime.openOptionsPage).toHaveBeenCalled();
    });

    it("calls onPrivacySettingsClick callback when provided", async () => {
      const onPrivacySettingsClick = jest.fn();
      const user = userEvent.setup();

      render(
        <PopupInterface onPrivacySettingsClick={onPrivacySettingsClick} />
      );

      await waitFor(() => {
        expect(screen.getByText("Spotlight Extension")).toBeInTheDocument();
      });

      const privacyButton = screen.getByLabelText("Open privacy settings");
      await user.click(privacyButton);

      expect(onPrivacySettingsClick).toHaveBeenCalled();
      expect(mockChrome.runtime.openOptionsPage).not.toHaveBeenCalled();
    });
  });

  describe("Content Script Communication", () => {
    it("sends settings update message to active tab", async () => {
      const user = userEvent.setup();
      render(<PopupInterface />);

      await waitFor(() => {
        expect(screen.getByText("Spotlight Extension")).toBeInTheDocument();
      });

      const masterToggle = screen.getByLabelText(
        "Enable or disable the entire extension"
      );
      await user.click(masterToggle);

      await waitFor(() => {
        expect(mockChrome.tabs.query).toHaveBeenCalledWith({
          active: true,
          currentWindow: true,
        });
        expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            type: "SETTINGS_UPDATED",
            settings: expect.any(Object),
          })
        );
      });
    });

    it("handles content script communication errors gracefully", async () => {
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error("Tab not found"));

      const user = userEvent.setup();
      render(<PopupInterface />);

      await waitFor(() => {
        expect(screen.getByText("Spotlight Extension")).toBeInTheDocument();
      });

      const masterToggle = screen.getByLabelText(
        "Enable or disable the entire extension"
      );
      await user.click(masterToggle);

      // Should not throw error
      await waitFor(() => {
        expect(mockChrome.storage.sync.set).toHaveBeenCalled();
      });
    });
  });

  describe("Storage Change Listener", () => {
    it("listens for storage changes and updates settings", async () => {
      let storageChangeListener: Function;

      mockChrome.storage.onChanged.addListener.mockImplementation(
        (listener) => {
          storageChangeListener = listener;
        }
      );

      render(<PopupInterface />);

      await waitFor(() => {
        expect(mockChrome.storage.onChanged.addListener).toHaveBeenCalled();
      });

      // Simulate storage change
      const newSettings = { ...defaultSettings, enabled: false };
      storageChangeListener(
        { monitoringSettings: { newValue: newSettings } },
        "sync"
      );

      await waitFor(() => {
        expect(screen.getByText("Inactive")).toBeInTheDocument();
      });
    });

    it("removes storage change listener on unmount", () => {
      const { unmount } = render(<PopupInterface />);

      unmount();

      expect(mockChrome.storage.onChanged.removeListener).toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels for interactive elements", async () => {
      render(<PopupInterface />);

      await waitFor(() => {
        expect(
          screen.getByLabelText("Open privacy settings")
        ).toBeInTheDocument();
      });
    });

    it("supports keyboard navigation", async () => {
      const user = userEvent.setup();
      render(<PopupInterface />);

      await waitFor(() => {
        expect(screen.getByText("Spotlight Extension")).toBeInTheDocument();
      });

      const privacyButton = screen.getByLabelText("Open privacy settings");

      // Focus and activate with keyboard
      privacyButton.focus();
      expect(privacyButton).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(mockChrome.runtime.openOptionsPage).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("handles missing Chrome APIs gracefully", async () => {
      // @ts-ignore
      global.chrome = undefined;

      render(<PopupInterface />);

      // Should render without crashing
      await waitFor(() => {
        expect(screen.getByText("Spotlight Extension")).toBeInTheDocument();
      });

      // Restore chrome mock
      // @ts-ignore
      global.chrome = mockChrome;
    });

    it("handles empty storage response", async () => {
      mockChrome.storage.sync.get.mockResolvedValue({});

      render(<PopupInterface />);

      await waitFor(() => {
        expect(screen.getByText("Spotlight Extension")).toBeInTheDocument();
      });

      // Should use default settings
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });
});
