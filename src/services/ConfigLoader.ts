import { WorkflowConfig } from "../types/workflow";
import {
  validateWorkflowConfig,
  createDefaultConfig,
} from "../utils/validation";

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: WorkflowConfig | null = null;

  private constructor() {}

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  public async loadConfig(): Promise<WorkflowConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      // Try to load from extension storage first
      const stored = await this.loadFromStorage();
      if (stored) {
        this.config = stored;
        return this.config;
      }

      // Fall back to default config file
      const defaultConfig = await this.loadDefaultConfig();
      this.config = defaultConfig;

      // Store the default config for future use
      await this.saveToStorage(this.config);

      return this.config;
    } catch (error) {
      console.warn("Failed to load workflow config, using defaults:", error);
      this.config = createDefaultConfig();
      return this.config;
    }
  }

  private async loadFromStorage(): Promise<WorkflowConfig | null> {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        const result = await chrome.storage.local.get(["workflowConfig"]);
        if (
          result.workflowConfig &&
          validateWorkflowConfig(result.workflowConfig)
        ) {
          return result.workflowConfig;
        }
      }
    } catch (error) {
      console.warn("Failed to load config from storage:", error);
    }
    return null;
  }

  private async loadDefaultConfig(): Promise<WorkflowConfig> {
    try {
      // In a real extension, this would load from the bundled config file
      // For now, we'll use the default config
      const defaultConfig = createDefaultConfig();

      if (validateWorkflowConfig(defaultConfig)) {
        return defaultConfig;
      }

      throw new Error("Default config is invalid");
    } catch (error) {
      console.warn("Failed to load default config:", error);
      return createDefaultConfig();
    }
  }

  private async saveToStorage(config: WorkflowConfig): Promise<void> {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.local.set({ workflowConfig: config });
      }
    } catch (error) {
      console.warn("Failed to save config to storage:", error);
    }
  }

  public async updateConfig(newConfig: WorkflowConfig): Promise<void> {
    if (!validateWorkflowConfig(newConfig)) {
      throw new Error("Invalid workflow configuration");
    }

    this.config = newConfig;
    await this.saveToStorage(newConfig);
  }

  public getConfig(): WorkflowConfig | null {
    return this.config;
  }

  public clearCache(): void {
    this.config = null;
  }
}
