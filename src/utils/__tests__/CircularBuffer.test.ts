import { CircularBuffer } from '../CircularBuffer';

describe('CircularBuffer', () => {
    describe('constructor', () => {
        it('should create buffer with specified capacity', () => {
            const buffer = new CircularBuffer<number>(5);
            expect(buffer.getCapacity()).toBe(5);
            expect(buffer.getSize()).toBe(0);
            expect(buffer.isEmpty()).toBe(true);
            expect(buffer.isFull()).toBe(false);
        });

        it('should throw error for invalid capacity', () => {
            expect(() => new CircularBuffer<number>(0)).toThrow('Capacity must be greater than 0');
            expect(() => new CircularBuffer<number>(-1)).toThrow('Capacity must be greater than 0');
        });
    });

    describe('push and basic operations', () => {
        it('should add items and track size correctly', () => {
            const buffer = new CircularBuffer<number>(3);

            buffer.push(1);
            expect(buffer.getSize()).toBe(1);
            expect(buffer.isEmpty()).toBe(false);
            expect(buffer.isFull()).toBe(false);

            buffer.push(2);
            buffer.push(3);
            expect(buffer.getSize()).toBe(3);
            expect(buffer.isFull()).toBe(true);
        });

        it('should overwrite oldest items when full', () => {
            const buffer = new CircularBuffer<number>(3);

            buffer.push(1);
            buffer.push(2);
            buffer.push(3);
            buffer.push(4); // Should overwrite 1

            expect(buffer.getSize()).toBe(3);
            expect(buffer.getAll()).toEqual([2, 3, 4]);
        });
    });

    describe('getAll', () => {
        it('should return empty array for empty buffer', () => {
            const buffer = new CircularBuffer<number>(3);
            expect(buffer.getAll()).toEqual([]);
        });

        it('should return items in chronological order', () => {
            const buffer = new CircularBuffer<number>(5);

            buffer.push(1);
            buffer.push(2);
            buffer.push(3);

            expect(buffer.getAll()).toEqual([1, 2, 3]);
        });

        it('should return items in correct order after overflow', () => {
            const buffer = new CircularBuffer<number>(3);

            buffer.push(1);
            buffer.push(2);
            buffer.push(3);
            buffer.push(4);
            buffer.push(5);

            expect(buffer.getAll()).toEqual([3, 4, 5]);
        });
    });

    describe('getRecent', () => {
        it('should return empty array for empty buffer', () => {
            const buffer = new CircularBuffer<number>(3);
            expect(buffer.getRecent(2)).toEqual([]);
        });

        it('should return recent items in chronological order', () => {
            const buffer = new CircularBuffer<number>(5);

            buffer.push(1);
            buffer.push(2);
            buffer.push(3);
            buffer.push(4);

            expect(buffer.getRecent(2)).toEqual([3, 4]);
            expect(buffer.getRecent(3)).toEqual([2, 3, 4]);
            expect(buffer.getRecent(10)).toEqual([1, 2, 3, 4]); // More than available
        });

        it('should handle recent items after overflow', () => {
            const buffer = new CircularBuffer<number>(3);

            buffer.push(1);
            buffer.push(2);
            buffer.push(3);
            buffer.push(4);
            buffer.push(5);

            expect(buffer.getRecent(2)).toEqual([4, 5]);
            expect(buffer.getRecent(5)).toEqual([3, 4, 5]);
        });
    });

    describe('getInTimeWindow', () => {
        interface TimestampedItem {
            value: number;
            timestamp: Date;
        }

        it('should filter items by time window', () => {
            const buffer = new CircularBuffer<TimestampedItem>(5);
            const baseTime = new Date('2023-01-01T00:00:00Z');

            buffer.push({ value: 1, timestamp: new Date(baseTime.getTime()) });
            buffer.push({ value: 2, timestamp: new Date(baseTime.getTime() + 1000) });
            buffer.push({ value: 3, timestamp: new Date(baseTime.getTime() + 2000) });
            buffer.push({ value: 4, timestamp: new Date(baseTime.getTime() + 3000) });

            const startTime = new Date(baseTime.getTime() + 500);
            const endTime = new Date(baseTime.getTime() + 2500);

            const result = buffer.getInTimeWindow(startTime, endTime);
            expect(result).toHaveLength(2);
            expect(result[0].value).toBe(2);
            expect(result[1].value).toBe(3);
        });

        it('should return empty array for items without timestamp', () => {
            const buffer = new CircularBuffer<number>(3);
            buffer.push(1);
            buffer.push(2);

            const result = buffer.getInTimeWindow(new Date(), new Date());
            expect(result).toEqual([]);
        });
    });

    describe('peek operations', () => {
        it('should peek oldest and newest items', () => {
            const buffer = new CircularBuffer<number>(3);

            expect(buffer.peek()).toBeUndefined();
            expect(buffer.peekLast()).toBeUndefined();

            buffer.push(1);
            expect(buffer.peek()).toBe(1);
            expect(buffer.peekLast()).toBe(1);

            buffer.push(2);
            buffer.push(3);
            expect(buffer.peek()).toBe(1);
            expect(buffer.peekLast()).toBe(3);

            buffer.push(4); // Overwrites 1
            expect(buffer.peek()).toBe(2);
            expect(buffer.peekLast()).toBe(4);
        });
    });

    describe('clear', () => {
        it('should clear all items and reset state', () => {
            const buffer = new CircularBuffer<number>(3);

            buffer.push(1);
            buffer.push(2);
            buffer.push(3);

            buffer.clear();

            expect(buffer.getSize()).toBe(0);
            expect(buffer.isEmpty()).toBe(true);
            expect(buffer.isFull()).toBe(false);
            expect(buffer.getAll()).toEqual([]);
            expect(buffer.peek()).toBeUndefined();
            expect(buffer.peekLast()).toBeUndefined();
        });
    });

    describe('getMemoryStats', () => {
        it('should return correct memory statistics', () => {
            const buffer = new CircularBuffer<number>(4);

            let stats = buffer.getMemoryStats();
            expect(stats).toEqual({
                usedSlots: 0,
                totalSlots: 4,
                utilizationPercent: 0
            });

            buffer.push(1);
            buffer.push(2);

            stats = buffer.getMemoryStats();
            expect(stats).toEqual({
                usedSlots: 2,
                totalSlots: 4,
                utilizationPercent: 50
            });

            buffer.push(3);
            buffer.push(4);

            stats = buffer.getMemoryStats();
            expect(stats).toEqual({
                usedSlots: 4,
                totalSlots: 4,
                utilizationPercent: 100
            });
        });
    });
});