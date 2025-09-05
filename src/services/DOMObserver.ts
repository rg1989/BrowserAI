import {
    LayoutSnapshot,
    VisibleElement,
    ViewportInfo,
    ScrollPosition,
    Modal,
    Overlay,
    UserInteraction,
    InteractionType,
    ElementInfo,
    InteractionContext,
    OverlayType
} from '../types/monitoring';
import {
    ErrorHandler,
    ErrorCategory,
    ErrorSeverity,
    RecoveryStrategy,
    CircuitBreaker,
    withErrorHandling
} from '../utils/ErrorHandler';
import {
    PerformanceMonitor,
    PerformanceMetrics,
    PerformanceAlertLevel,
    AdaptiveThrottler,
    withPerformanceMonitoring
} from '../utils/PerformanceMonitor';

/**
 * DOM change information
 */
export interface DOMChange {
    type: 'added' | 'removed' | 'modified' | 'attributes';
    element: ElementInfo;
    timestamp: Date;
    details?: {
        addedNodes?: Node[];
        removedNodes?: Node[];
        attributeName?: string;
        oldValue?: string;
        newValue?: string;
    };
}

/**
 * DOM observer service for monitoring page changes and user interactions
 * Uses MutationObserver, IntersectionObserver, and event listeners
 * Enhanced with comprehensive error handling and recovery mechanisms
 */
export class DOMObserver {
    private mutationObserver: MutationObserver | null = null;
    private intersectionObserver: IntersectionObserver | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private isObserving: boolean = false;

    // Change tracking
    private recentChanges: DOMChange[] = [];
    private maxChanges: number = 1000;

    // Throttling and debouncing
    private throttleInterval: number = 100; // ms
    private lastProcessTime: number = 0;
    private pendingChanges: MutationRecord[] = [];
    private processingTimer: NodeJS.Timeout | null = null;

    // Event listeners
    private eventListeners: Map<string, EventListener> = new Map();
    private trackedInteractions: UserInteraction[] = [];
    private maxInteractions: number = 500;

    // Viewport tracking
    private currentViewport: ViewportInfo | null = null;
    private visibleElements: VisibleElement[] = [];

    // Error handling and recovery
    private errorHandler: ErrorHandler;
    private circuitBreaker: CircuitBreaker;
    private isPaused: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 3;
    private observerErrors: number = 0;
    private maxObserverErrors: number = 5;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private lastHealthCheck: Date = new Date();
    private observerStats = {
        totalMutations: 0,
        totalInteractions: 0,
        errorCount: 0,
        lastError: null as Date | null
    };

    // Performance monitoring
    private performanceMonitor: PerformanceMonitor;
    private throttler: AdaptiveThrottler;
    private dynamicThrottleInterval: number;
    private lastPerformanceOptimization: Date = new Date();
    private mutationProcessingTime: number[] = [];
    private interactionProcessingTime: number[] = [];

    constructor(
        throttleInterval: number = 100,
        maxChanges: number = 1000,
        maxInteractions: number = 500
    ) {
        this.throttleInterval = throttleInterval;
        this.maxChanges = maxChanges;
        this.maxInteractions = maxInteractions;
        this.errorHandler = ErrorHandler.getInstance();
        this.circuitBreaker = new CircuitBreaker(3, 30000, 15000);
        this.performanceMonitor = PerformanceMonitor.getInstance();
        this.throttler = new AdaptiveThrottler();
        this.dynamicThrottleInterval = throttleInterval;

        // Set up error handling and performance monitoring
        this.setupErrorHandling();
        this.setupPerformanceMonitoring();
    }

    /**
     * Start observing DOM changes and user interactions with error handling
     */
    async startObserving(): Promise<void> {
        try {
            await this.circuitBreaker.execute(async () => {
                await this.initializeObserving();
            });
        } catch (error) {
            await this.errorHandler.handleError(
                ErrorCategory.DOM,
                ErrorSeverity.HIGH,
                `Failed to start DOM observing: ${error.message}`,
                'DOMObserver',
                error instanceof Error ? error : new Error(String(error))
            );
            throw error;
        }
    }

    /**
     * Initialize DOM observing with error handling
     */
    @withErrorHandling(ErrorCategory.DOM, 'DOMObserver', ErrorSeverity.MEDIUM)
    private async initializeObserving(): Promise<void> {
        if (this.isObserving) {
            console.warn('DOMObserver is already observing');
            return;
        }

        if (typeof window === 'undefined') {
            throw new Error('Window object not available');
        }

        try {
            this.isObserving = true;
            this.isPaused = false;
            this.observerErrors = 0;
            this.reconnectAttempts = 0;

            await this.setupMutationObserver();
            await this.setupIntersectionObserver();
            await this.setupResizeObserver();
            await this.setupEventListeners();

            this.updateViewportInfo();
            this.startHealthCheck();

            console.log('DOMObserver started successfully');
        } catch (error) {
            this.isObserving = false;
            throw new Error(`Failed to initialize DOM observing: ${error.message}`);
        }
    }

