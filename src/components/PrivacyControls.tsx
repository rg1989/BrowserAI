import React, { useState, useCallback } from "react";
import "./PrivacyControls.css";

export interface PrivacyConfig {
  excludedDomains: string[];
  excludedPaths: string[];
  redactSensitiveData: boolean;
  sensitiveDataPatterns: string[];
  dataRetentionDays: number;
}

export interface PrivacyControlsProps {
  config: PrivacyConfig;
  onConfigChange: (config: PrivacyConfig) => void;
}

export const PrivacyControls: React.FC<PrivacyControlsProps> = ({
  config,
  onConfigChange,
}) => {
  const [newDomain, setNewDomain] = useState("");
  const [newPath, setNewPath] = useState("");
  const [newPattern, setNewPattern] = useState("");

  // Handle adding excluded domain
  const handleAddDomain = useCallback(() => {
    if (!newDomain.trim()) return;

    const domain = newDomain.trim().toLowerCase();

    // Basic domain validation
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
      alert("Please enter a valid domain (e.g., example.com)");
      return;
    }

    if (config.excludedDomains.includes(domain)) {
      alert("This domain is already excluded");
      return;
    }

    onConfigChange({
      ...config,
      excludedDomains: [...config.excludedDomains, domain],
    });

    setNewDomain("");
  }, [newDomain, config, onConfigChange]);

  // Handle removing excluded domain
  const handleRemoveDomain = useCallback(
    (domain: string) => {
      onConfigChange({
        ...config,
        excludedDomains: config.excludedDomains.filter((d) => d !== domain),
      });
    },
    [config, onConfigChange]
  );

  // Handle adding excluded path
  const handleAddPath = useCallback(() => {
    if (!newPath.trim()) return;

    const path = newPath.trim();

    if (config.excludedPaths.includes(path)) {
      alert("This path pattern is already excluded");
      return;
    }

    onConfigChange({
      ...config,
      excludedPaths: [...config.excludedPaths, path],
    });

    setNewPath("");
  }, [newPath, config, onConfigChange]);

  // Handle removing excluded path
  const handleRemovePath = useCallback(
    (path: string) => {
      onConfigChange({
        ...config,
        excludedPaths: config.excludedPaths.filter((p) => p !== path),
      });
    },
    [config, onConfigChange]
  );

  // Handle adding sensitive data pattern
  const handleAddPattern = useCallback(() => {
    if (!newPattern.trim()) return;

    const pattern = newPattern.trim().toLowerCase();

    if (config.sensitiveDataPatterns.includes(pattern)) {
      alert("This pattern is already included");
      return;
    }

    onConfigChange({
      ...config,
      sensitiveDataPatterns: [...config.sensitiveDataPatterns, pattern],
    });

    setNewPattern("");
  }, [newPattern, config, onConfigChange]);

  // Handle removing sensitive data pattern
  const handleRemovePattern = useCallback(
    (pattern: string) => {
      onConfigChange({
        ...config,
        sensitiveDataPatterns: config.sensitiveDataPatterns.filter(
          (p) => p !== pattern
        ),
      });
    },
    [config, onConfigChange]
  );

  // Handle redact sensitive data toggle
  const handleRedactToggle = useCallback(
    (enabled: boolean) => {
      onConfigChange({
        ...config,
        redactSensitiveData: enabled,
      });
    },
    [config, onConfigChange]
  );

  // Handle data retention change
  const handleRetentionChange = useCallback(
    (days: number) => {
      onConfigChange({
        ...config,
        dataRetentionDays: days,
      });
    },
    [config, onConfigChange]
  );

  // Handle keyboard events for input fields
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>, action: () => void) => {
      if (event.key === "Enter") {
        event.preventDefault();
        action();
      }
    },
    []
  );

  return (
    <div className="privacy-controls">
      <section className="privacy-section">
        <h3 className="section-title">Excluded Domains</h3>
        <p className="section-description">
          Domains where monitoring will be completely disabled
        </p>

        <div className="input-group">
          <input
            type="text"
            className="privacy-input"
            placeholder="example.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, handleAddDomain)}
            aria-label="Add excluded domain"
          />
          <button
            className="add-button"
            onClick={handleAddDomain}
            disabled={!newDomain.trim()}
            aria-label="Add domain to exclusion list"
          >
            Add
          </button>
        </div>

        <div className="tag-list">
          {config.excludedDomains.map((domain) => (
            <div key={domain} className="tag">
              <span className="tag-text">{domain}</span>
              <button
                className="tag-remove"
                onClick={() => handleRemoveDomain(domain)}
                aria-label={`Remove ${domain} from exclusion list`}
              >
                ×
              </button>
            </div>
          ))}
          {config.excludedDomains.length === 0 && (
            <p className="empty-state">No domains excluded</p>
          )}
        </div>
      </section>

      <section className="privacy-section">
        <h3 className="section-title">Excluded URL Patterns</h3>
        <p className="section-description">
          URL patterns where monitoring will be disabled (supports wildcards)
        </p>

        <div className="input-group">
          <input
            type="text"
            className="privacy-input"
            placeholder="/admin/* or */login"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, handleAddPath)}
            aria-label="Add excluded URL pattern"
          />
          <button
            className="add-button"
            onClick={handleAddPath}
            disabled={!newPath.trim()}
            aria-label="Add URL pattern to exclusion list"
          >
            Add
          </button>
        </div>

        <div className="tag-list">
          {config.excludedPaths.map((path) => (
            <div key={path} className="tag">
              <span className="tag-text">{path}</span>
              <button
                className="tag-remove"
                onClick={() => handleRemovePath(path)}
                aria-label={`Remove ${path} from exclusion list`}
              >
                ×
              </button>
            </div>
          ))}
          {config.excludedPaths.length === 0 && (
            <p className="empty-state">No URL patterns excluded</p>
          )}
        </div>
      </section>

      <section className="privacy-section">
        <h3 className="section-title">Sensitive Data Protection</h3>

        <div className="setting-group">
          <label className="privacy-checkbox">
            <input
              type="checkbox"
              checked={config.redactSensitiveData}
              onChange={(e) => handleRedactToggle(e.target.checked)}
            />
            <span className="checkbox-label">
              Automatically redact sensitive data
            </span>
          </label>
          <p className="setting-description">
            Automatically filter out data matching sensitive patterns
          </p>
        </div>

        {config.redactSensitiveData && (
          <div className="subsection">
            <h4 className="subsection-title">Sensitive Data Patterns</h4>
            <p className="section-description">
              Keywords that will trigger data redaction (case-insensitive)
            </p>

            <div className="input-group">
              <input
                type="text"
                className="privacy-input"
                placeholder="password, token, secret..."
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleAddPattern)}
                aria-label="Add sensitive data pattern"
              />
              <button
                className="add-button"
                onClick={handleAddPattern}
                disabled={!newPattern.trim()}
                aria-label="Add pattern to sensitive data list"
              >
                Add
              </button>
            </div>

            <div className="tag-list">
              {config.sensitiveDataPatterns.map((pattern) => (
                <div key={pattern} className="tag">
                  <span className="tag-text">{pattern}</span>
                  <button
                    className="tag-remove"
                    onClick={() => handleRemovePattern(pattern)}
                    aria-label={`Remove ${pattern} from sensitive patterns`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="privacy-section">
        <h3 className="section-title">Data Retention</h3>
        <p className="section-description">
          How long monitoring data is kept before automatic deletion
        </p>

        <div className="setting-group">
          <label className="retention-label">
            Retention Period
            <select
              className="retention-select"
              value={config.dataRetentionDays}
              onChange={(e) => handleRetentionChange(parseInt(e.target.value))}
              aria-label="Select data retention period"
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>1 week</option>
              <option value={14}>2 weeks</option>
              <option value={30}>1 month</option>
              <option value={90}>3 months</option>
            </select>
          </label>
        </div>

        <div className="retention-info">
          <p className="info-text">
            Data older than {config.dataRetentionDays} day
            {config.dataRetentionDays !== 1 ? "s" : ""} will be automatically
            deleted.
          </p>
        </div>
      </section>
    </div>
  );
};

export default PrivacyControls;
