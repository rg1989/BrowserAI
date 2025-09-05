import React, { useState, useEffect, useCallback } from "react";
import "./SettingsManager.css";

export interface PrivacyConfig {
  excludedDomains: string[];
  excludedPaths: string[];
  redactSensitiveData: boolean;
  sensitiveDataPatterns: string[];
  dataRetentionDays: number;
}

export interface MonitoringSettings {
  enabled: boolean;
  features: {
    networkMonitoring: boolean;
    domObservation: boolean;
    contextCollection: boolean;
    pluginIntegration: boolean;
    interactionTracking: boolean;
  };
  privacy: PrivacyConfig;
  performanceLevel: "low" | "medium" | "high";
}

export interface SettingsManagerProps {
  onSettingsChange?: (settings: MonitoringSettings) => void;
  onClose?: () => void;
}

const DEFAULT_SETTINGS: MonitoringSettings = {
  enabled: true,
  features: {
    networkMonitoring: true,
    domObservation: true,
    contextCollection: true,
    pluginIntegration: true,
    interactionTracking: true,
  },
  privacy: {
    excludedDomains: [],
    excludedPaths: [],
    redactSensitiveData: true,
    sensitiveDataPatterns: [
      "password",
      "token",
      "key",
      "secret",
      "auth",
      "credential",
    ],
    dataRetentionDays: 7,
  },
  performanceLevel: "high",
};

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  onSettingsChange,
  onClose,
}) => {
  const [settings, setSettings] =
    useState<MonitoringSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load settings from Chrome storage
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (typeof chrome !== "undefined" && chrome.storage) {
        const result = await chrome.storage.sync.get(["monitoringSettings"]);
        if (result.monitoringSettings) {
          setSettings((prevSettings) => ({
            ...prevSettings,
            ...result.monitoringSettings,
          }));
        }
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save settings to Chrome storage
  const saveSettings = useCallback(
    async (newSettings: MonitoringSettings) => {
      try {
        if (typeof chrome !== "undefined" && chrome.storage) {
          await chrome.storage.sync.set({ monitoringSettings: newSettings });

          // Notify content scripts
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (tabs[0]?.id) {
            chrome.tabs
              .sendMessage(tabs[0].id, {
                type: "SETTINGS_UPDATED",
                settings: newSettings,
              })
              .catch(() => {
                // Content script might not be ready, that's okay
              });
          }
        }

        onSettingsChange?.(newSettings);
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Failed to save settings:", err);
        setError("Failed to save settings");
      }
    },
    [onSettingsChange]
  );

  // Handle settings change
  const handleSettingsChange = useCallback(
    (newSettings: MonitoringSettings) => {
      setSettings(newSettings);
      setHasUnsavedChanges(true);
    },
    []
  );

  // Handle save button click
  const handleSave = useCallback(async () => {
    await saveSettings(settings);
  }, [settings, saveSettings]);

  // Handle reset to defaults
  const handleReset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setHasUnsavedChanges(true);
  }, []);

  // Handle export settings
  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "spotlight-extension-settings.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }, [settings]);

  // Handle import settings
  const handleImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target?.result as string);

          // Validate imported settings structure
          if (importedSettings && typeof importedSettings === "object") {
            setSettings((prevSettings) => ({
              ...prevSettings,
              ...importedSettings,
            }));
            setHasUnsavedChanges(true);
          } else {
            setError("Invalid settings file format");
          }
        } catch (err) {
          setError("Failed to parse settings file");
        }
      };

      reader.readAsText(file);

      // Reset file input
      event.target.value = "";
    },
    []
  );

  // Handle clear all data
  const handleClearData = useCallback(async () => {
    if (
      !confirm(
        "Are you sure you want to clear all monitoring data? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.local.clear();

        // Notify content scripts to clear their data
        const tabs = await chrome.tabs.query({});
        tabs.forEach((tab) => {
          if (tab.id !== undefined) {
            chrome.tabs
              .sendMessage(tab.id, {
                type: "CLEAR_MONITORING_DATA",
              })
              .catch(() => {
                // Content script might not be loaded, that's okay
              });
          }
        });
      }

      alert("All monitoring data has been cleared.");
    } catch (err) {
      console.error("Failed to clear data:", err);
      setError("Failed to clear monitoring data");
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case "s":
            event.preventDefault();
            if (hasUnsavedChanges) {
              handleSave();
            }
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [hasUnsavedChanges, handleSave, onClose]);

  if (isLoading) {
    return (
      <div className="settings-manager loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-manager">
      <header className="settings-header">
        <h1 className="settings-title">Extension Settings</h1>
        <button
          className="close-button"
          onClick={onClose}
          aria-label="Close settings"
        >
          ×
        </button>
      </header>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
          <button
            className="error-dismiss"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <div className="settings-content">
        <section className="settings-section">
          <h2 className="section-title">Data Management</h2>

          <div className="setting-group">
            <label className="setting-label">
              Data Retention Period
              <select
                className="setting-select"
                value={settings.privacy.dataRetentionDays}
                onChange={(e) =>
                  handleSettingsChange({
                    ...settings,
                    privacy: {
                      ...settings.privacy,
                      dataRetentionDays: parseInt(e.target.value),
                    },
                  })
                }
              >
                <option value={1}>1 day</option>
                <option value={3}>3 days</option>
                <option value={7}>1 week</option>
                <option value={14}>2 weeks</option>
                <option value={30}>1 month</option>
              </select>
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings.privacy.redactSensitiveData}
                onChange={(e) =>
                  handleSettingsChange({
                    ...settings,
                    privacy: {
                      ...settings.privacy,
                      redactSensitiveData: e.target.checked,
                    },
                  })
                }
              />
              <span className="checkbox-label">
                Automatically redact sensitive data
              </span>
            </label>
            <p className="setting-description">
              Automatically filter out passwords, tokens, and other sensitive
              information
            </p>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="section-title">Import & Export</h2>

          <div className="setting-group">
            <div className="button-group">
              <button
                className="setting-button secondary"
                onClick={handleExport}
              >
                Export Settings
              </button>

              <label className="setting-button secondary file-input-label">
                Import Settings
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="file-input"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="settings-section danger-zone">
          <h2 className="section-title">Danger Zone</h2>

          <div className="setting-group">
            <button className="setting-button secondary" onClick={handleReset}>
              Reset to Defaults
            </button>
            <p className="setting-description">
              Reset all settings to their default values
            </p>
          </div>

          <div className="setting-group">
            <button className="setting-button danger" onClick={handleClearData}>
              Clear All Data
            </button>
            <p className="setting-description">
              Permanently delete all monitoring data and cache
            </p>
          </div>
        </section>
      </div>

      <footer className="settings-footer">
        <div className="footer-info">
          {hasUnsavedChanges && (
            <span className="unsaved-indicator">• Unsaved changes</span>
          )}
        </div>

        <div className="footer-actions">
          <button className="setting-button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="setting-button primary"
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
          >
            Save Changes
          </button>
        </div>
      </footer>
    </div>
  );
};

export default SettingsManager;
