# Implementation Plan

- [x] 1. Set up Plasmo project structure and configuration

  - Initialize new Plasmo browser extension project with TypeScript
  - Configure package.json with React, TypeScript, and development dependencies
  - Set up basic project structure with src/, components/, and config/ directories
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 2. Create core data models and interfaces

  - Define TypeScript interfaces for WorkflowConfig, Workflow, WorkflowStep, WorkflowPath, and ChatMessage
  - Create WorkflowComponentProps interface for dynamic component rendering
  - Add support for multi-step workflows with stepData and displayName tracking
  - Extend Workflow interface to support search, form, loader, and list component types
  - Implement validation functions for configuration data
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 3. Implement workflow configuration system

  - Create workflow-config.json with initial AI Ask, AI Agent, and Close workflows
  - Build ConfigLoader class to read and parse workflow configuration
  - Implement fallback mechanism for missing or invalid configuration
  - Write unit tests for configuration loading and validation
  - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [x] 4. Build WorkflowManager for navigation and state management

  - Implement WorkflowManager class with enhanced navigation methods supporting stepData
  - Create workflow path tracking with WorkflowStep objects for complex breadcrumbs
  - Add getBreadcrumbPath() method to generate dynamic breadcrumb strings
  - Implement methods for workflow transitions, back navigation, and step data management
  - Add support for conditional search field enabling based on workflow configuration
  - Write unit tests for workflow navigation logic including multi-step scenarios
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. Create keyboard event handling system

  - Implement KeyboardManager class for centralized event handling
  - Add CMD+K detection for overlay activation
  - Implement arrow key navigation, Enter selection, and Escape back/close
  - Handle event prevention and propagation for browser compatibility
  - Write unit tests for keyboard event handling
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4_

- [x] 6. Build SearchField component with breadcrumb support

  - Create SearchField React component with prefix display
  - Implement uneditable breadcrumb prefix functionality
  - Add focus management and input handling
  - Style component to match Apple Spotlight design
  - Write unit tests for SearchField component
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 8.2_

- [x] 7. Create WorkflowRenderer and dynamic workflow components

  - Build WorkflowRenderer component to dynamically render workflow components based on type
  - Create WorkflowList component to display available workflow options
  - Build WorkflowItem component with selection highlighting
  - Implement SearchInterface component for search-type workflows
  - Create FormInterface component for form-type workflows
  - Add LoaderInterface component for loading states
  - Implement keyboard navigation visual feedback across all component types
  - Add click and keyboard selection handling with stepData support
  - Style components with Spotlight-like appearance
  - Write unit tests for all workflow components
  - _Requirements: 2.5, 4.1, 8.3, 8.4_

- [x] 8. Create ChatInterface component for AI workflows

  - Build ChatInterface component with message display and input
  - Implement MessageList component for chat history
  - Create PromptInput component with send button
  - Add message state management and display logic
  - Style chat interface to match overall design
  - Write unit tests for chat components
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9. Build main SpotlightOverlay container component

  - Create SpotlightOverlay component as main container
  - Implement overlay visibility and focus management
  - Add background blur and z-index layering
  - Integrate SearchField and WorkflowRenderer for dynamic component rendering
  - Handle search field enabling/disabling based on current workflow configuration
  - Implement dynamic breadcrumb display in SearchField based on workflow path
  - Handle component switching based on workflow state and type
  - Write unit tests for overlay component including multi-step navigation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 8.5_

- [x] 10. Implement workflow-specific behavior and actions

  - Add Close workflow action to immediately close overlay
  - Implement AI Ask workflow navigation to chat interface
  - Add AI Agent workflow navigation to chat interface
  - Create workflow transition logic supporting stepData passing between workflows
  - Implement search workflow behavior with result selection and next workflow navigation
  - Add form workflow behavior with field management and action buttons
  - Create loader workflow behavior for async operations
  - Write unit tests for all workflow actions including multi-step transitions
  - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 11. Create content script for browser integration

  - Build Plasmo content script to inject overlay into web pages
  - Implement overlay mounting and unmounting logic
  - Add global keyboard event listeners for CMD+K
  - Handle script injection across different page types
  - Write integration tests for content script functionality
  - _Requirements: 1.1, 7.3, 7.4_

- [x] 12. Add AI service interface for future integration

  - Create abstract AIService interface for message handling
  - Implement mock AI service for testing and development
  - Add message sending and response handling logic
  - Design extensible architecture for multiple AI providers
  - Write unit tests for AI service interface
  - _Requirements: 5.6_

- [x] 13. Implement comprehensive styling and animations

  - Create CSS modules for all components with Apple Spotlight styling
  - Add smooth transitions and animations for overlay and selections
  - Implement responsive design for different screen sizes
  - Add proper shadows, rounded corners, and visual hierarchy
  - Ensure consistent typography and spacing throughout
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 14. Write integration tests for complete workflows

  - Create integration tests for full workflow navigation sequences including multi-step flows
  - Test keyboard navigation through all workflow types (action, chat, search, form, loader)
  - Verify chat interface functionality and message handling
  - Test search workflow with result selection and navigation to next workflow
  - Test form workflow with field interaction and action handling
  - Test configuration loading and dynamic workflow switching
  - Validate error handling and fallback behaviors for complex workflow paths
  - Test breadcrumb generation and display for nested workflow navigation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2_

- [x] 15. Set up Playwright MCP testing for end-to-end validation
  - Configure Playwright MCP for browser extension testing
  - Write E2E tests for CMD+K overlay activation and focus
  - Test complete keyboard navigation sequences
  - Verify workflow execution and chat interface interactions
  - Test multi-step navigation and breadcrumb display
  - Validate extension behavior across different web pages
  - _Requirements: 7.5, 1.1, 1.2, 2.1, 2.2, 2.3, 3.2, 3.3, 5.1, 5.2_
