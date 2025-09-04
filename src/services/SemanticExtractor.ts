import {
    SemanticData,
    SchemaOrgData,
    MicrodataItem,
    JsonLdData,
    OpenGraphData,
    TwitterCardData,
    CustomSemanticData
} from '../types/monitoring';

/**
 * Semantic extractor service for extracting structured data from web pages
 * Supports Schema.org, microdata, JSON-LD, OpenGraph, Twitter Cards, and custom semantic data
 */
export class SemanticExtractor {
    private customNamespaces: Map<string, (element: Element) => any>;

    constructor() {
        this.customNamespaces = new Map();
        this.registerDefaultNamespaces();
    }

    /**
     * Extract all semantic data from the current page
     */
    extractSemanticData(): SemanticData {
        return {
            schema: this.extractSchemaOrgData(),
            microdata: this.extractMicrodataItems(),
            jsonLd: this.extractJsonLdData(),
            openGraph: this.extractOpenGraphData(),
            twitter: this.extractTwitterCardData(),
            custom: this.extractCustomSemanticData()
        };
    }

    /**
     * Extract Schema.org structured data from microdata attributes
     */
    extractSchemaOrgData(): SchemaOrgData[] {
        try {
            const schemaItems: SchemaOrgData[] = [];
            const itemScopeElements = document.querySelectorAll('[itemscope]');

            itemScopeElements.forEach(element => {
                const itemType = element.getAttribute('itemtype');
                if (itemType && itemType.includes('schema.org')) {
                    const schemaType = this.extractSchemaType(itemType);
                    const properties = this.extractItemProperties(element);

                    if (schemaType && Object.keys(properties).length > 0) {
                        schemaItems.push({
                            type: schemaType,
                            properties
                        });
                    }
                }
            });

            return schemaItems;
        } catch (error) {
            console.warn('Failed to extract Schema.org data:', error);
            return [];
        }
    }

    /**
     * Extract microdata items (including non-Schema.org)
     */
    extractMicrodataItems(): MicrodataItem[] {
        try {
            const microdataItems: MicrodataItem[] = [];
            const itemScopeElements = document.querySelectorAll('[itemscope]');

            itemScopeElements.forEach(element => {
                const itemType = element.getAttribute('itemtype') || 'Unknown';
                const properties = this.extractItemProperties(element);

                if (Object.keys(properties).length > 0) {
                    microdataItems.push({
                        type: itemType,
                        properties
                    });
                }
            });

            return microdataItems;
        } catch (error) {
            console.warn('Failed to extract microdata items:', error);
            return [];
        }
    }

    /**
     * Extract JSON-LD structured data
     */
    extractJsonLdData(): JsonLdData[] {
        try {
            const jsonLdItems: JsonLdData[] = [];
            const scriptElements = document.querySelectorAll('script[type="application/ld+json"]');

            scriptElements.forEach(script => {
                try {
                    const jsonContent = script.textContent?.trim();
                    if (jsonContent) {
                        const data = JSON.parse(jsonContent);

                        // Handle both single objects and arrays
                        const items = Array.isArray(data) ? data : [data];

                        items.forEach(item => {
                            if (item && typeof item === 'object' && item['@type']) {
                                jsonLdItems.push({
                                    '@context': item['@context'] || 'https://schema.org',
                                    '@type': item['@type'],
                                    ...item
                                });
                            }
                        });
                    }
                } catch (error) {
                    console.warn('Failed to parse JSON-LD data:', error);
                }
            });

            return jsonLdItems;
        } catch (error) {
            console.warn('Failed to extract JSON-LD data:', error);
            return [];
        }
    }

    /**
     * Extract OpenGraph metadata
     */
    extractOpenGraphData(): OpenGraphData {
        try {
            const openGraph: OpenGraphData = {};

            const ogProperties = [
                'og:title',
                'og:description',
                'og:image',
                'og:url',
                'og:type',
                'og:site_name'
            ];

            ogProperties.forEach(property => {
                const element = document.querySelector(`meta[property="${property}"]`);
                const content = element?.getAttribute('content');

                if (content) {
                    const key = property.replace('og:', '') as keyof OpenGraphData;
                    (openGraph as any)[key] = content;
                }
            });

            return openGraph;
        } catch (error) {
            console.warn('Failed to extract OpenGraph data:', error);
            return {};
        }
    }

