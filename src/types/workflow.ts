export interface WorkflowConfig {
  workflows: Record<string, Workflow>;
  initialWorkflows: string[];
}

export interface Workflow {
  id: string;
  name: string;
  type:
    | "action"
    | "navigation"
    | "chat"
    | "search"
    | "form"
    | "loader"
    | "list";
  component: string;
  children?: string[];
  action?: string;
  searchEnabled?: boolean;
  searchPlaceholder?: string;
  data?: Record<string, any>;
  nextWorkflow?: string;
}

export interface WorkflowStep {
  workflowId: string;
  stepData?: Record<string, any>;
  displayName?: string;
}

export interface WorkflowPath {
  steps: WorkflowStep[];
  current: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
}

export interface WorkflowComponentProps {
  workflow: Workflow;
  searchValue: string;
  selectedIndex: number;
  onNavigate: (workflowId: string, stepData?: Record<string, any>) => void;
  onBack: () => void;
  onClose: () => void;
  onUpdateSearch: (value: string) => void;
}

export interface SpotlightOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  contextualAIService?: any; // ContextualAIService - using any to avoid circular imports
}

export interface SearchFieldProps {
  prefix: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder: string;
  onKeyDown?: (event: React.KeyboardEvent) => void;
}

export interface ChatInterfaceProps {
  workflowType: "ai-ask" | "ai-agent";
  onSendMessage: (message: string) => void;
  messages: ChatMessage[];
  contextualAIService?: any; // ContextualAIService - using any to avoid circular imports
}
