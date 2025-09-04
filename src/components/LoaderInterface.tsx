import React from "react";
import { WorkflowComponentProps } from "../types/workflow";
import "./LoaderInterface.css";

export const LoaderInterface: React.FC<WorkflowComponentProps> = ({
  workflow,
}) => {
  return (
    <div className="loader-interface">
      <div className="loader-content">
        <div className="loader-spinner"></div>
        <div className="loader-text">Loading...</div>
        <div className="loader-subtext">
          Please wait while we process your request
        </div>
      </div>
    </div>
  );
};
