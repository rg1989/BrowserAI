import React, { useState, useEffect, useCallback } from "react";
import "./FeatureToggles.css";

export interface FeatureConfig {
  networkMonitoring: boolean;
  domObservation: boolean;
  contextCollection: boolean;
  pluginIntegration: boolean;
  interactionTracking: boolean;
}

export interface FeatureToggleProps {
  enabled: boolean;
  features: FeatureConfig;
  onMasterToggle: (enabled: boolean) => void;
  onFeatureToggle: (feature: keyof FeatureConfig, enabled: boolean) => void;
  performanceLevel: "low" | "medium" | "high";
}

interface FeatureDefinition {
  key: keyof FeatureConfig;
  label: string;
  description: string;
  id: string;
}

const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    key: "networkMonitoring",
    label: "Network Monitoring",
    description: "Track API calls and network requests",
    id: "network-monitoring",
  },
  {
    key: "domObservation",
    label: "DOM Observation",
    description: "Monitor page changes and interactions",
    id: "dom-observation",
  },
  {
    key: "contextCollection",
    label: "Context Collection",
    description: "Analyze page content and structure",
    id: "context-collection",
  },
  {
    key: "pluginIntegration",
    label: "Plugin Integration",
    description: "Enhanced context from compatible sites",
    id: "plugin-integration",
  },
  {
    key: "interactionTracking",
    label: "Interaction Tracking",
    description: "Monitor user interactions and form usage",
    id: "interaction-tracking",
  },
];

export const FeatureToggles: React.FC<FeatureToggleProps> = ({
  enabled,
  features,
  onMasterToggle,
  onFeatureToggle,
  performanceLevel,
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleMasterToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newEnabled = event.target.checked;
      setIsTransitioning(true);
      onMasterToggle(newEnabled);

      // Reset transition state after animation
      setTimeout(() => setIsTransitioning(false), 300);
    },
    [onMasterToggle]
  );

  const handleFeatureToggle = useCallback(
    (feature: keyof FeatureConfig) => {
      return (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!enabled) return; // Prevent toggling when master is disabled

        const newEnabled = event.target.checked;
        onFeatureToggle(feature, newEnabled);
      };
    },
    [enabled, onFeatureToggle]
  );

  const getStatusText = useCallback(() => {
    if (!enabled) return "Inactive";

    const enabledCount = Object.values(features).filter(Boolean).length;
    const totalCount = Object.keys(features).length;

    if (enabledCount === totalCount) return "Active";
    if (enabledCount === 0) return "Monitoring Disabled";
    return `${enabledCount}/${totalCount} Features Active`;
  }, [enabled, features]);

  const getPerformanceLevelClass = useCallback(() => {
    return `performance-level ${performanceLevel}`;
  }, [performanceLevel]);

  const getPerformanceLevelText = useCallback(() => {
    switch (performanceLevel) {
      case "low":
        return "Low";
      case "medium":
        return "Medium";
      case "high":
        return "High";
      default:
        return "Unknown";
    }
  }, [performanceLevel]);

  return (
    <div
      className={`feature-toggles ${!enabled ? "disabled" : ""} ${
        isTransitioning ? "transitioning" : ""
      }`}
    >
      {/* Status Header */}
      <header className="toggles-header">
        <h1 className="toggles-title">Spotlight Extension</h1>
        <div className="status-indicator">
          <span className={`status-dot ${!enabled ? "inactive" : ""}`}></span>
          <span className="status-text">{getStatusText()}</span>
        </div>
      </header>

      {/* Master Control */}
      <section className="master-control">
        <div className="control-group">
          <label className="toggle-label" htmlFor="master-toggle">
            <span className="label-text">Enable Extension</span>
            <div className="toggle-switch">
              <input
                type="checkbox"
                id="master-toggle"
                className="toggle-input"
                checked={enabled}
                onChange={handleMasterToggle}
                aria-label="Enable or disable the entire extension"
              />
              <span className="toggle-slider"></span>
            </div>
          </label>
        </div>
      </section>

      {/* Feature Controls */}
      <section className="feature-controls">
        {FEATURE_DEFINITIONS.map((feature) => (
          <div key={feature.key} className="control-group">
            <label
              className={`toggle-label ${!enabled ? "disabled" : ""}`}
              htmlFor={feature.id}
            >
              <div className="feature-info">
                <span className="label-text">{feature.label}</span>
                <span className="feature-description">
                  {feature.description}
                </span>
              </div>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  id={feature.id}
                  className="toggle-input feature-toggle"
                  data-feature={feature.key}
                  checked={features[feature.key]}
                  disabled={!enabled}
                  onChange={handleFeatureToggle(feature.key)}
                  aria-label={`Toggle ${feature.label}`}
                  aria-describedby={`${feature.id}-description`}
                />
                <span className="toggle-slider"></span>
              </div>
            </label>
            <div id={`${feature.id}-description`} className="sr-only">
              {feature.description}
            </div>
          </div>
        ))}
      </section>

      {/* Performance Indicator */}
      <footer className="toggles-footer">
        <div className="performance-indicator">
          <span className="performance-label">Performance Impact:</span>
          <span className={getPerformanceLevelClass()}>
            {getPerformanceLevelText()}
          </span>
        </div>
      </footer>
    </div>
  );
};

export default FeatureToggles;
