/**
 * Privacy Controller for managing user consent, data retention, and privacy compliance
 * Implements GDPR and privacy-by-design principles
 */

import { PrivacyConfig, ConsentStatus, DataRetentionPolicy, PrivacySettings } from "../types/privacy";

export class PrivacyController {
  private config: PrivacyConfig;
  private consentStatus: ConsentStatus;
  private retentionPolicies: Map<string, DataRetentionPolicy> = new Map();

  constructor(config: PrivacyConfig) {
    this.config = config;
    this.consentStatus = {
      networkMonitoring: false,
      domObservation: false,
      contextCollection: false,
      dataStorage: false,
      consentTimestamp: null,
      consentVersion: "1.0.0"
    };
    this.initializeRetentionPolicies();
  }

  /**
   * Initialize user consent and check existing consent status
   */
  async initializeConsent(): Promise<ConsentStatus> {
    try {
      const stored = await chrome.storage.sync.get(['privacyConsent']);
      if (stored.privacyConsent) {
        this.consentStatus = stored.privacyConsent;

        // Check if consent needs renewal (older than 1 year)
        if (this.isConsentExpired()) {
          await this.requestConsentRenewal();
        }
      } else {
        // First time user - show privacy disclosure
        await this.showPrivacyDisclosure();
      }

      return this.consentStatus;
    } catch (error) {
      console.error("Failed to initialize consent:", error);
      return this.consentStatus;
    }
  }

  /**
   * Show privacy disclosure and request user consent
   */
  async showPrivacyDisclosure(): Promise<boolean> {
    return new Promise((resolve) => {
      // Create privacy disclosure modal
      const modal = this.createPrivacyModal();
      document.body.appendChild(modal);

      const acceptBtn = modal.querySelector('#privacy-accept') as HTMLButtonElement;
      const declineBtn = modal.querySelector('#privacy-decline') as HTMLButtonElement;
      const customizeBtn = modal.querySelector('#privacy-customize') as HTMLButtonElement;

      acceptBtn?.addEventListener('click', async () => {
        await this.grantFullConsent();
        document.body.removeChild(modal);
        resolve(true);
      });

      declineBtn?.addEventListener('click', async () => {
        await this.declineAllConsent();
        document.body.removeChild(modal);
        resolve(false);
      });

      customizeBtn?.addEventListener('click', () => {
        this.showCustomConsentDialog(modal, resolve);
      });
    });
  }

  /**
   * Create privacy disclosure modal
   */
  private createPrivacyModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'spotlight-privacy-modal';
    modal.innerHTML = `
      <div class="privacy-modal-overlay">
        <div class="privacy-modal-content">
          <h2>Privacy & Data Collection Notice</h2>
          
          <div class="privacy-section">
            <h3>What We Monitor</h3>
            <ul>
              <li><strong>Network Activity:</strong> HTTP requests and responses to understand page data flows</li>
              <li><strong>Page Content:</strong> Visible text, forms, and page structure for context awareness</li>
              <li><strong>User Interactions:</strong> Clicks, form submissions, and navigation for better assistance</li>
              <li><strong>DOM Changes:</strong> Dynamic content updates and layout changes</li>
            </ul>
          </div>

          <div class="privacy-section">
            <h3>How We Protect Your Privacy</h3>
            <ul>
              <li>All data is stored locally on your device</li>
              <li>Sensitive information (passwords, tokens) is automatically filtered</li>
              <li>You can exclude specific websites from monitoring</li>
              <li>Data is automatically deleted after ${this.config.dataRetentionDays} days</li>
              <li>You can export or delete your data at any time</li>
            </ul>
          </div>

          <div class="privacy-section">
            <h3>Your Choices</h3>
            <p>You can customize which features to enable and change your preferences at any time through the extension settings.</p>
          </div>

          <div class="privacy-actions">
            <button id="privacy-accept" class="btn-primary">Accept All</button>
            <button id="privacy-customize" class="btn-secondary">Customize Settings</button>
            <button id="privacy-decline" class="btn-tertiary">Decline All</button>
          </div>

          <div class="privacy-footer">
            <p><small>By using this extension, you agree to our privacy practices. You can change these settings at any time.</small></p>
          </div>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .spotlight-privacy-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .privacy-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .privacy-modal-content {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      }
      
      .privacy-modal-content h2 {
        margin: 0 0 20px 0;
        color: #333;
        font-size: 24px;
      }
      
      .privacy-modal-content h3 {
        margin: 16px 0 8px 0;
        color: #555;
        font-size: 18px;
      }
      
      .privacy-section {
        margin-bottom: 20px;
      }
      
      .privacy-section ul {
        margin: 8px 0;
        padding-left: 20px;
      }
      
      .privacy-section li {
        margin-bottom: 8px;
        line-height: 1.4;
      }
      
      .privacy-actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
        flex-wrap: wrap;
      }
      
      .privacy-actions button {
        padding: 12px 24px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .btn-primary {
        background: #007AFF;
        color: white;
      }
      
      .btn-primary:hover {
        background: #0056CC;
      }
      
      .btn-secondary {
        background: #F2F2F7;
        color: #007AFF;
      }
      
      .btn-secondary:hover {
        background: #E5E5EA;
      }
      
      .btn-tertiary {
        background: transparent;
        color: #666;
        border: 1px solid #ddd;
      }
      
      .btn-tertiary:hover {
        background: #f5f5f5;
      }
      
      .privacy-footer {
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid #eee;
        color: #666;
        font-size: 12px;
      }
    `;
    modal.appendChild(style);

