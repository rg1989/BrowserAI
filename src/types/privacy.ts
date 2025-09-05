/**
 * Privacy and consent management type definitions
 */

export interface PrivacyConfig {
    excludedDomains: string[];
    excludedPaths: string[];
    redactSensitiveData: boolean;
    sensitiveDataPatterns: RegExp[];
    dataRetentionDays: number;
    enableDataExport: boolean;
    enableDataDeletion: boolean;
    requireExplicitConsent: boolean;
    consentRenewalDays: number;
}

export interface ConsentStatus {
    networkMonitoring: boolean;
    domObservation: boolean;
    contextCollection: boolean;
    dataStorage: boolean;
    consentTimestamp: Date | null;
    consentVersion: string;
}

export interface DataRetentionPolicy {
    dataType: string;
    retentionDays: number;
    cleanupInterval: number;
    compressionAfterDays?: number;
    autoCleanup?: boolean;
}

export interface PrivacySettings {
    consentStatus: ConsentStatus;
    privacyConfig: PrivacyConfig;
    retentionPolicies: DataRetentionPolicy[];
    lastCleanup: Date | null;
    dataExportEnabled: boolean;
    dataDeletionEnabled: boolean;
}

export interface DataExportRequest {
    requestId: string;
    timestamp: Date;
    dataTypes: string[];
    format: 'json' | 'csv' | 'xml';
    includeMetadata: boolean;
    status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface DataDeletionRequest {
    requestId: string;
    timestamp: Date;
    dataTypes: string[];
    confirmationRequired: boolean;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    deletionDate?: Date;
}

export interface PrivacyAuditLog {
    id: string;
    timestamp: Date;
    action: 'consent_granted' | 'consent_revoked' | 'data_exported' | 'data_deleted' | 'settings_changed';
    details: Record<string, any>;
    userAgent: string;
    ipAddress?: string;
}

export interface ComplianceReport {
    timestamp: Date;
    consentStatus: ConsentStatus;
    dataInventory: DataInventoryItem[];
    retentionCompliance: RetentionComplianceItem[];
    privacyViolations: PrivacyViolation[];
    recommendations: string[];
}

export interface DataInventoryItem {
    dataType: string;
    category: 'personal' | 'technical' | 'behavioral' | 'derived';
    purpose: string;
    legalBasis: 'consent' | 'legitimate_interest' | 'contract' | 'legal_obligation';
    retentionPeriod: number;
    storageLocation: 'local' | 'sync' | 'memory';
    encryptionStatus: boolean;
    accessControls: string[];
}

export interface RetentionComplianceItem {
    dataType: string;
    policy: DataRetentionPolicy;
    currentAge: number;
    complianceStatus: 'compliant' | 'warning' | 'violation';
    nextCleanupDate: Date;
    recordCount: number;
}

export interface PrivacyViolation {
    id: string;
    timestamp: Date;
    type: 'retention_exceeded' | 'consent_missing' | 'data_leak' | 'unauthorized_access';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affectedData: string[];
    remediation: string;
    status: 'open' | 'investigating' | 'resolved';
}

export interface ConsentRecord {
    id: string;
    timestamp: Date;
    version: string;
    features: Record<string, boolean>;
    method: 'explicit' | 'implicit' | 'renewed';
    ipAddress?: string;
    userAgent: string;
    expirationDate?: Date;
}

export interface PrivacyNotification {
    id: string;
    type: 'consent_required' | 'consent_expired' | 'data_cleanup' | 'privacy_update';
    title: string;
    message: string;
    actionRequired: boolean;
    actions?: PrivacyNotificationAction[];
    timestamp: Date;
    expirationDate?: Date;
    dismissed: boolean;
}

export interface PrivacyNotificationAction {
    id: string;
    label: string;
    action: 'grant_consent' | 'revoke_consent' | 'export_data' | 'delete_data' | 'update_settings';
    primary: boolean;
}

export interface DataProcessingActivity {
    id: string;
    name: string;
    purpose: string;
    dataTypes: string[];
    legalBasis: string;
    recipients: string[];
    retentionPeriod: number;
    crossBorderTransfer: boolean;
    automatedDecisionMaking: boolean;
    dataSubjectRights: string[];
}

export interface PrivacyImpactAssessment {
    id: string;
    timestamp: Date;
    feature: string;
    riskLevel: 'low' | 'medium' | 'high';
    dataTypes: string[];
    processingPurpose: string;
    risks: PrivacyRisk[];
    mitigations: PrivacyMitigation[];
    approved: boolean;
    approver?: string;
    reviewDate?: Date;
}

export interface PrivacyRisk {
    id: string;
    description: string;
    likelihood: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    riskScore: number;
    category: 'data_breach' | 'unauthorized_access' | 'data_loss' | 'consent_violation';
}

export interface PrivacyMitigation {
    id: string;
    riskId: string;
    description: string;
    implementation: string;
    effectiveness: 'low' | 'medium' | 'high';
    status: 'planned' | 'implemented' | 'verified';
}

// Utility types for privacy compliance
export type ConsentFeature = keyof Omit<ConsentStatus, 'consentTimestamp' | 'consentVersion'>;
export type DataCategory = 'personal' | 'technical' | 'behavioral' | 'derived';
export type LegalBasis = 'consent' | 'legitimate_interest' | 'contract' | 'legal_obligation';
export type StorageLocation = 'local' | 'sync' | 'memory';
export type ComplianceStatus = 'compliant' | 'warning' | 'violation';
export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskLevel = 'low' | 'medium' | 'high';