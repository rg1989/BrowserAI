import {
    MonitoringConfig,
    FeatureConfig,
    PrivacyConfig,
    PerformanceConfig,
    StorageConfig
} from '../types/monitoring';

/**
 * Configuration management for the page context monitoring system
 * Provides validation, defaults, and persistence
 */
export class MonitoringConfigManager {
    private static readonly DEFAULT_CONFIG: MonitoringConfig = {
        enabled: true,
        features: {
            networkMonitoring: true,
            domObservation: true,
            contextCollection: true,
            pluginIntegration: true,
            interactionTracking: true
        },
        privacy: {
            excludedDomains: [],
            excludedPaths: [],
            redactSensitiveData: true,
            sensitiveDataPatterns: [
                /password/i,
                /ssn/i,
                /social.security/i,
                /credit.card/i,
                /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card pattern
                /\b\d{3}-\d{2}-\d{4}\b/ // SSN pattern
            ],
            dataRetentionDays: 7
        },
        performance: {
            maxBufferSize: 1000,
            throttleInterval: 100,
            maxConcurrentRequests: 10,
            compressionEnabled: true
        },
        storage: {
            persistentStorage: true,
            maxStorageSize: 50 * 1024 * 1024, // 50MB
            compressionLevel: 6,
            cleanupInterval: 24 * 60 * 60 * 1000 // 24 hours
        }
    };

    private config: MonitoringConfig;

    constructor(initialConfig?: Partial<MonitoringConfig>) {
        this.config = this.mergeWithDefaults(initialConfig || {});
        this.validateConfig();
    }

    /**
     * Get the current configuration
     */
    getConfig(): MonitoringConfig {
        return { ...this.config };
    }

    /**
     * Update configuration with validation
     */
    updateConfig(updates: Partial<MonitoringConfig>): void {
        const newConfig = this.mergeConfigs(this.config, updates);
        this.validateConfig(newConfig);
        this.config = newConfig;
    }

    /**
     * Get feature-specific configuration
     */
    getFeatureConfig(): FeatureConfig {
        return { ...this.config.features };
    }

    /**
     * Get privacy configuration
     */
    getPrivacyConfig(): PrivacyConfig {
        return { ...this.config.privacy };
    }

    /**
     * Get performance configuration
     */
    getPerformanceConfig(): PerformanceConfig {
        return { ...this.config.performance };
    }

    /**
     * Get storage configuration
     */
    getStorageConfig(): StorageConfig {
        return { ...this.config.storage };
    }

    /**
     * Check if monitoring is enabled
     */
    isEnabled(): boolean {
        return this.config.enabled;
    }

    /**
     * Check if a specific feature is enabled
     */
    isFeatureEnabled(feature: keyof FeatureConfig): boolean {
        return this.config.enabled && this.config.features[feature];
    }

    /**
     * Check if a domain should be excluded from monitoring
     */
    isDomainExcluded(domain: string): boolean {
        return this.config.privacy.excludedDomains.some(excluded =>
            domain.includes(excluded) || excluded.includes(domain)
        );
    }

    /**
     * Check if a URL path should be excluded from monitoring
     */
    isPathExcluded(path: string): boolean {
        return this.config.privacy.excludedPaths.some(excluded =>
            path.includes(excluded) || new RegExp(excluded).test(path)
        );
    }

    /**
     * Check if data contains sensitive information
     */
    containsSensitiveData(data: string): boolean {
        if (!this.config.privacy.redactSensitiveData) {
            return false;
        }

        return this.config.privacy.sensitiveDataPatterns.some(pattern =>
            pattern.test(data)
        );
    }

    /**
     * Redact sensitive data from a string
     */
    redactSensitiveData(data: string): string {
        if (!this.config.privacy.redactSensitiveData) {
            return data;
        }

        let redactedData = data;
        this.config.privacy.sensitiveDataPatterns.forEach(pattern => {
            redactedData = redactedData.replace(pattern, '[REDACTED]');
        });

        return redactedData;
    }

    /**
     * Export configuration as JSON
     */
    exportConfig(): string {
        return JSON.stringify(this.config, null, 2);
    }

    /**
     * Import configuration from JSON
     */
    importConfig(configJson: string): void {
        try {
            const importedConfig = JSON.parse(configJson);
            this.updateConfig(importedConfig);
        } catch (error) {
            throw new Error(`Invalid configuration JSON: ${error}`);
        }
    }

    /**
     * Reset to default configuration
     */
    resetToDefaults(): void {
        this.config = { ...MonitoringConfigManager.DEFAULT_CONFIG };
    }

    private mergeWithDefaults(config: Partial<MonitoringConfig>): MonitoringConfig {
        return this.mergeConfigs(MonitoringConfigManager.DEFAULT_CONFIG, config);
    }

    private mergeConfigs(base: MonitoringConfig, updates: Partial<MonitoringConfig>): MonitoringConfig {
        return {
            enabled: updates.enabled ?? base.enabled,
            features: { ...base.features, ...updates.features },
            privacy: {
                ...base.privacy,
                ...updates.privacy,
                sensitiveDataPatterns: updates.privacy?.sensitiveDataPatterns ?? base.privacy.sensitiveDataPatterns
            },
            performance: { ...base.performance, ...updates.performance },
            storage: { ...base.storage, ...updates.storage }
        };
    }

    private validateConfig(config: MonitoringConfig = this.config): void {
        // Validate performance settings
        if (config.performance.maxBufferSize <= 0) {
            throw new Error('maxBufferSize must be greater than 0');
        }

        if (config.performance.throttleInterval < 0) {
            throw new Error('throttleInterval must be non-negative');
        }

        if (config.performance.maxConcurrentRequests <= 0) {
            throw new Error('maxConcurrentRequests must be greater than 0');
        }

        // Validate storage settings
        if (config.storage.maxStorageSize <= 0) {
            throw new Error('maxStorageSize must be greater than 0');
        }

        if (config.storage.compressionLevel < 0 || config.storage.compressionLevel > 9) {
            throw new Error('compressionLevel must be between 0 and 9');
        }

        if (config.storage.cleanupInterval <= 0) {
            throw new Error('cleanupInterval must be greater than 0');
        }

        // Validate privacy settings
        if (config.privacy.dataRetentionDays <= 0) {
            throw new Error('dataRetentionDays must be greater than 0');
        }

        // Validate excluded domains format
        config.privacy.excludedDomains.forEach(domain => {
            if (typeof domain !== 'string' || domain.trim().length === 0) {
                throw new Error('All excluded domains must be non-empty strings');
            }
        });

        // Validate excluded paths format
        config.privacy.excludedPaths.forEach(path => {
            if (typeof path !== 'string') {
                throw new Error('All excluded paths must be strings');
            }
        });
    }
}