    /**
     * Extract Twitter Card metadata
     */
    extractTwitterCardData(): TwitterCardData {
        try {
            const twitterCard: TwitterCardData = {};

            const twitterProperties = [
                'twitter:card',
                'twitter:title',
                'twitter:description',
                'twitter:image',
                'twitter:creator'
            ];

            twitterProperties.forEach(property => {
                const element = document.querySelector(`meta[name="${property}"]`);
                const content = element?.getAttribute('content');

                if (content) {
                    const key = property.replace('twitter:', '') as keyof TwitterCardData;
                    (twitterCard as any)[key] = content;
                }
            });

            return twitterCard;
        } catch (error) {
            console.warn('Failed to extract Twitter Card data:', error);
            return {};
        }
    }

    /**
     * Extract custom semantic data based on registered namespaces
     */
    extractCustomSemanticData(): CustomSemanticData[] {
        const customData: CustomSemanticData[] = [];

        this.customNamespaces.forEach((extractor, namespace) => {
            try {
                const elements = document.querySelectorAll(`[data-${namespace}]`);
                if (elements.length > 0) {
                    const data: Record<string, any> = {};

                    elements.forEach(element => {
                        const extractedData = extractor(element);
                        if (extractedData && Object.keys(extractedData).length > 0) {
                            Object.assign(data, extractedData);
                        }
                    });

                    if (Object.keys(data).length > 0) {
                        customData.push({
                            namespace,
                            data
                        });
                    }
                }
            } catch (error) {
                console.warn(`Failed to extract custom semantic data for namespace ${namespace}:`, error);
            }
        });

        return customData;
    }

    /**
     * Register a custom namespace extractor
     */
    registerCustomNamespace(namespace: string, extractor: (element: Element) => any): void {
        this.customNamespaces.set(namespace, extractor);
    }

    /**
     * Extract semantic data for a specific element
     */
    extractElementSemantics(element: Element): Partial<SemanticData> {
        const semantics: Partial<SemanticData> = {};

        // Check for microdata
        if (element.hasAttribute('itemscope')) {
            const itemType = element.getAttribute('itemtype') || 'Unknown';
            const properties = this.extractItemProperties(element);

            if (Object.keys(properties).length > 0) {
                semantics.microdata = [{
                    type: itemType,
                    properties
                }];

                // Also add to schema if it's Schema.org
                if (itemType.includes('schema.org')) {
                    const schemaType = this.extractSchemaType(itemType);
                    if (schemaType) {
                        semantics.schema = [{
                            type: schemaType,
                            properties
                        }];
                    }
                }
            }
        }

        // Check for custom semantic data
        const customData: CustomSemanticData[] = [];
        this.customNamespaces.forEach((extractor, namespace) => {
            if (element.hasAttribute(`data-${namespace}`)) {
                try {
                    const data = extractor(element);
                    if (data && Object.keys(data).length > 0) {
                        customData.push({
                            namespace,
                            data
                        });
                    }
                } catch (error) {
                    console.warn(`Failed to extract custom semantic data for namespace ${namespace}:`, error);
                }
            }
        });

        if (customData.length > 0) {
            semantics.custom = customData;
        }

        return semantics;
    }

    /**
     * Find elements with specific semantic types
     */
    findElementsBySemanticType(type: string): Element[] {
        const elements: Element[] = [];

        // Search in microdata
        const microdataElements = document.querySelectorAll(`[itemtype*="${type}"]`);
        elements.push(...Array.from(microdataElements));

        // Search in JSON-LD (elements that might be referenced)
        const jsonLdData = this.extractJsonLdData();
        jsonLdData.forEach(item => {
            if (item['@type'] === type && item.id) {
                const element = document.getElementById(item.id);
                if (element && !elements.includes(element)) {
                    elements.push(element);
                }
            }
        });

        return elements;
    }

    /**
     * Get semantic context for a specific URL or page section
     */
    getSemanticContext(selector?: string): SemanticData {
        if (selector) {
            const element = document.querySelector(selector);
            if (element) {
                const elementSemantics = this.extractElementSemantics(element);
                return {
                    schema: elementSemantics.schema || [],
                    microdata: elementSemantics.microdata || [],
                    jsonLd: [], // JSON-LD is page-level
                    openGraph: {}, // OpenGraph is page-level
                    twitter: {}, // Twitter Cards are page-level
                    custom: elementSemantics.custom || []
                };
            }
        }

        return this.extractSemanticData();
    }

