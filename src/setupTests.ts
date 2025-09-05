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

// Mock DOM APIs for browser extension tests
global.MutationObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn(() => [])
}));

global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn()
}));

global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn()
}));

// Also mock on window object for DOMObserver
Object.defineProperty(window, 'MutationObserver', {
  writable: true,
  value: global.MutationObserver
});

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: global.IntersectionObserver
});

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: global.ResizeObserver
});

// Mock Response for fetch tests
global.Response = class Response {
  ok: boolean;
  status: number;
  statusText: string;
  body: any;

  constructor(body?: any, init?: ResponseInit) {
    this.body = body;
    this.status = init?.status || 200;
    this.statusText = init?.statusText || 'OK';
    this.ok = this.status >= 200 && this.status < 300;
  }

  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }

  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }
} as any;

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve(new Response('test response', { status: 200 }))
);

// Mock XMLHttpRequest
global.XMLHttpRequest = class XMLHttpRequest {
  static DONE = 4;
  readyState = 0;
  status = 200;
  statusText = 'OK';
  responseText = 'test response';
  onreadystatechange: (() => void) | null = null;

  open() { }
  send() {
    setTimeout(() => {
      this.readyState = XMLHttpRequest.DONE;
      if (this.onreadystatechange) {
        this.onreadystatechange();
      }
    }, 0);
  }
} as any;

// Mock performance API
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000
    }
  }
});

// Suppress console.error during tests to focus on actual test failures
const originalError = console.error;
beforeAll(() => {
  console.error = () => { }; // Silence all console.error during tests
});

afterAll(() => {
  console.error = originalError;
});
