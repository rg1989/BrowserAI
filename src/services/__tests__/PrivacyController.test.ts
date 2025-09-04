import { PrivacyController } from '../PrivacyController';
import { PrivacyConfig } from '../../types/monitoring';

describe('PrivacyController', () => {
    let privacyController: PrivacyController;
    let mockConfig: PrivacyConfig;

    beforeEach(() => {
        mockConfig = {
            excludedDomains: ['blocked.com', 'private.org'],
            excludedPaths: ['/admin', '/private'],
            redactSensitiveData: true,
            sensitiveDataPatterns: [
                /password/i,
                /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
                /\b\d{3}-\d{2}-\d{4}\b/ // SSN
            ],
            dataRetentionDays: 7
        };

        privacyController = new PrivacyController(mockConfig);
    });

    describe('consent management', () => {
        it('should initialize without consent', () => {
            expect(privacyController.hasConsent()).toBe(false);
        });

        it('should set and get consent status', () => {
            privacyController.setConsent(true);
            expect(privacyController.hasConsent()).toBe(true);

            privacyController.setConsent(false);
            expect(privacyController.hasConsent()).toBe(false);
        });

        it('should clear data when consent is revoked', () => {
            privacyController.setConsent(true);
            privacyController.logDataCollection('test', 'https://example.com');

            expect(privacyController.getDataCollectionLog()).toHaveLength(1);

            privacyController.setConsent(false);
            expect(privacyController.getDataCollectionLog()).toHaveLength(0);
        });
    });

    describe('URL monitoring decisions', () => {
        beforeEach(() => {
            privacyController.setConsent(true);
        });

        it('should allow monitoring for normal URLs', () => {
            expect(privacyController.shouldMonitorUrl('https://example.com/api/data')).toBe(true);
            expect(privacyController.shouldMonitorUrl('https://api.service.com/v1/users')).toBe(true);
        });

        it('should block monitoring for excluded domains', () => {
            expect(privacyController.shouldMonitorUrl('https://blocked.com/api')).toBe(false);
            expect(privacyController.shouldMonitorUrl('https://sub.blocked.com/data')).toBe(false);
            expect(privacyController.shouldMonitorUrl('https://private.org/anything')).toBe(false);
        });

        it('should block monitoring for excluded paths', () => {
            expect(privacyController.shouldMonitorUrl('https://example.com/admin/users')).toBe(false);
            expect(privacyController.shouldMonitorUrl('https://example.com/private/data')).toBe(false);
            expect(privacyController.shouldMonitorUrl('https://example.com/public/data')).toBe(true);
        });

        it('should block monitoring without consent', () => {
            privacyController.setConsent(false);
            expect(privacyController.shouldMonitorUrl('https://example.com/api')).toBe(false);
        });

        it('should handle invalid URLs gracefully', () => {
            expect(privacyController.shouldMonitorUrl('not-a-url')).toBe(false);
            expect(privacyController.shouldMonitorUrl('')).toBe(false);
        });
    });

    describe('network data sanitization', () => {
        it('should sanitize URL with sensitive data', () => {
            const data = {
                url: 'https://example.com/api?password=secret123&user=john',
                headers: { 'Authorization': 'Bearer token123' },
                body: 'password=secret&data=normal'
            };

            const sanitized = privacyController.sanitizeNetworkData(data);

            expect(sanitized.url).toBe('https://example.com/api?[REDACTED]=secret123&user=john');
            expect(sanitized.headers?.['Authorization']).toBe('[REDACTED]');
            expect(sanitized.body).toBe('[REDACTED]=secret&data=normal');
        });

        it('should not sanitize when redaction is disabled', () => {
            const configWithoutRedaction = { ...mockConfig, redactSensitiveData: false };
            const controller = new PrivacyController(configWithoutRedaction);

            const data = {
                url: 'https://example.com/api?password=secret123',
                body: 'password=secret'
            };

            const sanitized = controller.sanitizeNetworkData(data);

            expect(sanitized.url).toBe('https://example.com/api?password=secret123');
            expect(sanitized.body).toBe('password=secret');
        });

        it('should sanitize sensitive headers', () => {
            const data = {
                url: 'https://example.com/api',
                headers: {
                    'Authorization': 'Bearer token123',
                    'Cookie': 'session=abc123',
                    'X-API-Key': 'key123',
                    'Content-Type': 'application/json'
                }
            };

            const sanitized = privacyController.sanitizeNetworkData(data);

            expect(sanitized.headers?.['Authorization']).toBe('[REDACTED]');
            expect(sanitized.headers?.['Cookie']).toBe('[REDACTED]');
            expect(sanitized.headers?.['X-API-Key']).toBe('[REDACTED]');
            expect(sanitized.headers?.['Content-Type']).toBe('application/json');
        });
    });

    describe('DOM content sanitization', () => {
        it('should sanitize DOM content with sensitive patterns', () => {
            const content = 'User password: secret123, Credit card: 1234-5678-9012-3456, SSN: 123-45-6789';
            const sanitized = privacyController.sanitizeDOMContent(content);

            expect(sanitized).toBe('User [REDACTED]: secret123, Credit card: [REDACTED], SSN: [REDACTED]');
        });

        it('should not sanitize when redaction is disabled', () => {
            const configWithoutRedaction = { ...mockConfig, redactSensitiveData: false };
            const controller = new PrivacyController(configWithoutRedaction);

            const content = 'User password: secret123';
            const sanitized = controller.sanitizeDOMContent(content);

            expect(sanitized).toBe('User password: secret123');
        });
    });

    describe('form data sanitization', () => {
        it('should sanitize sensitive form fields', () => {
            const formData = {
                username: 'john',
                password: 'secret123',
                email: 'john@example.com',
                creditCard: '1234-5678-9012-3456',
                normalField: 'normal data'
            };

            const sanitized = privacyController.sanitizeFormData(formData);

            expect(sanitized.username).toBe('john');
            expect(sanitized.password).toBe('[REDACTED]');
            expect(sanitized.email).toBe('john@example.com');
            expect(sanitized.creditCard).toBe('[REDACTED]');
            expect(sanitized.normalField).toBe('normal data');
        });

        it('should sanitize field values with sensitive patterns', () => {
            const formData = {
                notes: 'My password is secret123',
                description: 'Credit card number: 1234-5678-9012-3456'
            };

            const sanitized = privacyController.sanitizeFormData(formData);

            expect(sanitized.notes).toBe('My [REDACTED] is secret123');
            expect(sanitized.description).toBe('Credit card number: [REDACTED]');
        });
    });

    describe('data collection logging', () => {
        beforeEach(() => {
            privacyController.setConsent(true);
        });

        it('should log data collection activity', () => {
            privacyController.logDataCollection('network-request', 'https://example.com/api');
            privacyController.logDataCollection('dom-change', 'https://example.com/page');

            const log = privacyController.getDataCollectionLog();
            expect(log).toHaveLength(2);
            expect(log[0].type).toBe('network-request');
            expect(log[0].url).toBe('https://example.com/api');
            expect(log[1].type).toBe('dom-change');
        });

        it('should limit log size to 1000 entries', () => {
            // Add 1100 entries
            for (let i = 0; i < 1100; i++) {
                privacyController.logDataCollection('test', `https://example.com/${i}`);
            }

            const log = privacyController.getDataCollectionLog();
            expect(log).toHaveLength(1000);

            // Should keep the most recent 1000
            expect(log[0].url).toBe('https://example.com/100');
            expect(log[999].url).toBe('https://example.com/1099');
        });

        it('should sanitize URLs in log entries', () => {
            privacyController.logDataCollection('test', 'https://example.com/api?password=secret');

            const log = privacyController.getDataCollectionLog();
            expect(log[0].url).toBe('https://example.com/api?[REDACTED]=secret');
        });
    });

    describe('data retention', () => {
        it('should check if data is expired', () => {
            const now = new Date();
            const oldDate = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
            const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

            expect(privacyController.isDataExpired(oldDate)).toBe(true);
            expect(privacyController.isDataExpired(recentDate)).toBe(false);
            expect(privacyController.isDataExpired(now)).toBe(false);
        });
    });

    describe('privacy reporting', () => {
        beforeEach(() => {
            privacyController.setConsent(true);
        });

        it('should generate privacy compliance report', () => {
            privacyController.logDataCollection('test1', 'https://example.com/1');
            privacyController.logDataCollection('test2', 'https://example.com/2');

            const report = privacyController.getPrivacyReport();

            expect(report.consentStatus).toBe(true);
            expect(report.dataRetentionDays).toBe(7);
            expect(report.excludedDomains).toEqual(['blocked.com', 'private.org']);
            expect(report.excludedPaths).toEqual(['/admin', '/private']);
            expect(report.sensitiveDataRedaction).toBe(true);
            expect(report.recentDataCollection).toBe(2);
        });

        it('should count only recent data collection in report', () => {
            // Mock older timestamp
            const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
            privacyController.logDataCollection('old', 'https://example.com/old');

            // Manually set older timestamp (this is a test hack)
            const log = privacyController.getDataCollectionLog();
            if (log.length > 0) {
                log[0].timestamp = oldTimestamp;
            }

            privacyController.logDataCollection('recent', 'https://example.com/recent');

            const report = privacyController.getPrivacyReport();
            expect(report.recentDataCollection).toBe(1); // Only recent one
        });
    });

    describe('configuration updates', () => {
        it('should update privacy configuration', () => {
            privacyController.setConsent(true); // Need consent for URL monitoring

            // Test initial state
            expect(privacyController.shouldMonitorUrl('https://blocked.com/api')).toBe(false); // Should be blocked initially
            expect(privacyController.shouldMonitorUrl('https://allowed.com/api')).toBe(true); // Should be allowed

            const newConfig: PrivacyConfig = {
                ...mockConfig,
                excludedDomains: ['newblocked.com'],
                redactSensitiveData: false
            };

            privacyController.updateConfig(newConfig);

            expect(privacyController.shouldMonitorUrl('https://blocked.com/api')).toBe(true); // Old exclusion removed
            expect(privacyController.shouldMonitorUrl('https://newblocked.com/api')).toBe(false); // New exclusion
        });
    });

    describe('data clearing', () => {
        it('should clear all collected data', () => {
            privacyController.setConsent(true);
            privacyController.logDataCollection('test', 'https://example.com');

            expect(privacyController.getDataCollectionLog()).toHaveLength(1);

            privacyController.clearAllData();
            expect(privacyController.getDataCollectionLog()).toHaveLength(0);
        });
    });
});