import { AIService, AIServiceConfig, AIServiceResponse } from "./AIService";
import { ChatMessage } from "../types/workflow";
import {
  ErrorHandler,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
} from "../utils/ErrorHandler";

export interface BrowserLLMConfig extends AIServiceConfig {
  modelName?: string;
  useWebGPU?: boolean;
  maxMemoryMB?: number;
  offloadLayers?: number;
}

export interface ModelInfo {
  name: string;
  size: string;
  capabilities: string[];
  requirements: {
    memory: number;
    webgpu?: boolean;
    wasm?: boolean;
  };
  downloadUrl?: string;
  localPath?: string;
}

export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
}

export interface BrowserLLMError {
  code: string;
  message: string;
  category: "model_loading" | "inference" | "memory" | "webgpu" | "network";
  recoverable: boolean;
  fallbackAvailable: boolean;
}

/**
 * Browser-based LLM service using Transformers.js for local AI inference
 * Provides offline AI capabilities with WebGPU acceleration when available
 */
export class BrowserLLMService extends AIService {
  private model: any = null;
  private tokenizer: any = null;
  private isLoaded: boolean = false;
  private loadingPromise?: Promise<void>;
  private browserLLMConfig: BrowserLLMConfig;
  private errorHandler: ErrorHandler;
  private loadingRetries: number = 0;
  private maxLoadingRetries: number = 3;
  private lastError: BrowserLLMError | null = null;

  // Available models for browser inference
  private static readonly MODELS: Record<string, ModelInfo> = {
    tinyllama: {
      name: "TinyLlama 1.1B Chat",
      size: "637MB",
      capabilities: ["chat", "basic-reasoning"],
      requirements: {
        memory: 1024, // 1GB
        wasm: true,
      },
      downloadUrl: "Xenova/TinyLlama-1.1B-Chat-v1.0",
    },
    "phi-3-mini": {
      name: "Phi-3 Mini 3.8B",
      size: "2.4GB",
      capabilities: ["chat", "reasoning", "code"],
      requirements: {
        memory: 4096, // 4GB
        webgpu: true,
        wasm: true,
      },
      downloadUrl: "Xenova/Phi-3-mini-4k-instruct",
    },
    "gemma-2b": {
      name: "Gemma 2B Instruct",
      size: "1.6GB",
      capabilities: ["chat", "reasoning"],
      requirements: {
        memory: 2048, // 2GB
        webgpu: true,
        wasm: true,
      },
      downloadUrl: "Xenova/gemma-2b-it",
    },
  };

  constructor(config: BrowserLLMConfig = {}) {
    super(config);
    this.browserLLMConfig = {
      modelName: "tinyllama", // Default to smallest model
      useWebGPU: true,
      maxMemoryMB: 2048,
      offloadLayers: 32,
      ...config,
    };
    this.errorHandler = ErrorHandler.getInstance();
  }

  /**
   * Load the specified model for inference with error handling and fallback
   */
  async loadModel(modelName?: string): Promise<void> {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    const targetModel =
      modelName || this.browserLLMConfig.modelName || "tinyllama";

    if (this.isLoaded && this.browserLLMConfig.modelName === targetModel) {
      return; // Already loaded
    }

    this.loadingPromise = this._loadModelWithFallback(targetModel);

    try {
      await this.loadingPromise;
      this.loadingRetries = 0; // Reset retry count on success
      this.lastError = null;
    } finally {
      this.loadingPromise = undefined;
    }
  }