    private extractItemProperties(element: Element): Record<string, any> {
        const properties: Record<string, any> = {};
        const propElements = element.querySelectorAll('[itemprop]');

        propElements.forEach(propElement => {
            const propName = propElement.getAttribute('itemprop');
            if (!propName) return;

            let propValue: any;

            // Extract value based on element type
            if (propElement.hasAttribute('itemscope')) {
                // Nested item
                propValue = this.extractItemProperties(propElement);
            } else if (propElement.tagName === 'META') {
                propValue = propElement.getAttribute('content');
            } else if (propElement.tagName === 'A' || propElement.tagName === 'LINK') {
                propValue = propElement.getAttribute('href');
            } else if (propElement.tagName === 'IMG' || propElement.tagName === 'AUDIO' || propElement.tagName === 'VIDEO') {
                propValue = propElement.getAttribute('src');
            } else if (propElement.tagName === 'TIME') {
                propValue = propElement.getAttribute('datetime') || propElement.textContent?.trim();
            } else {
                propValue = propElement.textContent?.trim();
            }

            if (propValue !== null && propValue !== undefined && propValue !== '') {
                // Handle multiple properties with the same name
                if (properties[propName]) {
                    if (Array.isArray(properties[propName])) {
                        properties[propName].push(propValue);
                    } else {
                        properties[propName] = [properties[propName], propValue];
                    }
                } else {
                    properties[propName] = propValue;
                }
            }
        });

        return properties;
    }

    private extractSchemaType(itemType: string): string | null {
        const match = itemType.match(/schema\.org\/(.+)$/);
        return match ? match[1] : null;
    }

    private registerDefaultNamespaces(): void {
        // Register common custom semantic namespaces

        // Product data
        this.registerCustomNamespace('product', (element) => {
            const data: Record<string, any> = {};

            const id = element.getAttribute('data-product-id');
            const name = element.getAttribute('data-product-name');
            const price = element.getAttribute('data-product-price');
            const category = element.getAttribute('data-product-category');

            if (id) data.id = id;
            if (name) data.name = name;
            if (price) data.price = price;
            if (category) data.category = category;

            return data;
        });

        // Article data
        this.registerCustomNamespace('article', (element) => {
            const data: Record<string, any> = {};

            const id = element.getAttribute('data-article-id');
            const title = element.getAttribute('data-article-title');
            const author = element.getAttribute('data-article-author');
            const publishDate = element.getAttribute('data-article-published');

            if (id) data.id = id;
            if (title) data.title = title;
            if (author) data.author = author;
            if (publishDate) data.publishDate = publishDate;

            return data;
        });

        // User data
        this.registerCustomNamespace('user', (element) => {
            const data: Record<string, any> = {};

            const id = element.getAttribute('data-user-id');
            const name = element.getAttribute('data-user-name');
            const role = element.getAttribute('data-user-role');

            if (id) data.id = id;
            if (name) data.name = name;
            if (role) data.role = role;

            return data;
        });

        // Event data
        this.registerCustomNamespace('event', (element) => {
            const data: Record<string, any> = {};

            const id = element.getAttribute('data-event-id');
            const name = element.getAttribute('data-event-name');
            const date = element.getAttribute('data-event-date');
            const location = element.getAttribute('data-event-location');

            if (id) data.id = id;
            if (name) data.name = name;
            if (date) data.date = date;
            if (location) data.location = location;

            return data;
        });

        // Spotlight plugin data (for enhanced context)
        this.registerCustomNamespace('spotlight', (element) => {
            const data: Record<string, any> = {};

            const context = element.getAttribute('data-spotlight-context');
            const item = element.getAttribute('data-spotlight-item');
            const field = element.getAttribute('data-spotlight-field');
            const priority = element.getAttribute('data-spotlight-priority');

            if (context) data.context = context;
            if (item) data.item = item;
            if (field) data.field = field;
            if (priority) data.priority = parseInt(priority, 10);

            return data;
        });
    }
}