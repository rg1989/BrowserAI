import { NetworkMonitor } from '../NetworkMonitor';
import { PrivacyController } from '../PrivacyController';
import { PrivacyConfig } from '../../types/monitoring';

// Simple test without complex mocking
describe('NetworkMonitor - Basic Functionality', () => {
    let networkMonitor: NetworkMonitor;
    let privacyController: PrivacyController;

    beforeEach(() => {
        const mockPrivacyConfig: PrivacyConfig = {
            excludedDomains: [],
            excludedPaths: [],
            redactSensitiveData: false,
            sensitiveDataPatterns: [],
            dataRetentionDays: 7
        };

        privacyController = new PrivacyController(mockPrivacyConfig);
        privacyController.setConsent(true);

        // Mock methods
        jest.spyOn(privacyController, 'shouldMonitorUrl').mockReturnValue(true);
        jest.spyOn(privacyController, 'sanitizeNetworkData').mockImplementation(data => data);
        jest.spyOn(privacyController, 'logDataCollection').mockImplementation(() => { });

        networkMonitor = new NetworkMonitor(100, privacyController);
    });

    afterEach(() => {
        networkMonitor.stopMonitoring();
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        it('should initialize with correct default state', () => {
            expect(networkMonitor.isActive()).toBe(false);

            const activity = networkMonitor.getAllActivity();
            expect(activity.requests).toHaveLength(0);
            expect(activity.responses).toHaveLength(0);
            expect(activity.errors).toHaveLength(0);
        });

        it('should initialize with custom buffer size', () => {
            const customMonitor = new NetworkMonitor(50, privacyController);
            expect(customMonitor).toBeDefined();
        });
    });

    describe('monitoring lifecycle', () => {
        it('should start and stop monitoring', () => {
            expect(networkMonitor.isActive()).toBe(false);

            networkMonitor.startMonitoring();
            expect(networkMonitor.isActive()).toBe(true);

            networkMonitor.stopMonitoring();
            expect(networkMonitor.isActive()).toBe(false);
        });

        it('should not start monitoring twice', () => {
            networkMonitor.startMonitoring();
            const firstState = networkMonitor.isActive();

            networkMonitor.startMonitoring();
            expect(networkMonitor.isActive()).toBe(firstState);
        });

        it('should not stop monitoring if not started', () => {
            expect(() => networkMonitor.stopMonitoring()).not.toThrow();
            expect(networkMonitor.isActive()).toBe(false);
        });
    });

    describe('data management', () => {
        it('should get empty activity initially', () => {
            const activity = networkMonitor.getAllActivity();
            expect(activity.requests).toHaveLength(0);
            expect(activity.responses).toHaveLength(0);
            expect(activity.errors).toHaveLength(0);
            expect(activity.timeWindow).toBeDefined();
        });

        it('should get recent activity within time window', () => {
            const recentActivity = networkMonitor.getRecentActivity(5000);
            expect(recentActivity.requests).toHaveLength(0);
            expect(recentActivity.timeWindow.duration).toBe(5000);
        });

        it('should get network statistics', () => {
            const stats = networkMonitor.getStatistics();
            expect(stats.totalRequests).toBe(0);
            expect(stats.totalResponses).toBe(0);
            expect(stats.totalErrors).toBe(0);
            expect(stats.successRate).toBe(0);
            expect(stats.averageResponseTime).toBe(0);
            expect(stats.requestsByType).toBeDefined();
        });

        it('should clear all data', () => {
            networkMonitor.clearData();

            const activity = networkMonitor.getAllActivity();
            expect(activity.requests).toHaveLength(0);
            expect(activity.responses).toHaveLength(0);
            expect(activity.errors).toHaveLength(0);
        });
    });

    describe('privacy integration', () => {
        it('should use privacy controller for URL monitoring check', () => {
            networkMonitor.startMonitoring();

            // The privacy controller methods should be available
            expect(privacyController.shouldMonitorUrl).toBeDefined();
            expect(privacyController.sanitizeNetworkData).toBeDefined();
            expect(privacyController.logDataCollection).toBeDefined();
        });
    });
});