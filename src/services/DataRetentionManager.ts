/**
 * Data Retention Manager for automated cleanup and compliance
 * Handles data lifecycle management and retention policy enforcement
 */

import { DataRetentionPolicy, PrivacyConfig, ComplianceReport, DataInventoryItem } from "../types/privacy";

export class DataRetentionManager {
    private policies: Map<string, DataRetentionPolicy> = new Map();
    private cleanupIntervals: Map<string, NodeJS.Timeout> = new Map();
    private config: PrivacyConfig;

    constructor(config: PrivacyConfig) {
        this.config = config;
        this.initializeDefaultPolicies();
    }

    /**
     * Initialize default retention policies for different data types
     */
    private initializeDefaultPolicies(): void {
        const defaultPolicies: DataRetentionPolicy[] = [
            {
                dataType: 'network_requests',
                retentionDays: this.config.dataRetentionDays,
                cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
                compressionAfterDays: 7,
                autoCleanup: true
            },
            {
                dataType: 'dom_observations',
                retentionDays: Math.min(this.config.dataRetentionDays, 14), // Max 14 days for DOM data
                cleanupInterval: 12 * 60 * 60 * 1000, // 12 hours
                compressionAfterDays: 3,
                autoCleanup: true
            },
            {
                dataType: 'user_interactions',
                retentionDays: this.config.dataRetentionDays,
                cleanupInterval: 24 * 60 * 60 * 1000,
                compressionAfterDays: 7,
                autoCleanup: true
            },
            {
                dataType: 'context_data',
                retentionDays: this.config.dataRetentionDays,
                cleanupInterval: 24 * 60 * 60 * 1000,
                compressionAfterDays: 5,
                autoCleanup: true
            },
            {
                dataType: 'error_logs',
                retentionDays: 30, // Keep error logs longer for debugging
                cleanupInterval: 24 * 60 * 60 * 1000,
                compressionAfterDays: 7,
                autoCleanup: true
            },
            {
                dataType: 'audit_logs',
                retentionDays: 365, // Keep audit logs for 1 year
                cleanupInterval: 7 * 24 * 60 * 60 * 1000, // Weekly cleanup
                compressionAfterDays: 30,
                autoCleanup: true
            }
        ];

        defaultPolicies.forEach(policy => {
            this.policies.set(policy.dataType, policy);
        });
    }

    /**
     * Start automated cleanup processes
     */
    startAutomatedCleanup(): void {
        this.policies.forEach((policy, dataType) => {
            if (policy.autoCleanup) {
                const interval = setInterval(
                    () => this.performCleanup(dataType),
                    policy.cleanupInterval
                );
                this.cleanupIntervals.set(dataType, interval);
            }
        });

        console.log(`Started automated cleanup for ${this.cleanupIntervals.size} data types`);
    }

    /**
     * Stop automated cleanup processes
     */
    stopAutomatedCleanup(): void {
        this.cleanupIntervals.forEach((interval, dataType) => {
            clearInterval(interval);
        });
        this.cleanupIntervals.clear();
        console.log("Stopped all automated cleanup processes");
    }

    /**
     * Perform cleanup for a specific data type
     */
    async performCleanup(dataType: string): Promise<void> {
        const policy = this.policies.get(dataType);
        if (!policy) {
            console.warn(`No retention policy found for data type: ${dataType}`);
            return;
        }

        try {
            const deletedCount = await this.deleteExpiredData(dataType, policy);
            const compressedCount = await this.compressOldData(dataType, policy);

            if (deletedCount > 0 || compressedCount > 0) {
                console.log(`Cleanup completed for ${dataType}: ${deletedCount} deleted, ${compressedCount} compressed`);
            }

            // Update last cleanup timestamp
            await this.updateLastCleanupTimestamp(dataType);
        } catch (error) {
            console.error(`Cleanup failed for ${dataType}:`, error);
        }
    }

    /**
     * Delete expired data based on retention policy
     */
    private async deleteExpiredData(dataType: string, policy: DataRetentionPolicy): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

