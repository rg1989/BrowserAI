import { AIService, AIServiceConfig, AIServiceResponse } from "./AIService";
import { ChatMessage } from "../types/workflow";

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
  }

  /**
   * Load the specified model for inference
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

    this.loadingPromise = this._loadModelInternal(targetModel);

    try {
      await this.loadingPromise;
    } finally {
      this.loadingPromise = undefined;
    }
  }

  private async _loadModelInternal(modelName: string): Promise<void> {
    try {
      // Validate model exists
      const modelInfo = BrowserLLMService.MODELS[modelName];
      if (!modelInfo) {
        throw new Error(
          `Unknown model: ${modelName}. Available models: ${Object.keys(
            BrowserLLMService.MODELS
          ).join(", ")}`
        );
      }

      // Check system requirements
      await this._checkSystemRequirements(modelInfo);

      // Import Transformers.js dynamically
      const { pipeline, env } = await this._importTransformers();

      // Configure environment for browser
      env.allowRemoteModels = true;
      env.allowLocalModels = true;

      // Set device preference
      const device =
        this.browserLLMConfig.useWebGPU && (await this._isWebGPUAvailable())
          ? "webgpu"
          : "wasm";

      console.log(`Loading ${modelInfo.name} with device: ${device}`);

      // Load the text generation pipeline
      this.model = await pipeline("text-generation", modelInfo.downloadUrl, {
        device,
        dtype: device === "webgpu" ? "fp16" : "fp32",
      });

      this.browserLLMConfig.modelName = modelName;
      this.isLoaded = true;

      console.log(`Successfully loaded ${modelInfo.name}`);
    } catch (error) {
      this.isLoaded = false;
      this.model = null;
      console.error("Failed to load browser LLM:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load model ${modelName}: ${errorMessage}`);
    }
  }

  /**
   * Unload the current model to free memory
   */
  async unloadModel(): Promise<void> {
    if (this.model) {
      // Dispose of model resources if available
      if (typeof this.model.dispose === "function") {
        await this.model.dispose();
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
    if (!this.isLoaded) {
      await this.loadModel();
    }

    if (!this.model) {
      throw new Error("Browser LLM model not loaded");
    }

    try {
      // Format the prompt with context
      const prompt = this._formatPrompt(message, context);

      // Generate response
      const startTime = Date.now();
      const result = await this.model(prompt, {
        max_new_tokens: this.config.maxTokens || 512,
        temperature: this.config.temperature || 0.7,
        do_sample: true,
        top_p: 0.9,
        repetition_penalty: 1.1,
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Extract the generated text
      let generatedText = "";
      if (Array.isArray(result) && result.length > 0) {
        generatedText = result[0].generated_text || "";
      } else if (result.generated_text) {
        generatedText = result.generated_text;
      }

      // Remove the original prompt from the response
      const response = generatedText.replace(prompt, "").trim();

      console.log(`Browser LLM response generated in ${responseTime}ms`);

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
      console.error("Browser LLM inference error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Browser LLM inference failed: ${errorMessage}`);
    }
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
