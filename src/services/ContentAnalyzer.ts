import {
    ContentSnapshot,
    Heading,
    Link,
    Image,
    Form,
    FormField,
    Table,
    PageMetadata,
    ElementInfo
} from '../types/monitoring';

/**
 * Content analysis result with relevance scoring
 */
export interface ContentAnalysis {
    content: ContentSnapshot;
    relevanceScore: number;
    keyTopics: string[];
    contentType: ContentType;
    readabilityScore: number;
    wordCount: number;
}

/**
 * Content type classification
 */
export enum ContentType {
    ARTICLE = 'article',
    BLOG_POST = 'blog-post',
    PRODUCT_PAGE = 'product-page',
    FORM_PAGE = 'form-page',
    LANDING_PAGE = 'landing-page',
    DOCUMENTATION = 'documentation',
    NEWS = 'news',
    SOCIAL_MEDIA = 'social-media',
    E_COMMERCE = 'e-commerce',
    DASHBOARD = 'dashboard',
    UNKNOWN = 'unknown'
}

/**
 * Content intent for analysis
 */
export enum ContentIntent {
    RESEARCH = 'research',
    SHOPPING = 'shopping',
    LEARNING = 'learning',
    ENTERTAINMENT = 'entertainment',
    WORK = 'work',
    SOCIAL = 'social',
    UNKNOWN = 'unknown'
}

/**
 * User context for content analysis
 */
export interface UserContext {
    userId?: string;
    preferences?: string[];
    history?: string[];
    currentTask?: string;
}

/**
 * Content analyzer service for extracting and analyzing page content
 * Provides semantic analysis, content prioritization, and relevance scoring
 */
export class ContentAnalyzer {
    private stopWords: Set<string>;
    private contentTypePatterns: Map<ContentType, RegExp[]>;

