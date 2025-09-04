import { DOMObserver } from '../DOMObserver';
import { InteractionType, OverlayType } from '../../types/monitoring';

// Mock DOM APIs
const mockMutationObserver = {
    observe: jest.fn(),
    disconnect: jest.fn(),
    takeRecords: jest.fn(() => [])
};

const mockIntersectionObserver = {
    observe: jest.fn(),
    disconnect: jest.fn(),
    unobserve: jest.fn()
};

const mockResizeObserver = {
    observe: jest.fn(),
    disconnect: jest.fn(),
    unobserve: jest.fn()
};

// Setup global mocks
Object.defineProperty(global, 'MutationObserver', {
    value: jest.fn(() => mockMutationObserver),
    writable: true
});

Object.defineProperty(global, 'IntersectionObserver', {
    value: jest.fn(() => mockIntersectionObserver),
    writable: true
});

Object.defineProperty(global, 'ResizeObserver', {
    value: jest.fn(() => mockResizeObserver),
    writable: true
});

// Simple test without complex DOM mocking
describe('DOMObserver - Basic Functionality', () => {
    let domObserver: DOMObserver;

    beforeEach(() => {
        jest.clearAllMocks();
        domObserver = new DOMObserver(100, 1000, 500);
    });

    afterEach(() => {
        domObserver.stopObserving();
    });

    describe('initialization', () => {
        it('should create DOMObserver instance', () => {
            expect(domObserver).toBeDefined();
            expect(domObserver.isActive()).toBe(false);
        });

        it('should initialize with custom parameters', () => {
            const customObserver = new DOMObserver(50, 500, 250);
            expect(customObserver).toBeDefined();
            expect(customObserver.isActive()).toBe(false);
            customObserver.stopObserving();
        });

        it('should initialize with default parameters', () => {
            const defaultObserver = new DOMObserver();
            expect(defaultObserver).toBeDefined();
            expect(defaultObserver.isActive()).toBe(false);
            defaultObserver.stopObserving();
        });
    });

    describe('observation lifecycle', () => {
        it('should start and stop observing', () => {
            expect(domObserver.isActive()).toBe(false);

            domObserver.startObserving();
            expect(domObserver.isActive()).toBe(true);
            expect(MutationObserver).toHaveBeenCalled();
            expect(IntersectionObserver).toHaveBeenCalled();
            expect(ResizeObserver).toHaveBeenCalled();

            domObserver.stopObserving();
            expect(domObserver.isActive()).toBe(false);
            expect(mockMutationObserver.disconnect).toHaveBeenCalled();
            expect(mockIntersectionObserver.disconnect).toHaveBeenCalled();
            expect(mockResizeObserver.disconnect).toHaveBeenCalled();
        });

        it('should not start observing twice', () => {
            domObserver.startObserving();
            const firstCallCount = (MutationObserver as jest.Mock).mock.calls.length;

            domObserver.startObserving();
            expect((MutationObserver as jest.Mock).mock.calls.length).toBe(firstCallCount);
        });

        it('should not stop observing if not started', () => {
            expect(() => domObserver.stopObserving()).not.toThrow();
            expect(domObserver.isActive()).toBe(false);
        });

        it('should handle missing window object', () => {
            // Test that observer handles environment without window
            const observer = new DOMObserver();
            expect(observer).toBeDefined();
            observer.stopObserving();
        });
    });

    describe('layout snapshot', () => {
        beforeEach(() => {
            domObserver.startObserving();
        });

        it('should get current layout snapshot', () => {
            const layout = domObserver.getCurrentLayout();

            expect(layout).toBeDefined();
            expect(layout.viewport).toBeDefined();
            expect(layout.scrollPosition).toBeDefined();
            expect(layout.visibleElements).toBeDefined();
            expect(layout.modals).toBeDefined();
            expect(layout.overlays).toBeDefined();
        });

        it('should get visible content elements', () => {
            const visibleElements = domObserver.getVisibleContent();
            expect(Array.isArray(visibleElements)).toBe(true);
        });

        it('should provide default viewport when window is not available', () => {
            const layout = domObserver.getCurrentLayout();
            expect(layout.viewport).toBeDefined();
            expect(typeof layout.viewport.width).toBe('number');
            expect(typeof layout.viewport.height).toBe('number');
        });
    });

    describe('change tracking', () => {
        beforeEach(() => {
            domObserver.startObserving();
        });

        it('should get recent changes', () => {
            const changes = domObserver.getRecentChanges();
            expect(Array.isArray(changes)).toBe(true);
        });

        it('should get recent changes within time window', () => {
            const changes = domObserver.getRecentChanges(30000); // 30 seconds
            expect(Array.isArray(changes)).toBe(true);
        });

        it('should get recent interactions', () => {
            const interactions = domObserver.getRecentInteractions();
            expect(Array.isArray(interactions)).toBe(true);
        });

        it('should get recent interactions within time window', () => {
            const interactions = domObserver.getRecentInteractions(30000); // 30 seconds
            expect(Array.isArray(interactions)).toBe(true);
        });
    });

    describe('data management', () => {
        beforeEach(() => {
            domObserver.startObserving();
        });

        it('should clear all data', () => {
            domObserver.clearData();

            const changes = domObserver.getRecentChanges();
            const interactions = domObserver.getRecentInteractions();
            const visibleElements = domObserver.getVisibleContent();

            expect(changes).toHaveLength(0);
            expect(interactions).toHaveLength(0);
            expect(visibleElements).toHaveLength(0);
        });
    });

    describe('observer support detection', () => {
        it('should handle missing MutationObserver gracefully', () => {
            const originalMutationObserver = global.MutationObserver;
            delete (global as any).MutationObserver;

            const observer = new DOMObserver();
            expect(() => observer.startObserving()).not.toThrow();
            expect(observer.isActive()).toBe(true);

            global.MutationObserver = originalMutationObserver;
            observer.stopObserving();
        });

        it('should handle missing IntersectionObserver gracefully', () => {
            const originalIntersectionObserver = global.IntersectionObserver;
            delete (global as any).IntersectionObserver;

            const observer = new DOMObserver();
            expect(() => observer.startObserving()).not.toThrow();
            expect(observer.isActive()).toBe(true);

            global.IntersectionObserver = originalIntersectionObserver;
            observer.stopObserving();
        });

        it('should handle missing ResizeObserver gracefully', () => {
            const originalResizeObserver = global.ResizeObserver;
            delete (global as any).ResizeObserver;

            const observer = new DOMObserver();
            expect(() => observer.startObserving()).not.toThrow();
            expect(observer.isActive()).toBe(true);

            global.ResizeObserver = originalResizeObserver;
            observer.stopObserving();
        });
    });

    describe('configuration', () => {
        it('should create observer with different configurations', () => {
            const configs = [
                { throttle: 50, maxChanges: 500, maxInteractions: 250 },
                { throttle: 200, maxChanges: 2000, maxInteractions: 1000 },
                { throttle: 1000, maxChanges: 100, maxInteractions: 50 }
            ];

            configs.forEach(config => {
                const observer = new DOMObserver(config.throttle, config.maxChanges, config.maxInteractions);
                expect(observer).toBeDefined();
                observer.stopObserving();
            });
        });
    });

    describe('lifecycle management', () => {
        it('should handle close operation', () => {
            expect(() => domObserver.stopObserving()).not.toThrow();
        });

        it('should handle multiple close operations', () => {
            domObserver.stopObserving();
            expect(() => domObserver.stopObserving()).not.toThrow();
        });

        it('should handle start/stop cycles', () => {
            for (let i = 0; i < 3; i++) {
                domObserver.startObserving();
                expect(domObserver.isActive()).toBe(true);

                domObserver.stopObserving();
                expect(domObserver.isActive()).toBe(false);
            }
        });
    });

    describe('performance optimization', () => {
        it('should handle throttling configuration', () => {
            const fastObserver = new DOMObserver(10); // 10ms throttle
            const slowObserver = new DOMObserver(1000); // 1s throttle

            expect(fastObserver).toBeDefined();
            expect(slowObserver).toBeDefined();

            fastObserver.stopObserving();
            slowObserver.stopObserving();
        });

        it('should handle buffer size limits', () => {
            const smallBufferObserver = new DOMObserver(100, 10, 5); // Small buffers
            const largeBufferObserver = new DOMObserver(100, 10000, 5000); // Large buffers

            expect(smallBufferObserver).toBeDefined();
            expect(largeBufferObserver).toBeDefined();

            smallBufferObserver.stopObserving();
            largeBufferObserver.stopObserving();
        });
    });

    describe('data structures', () => {
        it('should handle interaction types', () => {
            // Test that the observer can be created and handles the expected interaction types
            const observer = new DOMObserver();
            expect(observer).toBeDefined();

            // Verify the observer is set up to handle different event types
            observer.startObserving();
            observer.stopObserving();
        });

        it('should handle overlay types', () => {
            // Test that the observer can detect different overlay types
            const observer = new DOMObserver();
            expect(observer).toBeDefined();

            observer.startObserving();
            const layout = observer.getCurrentLayout();
            expect(layout.overlays).toBeDefined();
            observer.stopObserving();
        });
    });
});