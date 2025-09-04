import React from "react";
import { Workflow } from "../types/workflow";
import { WorkflowItem } from "./WorkflowItem";
import "./WorkflowList.css";

interface WorkflowListProps {
  workflows: Workflow[];
  selectedIndex: number;
  searchValue: string;
  onNavigate: (workflowId: string, stepData?: Record<string, any>) => void;
  onClose: () => void;
}

export const WorkflowList: React.FC<WorkflowListProps> = ({
  workflows,
  selectedIndex,
  searchValue,
  onNavigate,
  onClose,
}) => {
  // Filter workflows based on search value
  const filteredWorkflows = workflows.filter((workflow) =>
    workflow.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleItemClick = (workflow: Workflow) => {
    if (workflow.type === "action" && workflow.action === "close") {
      onClose();
    } else {
      onNavigate(workflow.id);
    }
  };

  const handleItemKeyDown = (
    event: React.KeyboardEvent,
    workflow: Workflow
  ) => {
    if (event.key === "Enter") {
      handleItemClick(workflow);
    }
  };

  if (filteredWorkflows.length === 0) {
    return (
      <div className="workflow-list">
        <div className="workflow-list-empty">No workflows found</div>
      </div>
    );
  }

  return (
    <div className="workflow-list" data-testid="workflow-list">
      {filteredWorkflows.map((workflow, index) => (
        <WorkflowItem
          key={workflow.id}
          workflow={workflow}
          isSelected={index === selectedIndex}
          onClick={() => handleItemClick(workflow)}
          onKeyDown={(event) => handleItemKeyDown(event, workflow)}
        />
      ))}
    </div>
  );
};
