import React from "react";
import { WorkflowComponentProps } from "../types/workflow";
import { WorkflowManager } from "../services/WorkflowManager";
import "./FormInterface.css";

export const FormInterface: React.FC<WorkflowComponentProps> = ({
  workflow,
  searchValue,
  selectedIndex,
  onNavigate,
  onBack,
  onClose,
}) => {
  // Get user data from workflow manager's current step data
  const workflowManager = WorkflowManager.getInstance();
  const stepData = workflowManager.getCurrentStepData();
  const userData = stepData?.userData || workflow.data || {};

  const handleClose = () => {
    onClose();
  };

  const handleEdit = () => {
    // In a real implementation, this would open an edit form
    console.log("Edit user:", userData);
  };

  return (
    <div className="form-interface">
      <div className="form-content">
        <div className="form-header">
          <h3 className="form-title">User Details</h3>
        </div>

        <div className="form-fields">
          <div className="form-field">
            <label className="form-label">Name</label>
            <div className="form-value">{userData.name || "N/A"}</div>
          </div>

          <div className="form-field">
            <label className="form-label">Description</label>
            <div className="form-value">{userData.description || "N/A"}</div>
          </div>

          <div className="form-field">
            <label className="form-label">ID</label>
            <div className="form-value">{userData.id || "N/A"}</div>
          </div>
        </div>

        <div className="form-actions">
          <button
            className="form-button form-button-secondary"
            onClick={handleEdit}
          >
            Edit
          </button>
          <button
            className="form-button form-button-primary"
            onClick={handleClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
