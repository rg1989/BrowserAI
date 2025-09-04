import { WorkflowActions, WorkflowCallbacks } from "../WorkflowActions";
import { Workflow, ChatMessage } from "../../types/workflow";

// Mock WorkflowManager
jest.mock("../WorkflowManager", () => ({
  WorkflowManager: {
    getInstance: jest.fn(() => ({
      // Mock methods if needed
    })),
  },
}));

// Mock AIServiceManager
const mockAIServiceManagerInstance = {
  sendMessage: jest.fn(),
  sendMessageStream: jest.fn(),
  getServiceInfo: jest.fn(),
  getAvailableServices: jest.fn(),
  setService: jest.fn(),
};

jest.mock("../AIService", () => ({
  AIServiceManager: {
    getInstance: jest.fn(() => mockAIServiceManagerInstance),
  },
}));

describe("WorkflowActions", () => {
  let workflowActions: WorkflowActions;
  let mockCallbacks: WorkflowCallbacks;
  let mockAIServiceManager: any;

  beforeEach(() => {
    // Reset singleton instances
    (WorkflowActions as any).instance = undefined;

    // Setup AI service manager mocks
    mockAIServiceManagerInstance.sendMessage.mockResolvedValue({
      message: "AI response",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });
    mockAIServiceManagerInstance.sendMessageStream.mockResolvedValue({
      message: "AI streaming response",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });
    mockAIServiceManagerInstance.getServiceInfo.mockReturnValue({
      name: "Mock AI Service",
      version: "1.0.0",
      capabilities: ["chat", "streaming"],
    });
    mockAIServiceManagerInstance.getAvailableServices.mockReturnValue(["mock", "openai"]);
    mockAIServiceManagerInstance.setService.mockResolvedValue();

    mockAIServiceManager = mockAIServiceManagerInstance;
    workflowActions = WorkflowActions.getInstance();
    mockCallbacks = {
      onClose: jest.fn(),
      onNavigate: jest.fn(),
      onUpdateSearch: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getInstance", () => {
    it("should return the same instance (singleton)", () => {
      const instance1 = WorkflowActions.getInstance();
      const instance2 = WorkflowActions.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("executeWorkflow", () => {
    it("should execute action workflow", async () => {
      const workflow: Workflow = {
        id: "close",
        name: "Close",
        type: "action",
        component: "ActionComponent",
        action: "close",
      };

      await workflowActions.executeWorkflow(workflow, undefined, mockCallbacks);
      expect(mockCallbacks.onClose).toHaveBeenCalled();
    });

    it("should execute chat workflow", async () => {
      const workflow: Workflow = {
        id: "ai-ask",
        name: "AI Ask",
        type: "chat",
        component: "ChatInterface",
        searchEnabled: false,
      };

      await workflowActions.executeWorkflow(workflow, undefined, mockCallbacks);
      expect(mockCallbacks.onNavigate).toHaveBeenCalledWith(
        "ai-ask",
        undefined
      );
    });

    it("should execute search workflow", async () => {
      const workflow: Workflow = {
        id: "search-users",
        name: "Search Users",
        type: "search",
        component: "SearchInterface",
        searchEnabled: true,
        searchPlaceholder: "Type to search users...",
        nextWorkflow: "user-details",
      };

      await workflowActions.executeWorkflow(workflow, undefined, mockCallbacks);
      expect(mockCallbacks.onUpdateSearch).toHaveBeenCalledWith("");
    });

    it("should execute form workflow", async () => {
      const workflow: Workflow = {
        id: "user-details",
        name: "User Details",
        type: "form",
        component: "FormInterface",
        searchEnabled: false,
      };

      await workflowActions.executeWorkflow(
        workflow,
        { userId: "123" },
        mockCallbacks
      );
      // Form workflows don't trigger immediate callbacks, just setup
      expect(mockCallbacks.onClose).not.toHaveBeenCalled();
      expect(mockCallbacks.onNavigate).not.toHaveBeenCalled();
    });

    it("should execute loader workflow and navigate to next", async () => {
      const workflow: Workflow = {
        id: "loading",
        name: "Loading",
        type: "loader",
        component: "LoaderInterface",
        nextWorkflow: "results",
      };

      await workflowActions.executeWorkflow(
        workflow,
        { data: "test" },
        mockCallbacks
      );
      expect(mockCallbacks.onNavigate).toHaveBeenCalledWith("results", {
        data: "test",
      });
    });

    it("should execute navigation workflow", async () => {
      const workflow: Workflow = {
        id: "nav",
        name: "Navigation",
        type: "navigation",
        component: "NavigationComponent",
        nextWorkflow: "target",
      };

      await workflowActions.executeWorkflow(
        workflow,
        { step: 1 },
        mockCallbacks
      );
      expect(mockCallbacks.onNavigate).toHaveBeenCalledWith("target", {
        step: 1,
      });
    });

    it("should throw error for unknown workflow type", async () => {
      const workflow: Workflow = {
        id: "unknown",
        name: "Unknown",
        type: "unknown" as any,
        component: "UnknownComponent",
      };

      await expect(
        workflowActions.executeWorkflow(workflow, undefined, mockCallbacks)
      ).rejects.toThrow("Unsupported workflow type: unknown");
    });

    it("should throw error for unknown action", async () => {
      const workflow: Workflow = {
        id: "unknown-action",
        name: "Unknown Action",
        type: "action",
        component: "ActionComponent",
        action: "unknown",
      };

      await expect(
        workflowActions.executeWorkflow(workflow, undefined, mockCallbacks)
      ).rejects.toThrow("Unsupported action: unknown");
    });
  });

  describe("handleSearchResult", () => {
    it("should handle search result and navigate to next workflow", async () => {
      const searchWorkflow: Workflow = {
        id: "search-users",
        name: "Search Users",
        type: "search",
        component: "SearchInterface",
        searchEnabled: true,
        nextWorkflow: "user-details",
      };

      const selectedResult = {
        id: "user-123",
        name: "John Doe",
        email: "john@example.com",
      };

      await workflowActions.handleSearchResult(
        searchWorkflow,
        selectedResult,
        mockCallbacks
      );

      expect(mockCallbacks.onNavigate).toHaveBeenCalledWith("user-details", {
        id: "user-123",
        name: "John Doe",
        email: "john@example.com",
        displayName: "John Doe",
        searchResult: selectedResult,
        fromWorkflow: "search-users",
      });
    });

    it("should handle search result without name using fallback", async () => {
      const searchWorkflow: Workflow = {
        id: "search-items",
        name: "Search Items",
        type: "search",
        component: "SearchInterface",
        searchEnabled: true,
        nextWorkflow: "item-details",
      };

      const selectedResult = {
        id: "item-123",
        title: "Test Item",
      };

      await workflowActions.handleSearchResult(
        searchWorkflow,
        selectedResult,
        mockCallbacks
      );

      expect(mockCallbacks.onNavigate).toHaveBeenCalledWith("item-details", {
        id: "item-123",
        title: "Test Item",
        displayName: "Test Item",
        searchResult: selectedResult,
        fromWorkflow: "search-items",
      });
    });

    it("should not navigate if no next workflow is defined", async () => {
      const searchWorkflow: Workflow = {
        id: "search-only",
        name: "Search Only",
        type: "search",
        component: "SearchInterface",
        searchEnabled: true,
      };

      const selectedResult = { id: "test" };

      await workflowActions.handleSearchResult(
        searchWorkflow,
        selectedResult,
        mockCallbacks
      );

      expect(mockCallbacks.onNavigate).not.toHaveBeenCalled();
    });
  });

  describe("handleFormSubmit", () => {
    it("should handle form submit and close overlay", async () => {
      const formWorkflow: Workflow = {
        id: "user-form",
        name: "User Form",
        type: "form",
        component: "FormInterface",
      };

      const formData = {
        name: "John Doe",
        email: "john@example.com",
      };

      await workflowActions.handleFormSubmit(
        formWorkflow,
        formData,
        mockCallbacks
      );
      expect(mockCallbacks.onClose).toHaveBeenCalled();
    });

    it("should handle form submit and navigate to next workflow", async () => {
      const formWorkflow: Workflow = {
        id: "user-form",
        name: "User Form",
        type: "form",
        component: "FormInterface",
        nextWorkflow: "confirmation",
      };

      const formData = {
        name: "John Doe",
        email: "john@example.com",
      };

      await workflowActions.handleFormSubmit(
        formWorkflow,
        formData,
        mockCallbacks
      );

      expect(mockCallbacks.onNavigate).toHaveBeenCalledWith("confirmation", {
        formData,
        fromWorkflow: "user-form",
        displayName: "Form: User Form",
      });
      expect(mockCallbacks.onClose).not.toHaveBeenCalled();
    });
  });

  describe("sendChatMessage", () => {
    it("should send message through AI service", async () => {
      const chatWorkflow: Workflow = {
        id: "ai-ask",
        name: "AI Ask",
        type: "chat",
        component: "ChatInterface",
      };

      const mockResponse = {
        message: "AI response to your question",
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };

      mockAIServiceManager.sendMessage.mockResolvedValue(mockResponse);

      const response = await workflowActions.sendChatMessage(
        chatWorkflow,
        "What is TypeScript?"
      );

      expect(mockAIServiceManager.sendMessage).toHaveBeenCalledWith(
        "What is TypeScript?",
        undefined
      );
      expect(response).toBe("AI response to your question");
    });

    it("should send message with context", async () => {
      const chatWorkflow: Workflow = {
        id: "ai-ask",
        name: "AI Ask",
        type: "chat",
        component: "ChatInterface",
      };

      const context: ChatMessage[] = [
        {
          id: "1",
          content: "Previous message",
          sender: "user",
          timestamp: new Date(),
        },
      ];

      const mockResponse = {
        message: "Contextual AI response",
        usage: { promptTokens: 15, completionTokens: 25, totalTokens: 40 },
      };

      mockAIServiceManager.sendMessage.mockResolvedValue(mockResponse);

      const response = await workflowActions.sendChatMessage(
        chatWorkflow,
        "Follow up question",
        context
      );

      expect(mockAIServiceManager.sendMessage).toHaveBeenCalledWith(
        "Follow up question",
        context
      );
      expect(response).toBe("Contextual AI response");
    });

    it("should handle AI service errors", async () => {
      const chatWorkflow: Workflow = {
        id: "ai-ask",
        name: "AI Ask",
        type: "chat",
        component: "ChatInterface",
      };

      mockAIServiceManager.sendMessage.mockRejectedValue(
        new Error("AI service error")
      );

      await expect(
        workflowActions.sendChatMessage(chatWorkflow, "Test message")
      ).rejects.toThrow("Failed to send message. Please try again.");
    });
  });

  describe("sendChatMessageStream", () => {
    it("should send streaming message through AI service", async () => {
      const chatWorkflow: Workflow = {
        id: "ai-agent",
        name: "AI Agent",
        type: "chat",
        component: "ChatInterface",
      };

      const mockResponse = {
        message: "Streaming AI response",
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };

      mockAIServiceManager.sendMessageStream.mockResolvedValue(mockResponse);

      const chunks: string[] = [];
      const onChunk = (chunk: string) => chunks.push(chunk);

      const response = await workflowActions.sendChatMessageStream(
        chatWorkflow,
        "Stream this message",
        undefined,
        onChunk
      );

      expect(mockAIServiceManager.sendMessageStream).toHaveBeenCalledWith(
        "Stream this message",
        undefined,
        onChunk
      );
      expect(response).toBe("Streaming AI response");
    });

    it("should handle streaming errors", async () => {
      const chatWorkflow: Workflow = {
        id: "ai-agent",
        name: "AI Agent",
        type: "chat",
        component: "ChatInterface",
      };

      mockAIServiceManager.sendMessageStream.mockRejectedValue(
        new Error("Streaming error")
      );

      await expect(
        workflowActions.sendChatMessageStream(chatWorkflow, "Test message")
      ).rejects.toThrow("Failed to send message. Please try again.");
    });
  });

  describe("handleWorkflowTransition", () => {
    it("should handle valid workflow transition", async () => {
      const fromWorkflow: Workflow = {
        id: "step1",
        name: "Step 1",
        type: "search",
        component: "SearchInterface",
        nextWorkflow: "step2",
      };

      const stepData = { userId: "123" };

      await workflowActions.handleWorkflowTransition(
        fromWorkflow,
        "step2",
        stepData,
        mockCallbacks
      );

      expect(mockCallbacks.onNavigate).toHaveBeenCalledWith("step2", {
        userId: "123",
        fromWorkflow: "step1",
        transitionTimestamp: expect.any(String),
      });
    });

    it("should handle transition without callbacks", async () => {
      const fromWorkflow: Workflow = {
        id: "step1",
        name: "Step 1",
        type: "action",
        component: "ActionComponent",
      };

      await expect(
        workflowActions.handleWorkflowTransition(fromWorkflow, "step2")
      ).resolves.not.toThrow();
    });
  });

  describe("getWorkflowCapabilities", () => {
    it("should return correct capabilities for search workflow", () => {
      const workflow: Workflow = {
        id: "search",
        name: "Search",
        type: "search",
        component: "SearchInterface",
        searchEnabled: true,
        nextWorkflow: "details",
      };

      const capabilities = workflowActions.getWorkflowCapabilities(workflow);

      expect(capabilities).toEqual({
        canSearch: true,
        canNavigate: true,
        canSubmit: false,
        canChat: false,
      });
    });

    it("should return correct capabilities for chat workflow", () => {
      const workflow: Workflow = {
        id: "chat",
        name: "Chat",
        type: "chat",
        component: "ChatInterface",
        searchEnabled: false,
      };

      const capabilities = workflowActions.getWorkflowCapabilities(workflow);

      expect(capabilities).toEqual({
        canSearch: false,
        canNavigate: false,
        canSubmit: false,
        canChat: true,
      });
    });

    it("should return correct capabilities for form workflow", () => {
      const workflow: Workflow = {
        id: "form",
        name: "Form",
        type: "form",
        component: "FormInterface",
        searchEnabled: false,
      };

      const capabilities = workflowActions.getWorkflowCapabilities(workflow);

      expect(capabilities).toEqual({
        canSearch: false,
        canNavigate: false,
        canSubmit: true,
        canChat: false,
      });
    });

    it("should return correct capabilities for navigation workflow", () => {
      const workflow: Workflow = {
        id: "nav",
        name: "Navigation",
        type: "navigation",
        component: "NavigationComponent",
      };

      const capabilities = workflowActions.getWorkflowCapabilities(workflow);

      expect(capabilities).toEqual({
        canSearch: false,
        canNavigate: true,
        canSubmit: false,
        canChat: false,
      });
    });
  });

  describe("AI Service Management", () => {
    it("should get AI service info", () => {
      const mockInfo = {
        name: "Mock AI Service",
        version: "1.0.0",
        capabilities: ["chat", "streaming"],
      };

      mockAIServiceManager.getServiceInfo.mockReturnValue(mockInfo);

      const info = workflowActions.getAIServiceInfo();

      expect(mockAIServiceManager.getServiceInfo).toHaveBeenCalled();
      expect(info).toEqual(mockInfo);
    });

    it("should get available AI services", () => {
      const mockServices = ["mock", "openai", "anthropic"];
      mockAIServiceManager.getAvailableServices.mockReturnValue(mockServices);

      const services = workflowActions.getAvailableAIServices();

      expect(mockAIServiceManager.getAvailableServices).toHaveBeenCalled();
      expect(services).toEqual(mockServices);
    });

    it("should set AI service", async () => {
      const serviceName = "openai";
      const config = { apiKey: "test-key" };

      mockAIServiceManager.setService.mockResolvedValue(undefined);

      await workflowActions.setAIService(serviceName, config);

      expect(mockAIServiceManager.setService).toHaveBeenCalledWith(
        serviceName,
        config
      );
    });

    it("should handle AI service setting errors", async () => {
      const serviceName = "invalid";
      mockAIServiceManager.setService.mockRejectedValue(
        new Error("Service not found")
      );

      await expect(workflowActions.setAIService(serviceName)).rejects.toThrow(
        "Service not found"
      );
    });
  });
});