    return modal;
  }

  /**
   * Show custom consent dialog for granular permissions
   */
  private showCustomConsentDialog(parentModal: HTMLElement, resolve: (value: boolean) => void): void {
    const customModal = document.createElement('div');
    customModal.className = 'spotlight-custom-consent';
    customModal.innerHTML = `
      <div class="custom-consent-content">
        <h3>Customize Privacy Settings</h3>
        
        <div class="consent-option">
          <label>
            <input type="checkbox" id="consent-network" checked>
            <span class="consent-label">Network Monitoring</span>
            <p class="consent-description">Monitor HTTP requests to understand data flows and API interactions</p>
          </label>
        </div>
        
        <div class="consent-option">
          <label>
            <input type="checkbox" id="consent-dom" checked>
            <span class="consent-label">Page Content Analysis</span>
            <p class="consent-description">Analyze page structure and content for contextual assistance</p>
          </label>
        </div>
        
        <div class="consent-option">
          <label>
            <input type="checkbox" id="consent-interactions" checked>
            <span class="consent-label">User Interaction Tracking</span>
            <p class="consent-description">Track clicks and form interactions for better AI assistance</p>
          </label>
        </div>
        
        <div class="consent-option">
          <label>
            <input type="checkbox" id="consent-storage" checked>
            <span class="consent-label">Local Data Storage</span>
            <p class="consent-description">Store monitoring data locally for improved performance</p>
          </label>
        </div>
        
        <div class="custom-consent-actions">
          <button id="custom-save" class="btn-primary">Save Preferences</button>
          <button id="custom-cancel" class="btn-secondary">Cancel</button>
        </div>
      </div>
    `;

    // Add custom consent styles
    const style = document.createElement('style');
    style.textContent = `
      .spotlight-custom-consent {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .custom-consent-content {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
      }
      
      .consent-option {
        margin-bottom: 20px;
        padding: 16px;
        border: 1px solid #eee;
        border-radius: 8px;
      }
      
      .consent-option label {
        display: block;
        cursor: pointer;
      }
      
      .consent-option input[type="checkbox"] {
        margin-right: 12px;
        transform: scale(1.2);
      }
      
      .consent-label {
        font-weight: 500;
        color: #333;
      }
      
      .consent-description {
        margin: 8px 0 0 24px;
        color: #666;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .custom-consent-actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
      }
    `;
    customModal.appendChild(style);

    parentModal.appendChild(customModal);

    const saveBtn = customModal.querySelector('#custom-save') as HTMLButtonElement;
    const cancelBtn = customModal.querySelector('#custom-cancel') as HTMLButtonElement;

    saveBtn?.addEventListener('click', async () => {
      const networkConsent = (customModal.querySelector('#consent-network') as HTMLInputElement).checked;
      const domConsent = (customModal.querySelector('#consent-dom') as HTMLInputElement).checked;
      const interactionConsent = (customModal.querySelector('#consent-interactions') as HTMLInputElement).checked;
      const storageConsent = (customModal.querySelector('#consent-storage') as HTMLInputElement).checked;

      await this.setCustomConsent({
        networkMonitoring: networkConsent,
        domObservation: domConsent,
        contextCollection: interactionConsent,
        dataStorage: storageConsent
      });

      document.body.removeChild(parentModal);
      resolve(true);
    });

    cancelBtn?.addEventListener('click', () => {
      parentModal.removeChild(customModal);
    });
  }

  /**
   * Grant full consent for all features
   */
  async grantFullConsent(): Promise<void> {
    this.consentStatus = {
      networkMonitoring: true,
      domObservation: true,
      contextCollection: true,
      dataStorage: true,
      consentTimestamp: new Date(),
      consentVersion: "1.0.0"
    };

    await this.saveConsentStatus();
  }

  /**
   * Decline all consent
   */
  async declineAllConsent(): Promise<void> {
    this.consentStatus = {
      networkMonitoring: false,
      domObservation: false,
      contextCollection: false,
      dataStorage: false,
      consentTimestamp: new Date(),
      consentVersion: "1.0.0"
    };

    await this.saveConsentStatus();
  }

  /**
   * Set custom consent preferences
   */
  async setCustomConsent(preferences: Partial<ConsentStatus>): Promise<void> {
    this.consentStatus = {
      ...this.consentStatus,
      ...preferences,
      consentTimestamp: new Date(),
      consentVersion: "1.0.0"
    };

    await this.saveConsentStatus();
  }

  /**
   * Save consent status to storage
   */
  private async saveConsentStatus(): Promise<void> {
    try {
      await chrome.storage.sync.set({
        privacyConsent: this.consentStatus
      });
    } catch (error) {
      console.error("Failed to save consent status:", error);
    }
  }

  /**
   * Check if consent has expired (older than 1 year)
   */
  private isConsentExpired(): boolean {
    if (!this.consentStatus.consentTimestamp) return true;

    const consentDate = new Date(this.consentStatus.consentTimestamp);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    return consentDate < oneYearAgo;
  }

  /**
   * Request consent renewal
   */
  private async requestConsentRenewal(): Promise<void> {
    // Reset consent and show disclosure again
    this.consentStatus.consentTimestamp = null;
    await this.showPrivacyDisclosure();
  }

  /**
   * Initialize data retention policies
   */
  private initializeRetentionPolicies(): void {
    // Network data retention
    this.retentionPolicies.set('network', {
      dataType: 'network',
      retentionDays: this.config.dataRetentionDays,
      cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
      compressionAfterDays: 7
    });

    // DOM observation data retention
    this.retentionPolicies.set('dom', {
      dataType: 'dom',
      retentionDays: this.config.dataRetentionDays,
      cleanupInterval: 24 * 60 * 60 * 1000,
      compressionAfterDays: 3
    });

    // Context data retention
    this.retentionPolicies.set('context', {
      dataType: 'context',
      retentionDays: this.config.dataRetentionDays,
      cleanupInterval: 24 * 60 * 60 * 1000,
      compressionAfterDays: 7
    });
  }

  /**
   * Apply data retention policies
   */
  async applyRetentionPolicies(): Promise<void> {
    for (const [dataType, policy] of this.retentionPolicies) {
      try {
        await this.cleanupExpiredData(policy);
        await this.compressOldData(policy);
      } catch (error) {
        console.error(`Failed to apply retention policy for ${dataType}:`, error);
      }
    }
  }

  /**
   * Clean up expired data based on retention policy
   */
  private async cleanupExpiredData(policy: DataRetentionPolicy): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    // Get storage keys for this data type
    const result = await chrome.storage.local.get(null);
    const keysToDelete: string[] = [];

    for (const [key, value] of Object.entries(result)) {
      if (key.startsWith(`${policy.dataType}_`) && value && typeof value === 'object') {
        const data = value as any;
        if (data.timestamp && new Date(data.timestamp) < cutoffDate) {
          keysToDelete.push(key);
        }
      }
    }

    if (keysToDelete.length > 0) {
      await chrome.storage.local.remove(keysToDelete);
      console.log(`Cleaned up ${keysToDelete.length} expired ${policy.dataType} records`);
    }
  }

  /**
   * Compress old data to save storage space
   */
  private async compressOldData(policy: DataRetentionPolicy): Promise<void> {
    if (!policy.compressionAfterDays) return;

    const compressionDate = new Date();
    compressionDate.setDate(compressionDate.getDate() - policy.compressionAfterDays);

    // Implementation would compress data older than compressionAfterDays
    // This is a placeholder for the compression logic
    console.log(`Compression check for ${policy.dataType} data older than ${policy.compressionAfterDays} days`);
  }

  /**
   * Export user data for GDPR compliance
   */
  async exportUserData(): Promise<string> {
    try {
      const allData = await chrome.storage.local.get(null);
      const syncData = await chrome.storage.sync.get(null);

      const exportData = {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        consent: this.consentStatus,
        settings: syncData,
        monitoringData: allData,
        retentionPolicies: Array.from(this.retentionPolicies.entries())
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error("Failed to export user data:", error);
      throw new Error("Data export failed");
    }
  }

  /**
   * Delete all user data
   */
  async deleteAllUserData(): Promise<void> {
    try {
      // Clear all local storage
      await chrome.storage.local.clear();

      // Clear sync storage (keep only essential settings)
      const syncData = await chrome.storage.sync.get(null);
      const keysToRemove = Object.keys(syncData).filter(key =>
        key !== 'extensionEnabled' // Keep basic extension state
      );

      if (keysToRemove.length > 0) {
        await chrome.storage.sync.remove(keysToRemove);
      }

      // Reset consent status
      this.consentStatus = {
        networkMonitoring: false,
        domObservation: false,
        contextCollection: false,
        dataStorage: false,
        consentTimestamp: null,
        consentVersion: "1.0.0"
      };

      console.log("All user data has been deleted");
    } catch (error) {
      console.error("Failed to delete user data:", error);
      throw new Error("Data deletion failed");
    }
  }

  /**
   * Check if a specific feature has user consent
   */
  hasConsent(feature: keyof ConsentStatus): boolean {
    if (feature === 'consentTimestamp' || feature === 'consentVersion') {
      return true;
    }
    return this.consentStatus[feature] === true;
  }

  /**
   * Get current consent status
   */
  getConsentStatus(): ConsentStatus {
    return { ...this.consentStatus };
  }

  /**
   * Update privacy configuration
   */
  updateConfig(newConfig: Partial<PrivacyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.initializeRetentionPolicies();
  }

  /**
   * Check if domain should be excluded from monitoring
   */
  isDomainExcluded(domain: string): boolean {
    return this.config.excludedDomains.some(excluded => {
      if (excluded.startsWith('*.')) {
        const pattern = excluded.substring(2);
        return domain.endsWith(pattern);
      }
      return domain === excluded;
    });
  }

  /**
   * Check if path should be excluded from monitoring
   */
  isPathExcluded(path: string): boolean {
    return this.config.excludedPaths.some(excluded => {
      if (excluded.includes('*')) {
        const regex = new RegExp(excluded.replace(/\*/g, '.*'));
        return regex.test(path);
      }
      return path.startsWith(excluded);
    });
  }

  /**
   * Redact sensitive data from text
   */
  redactSensitiveData(text: string): string {
    let redacted = text;

    // JSON-specific patterns with value preservation (apply first to preserve structure)
    redacted = redacted.replace(/"password"\s*:\s*"[^"]*"/gi, '"password": "[REDACTED]"');
    redacted = redacted.replace(/"token"\s*:\s*"[^"]*"/gi, '"token": "[REDACTED]"');
    redacted = redacted.replace(/"key"\s*:\s*"[^"]*"/gi, '"key": "[REDACTED]"');

    // Common sensitive patterns
    const commonPatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    ];

    for (const pattern of commonPatterns) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }

    // Apply configured sensitive data patterns last (but avoid JSON structure)
    for (const pattern of this.config.sensitiveDataPatterns) {
      // Skip if this would break JSON structure that we've already handled
      if (!redacted.includes('"password": "[REDACTED]"') && !redacted.includes('"token": "[REDACTED]"')) {
        redacted = redacted.replace(pattern, '[REDACTED]');
      }
    }

    return redacted;
  }

  /**
   * Check if URL should be monitored based on privacy settings
   */
  shouldMonitorUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);

      // Check domain exclusions
      if (this.isDomainExcluded(urlObj.hostname)) {
        return false;
      }

      // Check path exclusions
      if (this.isPathExcluded(urlObj.pathname)) {
        return false;
      }

      return true;
    } catch (error) {
      // Invalid URL, don't monitor
      return false;
    }
  }

  /**
   * Sanitize network data for privacy compliance
   */
  sanitizeNetworkData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };

    // Sanitize URL
    if (sanitized.url && typeof sanitized.url === 'string') {
      try {
        const urlObj = new URL(sanitized.url);
        // Remove sensitive query parameters
        const sensitiveParams = ['password', 'token', 'key', 'secret', 'auth'];
        sensitiveParams.forEach(param => {
          if (urlObj.searchParams.has(param)) {
            urlObj.searchParams.set(param, '[REDACTED]');
          }
        });
        sanitized.url = urlObj.toString();
      } catch (error) {
        // Keep original URL if parsing fails
      }
    }

    // Sanitize body content
    if (sanitized.body && typeof sanitized.body === 'string') {
      sanitized.body = this.redactSensitiveData(sanitized.body);
    }

    // Sanitize headers
    if (sanitized.headers && typeof sanitized.headers === 'object') {
      const sanitizedHeaders = { ...sanitized.headers };
      const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];

      Object.keys(sanitizedHeaders).forEach(key => {
        if (sensitiveHeaders.includes(key.toLowerCase())) {
          sanitizedHeaders[key] = '[REDACTED]';
        }
      });

      sanitized.headers = sanitizedHeaders;
    }

    return sanitized;
  }

  /**
   * Log data collection activity for audit purposes
   */
  logDataCollection(type: string, details: string): void {
    // This is a placeholder for audit logging
    // In a real implementation, this would log to an audit trail
    console.debug(`Data collection: ${type} - ${details}`);
  }
}