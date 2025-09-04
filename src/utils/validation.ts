import { WorkflowConfig, Workflow } from "../types/workflow";

export function validateWorkflowConfig(config: any): config is WorkflowConfig {
  if (!config || typeof config !== "object") {
    return false;
  }

  if (!config.workflows || typeof config.workflows !== "object") {
    return false;
  }

  if (!Array.isArray(config.initialWorkflows)) {
    return false;
  }

  // Validate each workflow
  for (const [id, workflow] of Object.entries(config.workflows)) {
    if (!validateWorkflow(workflow as any, id)) {
      return false;
    }
  }

  return true;
}

export function validateWorkflow(
  workflow: any,
  expectedId?: string
): workflow is Workflow {
  if (!workflow || typeof workflow !== "object") {
    return false;
  }

  const requiredFields = ["id", "name", "type", "component"];
  for (const field of requiredFields) {
    if (!workflow[field] || typeof workflow[field] !== "string") {
      return false;
    }
  }

  if (expectedId && workflow.id !== expectedId) {
    return false;
  }

  const validTypes = [
    "action",
    "navigation",
    "chat",
    "search",
    "form",
    "loader",
    "list",
  ];
  if (!validTypes.includes(workflow.type)) {
    return false;
  }

  // Optional field validations
  if (workflow.children && !Array.isArray(workflow.children)) {
    return false;
  }

  if (
    workflow.searchEnabled !== undefined &&
    typeof workflow.searchEnabled !== "boolean"
  ) {
    return false;
  }

  return true;
}

export function createDefaultConfig(): WorkflowConfig {
  return {
    workflows: {
      "ai-ask": {
        id: "ai-ask",
        name: "AI Ask",
        type: "chat",
        component: "ChatInterface",
        searchEnabled: false,
      },
      "ai-agent": {
        id: "ai-agent",
        name: "AI Agent",
        type: "chat",
        component: "ChatInterface",
        searchEnabled: false,
      },
      close: {
        id: "close",
        name: "Close",
        type: "action",
        component: "ActionComponent",
        action: "close",
      },
    },
    initialWorkflows: ["ai-ask", "ai-agent", "close"],
  };
}
