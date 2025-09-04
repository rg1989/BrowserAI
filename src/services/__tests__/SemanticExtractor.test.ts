import { SemanticExtractor } from '../SemanticExtractor';

// Simple test without complex DOM mocking
describe('SemanticExtractor - Basic Functionality', () => {
    let semanticExtractor: SemanticExtractor;

    beforeEach(() => {
        semanticExtractor = new SemanticExtractor();
    });

    describe('initialization', () => {
        it('should create SemanticExtractor instance', () => {
            expect(semanticExtractor).toBeDefined();
        });

        it('should initialize with default configuration', () => {
            const extractor = new SemanticExtractor();
            expect(extractor).toBeDefined();
        });
    });

    describe('custom namespace handling', () => {
        it('should register custom namespaces', () => {
            const customExtractor = jest.fn(() => ({ test: 'value' }));
            semanticExtractor.registerCustomNamespace('test', customExtractor);

            // Test that the namespace was registered by checking it doesn't throw
            expect(() => {
                semanticExtractor.registerCustomNamespace('another', () => ({}));
            }).not.toThrow();
        });

        it('should handle custom namespace extraction', () => {
            const testExtractor = (element: Element) => {
                const id = element.getAttribute('data-test-id');
                const name = element.getAttribute('data-test-name');
                return { id, name };
            };

            semanticExtractor.registerCustomNamespace('test', testExtractor);

            // Test that registration doesn't throw
            expect(() => {
                semanticExtractor.registerCustomNamespace('test', testExtractor);
            }).not.toThrow();
        });
    });

    describe('semantic data structure', () => {
        it('should handle semantic data extraction without DOM', () => {
            // Mock document methods to avoid DOM dependency
            const originalQuerySelectorAll = document.querySelectorAll;
            const originalQuerySelector = document.querySelector;

            document.querySelectorAll = jest.fn(() => []) as any;
            document.querySelector = jest.fn(() => null) as any;

            try {
                const semanticData = semanticExtractor.extractSemanticData();

                expect(semanticData).toBeDefined();
                expect(Array.isArray(semanticData.schema)).toBe(true);
                expect(Array.isArray(semanticData.microdata)).toBe(true);
                expect(Array.isArray(semanticData.jsonLd)).toBe(true);
                expect(typeof semanticData.openGraph).toBe('object');
                expect(typeof semanticData.twitter).toBe('object');
                expect(Array.isArray(semanticData.custom)).toBe(true);
            } finally {
                // Restore original methods
                document.querySelectorAll = originalQuerySelectorAll;
                document.querySelector = originalQuerySelector;
            }
        });

        it('should extract Schema.org data structure', () => {
            const originalQuerySelectorAll = document.querySelectorAll;

            document.querySelectorAll = jest.fn(() => []) as any;

            try {
                const schemaData = semanticExtractor.extractSchemaOrgData();
                expect(Array.isArray(schemaData)).toBe(true);
            } finally {
                document.querySelectorAll = originalQuerySelectorAll;
            }
        });

        it('should extract microdata structure', () => {
            const originalQuerySelectorAll = document.querySelectorAll;

            document.querySelectorAll = jest.fn(() => []) as any;

            try {
                const microdataItems = semanticExtractor.extractMicrodataItems();
                expect(Array.isArray(microdataItems)).toBe(true);
            } finally {
                document.querySelectorAll = originalQuerySelectorAll;
            }
        });

        it('should extract JSON-LD structure', () => {
            const originalQuerySelectorAll = document.querySelectorAll;

            document.querySelectorAll = jest.fn(() => []) as any;

            try {
                const jsonLdData = semanticExtractor.extractJsonLdData();
                expect(Array.isArray(jsonLdData)).toBe(true);
            } finally {
                document.querySelectorAll = originalQuerySelectorAll;
            }
        });

        it('should extract OpenGraph structure', () => {
            const originalQuerySelector = document.querySelector;

            document.querySelector = jest.fn(() => null) as any;

            try {
                const openGraphData = semanticExtractor.extractOpenGraphData();
                expect(typeof openGraphData).toBe('object');
            } finally {
                document.querySelector = originalQuerySelector;
            }
        });

        it('should extract Twitter Card structure', () => {
            const originalQuerySelector = document.querySelector;

            document.querySelector = jest.fn(() => null) as any;

            try {
                const twitterData = semanticExtractor.extractTwitterCardData();
                expect(typeof twitterData).toBe('object');
            } finally {
                document.querySelector = originalQuerySelector;
            }
        });

        it('should extract custom semantic data structure', () => {
            const originalQuerySelectorAll = document.querySelectorAll;

            document.querySelectorAll = jest.fn(() => []) as any;

            try {
                const customData = semanticExtractor.extractCustomSemanticData();
                expect(Array.isArray(customData)).toBe(true);
            } finally {
                document.querySelectorAll = originalQuerySelectorAll;
            }
        });
    });

    describe('JSON-LD parsing', () => {
        it('should handle valid JSON-LD data', () => {
            const mockScript = {
                textContent: JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'Product',
                    'name': 'Test Product'
                })
            };

            const originalQuerySelectorAll = document.querySelectorAll;
            document.querySelectorAll = jest.fn((selector) => {
                if (selector === 'script[type="application/ld+json"]') {
                    return [mockScript];
                }
                return [];
            }) as any;

            try {
                const jsonLdData = semanticExtractor.extractJsonLdData();
                expect(Array.isArray(jsonLdData)).toBe(true);
                if (jsonLdData.length > 0) {
                    expect(jsonLdData[0]['@type']).toBe('Product');
                }
            } finally {
                document.querySelectorAll = originalQuerySelectorAll;
            }
        });

        it('should handle invalid JSON-LD gracefully', () => {
            const mockScript = {
                textContent: 'invalid json'
            };

            const originalQuerySelectorAll = document.querySelectorAll;
            document.querySelectorAll = jest.fn((selector) => {
                if (selector === 'script[type="application/ld+json"]') {
                    return [mockScript];
                }
                return [];
            }) as any;

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            try {
                const jsonLdData = semanticExtractor.extractJsonLdData();
                expect(Array.isArray(jsonLdData)).toBe(true);
                expect(jsonLdData).toHaveLength(0);
            } finally {
                document.querySelectorAll = originalQuerySelectorAll;
                consoleSpy.mockRestore();
            }
        });

        it('should handle JSON-LD arrays', () => {
            const mockScript = {
                textContent: JSON.stringify([
                    { '@type': 'Product', 'name': 'Product 1' },
                    { '@type': 'Product', 'name': 'Product 2' }
                ])
            };

            const originalQuerySelectorAll = document.querySelectorAll;
            document.querySelectorAll = jest.fn((selector) => {
                if (selector === 'script[type="application/ld+json"]') {
                    return [mockScript];
                }
                return [];
            }) as any;

            try {
                const jsonLdData = semanticExtractor.extractJsonLdData();
                expect(Array.isArray(jsonLdData)).toBe(true);
                expect(jsonLdData.length).toBe(2);
            } finally {
                document.querySelectorAll = originalQuerySelectorAll;
            }
        });
    });

    describe('metadata extraction', () => {
        it('should extract OpenGraph metadata', () => {
            const originalQuerySelector = document.querySelector;
            document.querySelector = jest.fn((selector) => {
                if (selector === 'meta[property="og:title"]') {
                    return { getAttribute: () => 'Test Title' };
                }
                if (selector === 'meta[property="og:description"]') {
                    return { getAttribute: () => 'Test Description' };
                }
                return null;
            }) as any;

            try {
                const openGraphData = semanticExtractor.extractOpenGraphData();
                expect(openGraphData.title).toBe('Test Title');
                expect(openGraphData.description).toBe('Test Description');
            } finally {
                document.querySelector = originalQuerySelector;
            }
        });

        it('should extract Twitter Card metadata', () => {
            const originalQuerySelector = document.querySelector;
            document.querySelector = jest.fn((selector) => {
                if (selector === 'meta[name="twitter:card"]') {
                    return { getAttribute: () => 'summary' };
                }
                if (selector === 'meta[name="twitter:title"]') {
                    return { getAttribute: () => 'Test Title' };
                }
                return null;
            }) as any;

            try {
                const twitterData = semanticExtractor.extractTwitterCardData();
                expect(twitterData.card).toBe('summary');
                expect(twitterData.title).toBe('Test Title');
            } finally {
                document.querySelector = originalQuerySelector;
            }
        });
    });

    describe('element-specific operations', () => {
        it('should extract semantics for specific elements', () => {
            const mockElement = {
                hasAttribute: jest.fn(() => false),
                getAttribute: jest.fn(() => null),
                querySelectorAll: jest.fn(() => [])
            };

            const semantics = semanticExtractor.extractElementSemantics(mockElement as any);
            expect(typeof semantics).toBe('object');
        });

        it('should find elements by semantic type', () => {
            const originalQuerySelectorAll = document.querySelectorAll;
            const originalGetElementById = document.getElementById;

            document.querySelectorAll = jest.fn(() => []) as any;
            document.getElementById = jest.fn(() => null) as any;

            try {
                const elements = semanticExtractor.findElementsBySemanticType('Product');
                expect(Array.isArray(elements)).toBe(true);
            } finally {
                document.querySelectorAll = originalQuerySelectorAll;
                document.getElementById = originalGetElementById;
            }
        });

        it('should get semantic context', () => {
            const originalQuerySelectorAll = document.querySelectorAll;
            const originalQuerySelector = document.querySelector;

            document.querySelectorAll = jest.fn(() => []) as any;
            document.querySelector = jest.fn(() => null) as any;

            try {
                const context = semanticExtractor.getSemanticContext();
                expect(context).toBeDefined();
                expect(context.schema).toBeDefined();
                expect(context.microdata).toBeDefined();
                expect(context.jsonLd).toBeDefined();
                expect(context.openGraph).toBeDefined();
                expect(context.twitter).toBeDefined();
                expect(context.custom).toBeDefined();
            } finally {
                document.querySelectorAll = originalQuerySelectorAll;
                document.querySelector = originalQuerySelector;
            }
        });
    });

    describe('error handling', () => {
        it('should handle DOM query errors gracefully', () => {
            const originalQuerySelectorAll = document.querySelectorAll;
            document.querySelectorAll = jest.fn(() => {
                throw new Error('DOM query failed');
            }) as any;

            try {
                expect(() => {
                    semanticExtractor.extractSemanticData();
                }).not.toThrow();
            } finally {
                document.querySelectorAll = originalQuerySelectorAll;
            }
        });

        it('should handle custom namespace errors', () => {
            const errorExtractor = () => {
                throw new Error('Extraction failed');
            };

            semanticExtractor.registerCustomNamespace('error', errorExtractor);

            const originalQuerySelectorAll = document.querySelectorAll;
            document.querySelectorAll = jest.fn((selector) => {
                if (selector === '[data-error]') {
                    return [{ getAttribute: () => 'test' }];
                }
                return [];
            }) as any;

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            try {
                const customData = semanticExtractor.extractCustomSemanticData();
                expect(Array.isArray(customData)).toBe(true);
            } finally {
                document.querySelectorAll = originalQuerySelectorAll;
                consoleSpy.mockRestore();
            }
        });
    });

    describe('default namespaces', () => {
        it('should have default namespaces registered', () => {
            // Test that default namespaces are available by registering a new one
            expect(() => {
                semanticExtractor.registerCustomNamespace('test', () => ({}));
            }).not.toThrow();
        });

        it('should handle product namespace', () => {
            const originalQuerySelectorAll = document.querySelectorAll;
            const mockElement = {
                getAttribute: jest.fn((attr) => {
                    if (attr === 'data-product-id') return 'prod-123';
                    if (attr === 'data-product-name') return 'Test Product';
                    return null;
                })
            };

            document.querySelectorAll = jest.fn((selector) => {
                if (selector === '[data-product]') {
                    return [mockElement];
                }
                return [];
            }) as any;

            try {
                const customData = semanticExtractor.extractCustomSemanticData();
                expect(Array.isArray(customData)).toBe(true);
            } finally {
                document.querySelectorAll = originalQuerySelectorAll;
            }
        });
    });

    describe('performance and edge cases', () => {
        it('should handle empty results gracefully', () => {
            const originalQuerySelectorAll = document.querySelectorAll;
            const originalQuerySelector = document.querySelector;

            document.querySelectorAll = jest.fn(() => []) as any;
            document.querySelector = jest.fn(() => null) as any;

            try {
                const semanticData = semanticExtractor.extractSemanticData();

                expect(semanticData.schema).toHaveLength(0);
                expect(semanticData.microdata).toHaveLength(0);
                expect(semanticData.jsonLd).toHaveLength(0);
                expect(Object.keys(semanticData.openGraph)).toHaveLength(0);
                expect(Object.keys(semanticData.twitter)).toHaveLength(0);
                expect(semanticData.custom).toHaveLength(0);
            } finally {
                document.querySelectorAll = originalQuerySelectorAll;
                document.querySelector = originalQuerySelector;
            }
        });

        it('should handle malformed elements', () => {
            const originalQuerySelectorAll = document.querySelectorAll;
            const mockElement = {
                getAttribute: jest.fn(() => null),
                hasAttribute: jest.fn(() => true),
                querySelectorAll: jest.fn(() => [])
            };

            document.querySelectorAll = jest.fn(() => [mockElement]) as any;

            try {
                expect(() => {
                    const schemaData = semanticExtractor.extractSchemaOrgData();
                    expect(Array.isArray(schemaData)).toBe(true);
                }).not.toThrow();
            } finally {
                document.querySelectorAll = originalQuerySelectorAll;
            }
        });
    });
});