/**
 * Efficient circular buffer implementation for storing monitoring data
 * with fixed size and automatic overflow handling
 */
export class CircularBuffer<T> {
    private buffer: (T | undefined)[];
    private head: number = 0;
    private tail: number = 0;
    private size: number = 0;
    private readonly capacity: number;

    constructor(capacity: number) {
        if (capacity <= 0) {
            throw new Error('Capacity must be greater than 0');
        }
        this.capacity = capacity;
        this.buffer = new Array(capacity);
    }

    /**
     * Add an item to the buffer
     * If buffer is full, overwrites the oldest item
     */
    push(item: T): void {
        this.buffer[this.tail] = item;

        if (this.size < this.capacity) {
            this.size++;
        } else {
            // Buffer is full, move head forward
            this.head = (this.head + 1) % this.capacity;
        }

        this.tail = (this.tail + 1) % this.capacity;
    }

    /**
     * Get all items in chronological order (oldest first)
     */
    getAll(): T[] {
        if (this.size === 0) {
            return [];
        }

        const result: T[] = [];
        let current = this.head;

        for (let i = 0; i < this.size; i++) {
            const item = this.buffer[current];
            if (item !== undefined) {
                result.push(item);
            }
            current = (current + 1) % this.capacity;
        }

        return result;
    }

    /**
     * Get the most recent N items
     */
    getRecent(count: number): T[] {
        if (count <= 0 || this.size === 0) {
            return [];
        }

        const actualCount = Math.min(count, this.size);
        const result: T[] = [];

        // Start from the most recent item and work backwards
        let current = (this.tail - 1 + this.capacity) % this.capacity;

        for (let i = 0; i < actualCount; i++) {
            const item = this.buffer[current];
            if (item !== undefined) {
                result.unshift(item); // Add to front to maintain chronological order
            }
            current = (current - 1 + this.capacity) % this.capacity;
        }

        return result;
    }

    /**
     * Get items within a time window (requires items to have timestamp property)
     */
    getInTimeWindow(startTime: Date, endTime: Date): T[] {
        return this.getAll().filter(item => {
            const timestamp = (item as any).timestamp;
            if (!(timestamp instanceof Date)) {
                return false;
            }
            return timestamp >= startTime && timestamp <= endTime;
        });
    }

    /**
     * Clear all items from the buffer
     */
    clear(): void {
        this.buffer.fill(undefined);
        this.head = 0;
        this.tail = 0;
        this.size = 0;
    }

    /**
     * Get the current number of items in the buffer
     */
    getSize(): number {
        return this.size;
    }

    /**
     * Get the maximum capacity of the buffer
     */
    getCapacity(): number {
        return this.capacity;
    }

    /**
     * Check if the buffer is empty
     */
    isEmpty(): boolean {
        return this.size === 0;
    }

    /**
     * Check if the buffer is full
     */
    isFull(): boolean {
        return this.size === this.capacity;
    }

    /**
     * Get the oldest item without removing it
     */
    peek(): T | undefined {
        if (this.size === 0) {
            return undefined;
        }
        return this.buffer[this.head];
    }

    /**
     * Get the most recent item without removing it
     */
    peekLast(): T | undefined {
        if (this.size === 0) {
            return undefined;
        }
        const lastIndex = (this.tail - 1 + this.capacity) % this.capacity;
        return this.buffer[lastIndex];
    }

    /**
     * Get memory usage statistics
     */
    getMemoryStats(): { usedSlots: number; totalSlots: number; utilizationPercent: number } {
        return {
            usedSlots: this.size,
            totalSlots: this.capacity,
            utilizationPercent: (this.size / this.capacity) * 100
        };
    }
}