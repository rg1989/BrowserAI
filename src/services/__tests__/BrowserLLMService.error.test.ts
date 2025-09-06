/**
 * Error handling tests for BrowserLLMService
 * Tests MVP-7 requirements: graceful fallback, error messages, retry mechanisms
 */

// Mock @xenova/transformers at the module level
const mockPipeline = jest.fn();
const mockTransformers = {
  pipeline: mockPipeline,
  env: {
    allowRemoteModels: true,
    allowLocalModels: true,
  },
};

jest.mock("@xenova/transformers", () => mockTransformers);

import { BrowserLLMService, BrowserLLMConfig } from "../BrowserLLMService";
import {
  ErrorHandler,
  ErrorCategory,
  ErrorSeverity,
} from "../../utils/ErrorHandler";

// Mock ErrorHandler
jest.mock("../../utils/ErrorHandler");
const mockErrorHandler = {
  handleError: jest.fn(),
  getInstance: jest.fn(),
};
(ErrorHandler.getInstance as jest.Mock).mockReturnValue(mockErrorHandler);

describe("BrowserLLMService Error Handling", () => {
  let service: BrowserLLMService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BrowserLLMService();

    // Mock WebGPU availability
    Object.defineProperty(navigator, "gpu", {
      value: {
        requestAdapter: jest.fn().mockResolvedValue({}),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    // Clean up WebGPU mock
    delete (navigator as any).gpu;
  });

  describe("Model Loading Error Handling", () => {
    it("should handle unknown model gracefully", async () => {
      // Mock pipeline to fail for all models to prevent fallback
      mockPipeline.mockRejectedValue(new Error("Unknown model: unknown-model"));

      await expect(service.loadModel("unknown-model")).rejects.toThrow();

      const lastError = service.getLastError();
      expect(lastError).toBeDefined();
      expect(lastError?.code).toBe("INVALID_MODEL");
      expect(lastError?.category).toBe("model_loading");
      expect(lastError?.recoverable).toBe(false);
    });

    it("should fallback to smaller models when loading fails", async () => {
      // Mock pipeline to fail for larger models but succeed for tinyllama
      mockPipeline
        .mockRejectedValueOnce(new Error("Memory error")) // phi-3-mini fails
        .mockRejectedValueOnce(new Error("Memory error")) // gemma-2b fails
        .mockResolvedValueOnce({ generate: jest.fn() }); // tinyllama succeeds

      await service.loadModel("phi-3-mini");

      // Should have fallen back to tinyllama
      expect(service.getHealthStatus().modelName).toBe("tinyllama");
      expect(mockPipeline).toHaveBeenCalledTimes(3);
    });

    it("should handle WebGPU failures and fallback to WASM", async () => {
      // Mock WebGPU to fail
      (navigator as any).gpu.requestAdapter.mockRejectedValue(
        new Error("WebGPU not supported")
      );

      mockPipeline.mockResolvedValue({ generate: jest.fn() });

      await service.loadModel("tinyllama");

      // Should have called pipeline with wasm device
      expect(mockPipeline).toHaveBeenCalledWith(
        "text-generation",
        expect.any(String),
        expect.objectContaining({ device: "wasm" })
      );
    });

    it("should handle loading timeout", async () => {
      // Mock pipeline to never resolve (timeout scenario)
      mockPipeline.mockImplementation(() => new Promise(() => {}));

      await expect(service.loadModel("tinyllama")).rejects.toThrow("timeout");

      const lastError = service.getLastError();
      expect(lastError?.code).toBe("LOADING_TIMEOUT");
      expect(lastError?.category).toBe("network");
    }, 10000); // Increase timeout for this test

    it("should handle network errors during model download", async () => {
      mockPipeline.mockRejectedValue(new Error("Failed to fetch model"));

      await expect(service.loadModel("tinyllama")).rejects.toThrow();

      const lastError = service.getLastError();
      expect(lastError?.code).toBe("NETWORK_ERROR");
      expect(lastError?.recoverable).toBe(true);
    });

    it("should handle memory errors", async () => {
      mockPipeline.mockRejectedValue(new Error("Out of memory"));

      await expect(service.loadModel("phi-3-mini")).rejects.toThrow();

      const lastError = service.getLastError();
      expect(lastError?.code).toBe("MEMORY_ERROR");
      expect(lastError?.category).toBe("memory");
    });
  });

  describe("Inference Error Handling and Retry", () => {
    beforeEach(async () => {
      // Setup a working model for inference tests
      const mockModel = jest.fn();
      mockPipeline.mockResolvedValue(mockModel);
      await service.loadModel("tinyllama");

      // Reset the mock to control inference behavior
      mockModel.mockClear();
      (service as any).model = mockModel;
    });

    it("should retry failed inference requests", async () => {
      const mockModel = (service as any).model;

      // Fail first two attempts, succeed on third
      mockModel
        .mockRejectedValueOnce(new Error("Inference failed"))
        .mockRejectedValueOnce(new Error("Inference failed"))
        .mockResolvedValueOnce([
          { generated_text: "Human: Test prompt\nAssistant: Test response" },
        ]);

      const response = await service.sendMessage("Test prompt");

      expect(response.message).toBe("Test response");
      expect(mockModel).toHaveBeenCalledTimes(3);
      expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(2); // Two failed attempts
    });

    it("should handle inference timeout", async () => {
      const mockModel = (service as any).model;

      // Mock model to never resolve (timeout scenario)
      mockModel.mockImplementation(() => new Promise(() => {}));

      await expect(service.sendMessage("Test prompt")).rejects.toThrow(
        "timeout"
      );
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    }, 35000); // Increase timeout for this test

    it("should handle empty or invalid responses", async () => {
      const mockModel = (service as any).model;

      // Return empty response first, then valid response
      mockModel
        .mockResolvedValueOnce([
          { generated_text: "Human: Test prompt\nAssistant:" },
        ]) // Empty response
        .mockResolvedValueOnce([
          { generated_text: "Human: Test prompt\nAssistant: Valid response" },
        ]);

      const response = await service.sendMessage("Test prompt");

      expect(response.message).toBe("Valid response");
      expect(mockModel).toHaveBeenCalledTimes(2);
    });

    it("should reload model after memory errors", async () => {
      const mockModel = (service as any).model;
      const unloadSpy = jest.spyOn(service, "unloadModel");
      const loadSpy = jest.spyOn(service, "loadModel");

      // Fail with memory error, then succeed
      mockModel
        .mockRejectedValueOnce(new Error("Out of memory"))
        .mockResolvedValueOnce([
          {
            generated_text: "Human: Test prompt\nAssistant: Recovered response",
          },
        ]);

      const response = await service.sendMessage("Test prompt");

      expect(response.message).toBe("Recovered response");
      expect(unloadSpy).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    });

    it("should fail after max retries", async () => {
      const mockModel = (service as any).model;

      // Always fail
      mockModel.mockRejectedValue(new Error("Persistent error"));

      await expect(service.sendMessage("Test prompt")).rejects.toThrow(
        "failed after 4 attempts"
      );
      expect(mockModel).toHaveBeenCalledTimes(4); // Initial + 3 retries
    }, 10000); // Increase timeout for this test

    it("should use exponential backoff for retries", async () => {
      const mockModel = (service as any).model;
      const originalSetTimeout = global.setTimeout;
      const mockSetTimeout = jest.fn((callback, delay) => {
        callback();
        return 1 as any;
      });
      global.setTimeout = mockSetTimeout;

      // Fail first attempt, succeed on second
      mockModel
        .mockRejectedValueOnce(new Error("Temporary error"))
        .mockResolvedValueOnce([
          { generated_text: "Human: Test prompt\nAssistant: Retry success" },
        ]);

      const response = await service.sendMessage("Test prompt");

      expect(response.message).toBe("Retry success");
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 1000); // First retry delay

      global.setTimeout = originalSetTimeout;
    });
  });

  describe("Service Health and Status", () => {
    it("should report service availability correctly", async () => {
      // Mock the transformers import to succeed
      const available = await service.isServiceAvailable();
      expect(available).toBe(true);
    });

    it("should report service unavailable when transformers import fails", async () => {
      // Create a service that will fail on import
      const failingService = new BrowserLLMService();

      // Mock the _importTransformers method to fail
      jest
        .spyOn(failingService as any, "_importTransformers")
        .mockRejectedValue(new Error("Import failed"));

      const available = await failingService.isServiceAvailable();
      expect(available).toBe(false);
    });

    it("should provide health status information", () => {
      const status = service.getHealthStatus();

      expect(status).toEqual({
        isLoaded: false,
        modelName: "tinyllama",
        hasError: false,
        lastError: null,
        canFallback: true,
      });
    });

    it("should indicate when fallback is not available", async () => {
      // Mock pipeline to fail for all models to create a real error
      mockPipeline.mockRejectedValue(new Error("Unknown model: invalid-model"));

      // Try to load invalid model
      try {
        await service.loadModel("invalid-model");
      } catch (error) {
        // Expected to fail
      }

      const status = service.getHealthStatus();
      expect(status.hasError).toBe(true);
      expect(status.canFallback).toBe(false); // Invalid model errors are not recoverable
    });
  });

  describe("Error Recovery and Cleanup", () => {
    it("should clean up resources on unload", async () => {
      // Setup loaded model
      const mockModel = { dispose: jest.fn() };
      mockPipeline.mockResolvedValue(mockModel);
      await service.loadModel("tinyllama");

      await service.unloadModel();

      expect(mockModel.dispose).toHaveBeenCalled();
      expect(service.getHealthStatus().isLoaded).toBe(false);
    });

    it("should handle disposal errors gracefully", async () => {
      // Setup model with failing dispose
      const mockModel = {
        dispose: jest.fn().mockRejectedValue(new Error("Dispose failed")),
      };
      mockPipeline.mockResolvedValue(mockModel);
      await service.loadModel("tinyllama");

      // Should not throw even if dispose fails
      await expect(service.unloadModel()).resolves.not.toThrow();
    });

    it("should reset error state on successful operation", async () => {
      // Cause an error first
      try {
        await service.loadModel("invalid-model");
      } catch (error) {
        // Expected
      }

      expect(service.getLastError()).toBeDefined();

      // Now succeed
      mockPipeline.mockResolvedValue({ generate: jest.fn() });
      await service.loadModel("tinyllama");

      expect(service.getLastError()).toBeNull();
    });
  });

  describe("Configuration Validation", () => {
    it("should validate configuration successfully", async () => {
      // Mock successful validation
      const isValid = await service.validateConfig();
      expect(isValid).toBe(true);
    });

    it("should fail validation when transformers unavailable", async () => {
      // Create a service that will fail on import
      const failingService = new BrowserLLMService();

      // Mock the _importTransformers method to fail
      jest
        .spyOn(failingService as any, "_importTransformers")
        .mockRejectedValue(new Error("Import failed"));

      const isValid = await failingService.validateConfig();
      expect(isValid).toBe(false);
    });

    it("should fail validation for invalid model", async () => {
      const newService = new BrowserLLMService({ modelName: "invalid-model" });
      const isValid = await newService.validateConfig();
      expect(isValid).toBe(false);
    });
  });
});