  /**
   * Load model with automatic fallback to smaller models
   */
  private async _loadModelWithFallback(modelName: string): Promise<void> {
    const fallbackChain = this._getFallbackChain(modelName);

    for (const fallbackModel of fallbackChain) {
      try {
        await this._loadModelInternal(fallbackModel);
        if (fallbackModel !== modelName) {
          console.warn(
            `Fallback: Using ${fallbackModel} instead of ${modelName}`
          );
        }
        return;
      } catch (error) {
        const browserError = this._createBrowserLLMError(error, fallbackModel);
        this.lastError = browserError;

        await this.errorHandler.handleError(
          ErrorCategory.CONTEXT,
          ErrorSeverity.HIGH,
          `Failed to load model ${fallbackModel}: ${browserError.message}`,
          "BrowserLLMService",
          error instanceof Error ? error : new Error(String(error)),
          { modelName: fallbackModel, retryCount: this.loadingRetries }
        );

        // If this is the last model in the chain, throw the error
        if (fallbackModel === fallbackChain[fallbackChain.length - 1]) {
          throw new Error(
            `All model loading attempts failed. Last error: ${browserError.message}`
          );
        }
      }
    }
  }

  /**
   * Get fallback chain for model loading
   */
  private _getFallbackChain(modelName: string): string[] {
    const allModels = Object.keys(BrowserLLMService.MODELS);
    const sortedBySize = allModels.sort((a, b) => {
      const sizeA = this._getModelSizeInMB(a);
      const sizeB = this._getModelSizeInMB(b);
      return sizeA - sizeB;
    });

    // Start with requested model, then fallback to smaller models
    const chain = [modelName];
    const requestedIndex = sortedBySize.indexOf(modelName);

    if (requestedIndex > 0) {
      // Add smaller models as fallbacks
      for (let i = requestedIndex - 1; i >= 0; i--) {
        chain.push(sortedBySize[i]);
      }
    }

    // Ensure tinyllama is always the final fallback
    if (!chain.includes("tinyllama")) {
      chain.push("tinyllama");
    }

    return chain;
  }

  /**
   * Get model size in MB for sorting
   */
  private _getModelSizeInMB(modelName: string): number {
    const modelInfo = BrowserLLMService.MODELS[modelName];
    if (!modelInfo) return 0;

    const sizeStr = modelInfo.size.toLowerCase();
    if (sizeStr.includes("gb")) {
      return parseFloat(sizeStr) * 1024;
    } else if (sizeStr.includes("mb")) {
      return parseFloat(sizeStr);
    }
    return 0;
  }

