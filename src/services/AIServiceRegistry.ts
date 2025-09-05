import { AIServiceFactory } from "./AIService";
import { BrowserLLMService } from "./BrowserLLMService";

/**
 * Register all AI services with the factory
 * This is done in a separate file to avoid circular imports
 */
export function registerAIServices(): void {
  // Register the browser LLM service
  AIServiceFactory.register("browser-llm", () => new BrowserLLMService());
}

// Auto-register services when this module is imported
registerAIServices();
