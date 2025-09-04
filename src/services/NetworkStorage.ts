import { NetworkRequest, NetworkResponse, NetworkError, NetworkActivity } from '../types/monitoring';

/**
 * Network storage service for persisting network monitoring data
 * Uses IndexedDB for persistent storage with compression and cleanup
 */
export class NetworkStorage {
    private dbName: string = 'SpotlightNetworkMonitoring';
    private dbVersion: number = 1;
    private db: IDBDatabase | null = null;
    private maxStorageSize: number;
    private compressionEnabled: boolean;
    private cleanupInterval: number;
    private cleanupTimer: NodeJS.Timeout | null = null;

    constructor(
        maxStorageSize: number = 50 * 1024 * 1024, // 50MB default
        compressionEnabled: boolean = true,
        cleanupInterval: number = 60 * 60 * 1000 // 1 hour default
    ) {
        this.maxStorageSize = maxStorageSize;
        this.compressionEnabled = compressionEnabled;
        this.cleanupInterval = cleanupInterval;
    }

    /**
     * Initialize the storage system
     */
    async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (typeof window === 'undefined' || !window.indexedDB) {
                reject(new Error('IndexedDB not available'));
                return;
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                reject(new Error('Failed to open IndexedDB'));
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.startCleanupTimer();
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                this.createObjectStores(db);
            };
        });
    }

    /**
     * Store network requests
     */
    async storeRequests(requests: NetworkRequest[]): Promise<void> {
        if (!this.db) {
            throw new Error('Storage not initialized');
        }

        const transaction = this.db.transaction(['requests'], 'readwrite');
        const store = transaction.objectStore('requests');

        const promises = requests.map(request => {
            const data = this.compressionEnabled ? this.compressData(request) : request;
            return new Promise<void>((resolve, reject) => {
                const addRequest = store.put(data);
                addRequest.onsuccess = () => resolve();
                addRequest.onerror = () => reject(addRequest.error);
            });
        });

        await Promise.all(promises);
    }

    /**
     * Store network responses
     */
    async storeResponses(responses: NetworkResponse[]): Promise<void> {
        if (!this.db) {
            throw new Error('Storage not initialized');
        }

        const transaction = this.db.transaction(['responses'], 'readwrite');
        const store = transaction.objectStore('responses');

        const promises = responses.map(response => {
            const data = this.compressionEnabled ? this.compressData(response) : response;
            return new Promise<void>((resolve, reject) => {
                const addRequest = store.put(data);
                addRequest.onsuccess = () => resolve();
                addRequest.onerror = () => reject(addRequest.error);
            });
        });

        await Promise.all(promises);
    }

    /**
     * Store network errors
     */
    async storeErrors(errors: NetworkError[]): Promise<void> {
        if (!this.db) {
            throw new Error('Storage not initialized');
        }

        const transaction = this.db.transaction(['errors'], 'readwrite');
        const store = transaction.objectStore('errors');

        const promises = errors.map(error => {
            const data = this.compressionEnabled ? this.compressData(error) : error;
            return new Promise<void>((resolve, reject) => {
                const addRequest = store.put(data);
                addRequest.onsuccess = () => resolve();
                addRequest.onerror = () => reject(addRequest.error);
            });
        });

        await Promise.all(promises);
    }

    /**
     * Get network requests within a time window
     */
    async getRequests(startTime?: Date, endTime?: Date): Promise<NetworkRequest[]> {
        if (!this.db) {
            throw new Error('Storage not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['requests'], 'readonly');
            const store = transaction.objectStore('requests');
            const index = store.index('timestamp');

            let range: IDBKeyRange | undefined;
            if (startTime && endTime) {
                range = IDBKeyRange.bound(startTime, endTime);
            } else if (startTime) {
                range = IDBKeyRange.lowerBound(startTime);
            } else if (endTime) {
                range = IDBKeyRange.upperBound(endTime);
            }

            const request = index.getAll(range);

            request.onsuccess = () => {
                const results = request.result.map(data =>
                    this.compressionEnabled ? this.decompressData(data) : data
                );
                resolve(results);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get network responses within a time window
     */
    async getResponses(startTime?: Date, endTime?: Date): Promise<NetworkResponse[]> {
        if (!this.db) {
            throw new Error('Storage not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['responses'], 'readonly');
            const store = transaction.objectStore('responses');
            const index = store.index('timestamp');

            let range: IDBKeyRange | undefined;
            if (startTime && endTime) {
                range = IDBKeyRange.bound(startTime, endTime);
            } else if (startTime) {
                range = IDBKeyRange.lowerBound(startTime);
            } else if (endTime) {
                range = IDBKeyRange.upperBound(endTime);
            }

            const request = index.getAll(range);

            request.onsuccess = () => {
                const results = request.result.map(data =>
                    this.compressionEnabled ? this.decompressData(data) : data
                );
                resolve(results);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get network errors within a time window
     */
    async getErrors(startTime?: Date, endTime?: Date): Promise<NetworkError[]> {
        if (!this.db) {
            throw new Error('Storage not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['errors'], 'readonly');
            const store = transaction.objectStore('errors');
            const index = store.index('timestamp');

            let range: IDBKeyRange | undefined;
            if (startTime && endTime) {
                range = IDBKeyRange.bound(startTime, endTime);
            } else if (startTime) {
                range = IDBKeyRange.lowerBound(startTime);
            } else if (endTime) {
                range = IDBKeyRange.upperBound(endTime);
            }

            const request = index.getAll(range);

            request.onsuccess = () => {
                const results = request.result.map(data =>
                    this.compressionEnabled ? this.decompressData(data) : data
                );
                resolve(results);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get complete network activity within a time window
     */
    async getNetworkActivity(startTime?: Date, endTime?: Date): Promise<NetworkActivity> {
        const [requests, responses, errors] = await Promise.all([
            this.getRequests(startTime, endTime),
            this.getResponses(startTime, endTime),
            this.getErrors(startTime, endTime)
        ]);

        const actualStartTime = startTime || new Date(0);
        const actualEndTime = endTime || new Date();

        return {
            requests,
            responses,
            errors,
            timeWindow: {
                start: actualStartTime,
                end: actualEndTime,
                duration: actualEndTime.getTime() - actualStartTime.getTime()
            }
        };
    }

    /**
     * Clear old data based on retention policy
     */
    async cleanup(retentionDays: number = 7): Promise<void> {
        if (!this.db) {
            return;
        }

        const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
        const stores = ['requests', 'responses', 'errors'];

        for (const storeName of stores) {
            await this.cleanupStore(storeName, cutoffDate);
        }
    }

    /**
     * Get storage usage statistics
     */
    async getStorageStats(): Promise<{
        totalRequests: number;
        totalResponses: number;
        totalErrors: number;
        estimatedSize: number;
        oldestEntry: Date | null;
        newestEntry: Date | null;
    }> {
        if (!this.db) {
            throw new Error('Storage not initialized');
        }

        const [requestCount, responseCount, errorCount] = await Promise.all([
            this.getStoreCount('requests'),
            this.getStoreCount('responses'),
            this.getStoreCount('errors')
        ]);

        const [oldestEntry, newestEntry] = await Promise.all([
            this.getOldestEntry(),
            this.getNewestEntry()
        ]);

        // Rough estimation of storage size
        const estimatedSize = (requestCount + responseCount + errorCount) * 1024; // 1KB per entry estimate

        return {
            totalRequests: requestCount,
            totalResponses: responseCount,
            totalErrors: errorCount,
            estimatedSize,
            oldestEntry,
            newestEntry
        };
    }

    /**
     * Clear all stored data
     */
    async clearAll(): Promise<void> {
        if (!this.db) {
            return;
        }

        const transaction = this.db.transaction(['requests', 'responses', 'errors'], 'readwrite');

        await Promise.all([
            this.clearStore(transaction.objectStore('requests')),
            this.clearStore(transaction.objectStore('responses')),
            this.clearStore(transaction.objectStore('errors'))
        ]);
    }

    /**
     * Close the database connection
     */
    close(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }

        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    private createObjectStores(db: IDBDatabase): void {
        // Requests store
        if (!db.objectStoreNames.contains('requests')) {
            const requestStore = db.createObjectStore('requests', { keyPath: 'id' });
            requestStore.createIndex('timestamp', 'timestamp');
            requestStore.createIndex('url', 'url');
            requestStore.createIndex('method', 'method');
        }

        // Responses store
        if (!db.objectStoreNames.contains('responses')) {
            const responseStore = db.createObjectStore('responses', { keyPath: 'requestId' });
            responseStore.createIndex('timestamp', 'timestamp');
            responseStore.createIndex('status', 'status');
        }

        // Errors store
        if (!db.objectStoreNames.contains('errors')) {
            const errorStore = db.createObjectStore('errors', { keyPath: 'requestId' });
            errorStore.createIndex('timestamp', 'timestamp');
            errorStore.createIndex('type', 'type');
        }
    }

    private compressData(data: any): any {
        // Simple compression - in a real implementation, you might use a library like pako
        // For now, just return the data as-is
        return data;
    }

    private decompressData(data: any): any {
        // Simple decompression - in a real implementation, you might use a library like pako
        // For now, just return the data as-is
        return data;
    }

    private async cleanupStore(storeName: string, cutoffDate: Date): Promise<void> {
        if (!this.db) {
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const index = store.index('timestamp');
            const range = IDBKeyRange.upperBound(cutoffDate);

            const request = index.openCursor(range);

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    private async getStoreCount(storeName: string): Promise<number> {
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    private async getOldestEntry(): Promise<Date | null> {
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['requests'], 'readonly');
            const store = transaction.objectStore('requests');
            const index = store.index('timestamp');
            const request = index.openCursor();

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    resolve(cursor.value.timestamp);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    private async getNewestEntry(): Promise<Date | null> {
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['requests'], 'readonly');
            const store = transaction.objectStore('requests');
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev');

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    resolve(cursor.value.timestamp);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    private async clearStore(store: IDBObjectStore): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = store.clear();

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    private startCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        // Only start cleanup timer if we have a valid database and cleanup interval
        if (this.db && this.cleanupInterval > 0) {
            this.cleanupTimer = setInterval(() => {
                this.cleanup().catch(error => {
                    console.warn('Network storage cleanup failed:', error);
                });
            }, this.cleanupInterval);
        }
    }
}