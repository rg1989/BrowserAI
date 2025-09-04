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

    constructor(
        throttleInterval: number = 100,
        maxChanges: number = 1000,
        maxInteractions: number = 500
    ) {
        this.throttleInterval = throttleInterval;
        this.maxChanges = maxChanges;
        this.maxInteractions = maxInteractions;
    }

    /**
     * Start observing DOM changes and user interactions
     */
    startObserving(): void {
        if (this.isObserving || typeof window === 'undefined') {
            return;
        }

        this.isObserving = true;
        this.setupMutationObserver();
        this.setupIntersectionObserver();
        this.setupResizeObserver();
        this.setupEventListeners();
        this.updateViewportInfo();
    }

    /**
     * Stop observing DOM changes and user interactions
     */
    stopObserving(): void {
        if (!this.isObserving) {
            return;
        }

        this.isObserving = false;
        this.cleanupObservers();
        this.cleanupEventListeners();
        this.clearPendingWork();
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
        return this.isObserving;
    }

    private setupMutationObserver(): void {
        if (!window.MutationObserver) {
            console.warn('MutationObserver not supported');
            return;
        }

        this.mutationObserver = new MutationObserver((mutations) => {
            this.pendingChanges.push(...mutations);
            this.scheduleProcessing();
        });

        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeOldValue: true,
            characterData: true,
            characterDataOldValue: true
        });
    }

    private setupIntersectionObserver(): void {
        if (!window.IntersectionObserver) {
            console.warn('IntersectionObserver not supported');
            return;
        }

        this.intersectionObserver = new IntersectionObserver((entries) => {
            this.updateVisibleElements(entries);
        }, {
            threshold: [0, 0.25, 0.5, 0.75, 1.0],
            rootMargin: '50px'
        });

        // Observe key content elements
        this.observeContentElements();
    }

    private setupResizeObserver(): void {
        if (!window.ResizeObserver) {
            console.warn('ResizeObserver not supported');
            return;
        }

        this.resizeObserver = new ResizeObserver(() => {
            this.updateViewportInfo();
        });

        this.resizeObserver.observe(document.body);
    }

    private setupEventListeners(): void {
        const events = [
            'click', 'input', 'submit', 'scroll', 'focus', 'blur', 'keydown'
        ];

        events.forEach(eventType => {
            const listener = (event: Event) => {
                this.handleUserInteraction(event);
            };

            this.eventListeners.set(eventType, listener);
            document.addEventListener(eventType, listener, {
                passive: true,
                capture: true
            });
        });
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
}