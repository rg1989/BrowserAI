import { Workflow, ChatMessage } from "../types/workflow";
import { WorkflowManager } from "./WorkflowManager";
import { AIServiceManager } from "./AIService";

export interface WorkflowCallbacks {
  onClose?: () => void;
  onNavigate?: (workflowId: string, stepData?: Record<string, any>) => void;
  onUpdateSearch?: (value: string) => void;
}

export class WorkflowActions {
  private static instance: WorkflowActions;
  private workflowManager: WorkflowManager;
  private aiServiceManager: AIServiceManager;

  private constructor() {
    this.workflowManager = WorkflowManager.getInstance();
    this.aiServiceManager = AIServiceManager.getInstance();
  }

  public static getInstance(): WorkflowActions {
    if (!WorkflowActions.instance) {
      WorkflowActions.instance = new WorkflowActions();
    }
    return WorkflowActions.instance;
  }

  public async executeWorkflow(
    workflow: Workflow,
    stepData?: Record<string, any>,
    callbacks?: WorkflowCallbacks
  ): Promise<void> {
    try {
      switch (workflow.type) {
        case "action":
          await this.executeAction(workflow, callbacks);
          break;

        case "search":
          await this.executeSearch(workflow, stepData, callbacks);
          break;

        case "form":
          await this.executeForm(workflow, stepData, callbacks);
          break;

        case "loader":
          await this.executeLoader(workflow, stepData, callbacks);
          break;

        case "chat":
          await this.executeChat(workflow, stepData, callbacks);
          break;

        case "navigation":
          await this.executeNavigation(workflow, stepData, callbacks);
          break;

        default:
          console.warn("Unknown workflow type:", workflow.type);
          throw new Error(`Unsupported workflow type: ${workflow.type}`);
      }
    } catch (error) {
      console.error("Error executing workflow:", workflow.id, error);
      throw error;
    }
  }

  private async executeAction(
    workflow: Workflow,
    callbacks?: WorkflowCallbacks
  ): Promise<void> {
    switch (workflow.action) {
      case "close":
        console.log("Executing close action");
        callbacks?.onClose?.();
        break;

      default:
        console.warn("Unknown action:", workflow.action);
        throw new Error(`Unsupported action: ${workflow.action}`);
    }
  }

  private async executeChat(
    workflow: Workflow,
    stepData?: Record<string, any>,
    callbacks?: WorkflowCallbacks
  ): Promise<void> {
    console.log("Navigating to chat workflow:", workflow.id, stepData);

    // Chat workflows are primarily handled by the ChatInterface component
    // This method handles the navigation and setup for chat workflows
    if (callbacks?.onNavigate) {
      callbacks.onNavigate(workflow.id, stepData);
    }
  }

  private async executeNavigation(
    workflow: Workflow,
    stepData?: Record<string, any>,
    callbacks?: WorkflowCallbacks
  ): Promise<void> {
    console.log("Executing navigation workflow:", workflow.id, stepData);

    if (workflow.nextWorkflow && callbacks?.onNavigate) {
      callbacks.onNavigate(workflow.nextWorkflow, stepData);
    }
  }

  private async executeSearch(
    workflow: Workflow,
    stepData?: Record<string, any>,
    callbacks?: WorkflowCallbacks
  ): Promise<void> {
    console.log("Executing search workflow:", workflow.id, stepData);

    // Search workflows are handled by the SearchInterface component
    // This method handles the setup and initialization for search workflows
    if (callbacks?.onUpdateSearch && workflow.searchPlaceholder) {
      // Clear search field and set placeholder
      callbacks.onUpdateSearch("");
    }
  }

  private async executeForm(
    workflow: Workflow,
    stepData?: Record<string, any>,
    callbacks?: WorkflowCallbacks
  ): Promise<void> {
    console.log("Executing form workflow:", workflow.id, stepData);

    // Form workflows are handled by the FormInterface component
    // This method handles the setup and initialization for form workflows
    // The stepData contains any data passed from previous workflow steps
  }

  private async executeLoader(
    workflow: Workflow,
    stepData?: Record<string, any>,
    callbacks?: WorkflowCallbacks
  ): Promise<void> {
    console.log("Executing loader workflow:", workflow.id, stepData);

    try {
      // Simulate async operation - in real implementation this would be actual async work
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Navigate to next workflow if specified
      if (workflow.nextWorkflow && callbacks?.onNavigate) {
        callbacks.onNavigate(workflow.nextWorkflow, stepData);
      }
    } catch (error) {
      console.error("Error in loader workflow:", error);
      throw error;
    }
  }

