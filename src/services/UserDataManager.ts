/**
 * User Data Manager for GDPR compliance
 * Handles data export, deletion, and user rights management
 */

import { DataExportRequest, DataDeletionRequest, PrivacyAuditLog } from "../types/privacy";

export class UserDataManager {
    private auditLogs: PrivacyAuditLog[] = [];

    constructor() {
        this.initializeAuditLogging();
    }

    /**
     * Initialize audit logging system
     */
    private async initializeAuditLogging(): Promise<void> {
        try {
            const result = await chrome.storage.local.get(['privacy_audit_logs']);
            if (result.privacy_audit_logs) {
                this.auditLogs = result.privacy_audit_logs;
            }
        } catch (error) {
            console.error("Failed to initialize audit logging:", error);
        }
    }

    /**
     * Export all user data in compliance with GDPR Article 20
     */
    async exportUserData(format: 'json' | 'csv' | 'xml' = 'json'): Promise<string> {
        const exportRequest: DataExportRequest = {
            requestId: this.generateRequestId(),
            timestamp: new Date(),
            dataTypes: ['all'],
            format,
            includeMetadata: true,
            status: 'processing'
        };

        try {
            await this.logAuditEvent('data_exported', {
                requestId: exportRequest.requestId,
                format,
                timestamp: exportRequest.timestamp
            });

            // Collect all user data
            const localData = await chrome.storage.local.get(null);
            const syncData = await chrome.storage.sync.get(null);

            const exportData = {
                exportMetadata: {
                    requestId: exportRequest.requestId,
                    timestamp: exportRequest.timestamp.toISOString(),
                    format,
                    version: "1.0.0",
                    extensionVersion: chrome.runtime.getManifest().version
                },
                consentData: syncData.privacyConsent || null,
                settings: this.sanitizeSettings(syncData),
                monitoringData: this.categorizeMonitoringData(localData),
                auditLogs: this.auditLogs,
                dataInventory: await this.generateDataInventory(localData),
                privacySettings: syncData.privacySettings || null
            };

            // Format data according to requested format
            let formattedData: string;
            switch (format) {
                case 'csv':
                    formattedData = this.formatAsCSV(exportData);
                    break;
                case 'xml':
                    formattedData = this.formatAsXML(exportData);
                    break;
                default:
                    formattedData = JSON.stringify(exportData, null, 2);
            }

            exportRequest.status = 'completed';
            return formattedData;

        } catch (error) {
            exportRequest.status = 'failed';
            console.error("Data export failed:", error);
            throw new Error(`Data export failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Delete all user data in compliance with GDPR Article 17 (Right to Erasure)
     */
    async deleteAllUserData(confirmationToken?: string): Promise<void> {
        const deletionRequest: DataDeletionRequest = {
            requestId: this.generateRequestId(),
            timestamp: new Date(),
            dataTypes: ['all'],
            confirmationRequired: true,
            status: 'processing'
        };

        try {
            // Verify confirmation if required
            if (deletionRequest.confirmationRequired && !confirmationToken) {
                throw new Error("Confirmation token required for data deletion");
            }

            await this.logAuditEvent('data_deleted', {
                requestId: deletionRequest.requestId,
                timestamp: deletionRequest.timestamp,
                confirmationToken: confirmationToken ? '[PROVIDED]' : '[NOT_PROVIDED]'
            });

            // Clear all local storage
            await chrome.storage.local.clear();

            // Clear sync storage but preserve essential extension state
            const syncData = await chrome.storage.sync.get(null);
            const keysToKeep = ['extensionEnabled']; // Keep minimal state
            const keysToRemove = Object.keys(syncData).filter(key => !keysToKeep.includes(key));

            if (keysToRemove.length > 0) {
                await chrome.storage.sync.remove(keysToRemove);
            }

            // Clear audit logs (but log the deletion first)
            this.auditLogs = [];

            deletionRequest.status = 'completed';
            deletionRequest.deletionDate = new Date();

            console.log("All user data has been successfully deleted");

        } catch (error) {
            deletionRequest.status = 'failed';
            console.error("Data deletion failed:", error);
            throw new Error(`Data deletion failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Delete specific data types
     */
    async deleteDataByType(dataTypes: string[]): Promise<void> {
        const deletionRequest: DataDeletionRequest = {
            requestId: this.generateRequestId(),
            timestamp: new Date(),
            dataTypes,
            confirmationRequired: false,
            status: 'processing'
        };

        try {
            await this.logAuditEvent('data_deleted', {
                requestId: deletionRequest.requestId,
                dataTypes,
                timestamp: deletionRequest.timestamp
            });

            const allData = await chrome.storage.local.get(null);
            const keysToDelete: string[] = [];

            // Find keys matching the specified data types
            Object.keys(allData).forEach(key => {
                for (const dataType of dataTypes) {
                    if (key.startsWith(`${dataType}_`) || key.includes(`_${dataType}_`)) {
                        keysToDelete.push(key);
                        break;
                    }
                }
            });

            if (keysToDelete.length > 0) {
                await chrome.storage.local.remove(keysToDelete);
                console.log(`Deleted ${keysToDelete.length} records for data types: ${dataTypes.join(', ')}`);
            }

            deletionRequest.status = 'completed';
            deletionRequest.deletionDate = new Date();

        } catch (error) {
            deletionRequest.status = 'failed';
            console.error(`Failed to delete data types ${dataTypes.join(', ')}:`, error);
            throw error;
        }
    }

    /**
     * Generate data portability report
     */
    async generatePortabilityReport(): Promise<any> {
        try {
            const localData = await chrome.storage.local.get(null);
            const syncData = await chrome.storage.sync.get(null);

            return {
                reportMetadata: {
                    timestamp: new Date().toISOString(),
                    version: "1.0.0",
                    purpose: "Data Portability Report (GDPR Article 20)"
                },
                dataCategories: {
                    personalData: this.extractPersonalData(localData, syncData),
                    technicalData: this.extractTechnicalData(localData, syncData),
                    behavioralData: this.extractBehavioralData(localData),
                    derivedData: this.extractDerivedData(localData)
                },
                dataFormats: {
                    structured: this.getStructuredDataSummary(localData),
                    unstructured: this.getUnstructuredDataSummary(localData)
                },
                processingActivities: this.getProcessingActivities(),
                retentionPeriods: this.getRetentionPeriods(),
                dataRecipients: this.getDataRecipients()
            };
        } catch (error) {
            console.error("Failed to generate portability report:", error);
            throw error;
        }
    }

    /**
     * Sanitize settings data for export
     */
    private sanitizeSettings(syncData: any): any {
        const sanitized = { ...syncData };

        // Remove sensitive keys
        const sensitiveKeys = ['authTokens', 'apiKeys', 'passwords'];
        sensitiveKeys.forEach(key => {
            if (sanitized[key]) {
                sanitized[key] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    /**
     * Categorize monitoring data by type
     */
    private categorizeMonitoringData(localData: any): any {
        const categorized: {
            networkRequests: Record<string, any>;
            domObservations: Record<string, any>;
            userInteractions: Record<string, any>;
            contextData: Record<string, any>;
            errorLogs: Record<string, any>;
            other: Record<string, any>;
        } = {
            networkRequests: {},
            domObservations: {},
            userInteractions: {},
            contextData: {},
            errorLogs: {},
            other: {}
        };

        Object.entries(localData).forEach(([key, value]) => {
            if (key.startsWith('network_')) {
                categorized.networkRequests[key] = value;
            } else if (key.startsWith('dom_')) {
                categorized.domObservations[key] = value;
            } else if (key.startsWith('interaction_')) {
                categorized.userInteractions[key] = value;
            } else if (key.startsWith('context_')) {
                categorized.contextData[key] = value;
            } else if (key.startsWith('error_')) {
                categorized.errorLogs[key] = value;
            } else {
                categorized.other[key] = value;
            }
        });

        return categorized;
    }

    /**
     * Generate data inventory for export
     */
    private async generateDataInventory(localData: any): Promise<Array<{
        dataType: string;
        recordCount: number;
        sampleStructure: any;
        storageKeys: string[];
        estimatedSize: number;
    }>> {
        const inventory: Array<{
            dataType: string;
            recordCount: number;
            sampleStructure: any;
            storageKeys: string[];
            estimatedSize: number;
        }> = [];
        const dataTypes = new Set<string>();

        // Identify data types
        Object.keys(localData).forEach(key => {
            const match = key.match(/^([^_]+)_/);
            if (match) {
                dataTypes.add(match[1]);
            }
        });

        // Create inventory entries
        dataTypes.forEach(dataType => {
            const keys = Object.keys(localData).filter(key => key.startsWith(`${dataType}_`));
            const sampleData = keys.length > 0 ? localData[keys[0]] : null;

            inventory.push({
                dataType,
                recordCount: keys.length,
                sampleStructure: sampleData ? this.getDataStructure(sampleData) : null,
                storageKeys: keys.slice(0, 5), // Include first 5 keys as examples
                estimatedSize: this.estimateDataSize(keys.map(key => localData[key]))
            });
        });

        return inventory;
    }

    /**
     * Format data as CSV
     */
    private formatAsCSV(data: any): string {
        const lines: string[] = [];

        // Add header
        lines.push("Data Export - CSV Format");
        lines.push(`Export Date: ${data.exportMetadata.timestamp}`);
        lines.push(`Request ID: ${data.exportMetadata.requestId}`);
        lines.push("");

        // Add consent data
        if (data.consentData) {
            lines.push("Consent Status");
            lines.push("Feature,Granted,Timestamp");
            Object.entries(data.consentData).forEach(([key, value]) => {
                if (key !== 'consentTimestamp' && key !== 'consentVersion') {
                    lines.push(`${key},${value},${data.consentData.consentTimestamp || 'N/A'}`);
                }
            });
            lines.push("");
        }

        // Add monitoring data summary
        lines.push("Monitoring Data Summary");
        lines.push("Category,Record Count");
        Object.entries(data.monitoringData).forEach(([category, records]) => {
            const count = typeof records === 'object' ? Object.keys(records as object).length : 0;
            lines.push(`${category},${count}`);
        });

        return lines.join('\n');
    }

    /**
     * Format data as XML
     */
    private formatAsXML(data: any): string {
        const escapeXml = (str: string) => {
            return str.replace(/[<>&'"]/g, (c) => {
                switch (c) {
                    case '<': return '&lt;';
                    case '>': return '&gt;';
                    case '&': return '&amp;';
                    case "'": return '&apos;';
                    case '"': return '&quot;';
                    default: return c;
                }
            });
        };

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<userDataExport>\n';
        xml += `  <metadata>\n`;
        xml += `    <requestId>${escapeXml(data.exportMetadata.requestId)}</requestId>\n`;
        xml += `    <timestamp>${escapeXml(data.exportMetadata.timestamp)}</timestamp>\n`;
        xml += `    <format>${escapeXml(data.exportMetadata.format)}</format>\n`;
        xml += `  </metadata>\n`;

        if (data.consentData) {
            xml += `  <consentData>\n`;
            Object.entries(data.consentData).forEach(([key, value]) => {
                xml += `    <${key}>${escapeXml(String(value))}</${key}>\n`;
            });
            xml += `  </consentData>\n`;
        }

        xml += `  <monitoringData>\n`;
        Object.entries(data.monitoringData).forEach(([category, records]) => {
            const count = typeof records === 'object' ? Object.keys(records as object).length : 0;
            xml += `    <category name="${escapeXml(category)}" recordCount="${count}" />\n`;
        });
        xml += `  </monitoringData>\n`;

        xml += '</userDataExport>';
        return xml;
    }

    /**
     * Extract personal data for portability report
     */
    private extractPersonalData(localData: any, syncData: any): any {
        return {
            consentRecords: syncData.privacyConsent || null,
            userPreferences: syncData.userPreferences || null,
            customSettings: syncData.customSettings || null
        };
    }

    /**
     * Extract technical data for portability report
     */
    private extractTechnicalData(localData: any, syncData: any): any {
        const technicalData: any = {};

        Object.entries(localData).forEach(([key, value]) => {
            if (key.startsWith('error_') || key.startsWith('performance_') || key.startsWith('system_')) {
                technicalData[key] = value;
            }
        });

        return technicalData;
    }

    /**
     * Extract behavioral data for portability report
     */
    private extractBehavioralData(localData: any): any {
        const behavioralData: any = {};

        Object.entries(localData).forEach(([key, value]) => {
            if (key.startsWith('interaction_') || key.startsWith('navigation_') || key.startsWith('usage_')) {
                behavioralData[key] = value;
            }
        });

        return behavioralData;
    }

    /**
     * Extract derived data for portability report
     */
    private extractDerivedData(localData: any): any {
        const derivedData: any = {};

        Object.entries(localData).forEach(([key, value]) => {
            if (key.startsWith('context_') || key.startsWith('analysis_') || key.startsWith('insights_')) {
                derivedData[key] = value;
            }
        });

        return derivedData;
    }

    /**
     * Get structured data summary
     */
    private getStructuredDataSummary(localData: any): any {
        const structured: any = {};

        Object.entries(localData).forEach(([key, value]) => {
            if (value && typeof value === 'object' && value.constructor === Object) {
                structured[key] = this.getDataStructure(value);
            }
        });

        return structured;
    }

    /**
     * Get unstructured data summary
     */
    private getUnstructuredDataSummary(localData: any): any {
        const unstructured: any = {};

        Object.entries(localData).forEach(([key, value]) => {
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                unstructured[key] = typeof value;
            }
        });

        return unstructured;
    }

    /**
     * Get processing activities for compliance
     */
    private getProcessingActivities(): any[] {
        return [
            {
                activity: "Network Request Monitoring",
                purpose: "Provide contextual AI assistance",
                legalBasis: "User consent",
                dataTypes: ["HTTP requests", "API responses", "Network timing"],
                retention: "30 days"
            },
            {
                activity: "DOM Observation",
                purpose: "Understand page structure and changes",
                legalBasis: "User consent",
                dataTypes: ["DOM elements", "Page content", "Layout changes"],
                retention: "14 days"
            },
            {
                activity: "User Interaction Tracking",
                purpose: "Improve AI assistance relevance",
                legalBasis: "User consent",
                dataTypes: ["Click events", "Form interactions", "Navigation patterns"],
                retention: "30 days"
            }
        ];
    }

    /**
     * Get retention periods for different data types
     */
    private getRetentionPeriods(): any {
        return {
            networkRequests: "30 days",
            domObservations: "14 days",
            userInteractions: "30 days",
            contextData: "30 days",
            errorLogs: "30 days",
            auditLogs: "365 days"
        };
    }

    /**
     * Get data recipients (who has access to the data)
     */
    private getDataRecipients(): string[] {
        return [
            "Local browser storage only",
            "No third-party data sharing",
            "Data remains on user's device"
        ];
    }

    /**
     * Get data structure for analysis
     */
    private getDataStructure(data: any): any {
        if (typeof data !== 'object' || data === null) {
            return typeof data;
        }

        const structure: any = {};
        Object.entries(data).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
                structure[key] = Array.isArray(value) ? 'array' : 'object';
            } else {
                structure[key] = typeof value;
            }
        });

        return structure;
    }

    /**
     * Estimate data size in bytes
     */
    private estimateDataSize(dataArray: any[]): number {
        return dataArray.reduce((total, item) => {
            return total + JSON.stringify(item).length;
        }, 0);
    }

    /**
     * Generate unique request ID
     */
    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Log audit event for compliance tracking
     */
    private async logAuditEvent(action: string, details: any): Promise<void> {
        const auditLog: PrivacyAuditLog = {
            id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            timestamp: new Date(),
            action: action as any,
            details,
            userAgent: navigator.userAgent
        };

        this.auditLogs.push(auditLog);

        // Keep only last 1000 audit logs to prevent storage bloat
        if (this.auditLogs.length > 1000) {
            this.auditLogs = this.auditLogs.slice(-1000);
        }

        try {
            await chrome.storage.local.set({
                privacy_audit_logs: this.auditLogs
            });
        } catch (error) {
            console.error("Failed to save audit log:", error);
        }
    }

    /**
     * Get audit logs for compliance review
     */
    getAuditLogs(): PrivacyAuditLog[] {
        return [...this.auditLogs];
    }

    /**
     * Clear audit logs (with proper logging)
     */
    async clearAuditLogs(): Promise<void> {
        const previousLogCount = this.auditLogs.length;

        // Clear the logs first
        this.auditLogs = [];

        try {
            await chrome.storage.local.remove(['privacy_audit_logs']);
        } catch (error) {
            console.error("Failed to clear audit logs:", error);
        }

        // Log the clearing event after clearing
        await this.logAuditEvent('audit_logs_cleared', {
            previousLogCount,
            timestamp: new Date()
        });
    }
}