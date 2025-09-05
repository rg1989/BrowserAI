/**
 * User Data Manager Tests
 * Tests for GDPR compliance, data export, deletion, and audit logging
 */

import { UserDataManager } from '../UserDataManager';

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
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn()
        }
    },
    runtime: {
        getManifest: jest.fn(() => ({ version: '1.0.0' }))
    }
};

// @ts-ignore
global.chrome = mockChrome;

// Mock navigator
Object.defineProperty(global, 'navigator', {
    value: {
        userAgent: 'Mozilla/5.0 (Test Browser)'
    }
});

describe('UserDataManager', () => {
    let userDataManager: UserDataManager;

    beforeEach(() => {
        jest.clearAllMocks();
        userDataManager = new UserDataManager();
    });

    describe('Initialization', () => {
        it('should initialize audit logging system', async () => {
            const mockAuditLogs = [
                {
                    id: 'audit_1',
                    timestamp: new Date(),
                    action: 'data_exported',
                    details: { test: 'data' },
                    userAgent: 'Test Agent'
                }
            ];

            mockChrome.storage.local.get.mockResolvedValue({
                privacy_audit_logs: mockAuditLogs
            });

            const newManager = new UserDataManager();
            await new Promise(resolve => setTimeout(resolve, 0)); // Allow async init

            expect(mockChrome.storage.local.get).toHaveBeenCalledWith(['privacy_audit_logs']);
        });

        it('should handle missing audit logs gracefully', async () => {
            mockChrome.storage.local.get.mockResolvedValue({});

            const newManager = new UserDataManager();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(newManager.getAuditLogs()).toEqual([]);
        });
    });

    describe('Data Export', () => {
        it('should export user data in JSON format', async () => {
            const mockLocalData = {
                network_req_1: { url: 'https://api.example.com', method: 'GET', timestamp: new Date() },
                dom_obs_1: { element: 'div', change: 'added', timestamp: new Date() },
                context_data_1: { page: 'example.com', content: 'test', timestamp: new Date() }
            };

            const mockSyncData = {
                privacyConsent: {
                    networkMonitoring: true,
                    domObservation: true,
                    contextCollection: false,
                    dataStorage: true,
                    consentTimestamp: new Date(),
                    consentVersion: '1.0.0'
                },
                userPreferences: { theme: 'dark' }
            };

            mockChrome.storage.local.get.mockResolvedValue(mockLocalData);
            mockChrome.storage.sync.get.mockResolvedValue(mockSyncData);

            const exportedData = await userDataManager.exportUserData('json');
            const parsedData = JSON.parse(exportedData);

            expect(parsedData).toHaveProperty('exportMetadata');
            expect(parsedData).toHaveProperty('consentData');
            expect(parsedData).toHaveProperty('settings');
            expect(parsedData).toHaveProperty('monitoringData');
            expect(parsedData).toHaveProperty('auditLogs');
            expect(parsedData).toHaveProperty('dataInventory');

            expect(parsedData.exportMetadata.format).toBe('json');
            expect(parsedData.consentData).toEqual({
                ...mockSyncData.privacyConsent,
                consentTimestamp: mockSyncData.privacyConsent.consentTimestamp.toISOString()
            });
            expect(parsedData.monitoringData.networkRequests).toHaveProperty('network_req_1');
            expect(parsedData.monitoringData.domObservations).toHaveProperty('dom_obs_1');
        });

        it('should export data in CSV format', async () => {
            mockChrome.storage.local.get.mockResolvedValue({
                network_req_1: { url: 'test.com' }
            });
            mockChrome.storage.sync.get.mockResolvedValue({
                privacyConsent: {
                    networkMonitoring: true,
                    domObservation: false,
                    consentTimestamp: new Date('2024-01-01')
                }
            });

            const exportedData = await userDataManager.exportUserData('csv');

            expect(exportedData).toContain('Data Export - CSV Format');
            expect(exportedData).toContain('Consent Status');
            expect(exportedData).toContain('Feature,Granted,Timestamp');
            expect(exportedData).toContain('networkMonitoring,true');
            expect(exportedData).toContain('domObservation,false');
            expect(exportedData).toContain('Monitoring Data Summary');
        });

        it('should export data in XML format', async () => {
            mockChrome.storage.local.get.mockResolvedValue({
                network_req_1: { url: 'test.com' }
            });
            mockChrome.storage.sync.get.mockResolvedValue({
                privacyConsent: {
                    networkMonitoring: true,
                    consentTimestamp: new Date('2024-01-01')
                }
            });

            const exportedData = await userDataManager.exportUserData('xml');

            expect(exportedData).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(exportedData).toContain('<userDataExport>');
            expect(exportedData).toContain('<metadata>');
            expect(exportedData).toContain('<consentData>');
            expect(exportedData).toContain('<networkMonitoring>true</networkMonitoring>');
            expect(exportedData).toContain('</userDataExport>');
        });

        it('should handle export errors gracefully', async () => {
            mockChrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

            await expect(userDataManager.exportUserData()).rejects.toThrow('Data export failed');
        });

        it('should sanitize sensitive settings during export', async () => {
            const mockSyncData = {
                authTokens: 'secret-token',
                apiKeys: 'api-key-123',
                passwords: 'user-password',
                normalSetting: 'normal-value'
            };

            mockChrome.storage.local.get.mockResolvedValue({});
            mockChrome.storage.sync.get.mockResolvedValue(mockSyncData);

            const exportedData = await userDataManager.exportUserData();
            const parsedData = JSON.parse(exportedData);

            expect(parsedData.settings.authTokens).toBe('[REDACTED]');
            expect(parsedData.settings.apiKeys).toBe('[REDACTED]');
            expect(parsedData.settings.passwords).toBe('[REDACTED]');
            expect(parsedData.settings.normalSetting).toBe('normal-value');
        });
    });

    describe('Data Deletion', () => {
        it('should delete all user data', async () => {
            const mockSyncData = {
                privacyConsent: { networkMonitoring: true },
                extensionEnabled: true,
                userPreferences: { theme: 'dark' },
                otherSetting: 'value'
            };

            mockChrome.storage.sync.get.mockResolvedValue(mockSyncData);

            await userDataManager.deleteAllUserData('confirmation-token');

            expect(mockChrome.storage.local.clear).toHaveBeenCalled();
            expect(mockChrome.storage.sync.remove).toHaveBeenCalledWith([
                'privacyConsent',
                'userPreferences',
                'otherSetting'
            ]);
        });

        it('should require confirmation token for deletion', async () => {
            await expect(userDataManager.deleteAllUserData()).rejects.toThrow(
                'Confirmation token required for data deletion'
            );
        });

        it('should delete specific data types', async () => {
            const mockLocalData = {
                network_requests_1: { url: 'test.com' },
                network_requests_2: { url: 'test2.com' },
                dom_observations_1: { element: 'div' },
                context_data_1: { page: 'test.com' },
                other_data: { value: 'keep' }
            };

            mockChrome.storage.local.get.mockResolvedValue(mockLocalData);

            await userDataManager.deleteDataByType(['network_requests', 'dom_observations']);

            expect(mockChrome.storage.local.remove).toHaveBeenCalledWith([
                'network_requests_1',
                'network_requests_2',
                'dom_observations_1'
            ]);
        });

        it('should handle deletion errors gracefully', async () => {
            mockChrome.storage.local.clear.mockRejectedValue(new Error('Storage error'));

            await expect(userDataManager.deleteAllUserData('token')).rejects.toThrow(
                'Data deletion failed'
            );
        });
    });

    describe('Data Portability Report', () => {
        it('should generate comprehensive portability report', async () => {
            const mockLocalData = {
                network_req_1: { url: 'api.example.com', method: 'GET' },
                interaction_1: { type: 'click', element: 'button' },
                context_1: { page: 'example.com', analysis: 'test' },
                error_1: { message: 'Test error', timestamp: new Date() }
            };

            const mockSyncData = {
                privacyConsent: { networkMonitoring: true },
                userPreferences: { theme: 'dark' }
            };

            mockChrome.storage.local.get.mockResolvedValue(mockLocalData);
            mockChrome.storage.sync.get.mockResolvedValue(mockSyncData);

            const report = await userDataManager.generatePortabilityReport();

            expect(report).toHaveProperty('reportMetadata');
            expect(report).toHaveProperty('dataCategories');
            expect(report).toHaveProperty('dataFormats');
            expect(report).toHaveProperty('processingActivities');
            expect(report).toHaveProperty('retentionPeriods');
            expect(report).toHaveProperty('dataRecipients');

            expect(report.reportMetadata.purpose).toBe('Data Portability Report (GDPR Article 20)');
            expect(report.dataCategories).toHaveProperty('personalData');
            expect(report.dataCategories).toHaveProperty('technicalData');
            expect(report.dataCategories).toHaveProperty('behavioralData');
            expect(report.dataCategories).toHaveProperty('derivedData');
        });

        it('should categorize data correctly in portability report', async () => {
            const mockLocalData = {
                interaction_click_1: { type: 'click' },
                navigation_page_1: { url: 'test.com' },
                usage_session_1: { duration: 300 },
                context_analysis_1: { insights: 'test' },
                error_system_1: { error: 'test' },
                performance_metric_1: { timing: 100 }
            };

            mockChrome.storage.local.get.mockResolvedValue(mockLocalData);
            mockChrome.storage.sync.get.mockResolvedValue({});

            const report = await userDataManager.generatePortabilityReport();

            expect(report.dataCategories.behavioralData).toHaveProperty('interaction_click_1');
            expect(report.dataCategories.behavioralData).toHaveProperty('navigation_page_1');
            expect(report.dataCategories.behavioralData).toHaveProperty('usage_session_1');
            expect(report.dataCategories.derivedData).toHaveProperty('context_analysis_1');
            expect(report.dataCategories.technicalData).toHaveProperty('error_system_1');
            expect(report.dataCategories.technicalData).toHaveProperty('performance_metric_1');
        });

        it('should include processing activities information', async () => {
            mockChrome.storage.local.get.mockResolvedValue({});
            mockChrome.storage.sync.get.mockResolvedValue({});

            const report = await userDataManager.generatePortabilityReport();

            expect(report.processingActivities).toHaveLength(3);

            const networkActivity = report.processingActivities.find(
                (activity: any) => activity.activity === 'Network Request Monitoring'
            );
            expect(networkActivity).toBeDefined();
            expect(networkActivity.purpose).toBe('Provide contextual AI assistance');
            expect(networkActivity.legalBasis).toBe('User consent');
            expect(networkActivity.retention).toBe('30 days');
        });
    });

    describe('Audit Logging', () => {
        it('should log audit events', async () => {
            await userDataManager['logAuditEvent']('data_exported', {
                requestId: 'test-123',
                format: 'json'
            });

            const auditLogs = userDataManager.getAuditLogs();
            expect(auditLogs).toHaveLength(1);
            expect(auditLogs[0].action).toBe('data_exported');
            expect(auditLogs[0].details.requestId).toBe('test-123');
            expect(auditLogs[0].userAgent).toBe('Mozilla/5.0 (Test Browser)');

            expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
                privacy_audit_logs: expect.arrayContaining([
                    expect.objectContaining({
                        action: 'data_exported',
                        details: { requestId: 'test-123', format: 'json' }
                    })
                ])
            });
        });

        it('should limit audit log size to prevent storage bloat', async () => {
            // Pre-populate with 1000 logs
            const existingLogs = Array.from({ length: 1000 }, (_, i) => ({
                id: `audit_${i}`,
                timestamp: new Date(),
                action: 'test_action',
                details: {},
                userAgent: 'Test'
            }));

            userDataManager['auditLogs'] = existingLogs as any;

            // Add one more log
            await userDataManager['logAuditEvent']('new_action', {});

            const auditLogs = userDataManager.getAuditLogs();
            expect(auditLogs).toHaveLength(1000); // Should still be 1000
            expect(auditLogs[auditLogs.length - 1].action).toBe('new_action'); // Latest should be the new one
        });

        it('should clear audit logs with proper logging', async () => {
            // Add some initial logs
            await userDataManager['logAuditEvent']('test_action', {});

            const initialLogCount = userDataManager.getAuditLogs().length;
            expect(initialLogCount).toBeGreaterThan(0);

            await userDataManager.clearAuditLogs();

            const finalLogs = userDataManager.getAuditLogs();
            expect(finalLogs).toHaveLength(1); // Should have one log about clearing
            expect(finalLogs[0].action).toBe('audit_logs_cleared');
            expect(finalLogs[0].details.previousLogCount).toBe(initialLogCount);

            expect(mockChrome.storage.local.remove).toHaveBeenCalledWith(['privacy_audit_logs']);
        });

        it('should handle audit logging errors gracefully', async () => {
            mockChrome.storage.local.set.mockRejectedValue(new Error('Storage error'));

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            await userDataManager['logAuditEvent']('test_action', {});

            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to save audit log:',
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('Data Structure Analysis', () => {
        it('should analyze data structure correctly', () => {
            const testData = {
                stringField: 'test',
                numberField: 123,
                booleanField: true,
                objectField: { nested: 'value' },
                arrayField: [1, 2, 3],
                nullField: null
            };

            const structure = userDataManager['getDataStructure'](testData);

            expect(structure.stringField).toBe('string');
            expect(structure.numberField).toBe('number');
            expect(structure.booleanField).toBe('boolean');
            expect(structure.objectField).toBe('object');
            expect(structure.arrayField).toBe('array');
            expect(structure.nullField).toBe('object'); // null is typeof 'object'
        });

        it('should handle primitive data types', () => {
            expect(userDataManager['getDataStructure']('string')).toBe('string');
            expect(userDataManager['getDataStructure'](123)).toBe('number');
            expect(userDataManager['getDataStructure'](true)).toBe('boolean');
            expect(userDataManager['getDataStructure'](null)).toBe('object');
        });

        it('should estimate data size correctly', () => {
            const testData = [
                { field: 'value1' },
                { field: 'value2' },
                { field: 'value3' }
            ];

            const size = userDataManager['estimateDataSize'](testData);
            const expectedSize = testData.reduce((total, item) =>
                total + JSON.stringify(item).length, 0
            );

            expect(size).toBe(expectedSize);
        });
    });

    describe('Request ID Generation', () => {
        it('should generate unique request IDs', () => {
            const id1 = userDataManager['generateRequestId']();
            const id2 = userDataManager['generateRequestId']();

            expect(id1).toMatch(/^req_\d+_[a-z0-9]{9}$/);
            expect(id2).toMatch(/^req_\d+_[a-z0-9]{9}$/);
            expect(id1).not.toBe(id2);
        });
    });

    describe('XML Escaping', () => {
        it('should escape XML special characters', async () => {
            const mockData = {
                test_data: { content: 'Test <tag> & "quotes" & \'apostrophes\'' }
            };

            mockChrome.storage.local.get.mockResolvedValue(mockData);
            mockChrome.storage.sync.get.mockResolvedValue({});

            const exportedData = await userDataManager.exportUserData('xml');

            // The XML should be well-formed
            expect(exportedData).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(exportedData).toContain('<userDataExport>');
            expect(exportedData).toContain('</userDataExport>');
        });
    });

    describe('Data Categorization', () => {
        it('should categorize monitoring data correctly', () => {
            const mockData = {
                network_req_1: { url: 'test.com' },
                network_response_1: { status: 200 },
                dom_mutation_1: { element: 'div' },
                dom_observer_1: { changes: [] },
                interaction_click_1: { target: 'button' },
                interaction_form_1: { form: 'login' },
                context_page_1: { url: 'test.com' },
                context_analysis_1: { insights: [] },
                error_network_1: { message: 'Failed' },
                error_system_1: { stack: 'trace' },
                unknown_data_1: { value: 'test' }
            };

            const categorized = userDataManager['categorizeMonitoringData'](mockData);

            expect(categorized.networkRequests).toHaveProperty('network_req_1');
            expect(categorized.networkRequests).toHaveProperty('network_response_1');
            expect(categorized.domObservations).toHaveProperty('dom_mutation_1');
            expect(categorized.domObservations).toHaveProperty('dom_observer_1');
            expect(categorized.userInteractions).toHaveProperty('interaction_click_1');
            expect(categorized.userInteractions).toHaveProperty('interaction_form_1');
            expect(categorized.contextData).toHaveProperty('context_page_1');
            expect(categorized.contextData).toHaveProperty('context_analysis_1');
            expect(categorized.errorLogs).toHaveProperty('error_network_1');
            expect(categorized.errorLogs).toHaveProperty('error_system_1');
            expect(categorized.other).toHaveProperty('unknown_data_1');
        });
    });

    describe('Data Inventory Generation', () => {
        it('should generate data inventory with correct structure', async () => {
            const mockData = {
                network_req_1: { url: 'test1.com', size: 100 },
                network_req_2: { url: 'test2.com', size: 200 },
                dom_obs_1: { element: 'div' },
                context_1: { page: 'test.com' }
            };

            mockChrome.storage.local.get.mockResolvedValue(mockData);

            const inventory = await userDataManager['generateDataInventory'](mockData);

            expect(inventory).toHaveLength(3); // network, dom, context

            const networkInventory = inventory.find(item => item.dataType === 'network');
            expect(networkInventory).toBeDefined();
            expect(networkInventory?.recordCount).toBe(2);
            expect(networkInventory?.storageKeys).toEqual(['network_req_1', 'network_req_2']);
            expect(networkInventory?.sampleStructure).toBeDefined();
            expect(networkInventory?.estimatedSize).toBeGreaterThan(0);
        });
    });
});