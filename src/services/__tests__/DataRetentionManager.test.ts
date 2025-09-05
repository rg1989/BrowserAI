/**
 * Data Retention Manager Tests
 * Tests for automated cleanup, retention policies, and compliance reporting
 */

import { DataRetentionManager } from '../DataRetentionManager';
import { PrivacyConfig, DataRetentionPolicy } from '../../types/privacy';

// Mock Chrome APIs
const mockChrome = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn(),
            clear: jest.fn()
        },
        sync: {
            get: jest.fn()
        }
    }
};

// @ts-ignore
global.chrome = mockChrome;

// Mock timers
jest.useFakeTimers();

describe('DataRetentionManager', () => {
    let retentionManager: DataRetentionManager;
    let mockConfig: PrivacyConfig;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();

        mockConfig = {
            excludedDomains: [],
            excludedPaths: [],
            redactSensitiveData: true,
            sensitiveDataPatterns: [],
            dataRetentionDays: 30,
            enableDataExport: true,
            enableDataDeletion: true,
            requireExplicitConsent: true,
            consentRenewalDays: 365
        };

        retentionManager = new DataRetentionManager(mockConfig);
    });

    afterEach(() => {
        retentionManager.stopAutomatedCleanup();
    });

    describe('Policy Initialization', () => {
        it('should initialize default retention policies', () => {
            const policies = retentionManager.getAllRetentionPolicies();

            expect(policies.has('network_requests')).toBe(true);
            expect(policies.has('dom_observations')).toBe(true);
            expect(policies.has('user_interactions')).toBe(true);
            expect(policies.has('context_data')).toBe(true);
            expect(policies.has('error_logs')).toBe(true);
            expect(policies.has('audit_logs')).toBe(true);
        });

        it('should set correct retention periods for different data types', () => {
            const policies = retentionManager.getAllRetentionPolicies();

            expect(policies.get('network_requests')?.retentionDays).toBe(30);
            expect(policies.get('dom_observations')?.retentionDays).toBe(14); // Max 14 days for DOM data
            expect(policies.get('error_logs')?.retentionDays).toBe(30);
            expect(policies.get('audit_logs')?.retentionDays).toBe(365); // Keep audit logs longer
        });

        it('should enable auto cleanup for all policies by default', () => {
            const policies = retentionManager.getAllRetentionPolicies();

            policies.forEach((policy) => {
                expect(policy.autoCleanup).toBe(true);
            });
        });
    });

    describe('Automated Cleanup', () => {
        it('should start automated cleanup intervals', () => {
            const setIntervalSpy = jest.spyOn(global, 'setInterval');

            retentionManager.startAutomatedCleanup();

            // Should create intervals for each policy with autoCleanup enabled
            expect(setIntervalSpy).toHaveBeenCalledTimes(6); // 6 default policies
        });

        it('should stop automated cleanup intervals', () => {
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

            retentionManager.startAutomatedCleanup();
            retentionManager.stopAutomatedCleanup();

            expect(clearIntervalSpy).toHaveBeenCalledTimes(6);
        });

        it('should perform cleanup at scheduled intervals', async () => {
            const performCleanupSpy = jest.spyOn(retentionManager, 'performCleanup').mockResolvedValue();

            retentionManager.startAutomatedCleanup();

            // Fast-forward time to trigger cleanup
            jest.advanceTimersByTime(24 * 60 * 60 * 1000); // 24 hours

            await Promise.resolve(); // Allow async operations to complete

            expect(performCleanupSpy).toHaveBeenCalled();
        });
    });

    describe('Data Cleanup', () => {
        it('should delete expired data based on retention policy', async () => {
            const expiredData = {
                network_requests_1: { timestamp: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) }, // 40 days old
                network_requests_2: { timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }, // 10 days old
                dom_observations_1: { timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) }, // 20 days old
                other_data: { timestamp: new Date() }
            };

            mockChrome.storage.local.get.mockResolvedValue(expiredData);

            await retentionManager.performCleanup('network_requests');

            // Should remove network_requests_1 (older than 30 days) but keep network_requests_2
            expect(mockChrome.storage.local.remove).toHaveBeenCalledWith(['network_requests_1']);
        });

        it('should handle cleanup errors gracefully', async () => {
            mockChrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            await retentionManager.performCleanup('network_requests');

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to delete expired data for network_requests:'),
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });

        it('should compress old data when compression is enabled', async () => {
            const oldData = {
                network_requests_1: {
                    timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days old
                    data: 'large data content that should be compressed'
                }
            };

            mockChrome.storage.local.get.mockResolvedValue(oldData);

            await retentionManager.performCleanup('network_requests');

            // Should compress data older than compressionAfterDays (7 days for network requests)
            expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    network_requests_1: expect.objectContaining({
                        compressed: true
                    })
                })
            );
        });

        it('should update last cleanup timestamp', async () => {
            mockChrome.storage.local.get.mockResolvedValue({});

            await retentionManager.performCleanup('network_requests');

            expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    cleanup_network_requests_last: expect.objectContaining({
                        timestamp: expect.any(String),
                        dataType: 'network_requests'
                    })
                })
            );
        });
    });

    describe('Data Inventory', () => {
        it('should generate data inventory for compliance', async () => {
            const mockData = {
                network_req_1: { timestamp: new Date(), url: 'https://api.example.com' },
                network_req_2: { timestamp: new Date(), url: 'https://api2.example.com' },
                dom_obs_1: { timestamp: new Date(), element: 'div' },
                error_log_1: { timestamp: new Date(), error: 'Test error' }
            };

            mockChrome.storage.local.get.mockResolvedValue(mockData);

            const inventory = await retentionManager.getDataInventory();

            expect(inventory).toHaveLength(6); // 6 default data types

            const networkPolicy = inventory.find(item => item.dataType === 'network_requests');
            expect(networkPolicy).toBeDefined();
            expect(networkPolicy?.category).toBe('behavioral');
            expect(networkPolicy?.legalBasis).toBe('consent');
            expect(networkPolicy?.retentionPeriod).toBe(30);
        });

        it('should categorize data types correctly', async () => {
            mockChrome.storage.local.get.mockResolvedValue({});

            const inventory = await retentionManager.getDataInventory();

            const categories = inventory.reduce((acc, item) => {
                acc[item.dataType] = item.category;
                return acc;
            }, {} as Record<string, string>);

            expect(categories['network_requests']).toBe('behavioral');
            expect(categories['dom_observations']).toBe('behavioral');
            expect(categories['user_interactions']).toBe('behavioral');
            expect(categories['context_data']).toBe('derived');
            expect(categories['error_logs']).toBe('technical');
            expect(categories['audit_logs']).toBe('technical');
        });
    });

    describe('Compliance Reporting', () => {
        it('should generate compliance report', async () => {
            const mockData = {
                network_req_1: { timestamp: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) }, // 25 days old
                dom_obs_1: { timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) } // 10 days old
            };

            const mockConsent = {
                networkMonitoring: true,
                domObservation: true,
                contextCollection: false,
                dataStorage: true,
                consentTimestamp: new Date(),
                consentVersion: '1.0.0'
            };

            mockChrome.storage.local.get.mockResolvedValue(mockData);
            mockChrome.storage.sync.get.mockResolvedValue({ privacyConsent: mockConsent });

            const report = await retentionManager.generateComplianceReport();

            expect(report).toHaveProperty('timestamp');
            expect(report).toHaveProperty('consentStatus');
            expect(report).toHaveProperty('dataInventory');
            expect(report).toHaveProperty('retentionCompliance');
            expect(report).toHaveProperty('recommendations');

            expect(report.consentStatus).toEqual(mockConsent);
            expect(report.dataInventory).toHaveLength(6);
            expect(report.retentionCompliance).toHaveLength(6);
        });

        it('should identify compliance violations', async () => {
            const violationData = {
                network_requests_1: { timestamp: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) }, // 40 days old (violation)
                dom_observations_1: { timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) } // 20 days old (violation for DOM - max 14 days)
            };

            mockChrome.storage.local.get.mockResolvedValue(violationData);
            mockChrome.storage.sync.get.mockResolvedValue({ privacyConsent: {} });

            const report = await retentionManager.generateComplianceReport();

            const networkCompliance = report.retentionCompliance.find(
                item => item.dataType === 'network_requests'
            );
            const domCompliance = report.retentionCompliance.find(
                item => item.dataType === 'dom_observations'
            );

            expect(networkCompliance?.complianceStatus).toBe('violation');
            expect(domCompliance?.complianceStatus).toBe('violation');

            expect(report.recommendations).toContainEqual(
                expect.stringContaining('Immediate cleanup required for network_requests')
            );
        });

        it('should generate appropriate recommendations', async () => {
            mockChrome.storage.local.get.mockResolvedValue({});
            mockChrome.storage.sync.get.mockResolvedValue({ privacyConsent: {} });

            const report = await retentionManager.generateComplianceReport();

            expect(report.recommendations).toContain('All data retention policies are compliant');
        });
    });

    describe('Storage Statistics', () => {
        it('should calculate storage usage statistics', async () => {
            const mockData = {
                network_requests_1: { data: 'test data 1' },
                network_requests_2: { data: 'test data 2' },
                dom_observations_1: { element: 'div' },
                other_data: { value: 'other' }
            };

            mockChrome.storage.local.get.mockResolvedValue(mockData);

            const stats = await retentionManager.getStorageStats();

            expect(stats).toHaveProperty('used');
            expect(stats).toHaveProperty('available');
            expect(stats).toHaveProperty('byDataType');

            expect(stats.used).toBeGreaterThan(0);
            expect(stats.byDataType).toHaveProperty('network_requests');
            expect(stats.byDataType).toHaveProperty('dom_observations');
        });

        it('should handle storage errors gracefully', async () => {
            mockChrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

            const stats = await retentionManager.getStorageStats();

            expect(stats).toEqual({
                used: 0,
                available: 0,
                byDataType: {}
            });
        });
    });

    describe('Policy Management', () => {
        it('should allow setting custom retention policies', () => {
            const customPolicy: DataRetentionPolicy = {
                dataType: 'custom_data',
                retentionDays: 60,
                cleanupInterval: 12 * 60 * 60 * 1000,
                compressionAfterDays: 14,
                autoCleanup: true
            };

            retentionManager.setRetentionPolicy('custom_data', customPolicy);

            const retrievedPolicy = retentionManager.getRetentionPolicy('custom_data');
            expect(retrievedPolicy).toEqual(customPolicy);
        });

        it('should restart cleanup intervals when policy is updated', () => {
            const setIntervalSpy = jest.spyOn(global, 'setInterval');
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

            retentionManager.startAutomatedCleanup();

            const customPolicy: DataRetentionPolicy = {
                dataType: 'network_requests',
                retentionDays: 60,
                cleanupInterval: 6 * 60 * 60 * 1000, // 6 hours
                autoCleanup: true
            };

            retentionManager.setRetentionPolicy('network_requests', customPolicy);

            expect(clearIntervalSpy).toHaveBeenCalled();
            expect(setIntervalSpy).toHaveBeenCalledWith(
                expect.any(Function),
                6 * 60 * 60 * 1000
            );
        });
    });

    describe('Force Cleanup', () => {
        it('should perform cleanup for all data types', async () => {
            const performCleanupSpy = jest.spyOn(retentionManager, 'performCleanup').mockResolvedValue();

            await retentionManager.forceCleanupAll();

            expect(performCleanupSpy).toHaveBeenCalledTimes(6); // 6 default policies
            expect(performCleanupSpy).toHaveBeenCalledWith('network_requests');
            expect(performCleanupSpy).toHaveBeenCalledWith('dom_observations');
            expect(performCleanupSpy).toHaveBeenCalledWith('user_interactions');
            expect(performCleanupSpy).toHaveBeenCalledWith('context_data');
            expect(performCleanupSpy).toHaveBeenCalledWith('error_logs');
            expect(performCleanupSpy).toHaveBeenCalledWith('audit_logs');
        });

        it('should handle cleanup failures gracefully', async () => {
            jest.spyOn(retentionManager, 'performCleanup')
                .mockRejectedValueOnce(new Error('Cleanup failed'))
                .mockResolvedValue();

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            await retentionManager.forceCleanupAll();

            expect(consoleSpy).toHaveBeenCalledWith('Force cleanup completed for all data types');

            consoleSpy.mockRestore();
        });
    });

    describe('Data Type Identification', () => {
        it('should correctly identify data types from storage keys', () => {
            const testCases = [
                { key: 'network_requests_123', expected: 'network_requests' },
                { key: 'dom_observations_456', expected: 'dom_observations' },
                { key: 'user_interactions_789', expected: 'user_interactions' },
                { key: 'context_data_abc', expected: 'context_data' },
                { key: 'error_logs_def', expected: 'error_logs' },
                { key: 'audit_logs_ghi', expected: 'audit_logs' },
                { key: 'network_req_123', expected: 'network_requests' }, // Legacy format
                { key: 'dom_obs_456', expected: 'dom_observations' }, // Legacy format
                { key: 'unknown_key', expected: null }
            ];

            testCases.forEach(({ key, expected }) => {
                const result = retentionManager['extractDataType'](key);
                if (expected) {
                    expect(result).toBe(expected);
                } else {
                    expect(result).toBeNull();
                }
            });
        });
    });

    describe('Data Compression', () => {
        it('should compress data effectively', async () => {
            const largeData = {
                timestamp: new Date(),
                data: 'This is a large piece of data that should be compressed to save space',
                type: 'network_request',
                url: 'https://api.example.com/very/long/endpoint/path',
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ key: 'value', anotherKey: 'anotherValue' })
            };

            const compressed = await retentionManager['compressData'](largeData);

            expect(compressed).toBeDefined();
            expect(compressed!.length).toBeLessThan(JSON.stringify(largeData).length);
        });

        it('should return null if compression is not beneficial', async () => {
            const smallData = { a: 1 };

            const compressed = await retentionManager['compressData'](smallData);

            expect(compressed).toBeNull();
        });
    });
});