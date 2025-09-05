/**
 * Privacy Controller Tests
 * Tests for privacy compliance, consent management, and data protection
 */

import { PrivacyController } from '../PrivacyController';
import { PrivacyConfig, ConsentStatus } from '../../types/privacy';

// Mock Chrome APIs
const mockChrome = {
    storage: {
        sync: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn()
        },
        local: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn(),
            clear: jest.fn()
        }
    },
    runtime: {
        getManifest: jest.fn(() => ({ version: '1.0.0' }))
    }
};

// @ts-ignore
global.chrome = mockChrome;

// Mock DOM methods
const mockDocument = {
    createElement: jest.fn(() => ({
        className: '',
        innerHTML: '',
        appendChild: jest.fn(),
        querySelector: jest.fn(),
        addEventListener: jest.fn()
    })),
    body: {
        appendChild: jest.fn(),
        removeChild: jest.fn()
    }
};

// @ts-ignore
global.document = mockDocument;

describe('PrivacyController', () => {
    let privacyController: PrivacyController;
    let mockConfig: PrivacyConfig;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfig = {
            excludedDomains: ['example.com', '*.test.com'],
            excludedPaths: ['/admin/*', '/private'],
            redactSensitiveData: true,
            sensitiveDataPatterns: [/password/gi, /token/gi],
            dataRetentionDays: 30,
            enableDataExport: true,
            enableDataDeletion: true,
            requireExplicitConsent: true,
            consentRenewalDays: 365
        };

        privacyController = new PrivacyController(mockConfig);
    });

    describe('Consent Management', () => {
        it('should initialize with no consent by default', () => {
            const consentStatus = privacyController.getConsentStatus();

            expect(consentStatus.networkMonitoring).toBe(false);
            expect(consentStatus.domObservation).toBe(false);
            expect(consentStatus.contextCollection).toBe(false);
            expect(consentStatus.dataStorage).toBe(false);
            expect(consentStatus.consentTimestamp).toBeNull();
        });

        it('should load existing consent from storage', async () => {
            const existingConsent: ConsentStatus = {
                networkMonitoring: true,
                domObservation: true,
                contextCollection: false,
                dataStorage: true,
                consentTimestamp: new Date(), // Use current date to avoid expiration
                consentVersion: '1.0.0'
            };

            mockChrome.storage.sync.get.mockResolvedValue({
                privacyConsent: existingConsent
            });

            const consentStatus = await privacyController.initializeConsent();

            expect(consentStatus).toEqual(existingConsent);
            expect(mockChrome.storage.sync.get).toHaveBeenCalledWith(['privacyConsent']);
        });

        it('should detect expired consent', async () => {
            const expiredConsent: ConsentStatus = {
                networkMonitoring: true,
                domObservation: true,
                contextCollection: true,
                dataStorage: true,
                consentTimestamp: new Date('2022-01-01'), // Over 1 year ago
                consentVersion: '1.0.0'
            };

            mockChrome.storage.sync.get.mockResolvedValue({
                privacyConsent: expiredConsent
            });

            // Mock the privacy disclosure to avoid DOM manipulation in tests
            jest.spyOn(privacyController as any, 'showPrivacyDisclosure').mockResolvedValue(true);

            await privacyController.initializeConsent();

            expect(privacyController['showPrivacyDisclosure']).toHaveBeenCalled();
        });

        it('should grant full consent', async () => {
            await privacyController.grantFullConsent();

            const consentStatus = privacyController.getConsentStatus();
            expect(consentStatus.networkMonitoring).toBe(true);
            expect(consentStatus.domObservation).toBe(true);
            expect(consentStatus.contextCollection).toBe(true);
            expect(consentStatus.dataStorage).toBe(true);
            expect(consentStatus.consentTimestamp).toBeInstanceOf(Date);

            expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
                privacyConsent: expect.objectContaining({
                    networkMonitoring: true,
                    domObservation: true,
                    contextCollection: true,
                    dataStorage: true
                })
            });
        });

        it('should decline all consent', async () => {
            await privacyController.declineAllConsent();

            const consentStatus = privacyController.getConsentStatus();
            expect(consentStatus.networkMonitoring).toBe(false);
            expect(consentStatus.domObservation).toBe(false);
            expect(consentStatus.contextCollection).toBe(false);
            expect(consentStatus.dataStorage).toBe(false);
            expect(consentStatus.consentTimestamp).toBeInstanceOf(Date);
        });

        it('should set custom consent preferences', async () => {
            const customPreferences = {
                networkMonitoring: true,
                domObservation: false,
                contextCollection: true,
                dataStorage: false
            };

            await privacyController.setCustomConsent(customPreferences);

            const consentStatus = privacyController.getConsentStatus();
            expect(consentStatus.networkMonitoring).toBe(true);
            expect(consentStatus.domObservation).toBe(false);
            expect(consentStatus.contextCollection).toBe(true);
            expect(consentStatus.dataStorage).toBe(false);
        });

        it('should check consent for specific features', () => {
            privacyController['consentStatus'] = {
                networkMonitoring: true,
                domObservation: false,
                contextCollection: true,
                dataStorage: false,
                consentTimestamp: new Date(),
                consentVersion: '1.0.0'
            };

            expect(privacyController.hasConsent('networkMonitoring')).toBe(true);
            expect(privacyController.hasConsent('domObservation')).toBe(false);
            expect(privacyController.hasConsent('contextCollection')).toBe(true);
            expect(privacyController.hasConsent('dataStorage')).toBe(false);
        });
    });

    describe('Domain and Path Exclusion', () => {
        it('should exclude exact domain matches', () => {
            expect(privacyController.isDomainExcluded('example.com')).toBe(true);
            expect(privacyController.isDomainExcluded('other.com')).toBe(false);
        });

        it('should exclude wildcard domain matches', () => {
            expect(privacyController.isDomainExcluded('sub.test.com')).toBe(true);
            expect(privacyController.isDomainExcluded('another.test.com')).toBe(true);
            expect(privacyController.isDomainExcluded('test.com')).toBe(true);
            expect(privacyController.isDomainExcluded('example.org')).toBe(false);
        });

        it('should exclude exact path matches', () => {
            expect(privacyController.isPathExcluded('/private')).toBe(true);
            expect(privacyController.isPathExcluded('/private/sub')).toBe(true);
            expect(privacyController.isPathExcluded('/public')).toBe(false);
        });

        it('should exclude wildcard path matches', () => {
            expect(privacyController.isPathExcluded('/admin/users')).toBe(true);
            expect(privacyController.isPathExcluded('/admin/settings')).toBe(true);
            expect(privacyController.isPathExcluded('/user/profile')).toBe(false);
        });
    });

    describe('Sensitive Data Redaction', () => {
        it('should redact sensitive data using configured patterns', () => {
            const sensitiveText = 'User password is secret123 and token is abc123';
            const redacted = privacyController.redactSensitiveData(sensitiveText);

            expect(redacted).toBe('User [REDACTED] is secret123 and [REDACTED] is abc123');
        });

        it('should redact common sensitive patterns', () => {
            const testCases = [
                {
                    input: 'Email: user@example.com',
                    expected: 'Email: [REDACTED]'
                },
                {
                    input: 'Card: 1234-5678-9012-3456',
                    expected: 'Card: [REDACTED]'
                },
                {
                    input: 'SSN: 123-45-6789',
                    expected: 'SSN: [REDACTED]'
                },
                {
                    input: '{"password": "secret123"}',
                    expected: '{"password": "[REDACTED]"}'
                },
                {
                    input: '{"token": "abc123xyz"}',
                    expected: '{"token": "[REDACTED]"}'
                },
                {
                    input: '{"key": "api-key-123"}',
                    expected: '{"key": "[REDACTED]"}'
                }
            ];

            testCases.forEach(({ input, expected }) => {
                const result = privacyController.redactSensitiveData(input);
                expect(result).toBe(expected);
            });
        });

        it('should handle text without sensitive data', () => {
            const normalText = 'This is normal text without sensitive information';
            const result = privacyController.redactSensitiveData(normalText);

            expect(result).toBe(normalText);
        });
    });

    describe('Data Export', () => {
        it('should export user data in JSON format', async () => {
            const mockLocalData = {
                network_req_1: { url: 'https://api.example.com', method: 'GET' },
                dom_obs_1: { element: 'div', change: 'added' }
            };

            const mockSyncData = {
                privacyConsent: {
                    networkMonitoring: true,
                    domObservation: true,
                    contextCollection: false,
                    dataStorage: true,
                    consentTimestamp: new Date(),
                    consentVersion: '1.0.0'
                }
            };

            mockChrome.storage.local.get.mockResolvedValue(mockLocalData);
            mockChrome.storage.sync.get.mockResolvedValue(mockSyncData);

            const exportedData = await privacyController.exportUserData();
            const parsedData = JSON.parse(exportedData);

            expect(parsedData).toHaveProperty('timestamp');
            expect(parsedData).toHaveProperty('version');
            expect(parsedData).toHaveProperty('consent');
            expect(parsedData).toHaveProperty('monitoringData');
            expect(parsedData.consent).toHaveProperty('networkMonitoring');
            expect(parsedData.consent).toHaveProperty('domObservation');
            expect(parsedData.consent).toHaveProperty('contextCollection');
            expect(parsedData.consent).toHaveProperty('dataStorage');
        });

        it('should handle export errors gracefully', async () => {
            mockChrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

            await expect(privacyController.exportUserData()).rejects.toThrow('Data export failed');
        });
    });

    describe('Data Deletion', () => {
        it('should delete all user data', async () => {
            const mockSyncData = {
                privacyConsent: { networkMonitoring: true },
                extensionEnabled: true,
                otherSetting: 'value'
            };

            mockChrome.storage.sync.get.mockResolvedValue(mockSyncData);

            await privacyController.deleteAllUserData();

            expect(mockChrome.storage.local.clear).toHaveBeenCalled();
            expect(mockChrome.storage.sync.remove).toHaveBeenCalledWith(['privacyConsent', 'otherSetting']);
        });

        it('should handle deletion errors gracefully', async () => {
            mockChrome.storage.local.clear.mockRejectedValue(new Error('Storage error'));

            await expect(privacyController.deleteAllUserData()).rejects.toThrow('Data deletion failed');
        });
    });

    describe('Data Retention', () => {
        it('should apply retention policies', async () => {
            const mockData = {
                network_req_1: { timestamp: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) }, // 40 days old
                network_req_2: { timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }, // 10 days old
                dom_obs_1: { timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) } // 20 days old
            };

            mockChrome.storage.local.get.mockResolvedValue(mockData);

            await privacyController.applyRetentionPolicies();

            // Should remove network_req_1 (older than 30 days)
            expect(mockChrome.storage.local.remove).toHaveBeenCalledWith(['network_req_1']);
        });

        it('should update configuration and reinitialize policies', () => {
            const newConfig = {
                dataRetentionDays: 60,
                excludedDomains: ['newdomain.com']
            };

            privacyController.updateConfig(newConfig);

            expect(privacyController['config'].dataRetentionDays).toBe(60);
            expect(privacyController['config'].excludedDomains).toContain('newdomain.com');
        });
    });

    describe('Privacy Modal Creation', () => {
        it('should create privacy modal with correct structure', () => {
            const mockElement = {
                className: '',
                innerHTML: '',
                appendChild: jest.fn(),
                querySelector: jest.fn(() => ({
                    addEventListener: jest.fn()
                }))
            };

            document.createElement = jest.fn(() => mockElement as any);

            const modal = privacyController['createPrivacyModal']();

            expect(document.createElement).toHaveBeenCalledWith('div');
            expect(mockElement.className).toBe('spotlight-privacy-modal');
            expect(mockElement.innerHTML).toContain('Privacy & Data Collection Notice');
            expect(mockElement.innerHTML).toContain('What We Monitor');
            expect(mockElement.innerHTML).toContain('How We Protect Your Privacy');
            expect(mockElement.innerHTML).toContain('Your Choices');
        });
    });

    describe('Compliance Validation', () => {
        it('should validate GDPR compliance requirements', () => {
            // Test that all required GDPR features are implemented
            expect(typeof privacyController.exportUserData).toBe('function');
            expect(typeof privacyController.deleteAllUserData).toBe('function');
            expect(typeof privacyController.hasConsent).toBe('function');
            expect(typeof privacyController.getConsentStatus).toBe('function');
        });

        it('should ensure consent is required for data processing', () => {
            // Without consent, features should not be allowed
            expect(privacyController.hasConsent('networkMonitoring')).toBe(false);
            expect(privacyController.hasConsent('domObservation')).toBe(false);
            expect(privacyController.hasConsent('contextCollection')).toBe(false);
            expect(privacyController.hasConsent('dataStorage')).toBe(false);
        });

        it('should provide clear consent withdrawal mechanism', async () => {
            // Grant consent first
            await privacyController.grantFullConsent();
            expect(privacyController.hasConsent('networkMonitoring')).toBe(true);

            // Then withdraw consent
            await privacyController.declineAllConsent();
            expect(privacyController.hasConsent('networkMonitoring')).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('should handle storage errors gracefully', async () => {
            mockChrome.storage.sync.get.mockRejectedValue(new Error('Storage unavailable'));

            const consentStatus = await privacyController.initializeConsent();

            // Should return default consent status on error
            expect(consentStatus.networkMonitoring).toBe(false);
            expect(consentStatus.consentTimestamp).toBeNull();
        });

        it('should handle malformed stored consent data', async () => {
            mockChrome.storage.sync.get.mockResolvedValue({
                privacyConsent: 'invalid-data'
            });

            // Should not throw error and handle gracefully
            await expect(privacyController.initializeConsent()).resolves.toBeDefined();
        });
    });
});