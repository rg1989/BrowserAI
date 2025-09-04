import { MonitoringConfigManager } from '../MonitoringConfig';
import { MonitoringConfig } from '../../types/monitoring';

describe('MonitoringConfigManager', () => {
    describe('constructor and defaults', () => {
        it('should create with default configuration', () => {
            const manager = new MonitoringConfigManager();
            const config = manager.getConfig();

            expect(config.enabled).toBe(true);
            expect(config.features.networkMonitoring).toBe(true);
            expect(config.features.domObservation).toBe(true);
            expect(config.privacy.redactSensitiveData).toBe(true);
            expect(config.performance.maxBufferSize).toBe(1000);
        });

        it('should merge initial config with defaults', () => {
            const initialConfig = {
                enabled: false,
                features: { networkMonitoring: false }
            };

            const manager = new MonitoringConfigManager(initialConfig);
            const config = manager.getConfig();

            expect(config.enabled).toBe(false);
            expect(config.features.networkMonitoring).toBe(false);
            expect(config.features.domObservation).toBe(true); // Should use default
        });
    });

    describe('configuration validation', () => {
        it('should validate performance settings', () => {
            expect(() => {
                new MonitoringConfigManager({
                    performance: { maxBufferSize: 0 }
                });
            }).toThrow('maxBufferSize must be greater than 0');

            expect(() => {
                new MonitoringConfigManager({
                    performance: { throttleInterval: -1 }
                });
            }).toThrow('throttleInterval must be non-negative');

            expect(() => {
                new MonitoringConfigManager({
                    performance: { maxConcurrentRequests: 0 }
                });
            }).toThrow('maxConcurrentRequests must be greater than 0');
        });

        it('should validate storage settings', () => {
            expect(() => {
                new MonitoringConfigManager({
                    storage: { maxStorageSize: 0 }
                });
            }).toThrow('maxStorageSize must be greater than 0');

            expect(() => {
                new MonitoringConfigManager({
                    storage: { compressionLevel: 10 }
                });
            }).toThrow('compressionLevel must be between 0 and 9');

            expect(() => {
                new MonitoringConfigManager({
                    storage: { cleanupInterval: -1 }
                });
            }).toThrow('cleanupInterval must be greater than 0');
        });

        it('should validate privacy settings', () => {
            expect(() => {
                new MonitoringConfigManager({
                    privacy: { dataRetentionDays: 0 }
                });
            }).toThrow('dataRetentionDays must be greater than 0');

            expect(() => {
                new MonitoringConfigManager({
                    privacy: { excludedDomains: ['', 'valid.com'] }
                });
            }).toThrow('All excluded domains must be non-empty strings');
        });
    });

    describe('feature checking', () => {
        it('should check if monitoring is enabled', () => {
            const manager = new MonitoringConfigManager();
            expect(manager.isEnabled()).toBe(true);

            manager.updateConfig({ enabled: false });
            expect(manager.isEnabled()).toBe(false);
        });

        it('should check if specific features are enabled', () => {
            const manager = new MonitoringConfigManager();

            expect(manager.isFeatureEnabled('networkMonitoring')).toBe(true);

            manager.updateConfig({
                features: { networkMonitoring: false }
            });
            expect(manager.isFeatureEnabled('networkMonitoring')).toBe(false);

            // Should return false if monitoring is disabled entirely
            manager.updateConfig({ enabled: false });
            expect(manager.isFeatureEnabled('domObservation')).toBe(false);
        });
    });

    describe('privacy controls', () => {
        let manager: MonitoringConfigManager;

        beforeEach(() => {
            manager = new MonitoringConfigManager({
                privacy: {
                    excludedDomains: ['example.com', 'test.org'],
                    excludedPaths: ['/admin', '/private'],
                    redactSensitiveData: true,
                    sensitiveDataPatterns: [/password/i, /\d{4}-\d{4}-\d{4}-\d{4}/],
                    dataRetentionDays: 7
                }
            });
        });

        it('should check domain exclusions', () => {
            expect(manager.isDomainExcluded('example.com')).toBe(true);
            expect(manager.isDomainExcluded('sub.example.com')).toBe(true);
            expect(manager.isDomainExcluded('allowed.com')).toBe(false);
        });

        it('should check path exclusions', () => {
            expect(manager.isPathExcluded('/admin/users')).toBe(true);
            expect(manager.isPathExcluded('/private')).toBe(true);
            expect(manager.isPathExcluded('/public')).toBe(false);
        });

        it('should detect sensitive data', () => {
            expect(manager.containsSensitiveData('password: secret123')).toBe(true);
            expect(manager.containsSensitiveData('card: 1234-5678-9012-3456')).toBe(true);
            expect(manager.containsSensitiveData('normal text')).toBe(false);
        });

        it('should redact sensitive data', () => {
            const result = manager.redactSensitiveData('password: secret123, card: 1234-5678-9012-3456');
            expect(result).toBe('[REDACTED]: secret123, card: [REDACTED]');
        });

        it('should not redact when disabled', () => {
            manager.updateConfig({
                privacy: { redactSensitiveData: false }
            });

            const result = manager.redactSensitiveData('password: secret123');
            expect(result).toBe('password: secret123');
        });
    });

    describe('configuration management', () => {
        it('should update configuration', () => {
            const manager = new MonitoringConfigManager();

            manager.updateConfig({
                enabled: false,
                features: { networkMonitoring: false }
            });

            const config = manager.getConfig();
            expect(config.enabled).toBe(false);
            expect(config.features.networkMonitoring).toBe(false);
            expect(config.features.domObservation).toBe(true); // Should remain unchanged
        });

        it('should get specific config sections', () => {
            const manager = new MonitoringConfigManager();

            const features = manager.getFeatureConfig();
            expect(features).toHaveProperty('networkMonitoring');
            expect(features).toHaveProperty('domObservation');

            const privacy = manager.getPrivacyConfig();
            expect(privacy).toHaveProperty('excludedDomains');
            expect(privacy).toHaveProperty('redactSensitiveData');

            const performance = manager.getPerformanceConfig();
            expect(performance).toHaveProperty('maxBufferSize');
            expect(performance).toHaveProperty('throttleInterval');

            const storage = manager.getStorageConfig();
            expect(storage).toHaveProperty('persistentStorage');
            expect(storage).toHaveProperty('maxStorageSize');
        });

        it('should export and import configuration', () => {
            const manager = new MonitoringConfigManager();
            manager.updateConfig({ enabled: false });

            const exported = manager.exportConfig();
            expect(typeof exported).toBe('string');

            const newManager = new MonitoringConfigManager();
            newManager.importConfig(exported);

            expect(newManager.isEnabled()).toBe(false);
        });

        it('should handle invalid import JSON', () => {
            const manager = new MonitoringConfigManager();

            expect(() => {
                manager.importConfig('invalid json');
            }).toThrow('Invalid configuration JSON');
        });

        it('should reset to defaults', () => {
            const manager = new MonitoringConfigManager();
            manager.updateConfig({ enabled: false });

            manager.resetToDefaults();
            expect(manager.isEnabled()).toBe(true);
        });
    });

    describe('immutability', () => {
        it('should return copies of configuration objects', () => {
            const manager = new MonitoringConfigManager();

            const config1 = manager.getConfig();
            const config2 = manager.getConfig();

            expect(config1).not.toBe(config2); // Different objects
            expect(config1).toEqual(config2); // Same content

            // Modifying returned config should not affect internal state
            config1.enabled = false;
            expect(manager.isEnabled()).toBe(true);
        });
    });
});