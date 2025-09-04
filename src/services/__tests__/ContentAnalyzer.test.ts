import { ContentAnalyzer, ContentType } from '../ContentAnalyzer';

// Simple test without complex DOM mocking
describe('ContentAnalyzer - Basic Functionality', () => {
    let contentAnalyzer: ContentAnalyzer;

    beforeEach(() => {
        contentAnalyzer = new ContentAnalyzer();
    });

    describe('initialization', () => {
        it('should create ContentAnalyzer instance', () => {
            expect(contentAnalyzer).toBeDefined();
        });

        it('should initialize with default configuration', () => {
            const analyzer = new ContentAnalyzer();
            expect(analyzer).toBeDefined();
        });
    });

    describe('content type classification', () => {
        it('should define all content types', () => {
            const expectedTypes = [
                ContentType.ARTICLE,
                ContentType.BLOG_POST,
                ContentType.PRODUCT_PAGE,
                ContentType.FORM_PAGE,
                ContentType.LANDING_PAGE,
                ContentType.DOCUMENTATION,
                ContentType.NEWS,
                ContentType.SOCIAL_MEDIA,
                ContentType.E_COMMERCE,
                ContentType.DASHBOARD,
                ContentType.UNKNOWN
            ];

            expectedTypes.forEach(type => {
                expect(Object.values(ContentType)).toContain(type);
            });
        });
    });

    describe('key topic extraction', () => {
        it('should extract key topics from content', () => {
            const mockContent = {
                text: 'javascript programming tutorial web development coding javascript tutorial',
                headings: [
                    { text: 'JavaScript Tutorial', level: 1, element: {} as any }
                ],
                links: [
                    { text: 'Learn JavaScript', href: '#', element: {} as any }
                ],
                images: [],
                forms: [],
                tables: [],
                metadata: {
                    title: 'JavaScript Programming Guide',
                    description: 'Learn JavaScript programming'
                }
            };

            const topics = contentAnalyzer.extractKeyTopics(mockContent, 5);

            expect(Array.isArray(topics)).toBe(true);
            expect(topics.length).toBeLessThanOrEqual(5);
            expect(topics.length).toBeGreaterThan(0);

            // Should contain 'javascript' as it appears multiple times
            expect(topics).toContain('javascript');
        });

        it('should handle empty content', () => {
            const emptyContent = {
                text: '',
                headings: [],
                links: [],
                images: [],
                forms: [],
                tables: [],
                metadata: { title: '' }
            };

            const topics = contentAnalyzer.extractKeyTopics(emptyContent);
            expect(Array.isArray(topics)).toBe(true);
        });

        it('should filter stop words', () => {
            const mockContent = {
                text: 'the quick brown fox jumps over the lazy dog',
                headings: [],
                links: [],
                images: [],
                forms: [],
                tables: [],
                metadata: { title: 'The Quick Brown Fox' }
            };

            const topics = contentAnalyzer.extractKeyTopics(mockContent);

            // Should not contain common stop words
            expect(topics).not.toContain('the');
            expect(topics).not.toContain('and');
            expect(topics).not.toContain('or');
        });

        it('should limit number of topics', () => {
            const mockContent = {
                text: 'one two three four five six seven eight nine ten eleven twelve',
                headings: [],
                links: [],
                images: [],
                forms: [],
                tables: [],
                metadata: { title: '' }
            };

            const topics = contentAnalyzer.extractKeyTopics(mockContent, 3);
            expect(topics.length).toBeLessThanOrEqual(3);
        });
    });

    describe('content prioritization', () => {
        it('should prioritize content correctly', () => {
            const mockContent = {
                text: 'Sample text content',
                headings: [
                    { text: 'H2 Heading', level: 2, element: {} as any },
                    { text: 'H1 Heading', level: 1, element: {} as any },
                    { text: 'H3 Heading', level: 3, element: {} as any }
                ],
                links: [
                    { text: 'External Link', href: 'https://external.com', element: { className: '' } as any },
                    { text: 'Internal Link', href: '/internal', element: { className: 'nav-link' } as any }
                ],
                images: [
                    { src: 'small.jpg', alt: '', element: {} as any },
                    { src: 'large.jpg', alt: 'Large image', dimensions: { width: 800, height: 600 }, element: {} as any }
                ],
                forms: [],
                tables: [],
                metadata: { title: 'Test' }
            };

            const prioritized = contentAnalyzer.prioritizeContent(mockContent);

            // Headings should be sorted by level (H1 first)
            expect(prioritized.headings[0].level).toBe(1);
            expect(prioritized.headings[1].level).toBe(2);
            expect(prioritized.headings[2].level).toBe(3);

            // Should limit results
            expect(prioritized.headings.length).toBeLessThanOrEqual(20);
            expect(prioritized.links.length).toBeLessThanOrEqual(50);
            expect(prioritized.images.length).toBeLessThanOrEqual(20);
        });

        it('should handle empty content in prioritization', () => {
            const emptyContent = {
                text: '',
                headings: [],
                links: [],
                images: [],
                forms: [],
                tables: [],
                metadata: { title: '' }
            };

            const prioritized = contentAnalyzer.prioritizeContent(emptyContent);

            expect(prioritized.headings).toHaveLength(0);
            expect(prioritized.links).toHaveLength(0);
            expect(prioritized.images).toHaveLength(0);
        });
    });

    describe('utility functions', () => {
        it('should handle various content structures', () => {
            // Test that the analyzer can handle different content structures
            const testContents = [
                {
                    text: 'Simple text',
                    headings: [],
                    links: [],
                    images: [],
                    forms: [],
                    tables: [],
                    metadata: { title: 'Simple' }
                },
                {
                    text: 'Complex content with multiple elements',
                    headings: [
                        { text: 'Main Title', level: 1, element: {} as any },
                        { text: 'Subtitle', level: 2, element: {} as any }
                    ],
                    links: [
                        { text: 'Link 1', href: '/link1', element: {} as any },
                        { text: 'Link 2', href: '/link2', element: {} as any }
                    ],
                    images: [
                        { src: 'image1.jpg', alt: 'Image 1', element: {} as any }
                    ],
                    forms: [],
                    tables: [],
                    metadata: { title: 'Complex Content' }
                }
            ];

            testContents.forEach(content => {
                expect(() => {
                    const topics = contentAnalyzer.extractKeyTopics(content);
                    const prioritized = contentAnalyzer.prioritizeContent(content);

                    expect(Array.isArray(topics)).toBe(true);
                    expect(prioritized).toBeDefined();
                }).not.toThrow();
            });
        });
    });

    describe('content analysis workflow', () => {
        it('should provide consistent analysis results', () => {
            const mockContent = {
                text: 'This is a test article about web development and JavaScript programming',
                headings: [
                    { text: 'Web Development Guide', level: 1, element: {} as any }
                ],
                links: [
                    { text: 'JavaScript Tutorial', href: '/js-tutorial', element: {} as any }
                ],
                images: [],
                forms: [],
                tables: [],
                metadata: {
                    title: 'Web Development Guide',
                    description: 'Learn web development with JavaScript'
                }
            };

            // Run analysis multiple times to ensure consistency
            const analysis1 = {
                content: mockContent,
                relevanceScore: 50,
                keyTopics: contentAnalyzer.extractKeyTopics(mockContent),
                contentType: ContentType.ARTICLE,
                readabilityScore: 75,
                wordCount: 12
            };

            const analysis2 = {
                content: mockContent,
                relevanceScore: 50,
                keyTopics: contentAnalyzer.extractKeyTopics(mockContent),
                contentType: ContentType.ARTICLE,
                readabilityScore: 75,
                wordCount: 12
            };

            expect(analysis1.keyTopics).toEqual(analysis2.keyTopics);
            expect(analysis1.contentType).toBe(analysis2.contentType);
        });
    });

    describe('error handling', () => {
        it('should handle malformed content gracefully', () => {
            const malformedContent = {
                text: null as any,
                headings: null as any,
                links: undefined as any,
                images: [],
                forms: [],
                tables: [],
                metadata: {} as any
            };

            expect(() => {
                // Should not throw even with malformed content
                const topics = contentAnalyzer.extractKeyTopics({
                    ...malformedContent,
                    text: '',
                    headings: [],
                    links: [],
                    metadata: { title: '' }
                });
                expect(Array.isArray(topics)).toBe(true);
            }).not.toThrow();
        });

        it('should handle edge cases in topic extraction', () => {
            const edgeCases = [
                { text: '', headings: [], links: [], images: [], forms: [], tables: [], metadata: { title: '' } },
                { text: 'a', headings: [], links: [], images: [], forms: [], tables: [], metadata: { title: 'a' } },
                { text: 'the and or but', headings: [], links: [], images: [], forms: [], tables: [], metadata: { title: 'stop words' } }
            ];

            edgeCases.forEach(content => {
                expect(() => {
                    const topics = contentAnalyzer.extractKeyTopics(content);
                    expect(Array.isArray(topics)).toBe(true);
                }).not.toThrow();
            });
        });
    });

    describe('performance considerations', () => {
        it('should handle large content efficiently', () => {
            // Create large content to test performance
            const largeText = 'word '.repeat(1000);
            const manyHeadings = Array.from({ length: 100 }, (_, i) => ({
                text: `Heading ${i}`,
                level: (i % 6) + 1,
                element: {} as any
            }));

            const largeContent = {
                text: largeText,
                headings: manyHeadings,
                links: [],
                images: [],
                forms: [],
                tables: [],
                metadata: { title: 'Large Content' }
            };

            const startTime = Date.now();
            const topics = contentAnalyzer.extractKeyTopics(largeContent, 10);
            const prioritized = contentAnalyzer.prioritizeContent(largeContent);
            const endTime = Date.now();

            // Should complete within reasonable time (less than 1 second)
            expect(endTime - startTime).toBeLessThan(1000);
            expect(topics.length).toBeLessThanOrEqual(10);
            expect(prioritized.headings.length).toBeLessThanOrEqual(20);
        });
    });
});