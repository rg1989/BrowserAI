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

// Mock scrollIntoView for tests
Element.prototype.scrollIntoView = jest.fn();

// Suppress console.error during tests to focus on actual test failures
const originalError = console.error;
beforeAll(() => {
  console.error = () => { }; // Silence all console.error during tests
});

afterAll(() => {
  console.error = originalError;
});
