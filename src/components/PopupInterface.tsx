import React, { useState, useEffect, useCallback } from "react";
import { FeatureToggles, FeatureConfig } from "./FeatureToggles";
import "./PopupInterface.css";

export interface PopupSettings {
  enabled: boolean;
  features: FeatureConfig;
  performanceLevel: "low" | "medium" | "high";
}

export interface PopupInterfaceProps {
  onSettingsChange?: (settings: PopupSettings) => void;
  onPrivacySettingsClick?: () => void;
}

export const PopupInterface: React.FC<PopupInterfaceProps> = ({
  onSettingsChange,
  onPrivacySettingsClick,
}) => {
  const [settings, setSettings] = useState<PopupSettings>({
    enabled: true,
    features: {
      networkMonitoring: true,
      domObservation: true,
      contextCollection: true,
      pluginIntegration: true,
      interactionTracking: true,
    },
    performanceLevel: "high", // 5 features enabled = high performance
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate performance level based on enabled features
  const calculatePerformanceLevel = useCallback(
    (enabled: boolean, features: FeatureConfig): "low" | "medium" | "high" => {
      if (!enabled) return "low";

      const enabledCount = Object.values(features).filter(Boolean).length;

      if (enabledCount <= 2) return "low";
      if (enabledCount <= 4) return "medium";
      return "high";
    },
    []
  );

  // Load settings from Chrome storage
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (typeof chrome !== "undefined" && chrome.storage) {
        const result = await chrome.storage.sync.get(["monitoringSettings"]);
        if (result.monitoringSettings) {
          const loadedSettings = result.monitoringSettings;
          const calculatedPerformanceLevel = calculatePerformanceLevel(
            loadedSettings.enabled ?? true,
            loadedSettings.features ?? {
              networkMonitoring: true,
              domObservation: true,
              contextCollection: true,
              pluginIntegration: true,
              interactionTracking: true,
            }
          );

          setSettings((prevSettings) => ({
            ...prevSettings,
            ...loadedSettings,
            performanceLevel: calculatedPerformanceLevel,
          }));
        }
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }, [calculatePerformanceLevel]);

  // Save settings to Chrome storage
  const saveSettings = useCallback(
    async (newSettings: PopupSettings) => {
      try {
        if (typeof chrome !== "undefined" && chrome.storage) {
          await chrome.storage.sync.set({ monitoringSettings: newSettings });

          // Notify content scripts
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (tabs[0]) {
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
      } catch (err) {
        console.error("Failed to save settings:", err);
        setError("Failed to save settings");
      }
    },
    [onSettingsChange]
  );

  // Handle master toggle
  const handleMasterToggle = useCallback(
    async (enabled: boolean) => {
      const newSettings = {
        ...settings,
        enabled,
        performanceLevel: calculatePerformanceLevel(enabled, settings.features),
      };

      setSettings(newSettings);
      await saveSettings(newSettings);
    },
    [settings, calculatePerformanceLevel, saveSettings]
  );

  // Handle feature toggle
  const handleFeatureToggle = useCallback(
    async (feature: keyof FeatureConfig, enabled: boolean) => {
      const newFeatures = {
        ...settings.features,
        [feature]: enabled,
      };

      const newSettings = {
        ...settings,
        features: newFeatures,
        performanceLevel: calculatePerformanceLevel(
          settings.enabled,
          newFeatures
        ),
      };

      setSettings(newSettings);
      await saveSettings(newSettings);
    },
    [settings, calculatePerformanceLevel, saveSettings]
  );

  // Handle privacy settings click
  const handlePrivacySettingsClick = useCallback(() => {
    if (onPrivacySettingsClick) {
      onPrivacySettingsClick();
    } else if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.openOptionsPage();
    }
  }, [onPrivacySettingsClick]);

  // Load settings on mount and save defaults if none exist
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (typeof chrome !== "undefined" && chrome.storage) {
          const result = await chrome.storage.sync.get(["monitoringSettings"]);

          if (result.monitoringSettings) {
            // Settings exist, load them
            const loadedSettings = result.monitoringSettings;
            const calculatedPerformanceLevel = calculatePerformanceLevel(
              loadedSettings.enabled ?? true,
              loadedSettings.features ?? {
                networkMonitoring: true,
                domObservation: true,
                contextCollection: true,
                pluginIntegration: true,
                interactionTracking: true,
              }
            );

            setSettings((prevSettings) => ({
              ...prevSettings,
              ...loadedSettings,
              performanceLevel: calculatedPerformanceLevel,
            }));
          } else {
            // No settings exist, save and set defaults
            console.log("No monitoring settings found, saving defaults");
            const defaultSettings = {
              enabled: true,
              features: {
                networkMonitoring: true,
                domObservation: true,
                contextCollection: true,
                pluginIntegration: true,
                interactionTracking: true,
              },
              performanceLevel: "high" as const,
            };

            await chrome.storage.sync.set({
              monitoringSettings: defaultSettings,
            });
            setSettings(defaultSettings);

            // Notify content scripts about the new settings
            try {
              const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true,
              });
              if (tabs[0]) {
                chrome.tabs
                  .sendMessage(tabs[0].id, {
                    type: "SETTINGS_UPDATED",
                    settings: defaultSettings,
                  })
                  .catch(() => {
                    // Content script might not be ready, that's okay
                  });
              }
            } catch (tabError) {
              console.warn("Failed to notify content script:", tabError);
            }
          }
        }
      } catch (err) {
        console.error("Failed to initialize settings:", err);
        setError("Failed to load settings");
      } finally {
        setIsLoading(false);
      }
    };

    initializeSettings();
  }, [calculatePerformanceLevel]);

  // Listen for storage changes
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage) return;

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      namespace: string
    ) => {
      if (namespace === "sync" && changes.monitoringSettings) {
        setSettings(changes.monitoringSettings.newValue);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="popup-interface loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="popup-interface error">
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={loadSettings} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-interface">
      <FeatureToggles
        enabled={settings.enabled}
        features={settings.features}
        onMasterToggle={handleMasterToggle}
        onFeatureToggle={handleFeatureToggle}
        performanceLevel={settings.performanceLevel}
      />

      <div className="popup-actions">
        <button
          className="privacy-button"
          onClick={handlePrivacySettingsClick}
          aria-label="Open privacy settings"
        >
          <span className="button-icon">🔒</span>
          <span className="button-text">Privacy Settings</span>
          <span className="button-arrow">→</span>
        </button>
      </div>
    </div>
  );
};

export default PopupInterface;