    /**
     * Stop observing DOM changes and user interactions with cleanup
     */
    async stopObserving(): Promise<void> {
        try {
            await this.cleanupObserving();
        } catch (error) {
            await this.errorHandler.handleError(
                ErrorCategory.DOM,
                ErrorSeverity.MEDIUM,
                `Error stopping DOM observing: ${error.message}`,
                'DOMObserver',
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }

    /**
     * Cleanup DOM observing
     */
    private async cleanupObserving(): Promise<void> {
        if (!this.isObserving) {
            return;
        }

        try {
            this.isObserving = false;
            this.isPaused = false;
            this.stopHealthCheck();

            await this.cleanupObservers();
            await this.cleanupEventListeners();
            this.clearPendingWork();

            this.circuitBreaker.reset();

            console.log('DOMObserver stopped successfully');
        } catch (error) {
            console.error('Error during DOMObserver cleanup:', error);
            throw error;
        }
    }

    /**
     * Pause observing (keeps observers but stops processing)
     */
    pauseObserving(): void {
        if (this.isObserving && !this.isPaused) {
            this.isPaused = true;
            console.log('DOMObserver paused');
        }
    }

    /**
     * Resume observing from paused state
     */
    resumeObserving(): void {
        if (this.isObserving && this.isPaused) {
            this.isPaused = false;
            console.log('DOMObserver resumed');
        }
    }

    /**
     * Get current layout snapshot
     */
    getCurrentLayout(): LayoutSnapshot {
        this.updateViewportInfo();

        return {
            viewport: this.currentViewport || this.getDefaultViewport(),
            visibleElements: [...this.visibleElements],
            scrollPosition: this.getCurrentScrollPosition(),
            modals: this.detectModals(),
            overlays: this.detectOverlays()
        };
    }

    /**
     * Get currently visible content elements
     */
    getVisibleContent(): VisibleElement[] {
        return [...this.visibleElements];
    }

    /**
     * Get recent DOM changes
     */
    getRecentChanges(timeWindowMs: number = 60000): DOMChange[] {
        const cutoffTime = Date.now() - timeWindowMs;
        return this.recentChanges.filter(change =>
            change.timestamp.getTime() > cutoffTime
        );
    }

    /**
     * Get recent user interactions
     */
    getRecentInteractions(timeWindowMs: number = 60000): UserInteraction[] {
        const cutoffTime = Date.now() - timeWindowMs;
        return this.trackedInteractions.filter(interaction =>
            interaction.timestamp.getTime() > cutoffTime
        );
    }

    /**
     * Clear all tracked data
     */
    clearData(): void {
        this.recentChanges = [];
        this.trackedInteractions = [];
        this.visibleElements = [];
    }

    /**
     * Check if observer is currently active
     */
    isActive(): boolean {
        return this.isObserving && !this.isPaused;
    }

    /**
     * Get observer statistics
     */
    getStatistics(): {
        totalMutations: number;
        totalInteractions: number;
        errorCount: number;
        isActive: boolean;
        isPaused: boolean;
        circuitBreakerState: string;
        lastHealthCheck: Date;
        reconnectAttempts: number;
    } {
        return {
            ...this.observerStats,
            isActive: this.isObserving,
            isPaused: this.isPaused,
            circuitBreakerState: this.circuitBreaker.getState(),
            lastHealthCheck: this.lastHealthCheck,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    /**
     * Attempt to recover from observer errors
     */
    async recover(): Promise<boolean> {
        try {
            if (this.errorHandler.shouldDisableComponent('DOMObserver')) {
                console.warn('DOMObserver disabled due to too many errors');
                return false;
            }

            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error('Max reconnection attempts reached for DOMObserver');
                return false;
            }

            this.reconnectAttempts++;

            // Stop current observing
            await this.cleanupObserving();

            // Wait before reconnecting
            await this.sleep(1000 * this.reconnectAttempts);

            // Restart observing
            await this.initializeObserving();

            console.log(`DOMObserver recovered after ${this.reconnectAttempts} attempts`);
            return true;
        } catch (error) {
            await this.errorHandler.handleError(
                ErrorCategory.DOM,
                ErrorSeverity.HIGH,
                `DOM observer recovery failed: ${error.message}`,
                'DOMObserver',
                error instanceof Error ? error : new Error(String(error))
            );
            return false;
        }
    }

    private async setupMutationObserver(): Promise<void> {
        try {
            if (!window.MutationObserver) {
                throw new Error('MutationObserver not supported');
            }

            this.mutationObserver = new MutationObserver((mutations) => {
                try {
                    if (this.isPaused) return;

                    this.observerStats.totalMutations += mutations.length;
                    this.pendingChanges.push(...mutations);
                    this.scheduleProcessing();
                } catch (error) {
                    this.handleObserverError('MutationObserver callback', error);
                }
            });

            this.mutationObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeOldValue: true,
                characterData: true,
                characterDataOldValue: true
            });

            console.log('MutationObserver setup successfully');
        } catch (error) {
            throw new Error(`Failed to setup MutationObserver: ${error.message}`);
        }
    }

    private async setupIntersectionObserver(): Promise<void> {
        try {
            if (!window.IntersectionObserver) {
                console.warn('IntersectionObserver not supported, using fallback');
                return;
            }

            this.intersectionObserver = new IntersectionObserver((entries) => {
                try {
                    if (this.isPaused) return;
                    this.updateVisibleElements(entries);
                } catch (error) {
                    this.handleObserverError('IntersectionObserver callback', error);
                }
            }, {
                threshold: [0, 0.25, 0.5, 0.75, 1.0],
                rootMargin: '50px'
            });

            // Observe key content elements
            await this.observeContentElements();

            console.log('IntersectionObserver setup successfully');
        } catch (error) {
            console.warn(`IntersectionObserver setup failed: ${error.message}`);
            // Continue without intersection observer - graceful degradation
        }
    }

    private async setupResizeObserver(): Promise<void> {
        try {
            if (!window.ResizeObserver) {
                console.warn('ResizeObserver not supported, using fallback');
                // Set up window resize listener as fallback
                window.addEventListener('resize', () => {
                    try {
                        if (!this.isPaused) {
                            this.updateViewportInfo();
                        }
                    } catch (error) {
                        this.handleObserverError('Window resize handler', error);
                    }
                });
                return;
            }

            this.resizeObserver = new ResizeObserver(() => {
                try {
                    if (this.isPaused) return;
                    this.updateViewportInfo();
                } catch (error) {
                    this.handleObserverError('ResizeObserver callback', error);
                }
            });

            this.resizeObserver.observe(document.body);

            console.log('ResizeObserver setup successfully');
        } catch (error) {
            console.warn(`ResizeObserver setup failed: ${error.message}`);
            // Continue without resize observer - graceful degradation
        }
    }

    private async setupEventListeners(): Promise<void> {
        try {
            const events = [
                'click', 'input', 'submit', 'scroll', 'focus', 'blur', 'keydown'
            ];

            events.forEach(eventType => {
                const listener = (event: Event) => {
                    try {
                        if (this.isPaused) return;

                        this.observerStats.totalInteractions++;
                        this.handleUserInteraction(event);
                    } catch (error) {
                        this.handleObserverError(`${eventType} event handler`, error);
                    }
                };

                this.eventListeners.set(eventType, listener);
                document.addEventListener(eventType, listener, {
                    passive: true,
                    capture: true
                });
            });

            console.log('Event listeners setup successfully');
        } catch (error) {
            throw new Error(`Failed to setup event listeners: ${error.message}`);
        }
    }

    private scheduleProcessing(): void {
        if (this.processingTimer) {
            return;
        }

        const now = Date.now();
        const timeSinceLastProcess = now - this.lastProcessTime;

        if (timeSinceLastProcess >= this.throttleInterval) {
            this.processPendingChanges();
        } else {
            const delay = this.throttleInterval - timeSinceLastProcess;
            this.processingTimer = setTimeout(() => {
                this.processPendingChanges();
            }, delay);
        }
    }

    private processPendingChanges(): void {
        if (this.pendingChanges.length === 0) {
            return;
        }

        const changes = [...this.pendingChanges];
        this.pendingChanges = [];
        this.processingTimer = null;
        this.lastProcessTime = Date.now();

        changes.forEach(mutation => {
            this.processMutation(mutation);
        });

        // Cleanup old changes
        this.cleanupOldChanges();
    }

    private processMutation(mutation: MutationRecord): void {
        const timestamp = new Date();
        const target = mutation.target as Element;

        if (!target || target.nodeType !== Node.ELEMENT_NODE) {
            return;
        }

        const elementInfo = this.getElementInfo(target);

        switch (mutation.type) {
            case 'childList':
                if (mutation.addedNodes.length > 0) {
                    this.addDOMChange({
                        type: 'added',
                        element: elementInfo,
                        timestamp,
                        details: {
                            addedNodes: Array.from(mutation.addedNodes)
                        }
                    });
                }

                if (mutation.removedNodes.length > 0) {
                    this.addDOMChange({
                        type: 'removed',
                        element: elementInfo,
                        timestamp,
                        details: {
                            removedNodes: Array.from(mutation.removedNodes)
                        }
                    });
                }
                break;

            case 'attributes':
                this.addDOMChange({
                    type: 'attributes',
                    element: elementInfo,
                    timestamp,
                    details: {
                        attributeName: mutation.attributeName || undefined,
                        oldValue: mutation.oldValue || undefined,
                        newValue: target.getAttribute(mutation.attributeName || '') || undefined
                    }
                });
                break;

            case 'characterData':
                this.addDOMChange({
                    type: 'modified',
                    element: elementInfo,
                    timestamp,
                    details: {
                        oldValue: mutation.oldValue || undefined,
                        newValue: target.textContent || undefined
                    }
                });
                break;
        }
    }

    private addDOMChange(change: DOMChange): void {
        this.recentChanges.push(change);

        // Keep only recent changes
        if (this.recentChanges.length > this.maxChanges) {
            this.recentChanges = this.recentChanges.slice(-this.maxChanges);
        }
    }

    private handleUserInteraction(event: Event): void {
        const target = event.target as Element;
        if (!target || target.nodeType !== Node.ELEMENT_NODE) {
            return;
        }

        const interactionType = this.getInteractionType(event.type);
        if (!interactionType) {
            return;
        }

        const elementInfo = this.getElementInfo(target);
        const context = this.getInteractionContext(target, event);

        const interaction: UserInteraction = {
            type: interactionType,
            element: elementInfo,
            timestamp: new Date(),
            context
        };

        this.trackedInteractions.push(interaction);

        // Keep only recent interactions
        if (this.trackedInteractions.length > this.maxInteractions) {
            this.trackedInteractions = this.trackedInteractions.slice(-this.maxInteractions);
        }
    }

    private getInteractionType(eventType: string): InteractionType | null {
        switch (eventType) {
            case 'click': return InteractionType.CLICK;
            case 'input': return InteractionType.INPUT;
            case 'submit': return InteractionType.SUBMIT;
            case 'scroll': return InteractionType.SCROLL;
            case 'focus': return InteractionType.FOCUS;
            case 'blur': return InteractionType.BLUR;
            default: return null;
        }
    }

    private getInteractionContext(element: Element, event: Event): InteractionContext {
        const context: InteractionContext = {
            pageUrl: window.location.href,
            elementPath: this.getElementPath(element)
        };

        // Add surrounding text context
        const textContent = element.textContent?.trim();
        if (textContent && textContent.length > 0) {
            context.surroundingText = textContent.substring(0, 200);
        }

        // Add form context if applicable
        const form = element.closest('form');
        if (form) {
            context.formContext = {
                formId: form.id || undefined,
                fieldName: (element as HTMLInputElement).name || undefined,
                fieldType: (element as HTMLInputElement).type || undefined,
                fieldValue: (element as HTMLInputElement).value || undefined
            };
        }

        return context;
    }

    private updateVisibleElements(entries: IntersectionObserverEntry[]): void {
        entries.forEach(entry => {
            const element = entry.target;
            const elementInfo = this.getElementInfo(element);

            if (entry.isIntersecting) {
                // Add or update visible element
                const existingIndex = this.visibleElements.findIndex(
                    ve => ve.selector === elementInfo.selector
                );

                const visibleElement: VisibleElement = {
                    selector: elementInfo.selector,
                    text: element.textContent?.trim() || '',
                    bounds: entry.boundingClientRect,
                    visibility: entry.intersectionRatio
                };

                if (existingIndex >= 0) {
                    this.visibleElements[existingIndex] = visibleElement;
                } else {
                    this.visibleElements.push(visibleElement);
                }
            } else {
                // Remove element from visible list
                this.visibleElements = this.visibleElements.filter(
                    ve => ve.selector !== elementInfo.selector
                );
            }
        });
    }

    private observeContentElements(): void {
        if (!this.intersectionObserver) {
            return;
        }

        // Observe key content elements
        const selectors = [
            'h1, h2, h3, h4, h5, h6',
            'p',
            'article',
            'section',
            'main',
            'nav',
            'aside',
            'form',
            'table',
            'img',
            '[role="main"]',
            '[role="article"]',
            '[role="navigation"]'
        ];

        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                this.intersectionObserver!.observe(element);
            });
        });
    }

    private updateViewportInfo(): void {
        if (typeof window === 'undefined') {
            return;
        }

        this.currentViewport = {
            width: window.innerWidth,
            height: window.innerHeight,
            scrollX: window.scrollX,
            scrollY: window.scrollY,
            devicePixelRatio: window.devicePixelRatio || 1
        };
    }

    private getCurrentScrollPosition(): ScrollPosition {
        return {
            x: window.scrollX || 0,
            y: window.scrollY || 0,
            maxX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
            maxY: Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
        };
    }

    private detectModals(): Modal[] {
        const modals: Modal[] = [];

        // Common modal selectors
        const modalSelectors = [
            '[role="dialog"]',
            '[role="alertdialog"]',
            '.modal',
            '.dialog',
            '.popup',
            '[aria-modal="true"]'
        ];

        modalSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                const isVisible = this.isElementVisible(element);
                if (isVisible) {
                    modals.push({
                        selector: this.getElementSelector(element),
                        title: this.getModalTitle(element),
                        content: element.textContent?.trim() || '',
                        isVisible
                    });
                }
            });
        });

        return modals;
    }

    private detectOverlays(): Overlay[] {
        const overlays: Overlay[] = [];

        // Common overlay selectors
        const overlaySelectors = [
            '.overlay',
            '.backdrop',
            '.tooltip',
            '.dropdown',
            '.notification',
            '[role="tooltip"]',
            '[role="menu"]'
        ];

        overlaySelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                const isVisible = this.isElementVisible(element);
                if (isVisible) {
                    const computedStyle = window.getComputedStyle(element);
                    overlays.push({
                        selector: this.getElementSelector(element),
                        type: this.getOverlayType(element),
                        isVisible,
                        zIndex: parseInt(computedStyle.zIndex) || 0
                    });
                }
            });
        });

        return overlays;
    }

    private getModalTitle(element: Element): string | undefined {
        // Try various methods to get modal title
        const titleElement = element.querySelector('h1, h2, h3, h4, h5, h6, .title, .modal-title');
        if (titleElement) {
            return titleElement.textContent?.trim();
        }

        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
            return ariaLabel;
        }

        const ariaLabelledBy = element.getAttribute('aria-labelledby');
        if (ariaLabelledBy) {
            const labelElement = document.getElementById(ariaLabelledBy);
            if (labelElement) {
                return labelElement.textContent?.trim();
            }
        }

        return undefined;
    }

    private getOverlayType(element: Element): OverlayType {
        const classList = element.classList;
        const role = element.getAttribute('role');

        if (role === 'tooltip' || classList.contains('tooltip')) {
            return OverlayType.TOOLTIP;
        }
        if (role === 'menu' || classList.contains('dropdown')) {
            return OverlayType.DROPDOWN;
        }
        if (classList.contains('notification')) {
            return OverlayType.NOTIFICATION;
        }
        if (classList.contains('popup')) {
            return OverlayType.POPUP;
        }

        return OverlayType.MODAL;
    }

    private isElementVisible(element: Element): boolean {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            parseFloat(style.opacity) > 0;
    }

    private getElementInfo(element: Element): ElementInfo {
        const rect = element.getBoundingClientRect();

        return {
            tagName: element.tagName.toLowerCase(),
            id: element.id || undefined,
            className: element.className || undefined,
            selector: this.getElementSelector(element),
            bounds: rect.width > 0 && rect.height > 0 ? rect : undefined
        };
    }

    private getElementSelector(element: Element): string {
        if (element.id) {
            return `#${element.id}`;
        }

        const path: string[] = [];
        let current: Element | null = element;

        while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();

            if (current.className) {
                const classes = current.className.split(' ').filter(c => c.trim());
                if (classes.length > 0) {
                    selector += '.' + classes.join('.');
                }
            }

            // Add nth-child if needed for uniqueness
            const siblings = Array.from(current.parentElement?.children || []);
            const sameTagSiblings = siblings.filter(s => s.tagName === current!.tagName);
            if (sameTagSiblings.length > 1) {
                const index = sameTagSiblings.indexOf(current) + 1;
                selector += `:nth-child(${index})`;
            }

            path.unshift(selector);
            current = current.parentElement;
        }

        return path.join(' > ');
    }

    private getElementPath(element: Element): string {
        const path: string[] = [];
        let current: Element | null = element;

        while (current && current !== document.body) {
            let part = current.tagName.toLowerCase();
            if (current.id) {
                part += `#${current.id}`;
            }
            if (current.className) {
                const classes = current.className.split(' ').filter(c => c.trim());
                if (classes.length > 0) {
                    part += '.' + classes.slice(0, 2).join('.');
                }
            }
            path.unshift(part);
            current = current.parentElement;
        }

        return path.join(' > ');
    }

    private getDefaultViewport(): ViewportInfo {
        return {
            width: 1024,
            height: 768,
            scrollX: 0,
            scrollY: 0,
            devicePixelRatio: 1
        };
    }

    private cleanupOldChanges(): void {
        const cutoffTime = Date.now() - (5 * 60 * 1000); // 5 minutes
        this.recentChanges = this.recentChanges.filter(
            change => change.timestamp.getTime() > cutoffTime
        );
    }

    private cleanupObservers(): void {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }

        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    }

    private cleanupEventListeners(): void {
        this.eventListeners.forEach((listener, eventType) => {
            document.removeEventListener(eventType, listener, true);
        });
        this.eventListeners.clear();
    }

    private clearPendingWork(): void {
        if (this.processingTimer) {
            clearTimeout(this.processingTimer);
            this.processingTimer = null;
        }
        this.pendingChanges = [];
    }

    /**
     * Set up error handling callbacks
     */
    private setupErrorHandling(): void {
        this.errorHandler.onError(ErrorCategory.DOM, async (error) => {
            this.observerErrors++;
            this.observerStats.errorCount++;
            this.observerStats.lastError = new Date();

            if (error.severity === ErrorSeverity.CRITICAL) {
                console.error('Critical DOM observer error, attempting recovery');
                await this.recover();
            } else if (this.observerErrors >= this.maxObserverErrors) {
                console.warn('Too many DOM observer errors, pausing observation');
                this.pauseObserving();
            }
        });
    }

    /**
     * Handle observer-specific errors
     */
    private async handleObserverError(context: string, error: any): Promise<void> {
        await this.errorHandler.handleError(
            ErrorCategory.DOM,
            ErrorSeverity.LOW,
            `${context} error: ${error.message || error}`,
            'DOMObserver',
            error instanceof Error ? error : new Error(String(error)),
            { context }
        );
    }

    /**
     * Start health check monitoring
     */
    private startHealthCheck(): void {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000); // Check every 30 seconds
    }

    /**
     * Stop health check monitoring
     */
    private stopHealthCheck(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    /**
     * Perform health check on observers
     */
    private async performHealthCheck(): Promise<void> {
        try {
            this.lastHealthCheck = new Date();

            if (!this.isObserving || this.isPaused) {
                return;
            }

            // Check if observers are still connected
            let observersHealthy = true;

            if (this.mutationObserver) {
                try {
                    // Test if mutation observer is still working by checking if it's connected
                    // This is a simple check - in a real scenario you might want more sophisticated testing
                    if (!document.body) {
                        observersHealthy = false;
                    }
                } catch (error) {
                    observersHealthy = false;
                }
            }

            if (!observersHealthy) {
                await this.errorHandler.handleError(
                    ErrorCategory.DOM,
                    ErrorSeverity.MEDIUM,
                    'DOM observers appear to be disconnected, attempting recovery',
                    'DOMObserver'
                );
                await this.recover();
            }

            // Reset error count if observing is stable
            if (this.observerErrors > 0 && this.isObserving && !this.isPaused) {
                this.observerErrors = Math.max(0, this.observerErrors - 1);
            }

            // Check circuit breaker state
            if (this.circuitBreaker.getState() === 'open') {
                console.warn('DOM observer circuit breaker is open');
            }

        } catch (error) {
            console.error('DOM observer health check failed:', error);
        }
    }

    /**
     * Enhanced observe content elements with error handling
     */
    private async observeContentElements(): Promise<void> {
        if (!this.intersectionObserver) {
            return;
        }

        try {
            // Observe key content elements
            const selectors = [
                'h1, h2, h3, h4, h5, h6',
                'p',
                'article',
                'section',
                'main',
                'nav',
                'aside',
                'form',
                'table',
                'img',
                '[role="main"]',
                '[role="article"]',
                '[role="navigation"]'
            ];

            selectors.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(element => {
                        if (this.intersectionObserver) {
                            this.intersectionObserver.observe(element);
                        }
                    });
                } catch (error) {
                    console.warn(`Failed to observe elements with selector ${selector}:`, error);
                }
            });
        } catch (error) {
            console.warn('Failed to observe content elements:', error);
        }
    }

    /**
     * Enhanced cleanup observers with error handling
     */
    private async cleanupObservers(): Promise<void> {
        const errors: Error[] = [];

        try {
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
                this.mutationObserver = null;
            }
        } catch (error) {
            errors.push(new Error(`MutationObserver cleanup failed: ${error.message}`));
        }

        try {
            if (this.intersectionObserver) {
                this.intersectionObserver.disconnect();
                this.intersectionObserver = null;
            }
        } catch (error) {
            errors.push(new Error(`IntersectionObserver cleanup failed: ${error.message}`));
        }

        try {
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }
        } catch (error) {
            errors.push(new Error(`ResizeObserver cleanup failed: ${error.message}`));
        }

        if (errors.length > 0) {
            throw new Error(`Observer cleanup errors: ${errors.map(e => e.message).join(', ')}`);
        }
    }

    /**
     * Enhanced cleanup event listeners with error handling
     */
    private async cleanupEventListeners(): Promise<void> {
        const errors: Error[] = [];

        this.eventListeners.forEach((listener, eventType) => {
            try {
                document.removeEventListener(eventType, listener, true);
            } catch (error) {
                errors.push(new Error(`Failed to remove ${eventType} listener: ${error.message}`));
            }
        });

        this.eventListeners.clear();

        if (errors.length > 0) {
            console.warn('Event listener cleanup errors:', errors);
        }
    }

    /**
     * Enhanced process pending changes with error handling
     */
    private processPendingChanges(): void {
        if (this.pendingChanges.length === 0) {
            return;
        }

        try {
            const changes = [...this.pendingChanges];
            this.pendingChanges = [];
            this.processingTimer = null;
            this.lastProcessTime = Date.now();

            changes.forEach(mutation => {
                try {
                    this.processMutation(mutation);
                } catch (error) {
                    this.handleObserverError('Process mutation', error);
                }
            });

            // Cleanup old changes
            this.cleanupOldChanges();
        } catch (error) {
            this.handleObserverError('Process pending changes', error);
        }
    }

    /**
     * Enhanced update visible elements with error handling
     */
    private updateVisibleElements(entries: IntersectionObserverEntry[]): void {
        try {
            entries.forEach(entry => {
                try {
                    const element = entry.target;
                    const elementInfo = this.getElementInfo(element);

                    if (entry.isIntersecting) {
                        // Add or update visible element
                        const existingIndex = this.visibleElements.findIndex(
                            ve => ve.selector === elementInfo.selector
                        );

                        const visibleElement: VisibleElement = {
                            selector: elementInfo.selector,
                            text: element.textContent?.trim() || '',
                            bounds: entry.boundingClientRect,
                            visibility: entry.intersectionRatio
                        };

                        if (existingIndex >= 0) {
                            this.visibleElements[existingIndex] = visibleElement;
                        } else {
                            this.visibleElements.push(visibleElement);
                        }
                    } else {
                        // Remove element from visible list
                        this.visibleElements = this.visibleElements.filter(
                            ve => ve.selector !== elementInfo.selector
                        );
                    }
                } catch (error) {
                    console.warn('Error processing intersection entry:', error);
                }
            });
        } catch (error) {
            this.handleObserverError('Update visible elements', error);
        }
    }

    /**
     * Sleep utility for delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Setup performance monitoring callbacks
     */
    private setupPerformanceMonitoring(): void {
        this.performanceMonitor.onPerformanceAlert(PerformanceAlertLevel.WARNING, (alert) => {
            if (alert.component === 'DOMObserver') {
                console.warn(`DOMObserver performance warning: ${alert.message}`);
                this.adjustPerformanceSettings(alert);
            }
        });

        this.performanceMonitor.onPerformanceAlert(PerformanceAlertLevel.CRITICAL, (alert) => {
            if (alert.component === 'DOMObserver') {
                console.error(`DOMObserver performance critical: ${alert.message}`);
                this.handleCriticalPerformanceIssue(alert);
            }
        });
    }

    /**
     * Adjust performance settings based on alerts
     */
    private adjustPerformanceSettings(alert: any): void {
        switch (alert.metric) {
            case 'responseTime':
                // Increase throttle interval for mutation processing
                this.dynamicThrottleInterval = Math.min(1000, this.dynamicThrottleInterval * 1.5);
                break;
            case 'memoryUsage':
                // Reduce buffer sizes and cleanup old data
                this.maxChanges = Math.max(100, this.maxChanges * 0.8);
                this.maxInteractions = Math.max(50, this.maxInteractions * 0.8);
                this.cleanupOldData();
                break;
        }
    }

    /**
     * Handle critical performance issues
     */
    private async handleCriticalPerformanceIssue(alert: any): Promise<void> {
        switch (alert.metric) {
            case 'responseTime':
                // Temporarily pause processing to recover
                this.pauseObserving();
                setTimeout(() => this.resumeObserving(), 3000);
                break;
            case 'memoryUsage':
                // Aggressive cleanup
                this.clearData();
                this.performanceMonitor.triggerMemoryCleanup();
                break;
        }
    }

    /**
     * Enhanced mutation processing with performance monitoring
     */
    @withPerformanceMonitoring('DOMObserver')
    private async processPendingChangesWithMetrics(): Promise<void> {
        if (this.pendingChanges.length === 0) {
            return;
        }

        const operationId = `process_mutations_${Date.now()}`;
        this.performanceMonitor.startTimer(operationId);

        try {
            // Check if we should throttle processing
            if (this.performanceMonitor.shouldThrottle('DOMObserver')) {
                const delay = this.performanceMonitor.getThrottleDelay('DOMObserver');
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            const startTime = performance.now();

            const changes = [...this.pendingChanges];
            this.pendingChanges = [];
            this.processingTimer = null;
            this.lastProcessTime = Date.now();

            changes.forEach(mutation => {
                try {
                    this.processMutation(mutation);
                } catch (error) {
                    this.handleObserverError('Process mutation', error);
                }
            });

            // Cleanup old changes
            this.cleanupOldChanges();

            const processingTime = performance.now() - startTime;
            this.mutationProcessingTime.push(processingTime);

            // Keep only recent processing times
            if (this.mutationProcessingTime.length > 100) {
                this.mutationProcessingTime = this.mutationProcessingTime.slice(-50);
            }

            this.performanceMonitor.endTimer(operationId, 'DOMObserver', changes.length);
        } catch (error) {
            this.performanceMonitor.endTimer(operationId, 'DOMObserver', 0);
            throw error;
        }
    }

    /**
     * Enhanced user interaction handling with performance monitoring
     */
    @withPerformanceMonitoring('DOMObserver')
    private handleUserInteractionWithMetrics(event: Event): void {
        const operationId = `handle_interaction_${Date.now()}`;
        this.performanceMonitor.startTimer(operationId);

        try {
            const startTime = performance.now();

            const target = event.target as Element;
            if (!target || target.nodeType !== Node.ELEMENT_NODE) {
                return;
            }

            const interactionType = this.getInteractionType(event.type);
            if (!interactionType) {
                return;
            }

            const elementInfo = this.getElementInfo(target);
            const context = this.getInteractionContext(target, event);

            const interaction: UserInteraction = {
                type: interactionType,
                element: elementInfo,
                timestamp: new Date(),
                context
            };

            this.trackedInteractions.push(interaction);

            // Keep only recent interactions
            if (this.trackedInteractions.length > this.maxInteractions) {
                this.trackedInteractions = this.trackedInteractions.slice(-this.maxInteractions);
            }

            const processingTime = performance.now() - startTime;
            this.interactionProcessingTime.push(processingTime);

            // Keep only recent processing times
            if (this.interactionProcessingTime.length > 100) {
                this.interactionProcessingTime = this.interactionProcessingTime.slice(-50);
            }

            this.performanceMonitor.endTimer(operationId, 'DOMObserver', 1);
        } catch (error) {
            this.performanceMonitor.endTimer(operationId, 'DOMObserver', 0);
            throw error;
        }
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats(): {
        componentStats: any;
        systemStats: any;
        recentAlerts: any[];
        processingTimes: {
            mutations: { average: number; max: number; min: number };
            interactions: { average: number; max: number; min: number };
        };
        throttleInterval: number;
        optimizationActions: any[];
    } {
        const mutationStats = this.calculateProcessingStats(this.mutationProcessingTime);
        const interactionStats = this.calculateProcessingStats(this.interactionProcessingTime);

        return {
            componentStats: this.performanceMonitor.getComponentStats('DOMObserver'),
            systemStats: this.performanceMonitor.getSystemStats(),
            recentAlerts: this.performanceMonitor.getRecentAlerts(),
            processingTimes: {
                mutations: mutationStats,
                interactions: interactionStats
            },
            throttleInterval: this.dynamicThrottleInterval,
            optimizationActions: this.performanceMonitor.getOptimizationHistory()
        };
    }

    /**
     * Calculate processing time statistics
     */
    private calculateProcessingStats(times: number[]): { average: number; max: number; min: number } {
        if (times.length === 0) {
            return { average: 0, max: 0, min: 0 };
        }

        const sum = times.reduce((a, b) => a + b, 0);
        return {
            average: sum / times.length,
            max: Math.max(...times),
            min: Math.min(...times)
        };
    }

    /**
     * Optimize performance based on current metrics
     */
    optimizePerformance(): void {
        const stats = this.performanceMonitor.getComponentStats('DOMObserver');
        if (!stats) return;

        // Adjust throttle interval based on processing times
        const avgMutationTime = this.mutationProcessingTime.length > 0
            ? this.mutationProcessingTime.reduce((a, b) => a + b, 0) / this.mutationProcessingTime.length
            : 0;

        if (avgMutationTime > 50) { // 50ms threshold
            this.dynamicThrottleInterval = Math.min(1000, this.dynamicThrottleInterval * 1.2);
        } else if (avgMutationTime < 10) { // 10ms threshold
            this.dynamicThrottleInterval = Math.max(50, this.dynamicThrottleInterval * 0.9);
        }

        // Adjust buffer sizes based on memory usage
        const memoryUsage = this.performanceMonitor.getCurrentMemoryUsage();
        if (memoryUsage && memoryUsage.percentage > 70) {
            this.maxChanges = Math.max(100, this.maxChanges * 0.9);
            this.maxInteractions = Math.max(50, this.maxInteractions * 0.9);
        }

        // Clean up old data if performance is degrading
        if (stats.averageResponseTime > 100) {
            this.cleanupOldData();
        }
    }

    /**
     * Clean up old data to free memory
     */
    private cleanupOldData(): void {
        const cutoff = Date.now() - 300000; // 5 minutes

        // Clean up old changes
        this.recentChanges = this.recentChanges.filter(
            change => change.timestamp.getTime() > cutoff
        );

        // Clean up old interactions
        this.trackedInteractions = this.trackedInteractions.filter(
            interaction => interaction.timestamp.getTime() > cutoff
        );

        // Clean up processing time arrays
        this.mutationProcessingTime = this.mutationProcessingTime.slice(-25);
        this.interactionProcessingTime = this.interactionProcessingTime.slice(-25);
    }

    /**
     * Enhanced health check with performance monitoring
     */
    private async performHealthCheck(): Promise<void> {
        try {
            this.lastHealthCheck = new Date();

            if (!this.isObserving || this.isPaused) {
                return;
            }

            // Existing health checks...
            let observersHealthy = true;

            if (this.mutationObserver) {
                try {
                    if (!document.body) {
                        observersHealthy = false;
                    }
                } catch (error) {
                    observersHealthy = false;
                }
            }

            if (!observersHealthy) {
                await this.errorHandler.handleError(
                    ErrorCategory.DOM,
                    ErrorSeverity.MEDIUM,
                    'DOM observers appear to be disconnected, attempting recovery',
                    'DOMObserver'
                );
                await this.recover();
            }

            // Performance health checks
            const memoryUsage = this.performanceMonitor.getCurrentMemoryUsage();
            if (memoryUsage && memoryUsage.percentage > 80) {
                console.warn('High memory usage in DOMObserver, triggering cleanup');
                this.cleanupOldData();
                this.performanceMonitor.triggerMemoryCleanup();
            }

            // Optimize performance periodically
            const timeSinceLastOptimization = Date.now() - this.lastPerformanceOptimization.getTime();
            if (timeSinceLastOptimization > 60000) { // Every minute
                this.optimizePerformance();
                this.lastPerformanceOptimization = new Date();
            }

            // Reset error count if observing is stable
            if (this.observerErrors > 0 && this.isObserving && !this.isPaused) {
                this.observerErrors = Math.max(0, this.observerErrors - 1);
            }

            // Check circuit breaker state
            if (this.circuitBreaker.getState() === 'open') {
                console.warn('DOM observer circuit breaker is open');
            }

        } catch (error) {
            console.error('DOM observer health check failed:', error);
        }
    }

    /**
     * Override the original processing method to use performance-monitored version
     */
    private scheduleProcessing(): void {
        if (this.processingTimer) {
            return;
        }

        const now = Date.now();
        const timeSinceLastProcess = now - this.lastProcessTime;

        if (timeSinceLastProcess >= this.dynamicThrottleInterval) {
            this.processPendingChangesWithMetrics();
        } else {
            const delay = this.dynamicThrottleInterval - timeSinceLastProcess;
            this.processingTimer = setTimeout(() => {
                this.processPendingChangesWithMetrics();
            }, delay);
        }
    }

    /**
     * Add event listener support for error notifications
     */
    addEventListener(event: string, callback: (data: any) => void): void {
        // Implementation would depend on existing event system
        // This is a placeholder for the interface
    }
}