    constructor() {
        this.stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
            'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
            'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs'
        ]);

        this.contentTypePatterns = new Map([
            [ContentType.ARTICLE, [/article/i, /blog/i, /post/i, /content/i]],
            [ContentType.PRODUCT_PAGE, [/product/i, /item/i, /buy/i, /price/i, /cart/i]],
            [ContentType.FORM_PAGE, [/form/i, /signup/i, /login/i, /register/i, /contact/i]],
            [ContentType.LANDING_PAGE, [/landing/i, /home/i, /welcome/i, /intro/i]],
            [ContentType.DOCUMENTATION, [/docs/i, /documentation/i, /guide/i, /manual/i, /api/i]],
            [ContentType.NEWS, [/news/i, /press/i, /announcement/i, /update/i]],
            [ContentType.DASHBOARD, [/dashboard/i, /admin/i, /panel/i, /console/i]],
            [ContentType.E_COMMERCE, [/shop/i, /store/i, /catalog/i, /checkout/i]]
        ]);
    }

    /**
     * Analyze page content and extract structured information
     */
    analyzeContent(content: ContentSnapshot, userContext?: UserContext, intent?: ContentIntent): ContentAnalysis {
        const relevanceScore = this.calculateRelevanceScore(content);
        const keyTopics = this.extractKeyTopics(content);
        const contentType = this.classifyContentType(content);
        const readabilityScore = this.calculateReadabilityScore(content);
        const wordCount = this.countWords(content.text);

        return {
            content,
            relevanceScore,
            keyTopics,
            contentType,
            readabilityScore,
            wordCount
        };
    }

    /**
     * Extract structured content from DOM element
     */
    extractContent(element: Element = document.body): ContentSnapshot {
        return {
            text: this.extractText(element),
            headings: this.extractHeadings(element),
            links: this.extractLinks(element),
            images: this.extractImages(element),
            forms: this.extractForms(element),
            tables: this.extractTables(element),
            metadata: this.extractMetadata()
        };
    }

    /**
     * Prioritize content based on relevance and importance
     */
    prioritizeContent(content: ContentSnapshot): ContentSnapshot {
        // Sort headings by importance (h1 > h2 > h3, etc.)
        const prioritizedHeadings = [...content.headings].sort((a, b) => a.level - b.level);

        // Prioritize links by relevance (internal links, navigation, etc.)
        const prioritizedLinks = [...content.links].sort((a, b) => {
            const aScore = this.calculateLinkRelevance(a);
            const bScore = this.calculateLinkRelevance(b);
            return bScore - aScore;
        });

        // Prioritize images by size and alt text presence
        const prioritizedImages = [...content.images].sort((a, b) => {
            const aScore = this.calculateImageRelevance(a);
            const bScore = this.calculateImageRelevance(b);
            return bScore - aScore;
        });

        return {
            ...content,
            headings: prioritizedHeadings.slice(0, 20), // Limit to top 20
            links: prioritizedLinks.slice(0, 50), // Limit to top 50
            images: prioritizedImages.slice(0, 20) // Limit to top 20
        };
    }

    /**
     * Extract key topics from content using simple keyword analysis
     */
    extractKeyTopics(content: ContentSnapshot, maxTopics: number = 10): string[] {
        const text = [
            content.text,
            ...content.headings.map(h => h.text),
            ...content.links.map(l => l.text),
            content.metadata.title || '',
            content.metadata.description || ''
        ].join(' ').toLowerCase();

        // Simple word frequency analysis
        const words = text.match(/\b\w{3,}\b/g) || [];
        const wordFreq = new Map<string, number>();

        words.forEach(word => {
            if (!this.stopWords.has(word)) {
                wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
            }
        });

        // Sort by frequency and return top topics
        return Array.from(wordFreq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxTopics)
            .map(([word]) => word);
    }

    private extractText(element: Element): string {
        // Get visible text content, excluding script and style elements
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;

                    const tagName = parent.tagName.toLowerCase();
                    if (['script', 'style', 'noscript'].includes(tagName)) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    const style = window.getComputedStyle(parent);
                    if (style.display === 'none' || style.visibility === 'hidden') {
                        return NodeFilter.FILTER_REJECT;
                    }

                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const textNodes: string[] = [];
        let node;
        while (node = walker.nextNode()) {
            const text = node.textContent?.trim();
            if (text && text.length > 0) {
                textNodes.push(text);
            }
        }

        return textNodes.join(' ').replace(/\s+/g, ' ').trim();
    }

    private extractHeadings(element: Element): Heading[] {
        const headings: Heading[] = [];
        const headingElements = element.querySelectorAll('h1, h2, h3, h4, h5, h6');

        headingElements.forEach(heading => {
            const level = parseInt(heading.tagName.charAt(1));
            const text = heading.textContent?.trim() || '';

            if (text) {
                headings.push({
                    level,
                    text,
                    id: heading.id || undefined,
                    element: this.getElementInfo(heading)
                });
            }
        });

        return headings;
    }

    private extractLinks(element: Element): Link[] {
        const links: Link[] = [];
        const linkElements = element.querySelectorAll('a[href]');

        linkElements.forEach(link => {
            const href = link.getAttribute('href');
            const text = link.textContent?.trim() || '';
            const title = link.getAttribute('title') || undefined;

            if (href && text) {
                links.push({
                    href,
                    text,
                    title,
                    element: this.getElementInfo(link)
                });
            }
        });

        return links;
    }

    private extractImages(element: Element): Image[] {
        const images: Image[] = [];
        const imageElements = element.querySelectorAll('img[src]');

        imageElements.forEach(img => {
            const src = img.getAttribute('src');
            const alt = img.getAttribute('alt') || undefined;
            const title = img.getAttribute('title') || undefined;

            let dimensions: { width: number; height: number } | undefined;
            if (img instanceof HTMLImageElement) {
                if (img.naturalWidth && img.naturalHeight) {
                    dimensions = {
                        width: img.naturalWidth,
                        height: img.naturalHeight
                    };
                }
            }

            if (src) {
                images.push({
                    src,
                    alt,
                    title,
                    dimensions,
                    element: this.getElementInfo(img)
                });
            }
        });

        return images;
    }

    private extractForms(element: Element): Form[] {
        const forms: Form[] = [];
        const formElements = element.querySelectorAll('form');

        formElements.forEach(form => {
            const action = form.getAttribute('action') || undefined;
            const method = form.getAttribute('method') || undefined;
            const fields = this.extractFormFields(form);

            forms.push({
                action,
                method,
                fields,
                element: this.getElementInfo(form)
            });
        });

        return forms;
    }

    private extractFormFields(form: Element): FormField[] {
        const fields: FormField[] = [];
        const fieldElements = form.querySelectorAll('input, select, textarea');

        fieldElements.forEach(field => {
            const name = field.getAttribute('name') || '';
            const type = field.getAttribute('type') || field.tagName.toLowerCase();
            const placeholder = field.getAttribute('placeholder') || undefined;
            const required = field.hasAttribute('required');

            // Don't capture actual values for privacy
            let value: string | undefined;
            if (field instanceof HTMLInputElement &&
                ['checkbox', 'radio'].includes(field.type)) {
                value = field.checked ? 'checked' : 'unchecked';
            }

            if (name) {
                fields.push({
                    name,
                    type,
                    value,
                    placeholder,
                    required
                });
            }
        });

        return fields;
    }

    private extractTables(element: Element): Table[] {
        const tables: Table[] = [];
        const tableElements = element.querySelectorAll('table');

        tableElements.forEach(table => {
            const headers = this.extractTableHeaders(table);
            const rows = this.extractTableRows(table);
            const caption = table.querySelector('caption')?.textContent?.trim() || undefined;

            if (headers.length > 0 || rows.length > 0) {
                tables.push({
                    headers,
                    rows,
                    caption,
                    element: this.getElementInfo(table)
                });
            }
        });

        return tables;
    }

    private extractTableHeaders(table: Element): string[] {
        const headers: string[] = [];
        const headerElements = table.querySelectorAll('th');

        headerElements.forEach(header => {
            const text = header.textContent?.trim();
            if (text) {
                headers.push(text);
            }
        });

        return headers;
    }

    private extractTableRows(table: Element): string[][] {
        const rows: string[][] = [];
        const rowElements = table.querySelectorAll('tbody tr, tr');

        rowElements.forEach(row => {
            const cells: string[] = [];
            const cellElements = row.querySelectorAll('td, th');

            cellElements.forEach(cell => {
                const text = cell.textContent?.trim() || '';
                cells.push(text);
            });

            if (cells.length > 0) {
                rows.push(cells);
            }
        });

        return rows;
    }

    private extractMetadata(): PageMetadata {
        const getMetaContent = (name: string): string | undefined => {
            const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
            return meta?.getAttribute('content') || undefined;
        };

        return {
            title: document.title || '',
            description: getMetaContent('description'),
            keywords: getMetaContent('keywords')?.split(',').map(k => k.trim()),
            author: getMetaContent('author'),
            canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || undefined,
            language: document.documentElement.lang || undefined
        };
    }

    private calculateRelevanceScore(content: ContentSnapshot): number {
        let score = 0;

        // Title presence and quality
        if (content.metadata.title) {
            score += 20;
            if (content.metadata.title.length > 10 && content.metadata.title.length < 60) {
                score += 10;
            }
        }

        // Description presence
        if (content.metadata.description) {
            score += 15;
        }

        // Heading structure
        const h1Count = content.headings.filter(h => h.level === 1).length;
        if (h1Count === 1) score += 15; // Good: exactly one H1
        else if (h1Count > 1) score += 5; // Okay: multiple H1s

        score += Math.min(content.headings.length * 2, 20); // Up to 20 points for headings

        // Content length
        const wordCount = this.countWords(content.text);
        if (wordCount > 100) score += 10;
        if (wordCount > 500) score += 10;
        if (wordCount > 1000) score += 5;

        // Links and images
        score += Math.min(content.links.length, 10); // Up to 10 points for links
        score += Math.min(content.images.length * 2, 10); // Up to 10 points for images

        // Forms and tables (interactive content)
        score += content.forms.length * 5; // 5 points per form
        score += content.tables.length * 3; // 3 points per table

        return Math.min(score, 100); // Cap at 100
    }

    private calculateLinkRelevance(link: Link): number {
        let score = 0;

        // Internal links are more relevant
        if (!link.href.startsWith('http') || link.href.includes(window.location.hostname)) {
            score += 10;
        }

        // Navigation links
        if (link.element.className?.includes('nav') ||
            link.element.selector?.includes('nav')) {
            score += 5;
        }

        // Links with descriptive text
        if (link.text.length > 5 && link.text.length < 50) {
            score += 5;
        }

        // Links with titles
        if (link.title) {
            score += 3;
        }

        return score;
    }

    private calculateImageRelevance(image: Image): number {
        let score = 0;

        // Images with alt text are more relevant
        if (image.alt && image.alt.length > 0) {
            score += 10;
        }

        // Larger images are typically more important
        if (image.dimensions) {
            const area = image.dimensions.width * image.dimensions.height;
            if (area > 10000) score += 5; // Large images
            if (area > 50000) score += 5; // Very large images
        }

        // Images with titles
        if (image.title) {
            score += 3;
        }

        return score;
    }

    private classifyContentType(content: ContentSnapshot): ContentType {
        const url = window.location.href.toLowerCase();
        const title = content.metadata.title?.toLowerCase() || '';
        const text = content.text.toLowerCase();

        // Check URL and title patterns
        for (const [type, patterns] of this.contentTypePatterns) {
            if (patterns.some(pattern => pattern.test(url) || pattern.test(title))) {
                return type;
            }
        }

        // Check content patterns
        if (content.forms.length > 0) {
            return ContentType.FORM_PAGE;
        }

        if (content.tables.length > 2) {
            return ContentType.DASHBOARD;
        }

        if (content.headings.length > 3 && this.countWords(content.text) > 500) {
            return ContentType.ARTICLE;
        }

        return ContentType.UNKNOWN;
    }

    private calculateReadabilityScore(content: ContentSnapshot): number {
        const text = content.text;
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = text.match(/\b\w+\b/g) || [];
        const syllables = words.reduce((count, word) => count + this.countSyllables(word), 0);

        if (sentences.length === 0 || words.length === 0) {
            return 0;
        }

        // Simplified Flesch Reading Ease formula
        const avgSentenceLength = words.length / sentences.length;
        const avgSyllablesPerWord = syllables / words.length;

        const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);

        return Math.max(0, Math.min(100, score));
    }

    private countWords(text: string): number {
        return (text.match(/\b\w+\b/g) || []).length;
    }

    private countSyllables(word: string): number {
        word = word.toLowerCase();
        if (word.length <= 3) return 1;

        const vowels = word.match(/[aeiouy]+/g);
        let count = vowels ? vowels.length : 1;

        if (word.endsWith('e')) count--;
        if (word.endsWith('le') && word.length > 2) count++;

        return Math.max(1, count);
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
                    selector += '.' + classes.slice(0, 2).join('.');
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
}