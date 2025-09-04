import { PrivacyConfig } from '../types/monitoring';

/**
 * Privacy controller for managing data protection and user consent
 * Handles sensitive data detection, redaction, and privacy compliance
 */
export class PrivacyController {
    private config: PrivacyConfig;
    private consentGiven: boolean = false;
    private dataCollectionLog: Array<{ timestamp: Date; type: string; url: string }> = [];

    constructor(config: PrivacyConfig) {
        this.config = config;
    }

    /**
     * Update privacy configuration
     */
    updateConfig(config: PrivacyConfig): void {
        this.config = config;
    }

    /**
     * Set user consent status
     */
    setConsent(consent: boolean): void {
        this.consentGiven = consent;
        if (!consent) {
            this.clearAllData();
        }
    }

    /**
     * Check if user has given consent for data collection
     */
    hasConsent(): boolean {
        return this.consentGiven;
    }

    /**
     * Check if a URL should be monitored based on privacy settings
     */
    shouldMonitorUrl(url: string): boolean {
        if (!this.consentGiven) {
            return false;
        }

        try {
            const urlObj = new URL(url);

            // Check excluded domains
            if (this.config.excludedDomains.some(domain =>
                urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
            )) {
                return false;
            }

            // Check excluded paths
            if (this.config.excludedPaths.some(path =>
                urlObj.pathname.includes(path) || new RegExp(path).test(urlObj.pathname)
            )) {
                return false;
            }

            return true;
        } catch (error) {
            // Invalid URL, don't monitor
            return false;
        }
    }

    /**
     * Sanitize network request data based on privacy settings
     */
    sanitizeNetworkData(data: {
        url: string;
        headers?: Record<string, string>;
        body?: string;
    }): {
        url: string;
        headers?: Record<string, string>;
        body?: string;
    } {
        if (!this.config.redactSensitiveData) {
            return { ...data };
        }

        const sanitized = { ...data };

        // Redact sensitive data from URL
        if (sanitized.url) {
            sanitized.url = this.redactSensitiveData(sanitized.url);
        }

        // Sanitize headers
        if (sanitized.headers) {
            sanitized.headers = this.sanitizeHeaders(sanitized.headers);
        }

        // Sanitize body
        if (sanitized.body) {
            sanitized.body = this.redactSensitiveData(sanitized.body);
        }

        return sanitized;
    }

    /**
     * Sanitize DOM content based on privacy settings
     */
    sanitizeDOMContent(content: string): string {
        if (!this.config.redactSensitiveData) {
            return content;
        }

        return this.redactSensitiveData(content);
    }

    /**
     * Sanitize form data to remove sensitive information
     */
    sanitizeFormData(formData: Record<string, string>): Record<string, string> {
        if (!this.config.redactSensitiveData) {
            return formData;
        }

        const sanitized: Record<string, string> = {};

        Object.entries(formData).forEach(([key, value]) => {
            // Check if field name suggests sensitive data
            const sensitiveFieldNames = [
                'password', 'pwd', 'pass', 'secret', 'token', 'key',
                'ssn', 'social', 'credit', 'card', 'cvv', 'cvc',
                'pin', 'account', 'routing', 'bank'
            ];

            const isSensitiveField = sensitiveFieldNames.some(sensitive =>
                key.toLowerCase().includes(sensitive)
            );

            if (isSensitiveField) {
                sanitized[key] = '[REDACTED]';
            } else {
                sanitized[key] = this.redactSensitiveData(value);
            }
        });

        return sanitized;
    }

    /**
     * Log data collection activity for transparency
     */
    logDataCollection(type: string, url: string): void {
        this.dataCollectionLog.push({
            timestamp: new Date(),
            type,
            url: this.redactSensitiveData(url)
        });

        // Keep only recent logs (last 1000 entries)
        if (this.dataCollectionLog.length > 1000) {
            this.dataCollectionLog = this.dataCollectionLog.slice(-1000);
        }
    }

    /**
     * Get data collection activity log
     */
    getDataCollectionLog(): Array<{ timestamp: Date; type: string; url: string }> {
        return [...this.dataCollectionLog];
    }

    /**
     * Clear all collected data
     */
    clearAllData(): void {
        this.dataCollectionLog = [];
        // This would also trigger clearing of stored monitoring data
        // Implementation depends on storage system
    }

    /**
     * Check if data retention period has expired
     */
    isDataExpired(timestamp: Date): boolean {
        const retentionMs = this.config.dataRetentionDays * 24 * 60 * 60 * 1000;
        return Date.now() - timestamp.getTime() > retentionMs;
    }

    /**
     * Get privacy compliance report
     */
    getPrivacyReport(): {
        consentStatus: boolean;
        dataRetentionDays: number;
        excludedDomains: string[];
        excludedPaths: string[];
        sensitiveDataRedaction: boolean;
        recentDataCollection: number;
    } {
        const recentCollections = this.dataCollectionLog.filter(
            log => Date.now() - log.timestamp.getTime() < 24 * 60 * 60 * 1000
        );

        return {
            consentStatus: this.consentGiven,
            dataRetentionDays: this.config.dataRetentionDays,
            excludedDomains: [...this.config.excludedDomains],
            excludedPaths: [...this.config.excludedPaths],
            sensitiveDataRedaction: this.config.redactSensitiveData,
            recentDataCollection: recentCollections.length
        };
    }

    private redactSensitiveData(data: string): string {
        let redacted = data;

        this.config.sensitiveDataPatterns.forEach(pattern => {
            redacted = redacted.replace(pattern, '[REDACTED]');
        });

        return redacted;
    }

    private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
        const sanitized: Record<string, string> = {};
        const sensitiveHeaders = [
            'authorization', 'cookie', 'set-cookie', 'x-api-key',
            'x-auth-token', 'x-access-token', 'bearer', 'basic'
        ];

        Object.entries(headers).forEach(([key, value]) => {
            const isSensitive = sensitiveHeaders.some(sensitive =>
                key.toLowerCase().includes(sensitive)
            );

            if (isSensitive) {
                sanitized[key] = '[REDACTED]';
            } else {
                sanitized[key] = this.redactSensitiveData(value);
            }
        });

        return sanitized;
    }
}