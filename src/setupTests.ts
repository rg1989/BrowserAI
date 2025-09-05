import "@testing-library/jest-dom";

// Mock chrome API for tests
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
    },
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
  runtime: {
    openOptionsPage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
} as any;

// Mock URL methods for file operations
global.URL.createObjectURL = jest.fn(() => "mock-url");
global.URL.revokeObjectURL = jest.fn();

// Mock FileReader
global.FileReader = class {
  result: string | ArrayBuffer | null = null;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null =
    null;

  readAsText(file: Blob) {
    setTimeout(() => {
      this.result = '{"test": true}';
      if (this.onload) {
        this.onload({ target: this } as any);
      }
    }, 0);
  }
} as any;

// Mock scrollIntoView for tests
Element.prototype.scrollIntoView = jest.fn();

// Suppress console.error during tests to focus on actual test failures
const originalError = console.error;
beforeAll(() => {
  console.error = () => {}; // Silence all console.error during tests
});

afterAll(() => {
  console.error = originalError;
});
