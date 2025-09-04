import {
  WorkflowConfig,
  Workflow,
  WorkflowPath,
  WorkflowStep,
} from "../types/workflow";
import { ConfigLoader } from "./ConfigLoader";

export class WorkflowManager {
  private static instance: WorkflowManager;
  private config: WorkflowConfig | null = null;
  private currentPath: WorkflowPath = { steps: [], current: "" };

  private constructor() { }

  public static getInstance(): WorkflowManager {
    if (!WorkflowManager.instance) {
      WorkflowManager.instance = new WorkflowManager();
    }
    return WorkflowManager.instance;
  }

  public async initialize(): Promise<void> {
    const configLoader = ConfigLoader.getInstance();
    this.config = await configLoader.loadConfig();
    this.resetToInitial();
  }

  public resetToInitial(): void {
    this.currentPath = { steps: [], current: "initial" };
  }

  public navigateToWorkflow(
    workflowId: string,
    stepData?: Record<string, any>
  ): void {
    if (!this.config) {
      throw new Error("WorkflowManager not initialized");
    }

    const workflow = this.config.workflows[workflowId];
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Create new step
    const newStep: WorkflowStep = {
      workflowId,
      stepData,
      displayName: stepData?.displayName || workflow.name,
    };

    // Add to path
    this.currentPath.steps.push(newStep);
    this.currentPath.current = workflowId;

    console.log("Navigated to workflow:", workflowId, {
      totalSteps: this.currentPath.steps.length,
      currentPath: this.currentPath
    });
  }

  public goBack(): boolean {
    console.log("WorkflowManager.goBack() called", {
      currentSteps: this.currentPath.steps.length,
      current: this.currentPath.current,
      steps: this.currentPath.steps
    });

    if (this.currentPath.steps.length === 0) {
      console.log("Already at initial state, cannot go back");
      return false; // Already at initial state
    }

    // Remove the last step
    this.currentPath.steps.pop();

    // Update current to previous step or initial
    if (this.currentPath.steps.length > 0) {
      const lastStep =
        this.currentPath.steps[this.currentPath.steps.length - 1];
      this.currentPath.current = lastStep.workflowId;
      console.log("Navigated back to:", lastStep.workflowId);
    } else {
      this.currentPath.current = "initial";
      console.log("Navigated back to initial state");
    }

    return true;
  }

  public getCurrentWorkflows(): Workflow[] {
    if (!this.config) {
      return [];
    }

    if (this.currentPath.current === "initial") {
      // Return initial workflows
      return this.config.initialWorkflows
        .map((id) => this.config!.workflows[id])
        .filter(Boolean);
    }

    // Return children of current workflow
    const currentWorkflow = this.config.workflows[this.currentPath.current];
    if (!currentWorkflow || !currentWorkflow.children) {
      return [];
    }

    return currentWorkflow.children
      .map((id) => this.config!.workflows[id])
      .filter(Boolean);
  }

  public getCurrentWorkflow(): Workflow | null {
    if (!this.config || this.currentPath.current === "initial") {
      return null;
    }

    return this.config.workflows[this.currentPath.current] || null;
  }

  public getBreadcrumbPath(): string {
    if (this.currentPath.steps.length === 0) {
      return "";
    }

    const breadcrumbs = this.currentPath.steps.map((step) => step.displayName);
    return breadcrumbs.join(" > ") + ":";
  }

  public isSearchEnabled(): boolean {
    const currentWorkflow = this.getCurrentWorkflow();
    if (!currentWorkflow) {
      return true; // Enable search for initial state
    }

    return currentWorkflow.searchEnabled ?? false;
  }

  public getSearchPlaceholder(): string {
    const currentWorkflow = this.getCurrentWorkflow();
    if (!currentWorkflow) {
      return "Search workflows...";
    }

    return currentWorkflow.searchPlaceholder || "Search...";
  }

  public getCurrentPath(): WorkflowPath {
    return { ...this.currentPath };
  }

  public isAtInitialState(): boolean {
    return this.currentPath.current === "initial";
  }

  public getWorkflowById(id: string): Workflow | null {
    if (!this.config) {
      return null;
    }
    return this.config.workflows[id] || null;
  }

  public getCurrentStepData(): Record<string, any> | undefined {
    if (this.currentPath.steps.length === 0) {
      return undefined;
    }

    const currentStep =
      this.currentPath.steps[this.currentPath.steps.length - 1];
    return currentStep.stepData;
  }
}
