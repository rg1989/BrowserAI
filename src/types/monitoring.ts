// Core monitoring data models and interfaces

export interface PageContext {
    url: string;
    title: string;
    timestamp: number;
    content: ContentSnapshot;
    layout: LayoutSnapshot;
    network: NetworkActivity;
    interactions: UserInteraction[];
    metadata: {
        userAgent: string;
        viewport: {
            width: number;
            height: number;
        };
        scrollPosition: {
            x: number;
            y: number;
        };
    };
    semantics?: SemanticData;
    plugin?: EnhancedContext;
}

export interface ContentSnapshot {
    text: string;
    headings: Heading[];
    links: Link[];
    images: Image[];
    forms: Form[];
    tables: Table[];
    metadata: PageMetadata;
}

export interface LayoutSnapshot {
    viewport: ViewportInfo;
    visibleElements: VisibleElement[];
    scrollPosition: ScrollPosition;
    modals: Modal[];
    overlays: Overlay[];
}

export interface NetworkActivity {
    recentRequests: any[];
    totalRequests: number;
    totalDataTransferred: number;
    averageResponseTime: number;
}

export interface NetworkRequest {
    id: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    timestamp: Date;
    initiator: string;
    type: RequestType;
}

export interface NetworkResponse {
    requestId: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body?: string;
    timestamp: Date;
    size: number;
}

export interface NetworkError {
    requestId: string;
    error: string;
    timestamp: Date;
    type: ErrorType;
}

export interface UserInteraction {
    type: InteractionType;
    element: ElementInfo;
    timestamp: Date;
    context: InteractionContext;
}

export interface SemanticData {
    schema: SchemaOrgData[];
    microdata: MicrodataItem[];
    jsonLd: JsonLdData[];
    openGraph: OpenGraphData;
    twitter: TwitterCardData;
    custom: CustomSemanticData[];
}

export interface EnhancedContext {
    provider: string;
    version: string;
    capabilities: PluginCapability[];
    data: StructuredData;
    performance: PerformanceMetrics;
}

// Configuration interfaces
export interface MonitoringConfig {
    enabled: boolean;
    features: FeatureConfig;
    privacy: PrivacyConfig;
    performance: PerformanceConfig;
    storage: StorageConfig;
}

export interface FeatureConfig {
    networkMonitoring: boolean;
    domObservation: boolean;
    contextCollection: boolean;
    pluginIntegration: boolean;
    interactionTracking: boolean;
}

export interface PrivacyConfig {
    excludedDomains: string[];
    excludedPaths: string[];
    redactSensitiveData: boolean;
    sensitiveDataPatterns: RegExp[];
    dataRetentionDays: number;
}

export interface PerformanceConfig {
    maxBufferSize: number;
    throttleInterval: number;
    maxConcurrentRequests: number;
    compressionEnabled: boolean;
}

export interface StorageConfig {
    persistentStorage: boolean;
    maxStorageSize: number;
    compressionLevel: number;
    cleanupInterval: number;
}

// Supporting type definitions
export interface Heading {
    level: number;
    text: string;
    id?: string;
    element: ElementInfo;
}

export interface Link {
    href: string;
    text: string;
    title?: string;
    element: ElementInfo;
}

export interface Image {
    src: string;
    alt?: string;
    title?: string;
    dimensions?: { width: number; height: number };
    element: ElementInfo;
}

export interface Form {
    action?: string;
    method?: string;
    fields: FormField[];
    element: ElementInfo;
}

export interface FormField {
    name: string;
    type: string;
    value?: string;
    placeholder?: string;
    required: boolean;
}

export interface Table {
    headers: string[];
    rows: string[][];
    caption?: string;
    element: ElementInfo;
}

export interface PageMetadata {
    title: string;
    description?: string;
    keywords?: string[];
    author?: string;
    canonical?: string;
    language?: string;
}

export interface ViewportInfo {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
    devicePixelRatio: number;
}

export interface VisibleElement {
    selector: string;
    text: string;
    bounds: DOMRect;
    visibility: number; // 0-1 visibility ratio
}