        try {
            // Get all storage data
            const allData = await chrome.storage.local.get(null);
            const keysToDelete: string[] = [];

            // Find expired keys for this data type
            Object.entries(allData).forEach(([key, value]) => {
                if (this.isDataTypeKey(key, dataType) && this.isExpired(value, cutoffDate)) {
                    keysToDelete.push(key);
                }
            });

            // Delete expired data
            if (keysToDelete.length > 0) {
                await chrome.storage.local.remove(keysToDelete);
            }

            return keysToDelete.length;
        } catch (error) {
            console.error(`Failed to delete expired data for ${dataType}:`, error);
            return 0;
        }
    }

    /**
     * Compress old data to save storage space
     */
    private async compressOldData(dataType: string, policy: DataRetentionPolicy): Promise<number> {
        if (!policy.compressionAfterDays) return 0;

        const compressionDate = new Date();
        compressionDate.setDate(compressionDate.getDate() - policy.compressionAfterDays);

        try {
            const allData = await chrome.storage.local.get(null);
            let compressedCount = 0;

            for (const [key, value] of Object.entries(allData)) {
                if (this.isDataTypeKey(key, dataType) && this.shouldCompress(value, compressionDate)) {
                    const compressed = await this.compressData(value);
                    if (compressed && compressed.length < JSON.stringify(value).length) {
                        await chrome.storage.local.set({
                            [key]: {
                                ...value,
                                compressed: true,
                                data: compressed,
                                originalSize: JSON.stringify(value).length
                            }
                        });
                        compressedCount++;
                    }
                }
            }

            return compressedCount;
        } catch (error) {
            console.error(`Failed to compress data for ${dataType}:`, error);
            return 0;
        }
    }

    /**
     * Check if a storage key belongs to a specific data type
     */
    private isDataTypeKey(key: string, dataType: string): boolean {
        return key.startsWith(`${dataType}_`) || key.includes(`_${dataType}_`);
    }

    /**
     * Check if data is expired based on timestamp
     */
    private isExpired(data: any, cutoffDate: Date): boolean {
        if (!data || typeof data !== 'object') return false;

        const timestamp = data.timestamp || data.createdAt || data.date;
        if (!timestamp) return false;

        try {
            const dataDate = new Date(timestamp);
            return dataDate < cutoffDate;
        } catch {
            return false;
        }
    }

    /**
     * Check if data should be compressed
     */
    private shouldCompress(data: any, compressionDate: Date): boolean {
        if (!data || typeof data !== 'object' || data.compressed) return false;

        const timestamp = data.timestamp || data.createdAt || data.date;
        if (!timestamp) return false;

        try {
            const dataDate = new Date(timestamp);
            return dataDate < compressionDate;
        } catch {
            return false;
        }
    }

    /**
     * Compress data using simple JSON compression
     */
    private async compressData(data: any): Promise<string | null> {
        try {
            // Simple compression by removing whitespace and shortening keys
            const jsonString = JSON.stringify(data);

            // Basic compression: remove unnecessary whitespace and use shorter keys
            const compressed = jsonString
                .replace(/\s+/g, ' ')
                .replace(/"timestamp":/g, '"ts":')
                .replace(/"createdAt":/g, '"ca":')
                .replace(/"updatedAt":/g, '"ua":')
                .replace(/"data":/g, '"d":')
                .replace(/"type":/g, '"t":')
                .replace(/"url":/g, '"u":')
                .replace(/"method":/g, '"m":')
                .replace(/"headers":/g, '"h":')
                .replace(/"body":/g, '"b":');

            return compressed.length < jsonString.length ? compressed : null;
        } catch (error) {
            console.error("Failed to compress data:", error);
            return null;
        }
    }

    /**
     * Update last cleanup timestamp for a data type
     */
    private async updateLastCleanupTimestamp(dataType: string): Promise<void> {
        try {
            const key = `cleanup_${dataType}_last`;
            await chrome.storage.local.set({
                [key]: {
                    timestamp: new Date().toISOString(),
                    dataType
                }
            });
        } catch (error) {
            console.error(`Failed to update cleanup timestamp for ${dataType}:`, error);
        }
    }

    /**
     * Get data inventory for compliance reporting
     */
    async getDataInventory(): Promise<DataInventoryItem[]> {
        const inventory: DataInventoryItem[] = [];

        try {
            const allData = await chrome.storage.local.get(null);
            const dataTypeCounts = new Map<string, number>();
            const dataTypeAges = new Map<string, Date>();

            // Analyze stored data
            Object.entries(allData).forEach(([key, value]) => {
                const dataType = this.extractDataType(key);
                if (dataType) {
                    dataTypeCounts.set(dataType, (dataTypeCounts.get(dataType) || 0) + 1);

                    if (value && typeof value === 'object') {
                        const timestamp = value.timestamp || value.createdAt || value.date;
                        if (timestamp) {
                            const date = new Date(timestamp);
                            const currentOldest = dataTypeAges.get(dataType);
                            if (!currentOldest || date < currentOldest) {
                                dataTypeAges.set(dataType, date);
                            }
                        }
                    }
                }
            });

            // Create inventory items
            this.policies.forEach((policy, dataType) => {
                const count = dataTypeCounts.get(dataType) || 0;
                const oldestDate = dataTypeAges.get(dataType);

                inventory.push({
                    dataType,
                    category: this.categorizeDataType(dataType),
                    purpose: this.getDataPurpose(dataType),
                    legalBasis: 'consent',
                    retentionPeriod: policy.retentionDays,
                    storageLocation: 'local',
                    encryptionStatus: false, // Browser extension storage is not encrypted by default
                    accessControls: ['user_consent', 'extension_permissions']
                });
            });

            return inventory;
        } catch (error) {
            console.error("Failed to generate data inventory:", error);
            return [];
        }
    }

    /**
     * Extract data type from storage key
     */
    private extractDataType(key: string): string | null {
        // Check for exact matches with known data types first
        for (const dataType of this.policies.keys()) {
            if (key.startsWith(`${dataType}_`)) {
                return dataType;
            }
        }

        // Fallback patterns
        const patterns = [
            /^([^_]+)_/,  // prefix_something
        ];

        for (const pattern of patterns) {
            const match = key.match(pattern);
            if (match) {
                const candidate = match[1];
                // Map common prefixes to our data types
                const mappings: Record<string, string> = {
                    'network': 'network_requests',
                    'dom': 'dom_observations',
                    'interaction': 'user_interactions',
                    'context': 'context_data',
                    'error': 'error_logs',
                    'audit': 'audit_logs'
                };

                if (mappings[candidate]) {
                    return mappings[candidate];
                }

                if (this.policies.has(candidate)) {
                    return candidate;
                }
            }
        }

        return null;
    }

    /**
     * Categorize data type for privacy compliance
     */
    private categorizeDataType(dataType: string): 'personal' | 'technical' | 'behavioral' | 'derived' {
        const categories = {
            'network_requests': 'behavioral' as const,
            'dom_observations': 'behavioral' as const,
            'user_interactions': 'behavioral' as const,
            'context_data': 'derived' as const,
            'error_logs': 'technical' as const,
            'audit_logs': 'technical' as const
        };

        return categories[dataType as keyof typeof categories] || 'technical';
    }

    /**
     * Get purpose description for data type
     */
    private getDataPurpose(dataType: string): string {
        const purposes = {
            'network_requests': 'Monitor API calls and network activity for contextual AI assistance',
            'dom_observations': 'Track page changes and content for improved user experience',
            'user_interactions': 'Understand user behavior to provide relevant suggestions',
            'context_data': 'Aggregate page context for AI chat functionality',
            'error_logs': 'Debug and improve extension functionality',
            'audit_logs': 'Maintain compliance and security audit trail'
        };

        return purposes[dataType as keyof typeof purposes] || 'Extension functionality';
    }

    /**
     * Generate compliance report
     */
    async generateComplianceReport(): Promise<ComplianceReport> {
        try {
            const inventory = await this.getDataInventory();
            const retentionCompliance = await this.checkRetentionCompliance();

            return {
                timestamp: new Date(),
                consentStatus: await this.getCurrentConsentStatus(),
                dataInventory: inventory,
                retentionCompliance,
                privacyViolations: [], // Would be populated by privacy monitoring
                recommendations: this.generateRecommendations(retentionCompliance)
            };
        } catch (error) {
            console.error("Failed to generate compliance report:", error);
            throw error;
        }
    }

    /**
     * Check retention compliance for all data types
     */
    private async checkRetentionCompliance() {
        const compliance = [];

        for (const [dataType, policy] of this.policies) {
            try {
                const allData = await chrome.storage.local.get(null);
                let recordCount = 0;
                let oldestRecord: Date | null = null;
                let newestRecord: Date | null = null;

                Object.entries(allData).forEach(([key, value]) => {
                    if (this.isDataTypeKey(key, dataType) && value && typeof value === 'object') {
                        recordCount++;
                        const timestamp = value.timestamp || value.createdAt || value.date;
                        if (timestamp) {
                            const date = new Date(timestamp);
                            if (!oldestRecord || date < oldestRecord) {
                                oldestRecord = date;
                            }
                            if (!newestRecord || date > newestRecord) {
                                newestRecord = date;
                            }
                        }
                    }
                });

                const currentAge = oldestRecord ?
                    Math.floor((Date.now() - oldestRecord.getTime()) / (1000 * 60 * 60 * 24)) : 0;

                let complianceStatus: 'compliant' | 'warning' | 'violation' = 'compliant';
                if (currentAge > policy.retentionDays) {
                    complianceStatus = 'violation';
                } else if (currentAge > policy.retentionDays * 0.9) {
                    complianceStatus = 'warning';
                }

                const nextCleanup = new Date();
                nextCleanup.setTime(nextCleanup.getTime() + policy.cleanupInterval);

                compliance.push({
                    dataType,
                    policy,
                    currentAge,
                    complianceStatus,
                    nextCleanupDate: nextCleanup,
                    recordCount
                });
            } catch (error) {
                console.error(`Failed to check compliance for ${dataType}:`, error);
            }
        }

        return compliance;
    }

    /**
     * Get current consent status from storage
     */
    private async getCurrentConsentStatus() {
        try {
            const result = await chrome.storage.sync.get(['privacyConsent']);
            return result.privacyConsent || {
                networkMonitoring: false,
                domObservation: false,
                contextCollection: false,
                dataStorage: false,
                consentTimestamp: null,
                consentVersion: "1.0.0"
            };
        } catch (error) {
            console.error("Failed to get consent status:", error);
            return {
                networkMonitoring: false,
                domObservation: false,
                contextCollection: false,
                dataStorage: false,
                consentTimestamp: null,
                consentVersion: "1.0.0"
            };
        }
    }

    /**
     * Generate recommendations based on compliance status
     */
    private generateRecommendations(retentionCompliance: any[]): string[] {
        const recommendations: string[] = [];

        retentionCompliance.forEach(item => {
            if (item.complianceStatus === 'violation') {
                recommendations.push(`Immediate cleanup required for ${item.dataType} - data exceeds retention period`);
            } else if (item.complianceStatus === 'warning') {
                recommendations.push(`Schedule cleanup for ${item.dataType} - approaching retention limit`);
            }

            if (item.recordCount > 10000) {
                recommendations.push(`Consider increasing cleanup frequency for ${item.dataType} - high record count`);
            }
        });

        if (recommendations.length === 0) {
            recommendations.push("All data retention policies are compliant");
        }

        return recommendations;
    }

    /**
     * Add or update retention policy
     */
    setRetentionPolicy(dataType: string, policy: DataRetentionPolicy): void {
        this.policies.set(dataType, policy);

        // Restart cleanup for this data type if it was running
        if (this.cleanupIntervals.has(dataType)) {
            clearInterval(this.cleanupIntervals.get(dataType)!);
            this.cleanupIntervals.delete(dataType);
        }

        if (policy.autoCleanup) {
            const interval = setInterval(
                () => this.performCleanup(dataType),
                policy.cleanupInterval
            );
            this.cleanupIntervals.set(dataType, interval);
        }
    }

    /**
     * Get retention policy for data type
     */
    getRetentionPolicy(dataType: string): DataRetentionPolicy | undefined {
        return this.policies.get(dataType);
    }

    /**
     * Get all retention policies
     */
    getAllRetentionPolicies(): Map<string, DataRetentionPolicy> {
        return new Map(this.policies);
    }

    /**
     * Force cleanup for all data types
     */
    async forceCleanupAll(): Promise<void> {
        const promises = Array.from(this.policies.keys()).map(dataType =>
            this.performCleanup(dataType)
        );

        await Promise.allSettled(promises);
        console.log("Force cleanup completed for all data types");
    }

    /**
     * Get storage usage statistics
     */
    async getStorageStats(): Promise<{ used: number; available: number; byDataType: Record<string, number> }> {
        try {
            const allData = await chrome.storage.local.get(null);
            const byDataType: Record<string, number> = {};
            let totalUsed = 0;

            Object.entries(allData).forEach(([key, value]) => {
                const size = JSON.stringify(value).length;
                totalUsed += size;

                const dataType = this.extractDataType(key) || 'unknown';
                byDataType[dataType] = (byDataType[dataType] || 0) + size;
            });

            // Chrome extension storage quota is typically 5MB for local storage
            const available = 5 * 1024 * 1024 - totalUsed;

            return {
                used: totalUsed,
                available: Math.max(0, available),
                byDataType
            };
        } catch (error) {
            console.error("Failed to get storage stats:", error);
            return { used: 0, available: 0, byDataType: {} };
        }
    }
}