  public async handleSearchResult(
    searchWorkflow: Workflow,
    selectedResult: any,
    callbacks?: WorkflowCallbacks
  ): Promise<void> {
    console.log("Handling search result:", searchWorkflow.id, selectedResult);

    if (searchWorkflow.nextWorkflow && callbacks?.onNavigate) {
      const stepData = {
        ...selectedResult,
        displayName:
          selectedResult.name || selectedResult.title || selectedResult.id,
        searchResult: selectedResult,
        fromWorkflow: searchWorkflow.id,
      };

      callbacks.onNavigate(searchWorkflow.nextWorkflow, stepData);
    } else {
      console.warn(
        "No next workflow defined for search workflow:",
        searchWorkflow.id
      );
    }
  }

  public async handleFormSubmit(
    formWorkflow: Workflow,
    formData: Record<string, any>,
    callbacks?: WorkflowCallbacks
  ): Promise<void> {
    console.log("Form submitted:", formWorkflow.id, formData);

    try {
      // In a real implementation, this would submit the form data to a server
      // Simulate form submission
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Navigate to next workflow if specified, otherwise close
      if (formWorkflow.nextWorkflow && callbacks?.onNavigate) {
        const stepData = {
          formData,
          fromWorkflow: formWorkflow.id,
          displayName: `Form: ${formWorkflow.name}`,
        };
        callbacks.onNavigate(formWorkflow.nextWorkflow, stepData);
      } else {
        callbacks?.onClose?.();
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      throw error;
    }
  }

  public async sendChatMessage(
    chatWorkflow: Workflow,
    message: string,
    context?: ChatMessage[]
  ): Promise<string> {
    console.log("Sending chat message:", chatWorkflow.id, message);

    try {
      // Use AI service to generate response
      const response = await this.aiServiceManager.sendMessage(
        message,
        context
      );
      return response.message;
    } catch (error) {
      console.error("Error sending chat message:", error);
      throw new Error("Failed to send message. Please try again.");
    }
  }

  public async sendChatMessageStream(
    chatWorkflow: Workflow,
    message: string,
    context?: ChatMessage[],
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    console.log("Sending streaming chat message:", chatWorkflow.id, message);

    try {
      // Use AI service to generate streaming response
      const response = await this.aiServiceManager.sendMessageStream(
        message,
        context,
        onChunk
      );
      return response.message;
    } catch (error) {
      console.error("Error sending streaming chat message:", error);
      throw new Error("Failed to send message. Please try again.");
    }
  }

  public async handleWorkflowTransition(
    fromWorkflow: Workflow,
    toWorkflowId: string,
    stepData?: Record<string, any>,
    callbacks?: WorkflowCallbacks
  ): Promise<void> {
    console.log(
      "Handling workflow transition:",
      fromWorkflow.id,
      "->",
      toWorkflowId,
      stepData
    );

    try {
      // Validate transition
      if (!this.isValidTransition(fromWorkflow, toWorkflowId)) {
        throw new Error(
          `Invalid transition from ${fromWorkflow.id} to ${toWorkflowId}`
        );
      }

      // Execute transition
      if (callbacks?.onNavigate) {
        const transitionData = {
          ...stepData,
          fromWorkflow: fromWorkflow.id,
          transitionTimestamp: new Date().toISOString(),
        };
        callbacks.onNavigate(toWorkflowId, transitionData);
      }
    } catch (error) {
      console.error("Error in workflow transition:", error);
      throw error;
    }
  }

  private isValidTransition(
    fromWorkflow: Workflow,
    toWorkflowId: string
  ): boolean {
    // Basic validation - in a real implementation, this could be more sophisticated
    if (
      fromWorkflow.nextWorkflow &&
      fromWorkflow.nextWorkflow !== toWorkflowId
    ) {
      console.warn(
        "Transition to unexpected workflow:",
        toWorkflowId,
        "expected:",
        fromWorkflow.nextWorkflow
      );
    }
    return true; // Allow all transitions for now
  }

  public getWorkflowCapabilities(workflow: Workflow): {
    canSearch: boolean;
    canNavigate: boolean;
    canSubmit: boolean;
    canChat: boolean;
  } {
    return {
      canSearch: workflow.searchEnabled === true,
      canNavigate: !!workflow.nextWorkflow || workflow.type === "navigation",
      canSubmit: workflow.type === "form",
      canChat: workflow.type === "chat",
    };
  }

  public getAIServiceInfo() {
    return this.aiServiceManager.getServiceInfo();
  }

  public getAvailableAIServices(): string[] {
    return this.aiServiceManager.getAvailableServices();
  }

  public async setAIService(serviceName: string, config?: any): Promise<void> {
    try {
      await this.aiServiceManager.setService(serviceName, config);
      console.log(`AI service switched to: ${serviceName}`);
    } catch (error) {
      console.error(`Failed to switch AI service to ${serviceName}:`, error);
      throw error;
    }
  }
}
