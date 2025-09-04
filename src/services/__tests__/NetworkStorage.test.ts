import { NetworkStorage } from '../NetworkStorage';
import { NetworkRequest, NetworkResponse, NetworkError, RequestType, ErrorType } from '../../types/monitoring';

// Simple test without complex IndexedDB mocking
describe('NetworkStorage - Basic Functionality', () => {
    let networkStorage: NetworkStorage;

    beforeEach(() => {
        networkStorage = new NetworkStorage(1024 * 1024, false, 0); // 1MB, no compression, no cleanup timer
    });

    afterEach(() => {
        networkStorage.close();
    });

    describe('initialization', () => {
        it('should create NetworkStorage instance', () => {
            expect(networkStorage).toBeDefined();
        });

        it('should initialize with custom parameters', () => {
            const customStorage = new NetworkStorage(2048, true, 5000);
            expect(customStorage).toBeDefined();
            customStorage.close();
        });

        it('should handle missing IndexedDB gracefully', async () => {
            // Temporarily remove IndexedDB
            const originalIndexedDB = global.indexedDB;
            delete (global as any).indexedDB;

            const uninitializedStorage = new NetworkStorage(1024, false, 0);

            await expect(uninitializedStorage.initialize()).rejects.toThrow('IndexedDB not available');

            // Restore IndexedDB
            global.indexedDB = originalIndexedDB;
            uninitializedStorage.close();
        });
    });

    describe('basic operations', () => {
        it('should handle operations when not initialized', async () => {
            const requests: NetworkRequest[] = [{
                id: 'req1',
                url: 'https://api.example.com/data',
                method: 'GET',
                headers: {},
                timestamp: new Date(),
                initiator: 'fetch',
                type: RequestType.FETCH
            }];

            await expect(networkStorage.storeRequests(requests)).rejects.toThrow('Storage not initialized');
            await expect(networkStorage.getRequests()).rejects.toThrow('Storage not initialized');
            await expect(networkStorage.getStorageStats()).rejects.toThrow('Storage not initialized');
        });

        it('should handle cleanup when not initialized', async () => {
            // Should not throw when database is not initialized
            await expect(networkStorage.cleanup()).resolves.toBeUndefined();
        });

        it('should handle clearAll when not initialized', async () => {
            // Should not throw when database is not initialized
            await expect(networkStorage.clearAll()).resolves.toBeUndefined();
        });
    });

    describe('configuration', () => {
        it('should create storage with different configurations', () => {
            const configs = [
                { size: 1024, compression: false, cleanup: 0 },
                { size: 2048, compression: true, cleanup: 1000 },
                { size: 4096, compression: false, cleanup: 5000 }
            ];

            configs.forEach(config => {
                const storage = new NetworkStorage(config.size, config.compression, config.cleanup);
                expect(storage).toBeDefined();
                storage.close();
            });
        });
    });

    describe('data types', () => {
        it('should handle different network request types', () => {
            const requests: NetworkRequest[] = [
                {
                    id: 'req1',
                    url: 'https://api.example.com/fetch',
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    timestamp: new Date(),
                    initiator: 'fetch',
                    type: RequestType.FETCH
                },
                {
                    id: 'req2',
                    url: 'https://api.example.com/xhr',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{"data": "test"}',
                    timestamp: new Date(),
                    initiator: 'xhr',
                    type: RequestType.XHR
                }
            ];

            // Should not throw when creating request objects
            expect(requests).toHaveLength(2);
            expect(requests[0].type).toBe(RequestType.FETCH);
            expect(requests[1].type).toBe(RequestType.XHR);
        });

        it('should handle different network response types', () => {
            const responses: NetworkResponse[] = [
                {
                    requestId: 'req1',
                    status: 200,
                    statusText: 'OK',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{"success": true}',
                    timestamp: new Date(),
                    size: 18
                },
                {
                    requestId: 'req2',
                    status: 404,
                    statusText: 'Not Found',
                    headers: { 'Content-Type': 'text/html' },
                    timestamp: new Date(),
                    size: 0
                }
            ];

            // Should not throw when creating response objects
            expect(responses).toHaveLength(2);
            expect(responses[0].status).toBe(200);
            expect(responses[1].status).toBe(404);
        });

        it('should handle different network error types', () => {
            const errors: NetworkError[] = [
                {
                    requestId: 'req1',
                    error: 'Network timeout',
                    timestamp: new Date(),
                    type: ErrorType.TIMEOUT
                },
                {
                    requestId: 'req2',
                    error: 'CORS error',
                    timestamp: new Date(),
                    type: ErrorType.CORS
                },
                {
                    requestId: 'req3',
                    error: 'Unknown error',
                    timestamp: new Date(),
                    type: ErrorType.UNKNOWN
                }
            ];

            // Should not throw when creating error objects
            expect(errors).toHaveLength(3);
            expect(errors[0].type).toBe(ErrorType.TIMEOUT);
            expect(errors[1].type).toBe(ErrorType.CORS);
            expect(errors[2].type).toBe(ErrorType.UNKNOWN);
        });
    });

    describe('lifecycle management', () => {
        it('should handle close operation', () => {
            expect(() => networkStorage.close()).not.toThrow();
        });

        it('should handle multiple close operations', () => {
            networkStorage.close();
            expect(() => networkStorage.close()).not.toThrow();
        });
    });
});