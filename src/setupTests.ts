import "@testing-library/jest-dom";

// Mock chrome API for tests
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
} as any;
