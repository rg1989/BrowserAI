import React from "react";
import { Workflow } from "../types/workflow";
import "./WorkflowItem.css";

interface WorkflowItemProps {
  workflow: Workflow;
  isSelected: boolean;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

export const WorkflowItem: React.FC<WorkflowItemProps> = ({
  workflow,
  isSelected,
  onClick,
  onKeyDown,
}) => {
  const getWorkflowIcon = (type: string) => {
    switch (type) {
      case "chat":
        return "💬";
      case "search":
        return "🔍";
      case "form":
        return "📝";
      case "action":
        return "⚡";
      case "loader":
        return "⏳";
      default:
        return "📁";
    }
  };

  return (
    <div
      className={`workflow-item ${
        isSelected ? "workflow-item-selected selected" : ""
      }`}
      data-testid="workflow-item"
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="button"
      aria-selected={isSelected}
    >
      <div className="workflow-item-icon">{getWorkflowIcon(workflow.type)}</div>
      <div className="workflow-item-content">
        <div className="workflow-item-name">{workflow.name}</div>
        {workflow.type !== "action" && (
          <div className="workflow-item-type">{workflow.type}</div>
        )}
      </div>
      {workflow.type !== "action" && (
        <div className="workflow-item-arrow">→</div>
      )}
    </div>
  );
};