  private async _loadModelInternal(modelName: string): Promise<void> {
    try {
      // Validate model exists
      const modelInfo = BrowserLLMService.MODELS[modelName];
      if (!modelInfo) {
        throw this._createBrowserLLMError(
          new Error(`Unknown model: ${modelName}`),
          modelName,
          "model_loading"
        );
      }

      // Check system requirements
      await this._checkSystemRequirements(modelInfo);

      // Import Transformers.js dynamically
      const { pipeline, env } = await this._importTransformers();

      // Configure environment for browser
      env.allowRemoteModels = true;
      env.allowLocalModels = true;

      // Set device preference with fallback
      let device = "wasm"; // Default fallback
      if (this.browserLLMConfig.useWebGPU) {
        try {
          const webgpuAvailable = await this._isWebGPUAvailable();
          if (webgpuAvailable) {
            device = "webgpu";
          } else {
            console.warn("WebGPU not available, falling back to WebAssembly");
          }
        } catch (webgpuError) {
          console.warn(
            "WebGPU check failed, falling back to WebAssembly:",
            webgpuError
          );
        }
      }

      console.log(`Loading ${modelInfo.name} with device: ${device}`);

      // Load the text generation pipeline with timeout
      const loadingTimeout = process.env.NODE_ENV === "test" ? 1000 : 60000; // 1 second for tests, 60 seconds for production
      this.model = await Promise.race([
        pipeline("text-generation", modelInfo.downloadUrl, {
          device,
          dtype: device === "webgpu" ? "fp16" : "fp32",
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), loadingTimeout)
        ),
      ]);

      this.browserLLMConfig.modelName = modelName;
      this.isLoaded = true;

      console.log(`Successfully loaded ${modelInfo.name}`);
    } catch (error) {
      this.isLoaded = false;
      this.model = null;

      // Create structured error
      const browserError = this._createBrowserLLMError(error, modelName);
      console.error("Failed to load browser LLM:", browserError);

      throw new Error(browserError.message);
    }
  }

  /**
   * Create structured BrowserLLM error
   */
  private _createBrowserLLMError(
    error: any,
    modelName: string,
    category: BrowserLLMError["category"] = "model_loading"
  ): BrowserLLMError {
    const errorMessage = error instanceof Error ? error.message : String(error);

    let errorCode = "UNKNOWN_ERROR";
    let recoverable = true;
    let fallbackAvailable = true;

    // Categorize errors based on message content
    const lowerMessage = errorMessage.toLowerCase();
    if (lowerMessage.includes("webgpu")) {
      category = "webgpu";
      errorCode = "WEBGPU_ERROR";
      recoverable = true; // Can fallback to WASM
    } else if (
      lowerMessage.includes("memory") ||
      lowerMessage.includes("out of memory")
    ) {
      category = "memory";
      errorCode = "MEMORY_ERROR";
      recoverable = modelName !== "tinyllama"; // Can fallback to smaller model
    } else if (
      lowerMessage.includes("network") ||
      lowerMessage.includes("fetch") ||
      lowerMessage.includes("failed to fetch")
    ) {
      category = "network";
      errorCode = "NETWORK_ERROR";
      recoverable = true;
    } else if (lowerMessage.includes("timeout")) {
      category = "network";
      errorCode = "LOADING_TIMEOUT";
      recoverable = true;
    } else if (
      errorMessage.includes("Unknown model") ||
      lowerMessage.includes("unknown model")
    ) {
      category = "model_loading";
      errorCode = "INVALID_MODEL";
      recoverable = false;
      fallbackAvailable = false;
    }

    return {
      code: errorCode,
      message: errorMessage,
      category,
      recoverable,
      fallbackAvailable,
    };
  }

  /**
   * Unload the current model to free memory
   */
  async unloadModel(): Promise<void> {
    if (this.model) {
      // Dispose of model resources if available
      if (typeof this.model.dispose === "function") {
        try {
          await this.model.dispose();
        } catch (error) {
          console.warn("Failed to dispose model resources:", error);
          // Continue with cleanup even if dispose fails
        }
      }
      this.model = null;
      this.tokenizer = null;
      this.isLoaded = false;

      // Force garbage collection if available
      if ((window as any).gc) {
        (window as any).gc();
      }

      console.log("Browser LLM model unloaded");
    }
  }

  async sendMessage(
    message: string,
    context?: ChatMessage[]
  ): Promise<AIServiceResponse> {
    return this._sendMessageWithRetry(message, context, 3);
  }

  /**
   * Send message with retry logic
   */
  private async _sendMessageWithRetry(
    message: string,
    context?: ChatMessage[],
    maxRetries: number = 3
  ): Promise<AIServiceResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Ensure model is loaded
        if (!this.isLoaded) {
          await this.loadModel();
        }

        if (!this.model) {
          throw new Error("Browser LLM model not loaded after loading attempt");
        }

        // Format the prompt with context
        const prompt = this._formatPrompt(message, context);

        // Generate response with timeout
        const startTime = Date.now();
        const inferenceTimeout = process.env.NODE_ENV === "test" ? 1000 : 30000; // 1 second for tests, 30 seconds for production

        const result = await Promise.race([
          this.model(prompt, {
            max_new_tokens: this.config.maxTokens || 512,
            temperature: this.config.temperature || 0.7,
            do_sample: true,
            top_p: 0.9,
            repetition_penalty: 1.1,
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Inference timeout")),
              inferenceTimeout
            )
          ),
        ]);

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // Extract the generated text
        let generatedText = "";
        if (Array.isArray(result) && result.length > 0) {
          generatedText = result[0].generated_text || "";
        } else if (result.generated_text) {
          generatedText = result.generated_text;
        }

        // Parse response by finding content after "Assistant:" marker
        let response = "";
        const assistantIndex = generatedText.indexOf("Assistant:");
        if (assistantIndex !== -1) {
          response = generatedText.substring(assistantIndex + 10).trim();
        } else {
          // Fallback: remove the original prompt from the response
          response = generatedText.replace(prompt, "").trim();
        }

        // Validate response quality
        if (!response || response.length < 10) {
          throw new Error("Generated response too short or empty");
        }

        console.log(
          `Browser LLM response generated in ${responseTime}ms (attempt ${
            attempt + 1
          })`
        );

        return {
          message: response,
          usage: {
            promptTokens: Math.floor(prompt.length / 4), // Rough token estimation
            completionTokens: Math.floor(response.length / 4),
            totalTokens: Math.floor((prompt.length + response.length) / 4),
          },
          model: this.browserLLMConfig.modelName || "browser-llm",
          finishReason: "stop",
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const browserError = this._createBrowserLLMError(
          error,
          this.browserLLMConfig.modelName || "unknown",
          "inference"
        );

        await this.errorHandler.handleError(
          ErrorCategory.CONTEXT,
          attempt === maxRetries ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
          `Browser LLM inference failed (attempt ${attempt + 1}/${
            maxRetries + 1
          }): ${browserError.message}`,
          "BrowserLLMService",
          lastError,
          { attempt, maxRetries, message: message.substring(0, 100) }
        );

        // If this is the last attempt, don't retry
        if (attempt === maxRetries) {
          break;
        }

        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));

        // For certain errors, try to reload the model
        if (
          browserError.category === "memory" ||
          browserError.category === "inference"
        ) {
          try {
            console.log("Attempting to reload model after inference error...");
            await this.unloadModel();
            await this.loadModel();
          } catch (reloadError) {
            console.warn("Failed to reload model:", reloadError);
          }
        }
      }
    }

    // All retries failed
    throw new Error(
      `Browser LLM inference failed after ${
        maxRetries + 1
      } attempts. Last error: ${lastError?.message}`
    );
  }

  async sendMessageStream(
    message: string,
    context?: ChatMessage[],
    onChunk?: (chunk: string) => void
  ): Promise<AIServiceResponse> {
    // For now, simulate streaming by getting full response and chunking it
    // TODO: Implement true streaming when Transformers.js supports it
    const fullResponse = await this.sendMessage(message, context);

    if (onChunk && fullResponse.message) {
      // Simulate streaming by sending word chunks
      const words = fullResponse.message.split(" ");
      for (let i = 0; i < words.length; i++) {
        await new Promise((resolve) =>
          setTimeout(resolve, 50 + Math.random() * 100)
        );
        const chunk = i === 0 ? words[i] : " " + words[i];
        onChunk(chunk);
      }
    }

    return fullResponse;
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Check if Transformers.js can be imported
      await this._importTransformers();

      // Check if the specified model exists
      const modelName = this.browserLLMConfig.modelName || "tinyllama";
      const modelInfo = BrowserLLMService.MODELS[modelName];

      if (!modelInfo) {
        return false;
      }

      // Check system requirements
      await this._checkSystemRequirements(modelInfo);

      return true;
    } catch (error) {
      console.error("Browser LLM config validation failed:", error);
      return false;
    }
  }

  getServiceInfo() {
    const modelName = this.browserLLMConfig.modelName || "tinyllama";
    const modelInfo = BrowserLLMService.MODELS[modelName];

    return {
      name: "Browser LLM Service",
      version: "1.0.0",
      capabilities: [
        "chat",
        "offline",
        "privacy-preserving",
        ...(modelInfo?.capabilities || []),
      ],
    };
  }

  /**
   * Get information about the current model
   */
  getModelInfo(): ModelInfo | null {
    const modelName = this.browserLLMConfig.modelName;
    return modelName ? BrowserLLMService.MODELS[modelName] : null;
  }

  /**
   * Get current memory usage (estimated)
   */
  getMemoryUsage(): MemoryUsage {
    // This is a rough estimation - actual implementation would need more sophisticated tracking
    const modelInfo = this.getModelInfo();
    const estimatedUsage =
      this.isLoaded && modelInfo ? modelInfo.requirements.memory : 0;

    return {
      used: estimatedUsage,
      total: this.browserLLMConfig.maxMemoryMB || 2048,
      percentage:
        (estimatedUsage / (this.browserLLMConfig.maxMemoryMB || 2048)) * 100,
    };
  }

  /**
   * Get available models
   */
  static getAvailableModels(): ModelInfo[] {
    return Object.values(BrowserLLMService.MODELS);
  }

  /**
   * Check if the service is available and working
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      // Quick validation without loading model
      await this._importTransformers();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get last error information
   */
  getLastError(): BrowserLLMError | null {
    return this.lastError;
  }

  /**
   * Check if service can be used as fallback
   */
  canFallback(): boolean {
    return this.lastError?.fallbackAvailable !== false;
  }

  /**
   * Get service health status
   */
  getHealthStatus(): {
    isLoaded: boolean;
    modelName: string | undefined;
    hasError: boolean;
    lastError: BrowserLLMError | null;
    canFallback: boolean;
  } {
    return {
      isLoaded: this.isLoaded,
      modelName: this.browserLLMConfig.modelName,
      hasError: this.lastError !== null,
      lastError: this.lastError,
      canFallback: this.canFallback(),
    };
  }

  /**
   * Check if the browser supports the required features
   */
  private async _checkSystemRequirements(modelInfo: ModelInfo): Promise<void> {
    // Check memory requirements (rough estimation)
    const deviceMemory = (navigator as any).deviceMemory;
    if (deviceMemory && deviceMemory * 1024 < modelInfo.requirements.memory) {
      console.warn(
        `System may not have enough memory for ${modelInfo.name}. Required: ${
          modelInfo.requirements.memory
        }MB, Available: ~${deviceMemory * 1024}MB`
      );
    }

    // Check WebGPU if required
    if (modelInfo.requirements.webgpu && this.browserLLMConfig.useWebGPU) {
      const webgpuAvailable = await this._isWebGPUAvailable();
      if (!webgpuAvailable) {
        console.warn(
          `WebGPU not available, falling back to WebAssembly for ${modelInfo.name}`
        );
        this.browserLLMConfig.useWebGPU = false;
      }
    }

    // Check WebAssembly
    if (modelInfo.requirements.wasm && typeof WebAssembly === "undefined") {
      throw new Error("WebAssembly not supported in this browser");
    }
  }

  /**
   * Check if WebGPU is available
   */
  private async _isWebGPUAvailable(): Promise<boolean> {
    const nav = navigator as any;
    if (!nav.gpu) {
      return false;
    }

    try {
      const adapter = await nav.gpu.requestAdapter();
      return adapter !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Dynamically import Transformers.js
   */
  private async _importTransformers(): Promise<any> {
    try {
      // Dynamic import for Transformers.js
      const transformers = await import("@xenova/transformers");
      return transformers;
    } catch (error) {
      throw new Error(
        "Failed to import Transformers.js. Make sure @xenova/transformers is installed."
      );
    }
  }

  /**
   * Format the prompt with conversation context
   */
  private _formatPrompt(message: string, context?: ChatMessage[]): string {
    let prompt = "";

    // Add system prompt
    prompt +=
      "You are a helpful AI assistant. Provide clear, concise, and accurate responses.\n\n";

    // Add conversation context
    if (context && context.length > 0) {
      // Only include recent context to stay within token limits
      const recentContext = context.slice(-5); // Last 5 messages

      for (const msg of recentContext) {
        const role = msg.sender === "user" ? "Human" : "Assistant";
        prompt += `${role}: ${msg.content}\n`;
      }
    }

    // Add current message
    prompt += `Human: ${message}\nAssistant:`;

    return prompt;
  }
}
