import {
  AIService,
  MockAIService,
  AIServiceFactory,
  AIServiceManager,
  AIServiceConfig,
} from "../AIService";
import { ChatMessage } from "../../types/workflow";

describe("AIService", () => {
  describe("MockAIService", () => {
    let mockService: MockAIService;

    beforeEach(() => {
      mockService = new MockAIService();
    });

    describe("sendMessage", () => {
      it("should send message and return response", async () => {
        const message = "What is TypeScript?";
        const response = await mockService.sendMessage(message);

        expect(response.message).toBeTruthy();
        expect(response.message.length).toBeGreaterThan(0);
        expect(response.usage).toBeDefined();
        expect(response.usage?.promptTokens).toBeGreaterThan(0);
        expect(response.usage?.completionTokens).toBeGreaterThan(0);
        expect(response.usage?.totalTokens).toBeGreaterThan(0);
        expect(response.model).toBe("mock-ai-model-v1");
        expect(response.finishReason).toBe("stop");
      });

      it("should generate different responses for ai-ask workflow", async () => {
        const message = "Tell me about JavaScript";
        const response1 = await mockService.sendMessage(message);
        const response2 = await mockService.sendMessage(message);

        // Responses should be different (cycling through templates)
        expect(response1.message).not.toBe(response2.message);
      });

      it("should generate ai-agent responses for agent-like messages", async () => {
        const message = "Help me write a function";
        const response = await mockService.sendMessage(message);

        expect(response.message).toContain("agent");
      });

      it("should include context in response when provided", async () => {
        const context: ChatMessage[] = [
          {
            id: "1",
            content: "Previous message",
            sender: "user",
            timestamp: new Date(),
          },
        ];

        const response = await mockService.sendMessage(
          "Follow up question",
          context
        );
        expect(response.message).toContain("previous conversation");
      });

      it("should calculate token usage based on message length", async () => {
        const shortMessage = "Hi";
        const longMessage =
          "This is a much longer message that should result in more tokens being calculated";

        const shortResponse = await mockService.sendMessage(shortMessage);
        const longResponse = await mockService.sendMessage(longMessage);

        expect(longResponse.usage?.promptTokens).toBeGreaterThan(
          shortResponse.usage?.promptTokens || 0
        );
      });
    });

    describe("sendMessageStream", () => {
      it("should stream message chunks", async () => {
        const message = "Stream this response";
        const chunks: string[] = [];

        const response = await mockService.sendMessageStream(
          message,
          undefined,
          (chunk) => {
            chunks.push(chunk);
          }
        );

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.join("")).toBe(response.message);
      });

      it("should work without chunk callback", async () => {
        const message = "No streaming callback";
        const response = await mockService.sendMessageStream(message);

        expect(response.message).toBeTruthy();
        expect(response.usage).toBeDefined();
      });
    });

    describe("validateConfig", () => {
      it("should always return true for mock service", async () => {
        const isValid = await mockService.validateConfig();
        expect(isValid).toBe(true);
      });
    });

    describe("getServiceInfo", () => {
      it("should return service information", () => {
        const info = mockService.getServiceInfo();

        expect(info.name).toBe("Mock AI Service");
        expect(info.version).toBe("1.0.0");
        expect(info.capabilities).toContain("chat");
        expect(info.capabilities).toContain("streaming");
        expect(info.capabilities).toContain("context-aware");
      });
    });

    describe("configuration", () => {
      it("should use default configuration", () => {
        const config = mockService.getConfig();

        expect(config.temperature).toBe(0.7);
        expect(config.maxTokens).toBe(1000);
        expect(config.timeout).toBe(30000);
      });

      it("should accept custom configuration", () => {
        const customConfig: AIServiceConfig = {
          temperature: 0.5,
          maxTokens: 2000,
          model: "custom-model",
        };

        const customService = new MockAIService(customConfig);
        const config = customService.getConfig();

        expect(config.temperature).toBe(0.5);
        expect(config.maxTokens).toBe(2000);
        expect(config.model).toBe("custom-model");
      });

      it("should update configuration", () => {
        mockService.updateConfig({ temperature: 0.9 });
        const config = mockService.getConfig();

        expect(config.temperature).toBe(0.9);
      });

      it("should not expose API key in getConfig", () => {
        const serviceWithKey = new MockAIService({ apiKey: "secret-key" });
        const config = serviceWithKey.getConfig();

        expect(config).not.toHaveProperty("apiKey");
      });
    });

    describe("response scenarios", () => {
      it("should handle empty response scenario", async () => {
        mockService.setResponseScenario("empty");
        const response = await mockService.sendMessage("Test message");

        expect(response.message).toBe("");
      });

      it("should reset to normal responses", async () => {
        mockService.setResponseScenario("empty");
        mockService.setResponseScenario("normal");

        const response = await mockService.sendMessage("Test message");
        expect(response.message.length).toBeGreaterThan(0);
      });
    });
  });

  describe("AIServiceFactory", () => {
    beforeEach(() => {
      // Clear any custom registered services
      AIServiceFactory["services"].clear();
      AIServiceFactory.register("mock", () => new MockAIService());
    });

    it("should register and create services", () => {
      const customService = new MockAIService();
      AIServiceFactory.register("custom", () => customService);

      const createdService = AIServiceFactory.create("custom");
      expect(createdService).toBeInstanceOf(MockAIService);
    });

    it("should throw error for unknown service", () => {
      expect(() => {
        AIServiceFactory.create("unknown");
      }).toThrow('AI service "unknown" not found');
    });

    it("should list available services", () => {
      AIServiceFactory.register("test-service", () => new MockAIService());
      const services = AIServiceFactory.getAvailableServices();

      expect(services).toContain("mock");
      expect(services).toContain("test-service");
    });

    it("should create default service", () => {
      const defaultService = AIServiceFactory.createDefault();
      expect(defaultService).toBeInstanceOf(MockAIService);
    });

    it("should create default service with config", () => {
      const config: AIServiceConfig = { temperature: 0.8 };
      const defaultService = AIServiceFactory.createDefault(config);

      expect(defaultService).toBeInstanceOf(MockAIService);
      expect(defaultService.getConfig().temperature).toBe(0.8);
    });
  });

  describe("AIServiceManager", () => {
    let manager: AIServiceManager;

    beforeEach(() => {
      // Reset singleton instance
      AIServiceManager["instance"] = undefined as any;
      manager = AIServiceManager.getInstance();
    });

    it("should be a singleton", () => {
      const manager2 = AIServiceManager.getInstance();
      expect(manager).toBe(manager2);
    });

    it("should have default service", () => {
      const currentService = manager.getCurrentService();
      expect(currentService).toBeInstanceOf(MockAIService);
    });

    it("should set service by name", async () => {
      await manager.setService("mock");
      const currentService = manager.getCurrentService();
      expect(currentService).toBeInstanceOf(MockAIService);
    });

    it("should throw error for invalid service", async () => {
      await expect(manager.setService("invalid")).rejects.toThrow();
    });

    it("should send message through current service", async () => {
      const message = "Test message";
      const response = await manager.sendMessage(message);

      expect(response.message).toBeTruthy();
      expect(response.usage).toBeDefined();
    });

    it("should send streaming message through current service", async () => {
      const message = "Stream test";
      const chunks: string[] = [];

      const response = await manager.sendMessageStream(
        message,
        undefined,
        (chunk) => chunks.push(chunk)
      );

      expect(chunks.length).toBeGreaterThan(0);
      expect(response.message).toBeTruthy();
    });

    it("should get service info", () => {
      const info = manager.getServiceInfo();
      expect(info.name).toBe("Mock AI Service");
    });

    it("should list available services", () => {
      const services = manager.getAvailableServices();
      expect(services).toContain("mock");
    });

    it("should handle service validation failure", async () => {
      // Create a mock service that fails validation
      class InvalidService extends MockAIService {
        async validateConfig(): Promise<boolean> {
          return false;
        }
      }

      AIServiceFactory.register("invalid", () => new InvalidService());

      await expect(manager.setService("invalid")).rejects.toThrow(
        'Invalid configuration for AI service "invalid"'
      );
    });

    it("should maintain service instances", async () => {
      await manager.setService("mock");
      const service1 = manager.getCurrentService();

      await manager.setService("mock");
      const service2 = manager.getCurrentService();

      // Should be the same instance since it's cached
      expect(service1).toBe(service2);
    });
  });

  describe("Abstract AIService", () => {
    class TestAIService extends AIService {
      async sendMessage(): Promise<any> {
        return {
          message: "test",
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        };
      }

      async sendMessageStream(): Promise<any> {
        return {
          message: "test",
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        };
      }

      async validateConfig(): Promise<boolean> {
        return true;
      }

      getServiceInfo() {
        return { name: "Test", version: "1.0.0", capabilities: ["test"] };
      }
    }

    it("should initialize with default config", () => {
      const service = new TestAIService();
      const config = service.getConfig();

      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(1000);
      expect(config.timeout).toBe(30000);
    });

    it("should merge custom config with defaults", () => {
      const customConfig: AIServiceConfig = {
        temperature: 0.5,
        apiKey: "test-key",
      };

      const service = new TestAIService(customConfig);
      const config = service.getConfig();

      expect(config.temperature).toBe(0.5);
      expect(config.maxTokens).toBe(1000); // default
      expect(config).not.toHaveProperty("apiKey"); // excluded from getConfig
    });
  });
});