export interface ScrollPosition {
    x: number;
    y: number;
    maxX: number;
    maxY: number;
}

export interface Modal {
    selector: string;
    title?: string;
    content: string;
    isVisible: boolean;
}

export interface Overlay {
    selector: string;
    type: OverlayType;
    isVisible: boolean;
    zIndex: number;
}

export interface ElementInfo {
    tagName: string;
    id?: string;
    className?: string;
    selector: string;
    bounds?: DOMRect;
}

export interface InteractionContext {
    pageUrl: string;
    elementPath: string;
    surroundingText?: string;
    formContext?: FormContext;
}

export interface FormContext {
    formId?: string;
    fieldName?: string;
    fieldType?: string;
    fieldValue?: string;
}

export interface TimeWindow {
    start: Date;
    end: Date;
    duration: number;
}

export interface SchemaOrgData {
    type: string;
    properties: Record<string, any>;
}

export interface MicrodataItem {
    type: string;
    properties: Record<string, any>;
}

export interface JsonLdData {
    '@context': string;
    '@type': string;
    [key: string]: any;
}

export interface OpenGraphData {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
    siteName?: string;
}

export interface TwitterCardData {
    card?: string;
    title?: string;
    description?: string;
    image?: string;
    creator?: string;
}

export interface CustomSemanticData {
    namespace: string;
    data: Record<string, any>;
}

export interface PluginCapability {
    name: string;
    version: string;
    features: string[];
    performance: PerformanceLevel;
}

export interface StructuredData {
    [key: string]: any;
}

export interface PerformanceMetrics {
    responseTime: number;
    dataSize: number;
    cacheHit: boolean;
    processingTime: number;
}

// Plugin API interfaces
export interface ContextProvider {
    id: string;
    name: string;
    version: string;
    getContext(): Promise<StructuredData>;
    getSchema(): ContextSchema;
    supportsRealtime(): boolean;
}

export interface ContextSchema {
    type: string;
    properties: Record<string, SchemaProperty>;
    required?: string[];
}

export interface SchemaProperty {
    type: string;
    description?: string;
    format?: string;
    items?: SchemaProperty;
    properties?: Record<string, SchemaProperty>;
}

export interface PluginInfo {
    name: string;
    version: string;
    capabilities: string[];
    endpoint?: string;
    authentication?: AuthConfig;
}

export interface AuthConfig {
    type: 'none' | 'bearer' | 'basic' | 'custom';
    token?: string;
    credentials?: Record<string, string>;
}

export interface PluginGuidelines {
    contextAPI: {
        endpoint: string;
        authentication?: AuthConfig;
        schema: ContextSchema;
    };
    semanticMarkup: {
        required: string[];
        recommended: string[];
        custom: CustomMarkupSpec[];
    };
    performance: {
        cacheHeaders: boolean;
        compression: boolean;
        streaming: boolean;
    };
}

export interface CustomMarkupSpec {
    attribute: string;
    values: string[];
    description: string;
}

// Enums
export enum MonitoringState {
    STOPPED = 'stopped',
    STARTING = 'starting',
    RUNNING = 'running',
    PAUSED = 'paused',
    STOPPING = 'stopping',
    ERROR = 'error'
}

export enum RequestType {
    XHR = 'xhr',
    FETCH = 'fetch',
    WEBSOCKET = 'websocket',
    EVENTSOURCE = 'eventsource',
    BEACON = 'beacon'
}

export enum ErrorType {
    NETWORK = 'network',
    TIMEOUT = 'timeout',
    CORS = 'cors',
    SECURITY = 'security',
    UNKNOWN = 'unknown'
}

export enum InteractionType {
    CLICK = 'click',
    INPUT = 'input',
    SUBMIT = 'submit',
    SCROLL = 'scroll',
    HOVER = 'hover',
    FOCUS = 'focus',
    BLUR = 'blur'
}

export enum OverlayType {
    MODAL = 'modal',
    TOOLTIP = 'tooltip',
    DROPDOWN = 'dropdown',
    POPUP = 'popup',
    NOTIFICATION = 'notification'
}

export enum PerformanceLevel {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    OPTIMAL = 'optimal'
}