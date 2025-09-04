import React from "react";
import { WorkflowComponentProps } from "../types/workflow";
import { WorkflowList } from "./WorkflowList";
import { SearchInterface } from "./SearchInterface";
import { FormInterface } from "./FormInterface";
import { LoaderInterface } from "./LoaderInterface";

export const WorkflowRenderer: React.FC<WorkflowComponentProps> = (props) => {
  const { workflow } = props;

  // For list type workflows, we need to get the available workflows
  if (workflow.type === "list" || !workflow) {
    // This will be handled by the parent component passing workflows
    return null;
  }

  switch (workflow.type) {
    case "search":
      return <SearchInterface {...props} />;

    case "form":
      return <FormInterface {...props} />;

    case "loader":
      return <LoaderInterface {...props} />;

    case "chat":
      // Chat interface will be handled separately
      return null;

    case "action":
      // Actions are handled immediately, no UI needed
      return null;

    default:
      return (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            color: "rgba(255, 255, 255, 0.6)",
          }}
        >
          Unknown workflow type: {workflow.type}
        </div>
      );
  }
};
