import React, { useState, useEffect, useCallback } from "react";
import { SpotlightOverlayProps } from "../types/workflow";
import { WorkflowManager } from "../services/WorkflowManager";
import { KeyboardManager } from "../services/KeyboardManager";
import { SearchField } from "./SearchField";
import { WorkflowList } from "./WorkflowList";
import { WorkflowRenderer } from "./WorkflowRenderer";
import { ChatInterface } from "./ChatInterface";
import "./SpotlightOverlay.css";

export const SpotlightOverlay: React.FC<SpotlightOverlayProps> = ({
  isVisible,
  onClose,
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [workflowManager] = useState(() => WorkflowManager.getInstance());
  const [keyboardManager] = useState(() => KeyboardManager.getInstance());
  const [currentWorkflows, setCurrentWorkflows] = useState<any[]>([]);
  const [currentWorkflow, setCurrentWorkflow] = useState<any>(null);
  const [breadcrumbPath, setBreadcrumbPath] = useState("");
  const [isSearchEnabled, setIsSearchEnabled] = useState(true);

  // Update state when workflow changes
  const updateWorkflowState = useCallback(() => {
    setCurrentWorkflows(workflowManager.getCurrentWorkflows());
    setCurrentWorkflow(workflowManager.getCurrentWorkflow());
    setBreadcrumbPath(workflowManager.getBreadcrumbPath());
    setIsSearchEnabled(workflowManager.isSearchEnabled());
    setSelectedIndex(0);
    setSearchValue("");
  }, [workflowManager]);

  // Initialize workflow manager
  useEffect(() => {
    if (isVisible) {
      workflowManager.initialize().then(() => {
        updateWorkflowState();
      });
    }
  }, [isVisible, workflowManager, updateWorkflowState]);

  // Handle keyboard navigation
  const handleNavigateUp = useCallback(() => {
    if (currentWorkflow?.type === "chat") return; // No navigation in chat mode

    const workflows = currentWorkflows.filter((w) =>
      w.name.toLowerCase().includes(searchValue.toLowerCase())
    );
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : workflows.length - 1));
  }, [currentWorkflows, searchValue, currentWorkflow]);

  const handleNavigateDown = useCallback(() => {
    if (currentWorkflow?.type === "chat") return; // No navigation in chat mode

    const workflows = currentWorkflows.filter((w) =>
      w.name.toLowerCase().includes(searchValue.toLowerCase())
    );
    setSelectedIndex((prev) => (prev < workflows.length - 1 ? prev + 1 : 0));
  }, [currentWorkflows, searchValue, currentWorkflow]);

  const handleSelect = useCallback(() => {
    if (currentWorkflow?.type === "chat") return; // Selection handled by chat interface

    const workflows = currentWorkflows.filter((w) =>
      w.name.toLowerCase().includes(searchValue.toLowerCase())
    );

    if (workflows[selectedIndex]) {
      const workflow = workflows[selectedIndex];
      if (workflow.type === "action" && workflow.action === "close") {
        onClose();
      } else {
        workflowManager.navigateToWorkflow(workflow.id);
        updateWorkflowState();
      }
    }
  }, [
    currentWorkflows,
    searchValue,
    selectedIndex,
    currentWorkflow,
    workflowManager,
    updateWorkflowState,
    onClose,
  ]);

  const handleBack = useCallback(() => {
    if (workflowManager.goBack()) {
      updateWorkflowState();
    } else {
      onClose();
    }
  }, [workflowManager, updateWorkflowState, onClose]);

  const handleToggleOverlay = useCallback(() => {
    if (isVisible) {
      onClose();
    }
    // Opening is handled by parent component
  }, [isVisible, onClose]);

  // Set up keyboard handlers
  useEffect(() => {
    keyboardManager.initialize({
      onToggleOverlay: handleToggleOverlay,
      onNavigateUp: handleNavigateUp,
      onNavigateDown: handleNavigateDown,
      onSelect: handleSelect,
      onBack: handleBack,
      onClose: onClose,
    });

    keyboardManager.setActive(isVisible);

    return () => {
      keyboardManager.setActive(false);
    };
  }, [
    keyboardManager,
    isVisible,
    handleToggleOverlay,
    handleNavigateUp,
    handleNavigateDown,
    handleSelect,
    handleBack,
    onClose,
  ]);

  const handleNavigateToWorkflow = (
    workflowId: string,
    stepData?: Record<string, any>
  ) => {
    const workflow = workflowManager.getWorkflowById(workflowId);

    if (!workflow) {
      console.error("Workflow not found:", workflowId);
      return;
    }

    // Handle action workflows immediately
    if (workflow.type === "action") {
      switch (workflow.action) {
        case "close":
          onClose();
          return;
        default:
          console.warn("Unknown action:", workflow.action);
          return;
      }
    }

    // For other workflows, navigate normally
    workflowManager.navigateToWorkflow(workflowId, stepData);
    updateWorkflowState();
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent) => {
    keyboardManager.handleSearchKeyDown(event);
  };

  const handleSendMessage = async (message: string) => {
    // In a real implementation, this would send the message to an AI service
    console.log("Sending message:", message);
  };

  const renderContent = () => {
    // Show chat interface for chat workflows
    if (currentWorkflow?.type === "chat") {
      return (
        <ChatInterface
          workflowType={currentWorkflow.id as "ai-ask" | "ai-agent"}
          onSendMessage={handleSendMessage}
          messages={[]}
        />
      );
    }

    // Show workflow renderer for other workflow types
    if (currentWorkflow && currentWorkflow.type !== "list") {
      return (
        <WorkflowRenderer
          workflow={currentWorkflow}
          searchValue={searchValue}
          selectedIndex={selectedIndex}
          onNavigate={handleNavigateToWorkflow}
          onBack={handleBack}
          onClose={onClose}
          onUpdateSearch={setSearchValue}
        />
      );
    }

    // Show workflow list for initial state or list workflows
    return (
      <WorkflowList
        workflows={currentWorkflows}
        selectedIndex={selectedIndex}
        searchValue={searchValue}
        onNavigate={handleNavigateToWorkflow}
        onClose={onClose}
      />
    );
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="spotlight-overlay"
      data-testid="spotlight-overlay-container"
      onClick={onClose}
    >
      <div
        className="spotlight-container"
        data-testid="spotlight-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <SearchField
          prefix={breadcrumbPath}
          value={searchValue}
          onChange={setSearchValue}
          disabled={!isSearchEnabled}
          placeholder={workflowManager.getSearchPlaceholder()}
          onKeyDown={handleSearchKeyDown}
        />

        <div className="spotlight-content">{renderContent()}</div>
      </div>
    </div>
  );
};
