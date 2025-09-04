import { WorkflowManager } from "../WorkflowManager";
import { ConfigLoader } from "../ConfigLoader";
import { createDefaultConfig } from "../../utils/validation";

// Mock ConfigLoader
jest.mock("../ConfigLoader");

describe("WorkflowManager", () => {
  let workflowManager: WorkflowManager;
  let mockConfigLoader: jest.Mocked<ConfigLoader>;

  beforeEach(() => {
    workflowManager = WorkflowManager.getInstance();
    mockConfigLoader = {
      loadConfig: jest.fn(),
    } as any;
    (ConfigLoader.getInstance as jest.Mock).mockReturnValue(mockConfigLoader);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize with config", async () => {
    const config = createDefaultConfig();
    mockConfigLoader.loadConfig.mockResolvedValue(config);

    await workflowManager.initialize();

    expect(mockConfigLoader.loadConfig).toHaveBeenCalled();
    expect(workflowManager.isAtInitialState()).toBe(true);
  });

  it("should navigate to workflow", async () => {
    const config = createDefaultConfig();
    mockConfigLoader.loadConfig.mockResolvedValue(config);
    await workflowManager.initialize();

    workflowManager.navigateToWorkflow("ai-ask");

    expect(workflowManager.getCurrentWorkflow()?.id).toBe("ai-ask");
    expect(workflowManager.getBreadcrumbPath()).toBe("AI Ask:");
  });

  it("should navigate with step data", async () => {
    const config = createDefaultConfig();
    mockConfigLoader.loadConfig.mockResolvedValue(config);
    await workflowManager.initialize();

    const stepData = { userId: "123", displayName: "John Doe" };
    workflowManager.navigateToWorkflow("ai-ask", stepData);

    expect(workflowManager.getCurrentStepData()).toEqual(stepData);
    expect(workflowManager.getBreadcrumbPath()).toBe("John Doe:");
  });

  it("should go back to previous step", async () => {
    const config = createDefaultConfig();
    mockConfigLoader.loadConfig.mockResolvedValue(config);
    await workflowManager.initialize();

    // Navigate to a workflow
    workflowManager.navigateToWorkflow("ai-ask");
    expect(workflowManager.getCurrentWorkflow()?.id).toBe("ai-ask");

    // Go back
    const canGoBack = workflowManager.goBack();
    expect(canGoBack).toBe(true);
    expect(workflowManager.isAtInitialState()).toBe(true);
  });

  it("should handle multi-step navigation", async () => {
    const config = createDefaultConfig();
    mockConfigLoader.loadConfig.mockResolvedValue(config);
    await workflowManager.initialize();

    // Navigate through multiple steps
    workflowManager.navigateToWorkflow("search-users");
    workflowManager.navigateToWorkflow("user-details", {
      userId: "123",
      displayName: "John Doe",
    });

    expect(workflowManager.getBreadcrumbPath()).toBe(
      "Search Users > John Doe:"
    );

    // Go back one step
    workflowManager.goBack();
    expect(workflowManager.getCurrentWorkflow()?.id).toBe("search-users");
    expect(workflowManager.getBreadcrumbPath()).toBe("Search Users:");
  });

  it("should return initial workflows when at initial state", async () => {
    const config = createDefaultConfig();
    mockConfigLoader.loadConfig.mockResolvedValue(config);
    await workflowManager.initialize();

    const workflows = workflowManager.getCurrentWorkflows();
    expect(workflows).toHaveLength(3);
    expect(workflows.map((w) => w.id)).toEqual(["ai-ask", "ai-agent", "close"]);
  });

  it("should determine search enabled state", async () => {
    const config = createDefaultConfig();
    mockConfigLoader.loadConfig.mockResolvedValue(config);
    await workflowManager.initialize();

    // Initial state should have search enabled
    expect(workflowManager.isSearchEnabled()).toBe(true);

    // Navigate to chat workflow (search disabled)
    workflowManager.navigateToWorkflow("ai-ask");
    expect(workflowManager.isSearchEnabled()).toBe(false);
  });
});
