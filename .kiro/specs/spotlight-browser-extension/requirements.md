# Requirements Document

## Introduction

This feature involves creating a browser extension that provides a Spotlight-like overlay interface activated by CMD+K. The extension will display a searchable dropdown with configurable workflows, including AI Ask, AI Agent, and Close options. The interface will support keyboard navigation and multi-step flows with visual breadcrumbs.

## Requirements

### Requirement 1

**User Story:** As a user, I want to activate a Spotlight-like overlay using CMD+K, so that I can quickly access various workflows without leaving my current page.

#### Acceptance Criteria

1. WHEN the user presses CMD+K THEN the system SHALL display an overlay on top of the current page
2. WHEN the overlay opens THEN the system SHALL focus the cursor in the search field
3. WHEN the overlay is displayed THEN the system SHALL show a dropdown with available workflow options
4. WHEN the overlay opens THEN the system SHALL blur the background page content

### Requirement 2

**User Story:** As a user, I want to navigate the interface using keyboard shortcuts, so that I can efficiently interact with workflows without using a mouse.

#### Acceptance Criteria

1. WHEN the user presses arrow keys THEN the system SHALL move selection up and down through available options
2. WHEN the user presses Enter THEN the system SHALL select the currently highlighted option
3. WHEN the user presses Escape THEN the system SHALL go back one step in the workflow
4. WHEN the user presses Escape on the initial step THEN the system SHALL close the overlay
5. WHEN navigating options THEN the system SHALL provide visual feedback for the selected item

### Requirement 3

**User Story:** As a user, I want to see workflow navigation breadcrumbs in the search field, so that I understand my current position in multi-step flows.

#### Acceptance Criteria

1. WHEN in the initial workflow step THEN the search field SHALL show no prefix
2. WHEN entering a workflow THEN the system SHALL display the workflow name as a prefix (e.g., "AI Ask:")
3. WHEN in nested workflow steps THEN the system SHALL show the full path (e.g., "AI Ask > Step2:")
4. WHEN displaying breadcrumbs THEN the prefix SHALL be uneditable
5. WHEN showing breadcrumbs THEN the search field SHALL remain functional for the current step

### Requirement 4

**User Story:** As a user, I want access to predefined workflows (AI Ask, AI Agent, Close), so that I can perform common tasks efficiently.

#### Acceptance Criteria

1. WHEN the overlay opens THEN the system SHALL display "AI Ask", "AI Agent", and "Close" as initial options
2. WHEN the user selects "Close" THEN the system SHALL immediately close the overlay
3. WHEN the user selects "AI Ask" THEN the system SHALL navigate to the AI Ask chat interface
4. WHEN the user selects "AI Agent" THEN the system SHALL navigate to the AI Agent chat interface
5. WHEN entering AI Ask workflow THEN the system SHALL show "AI Ask:" prefix and display chat interface
6. WHEN entering AI Agent workflow THEN the system SHALL show "AI Agent:" prefix and display chat interface

### Requirement 5

**User Story:** As a user, I want to interact with a chat interface in AI workflows, so that I can communicate with AI services.

#### Acceptance Criteria

1. WHEN in AI Ask or AI Agent workflow THEN the system SHALL display a chat interface in the dropdown
2. WHEN the chat interface loads THEN the system SHALL focus the prompt input field
3. WHEN the chat interface is active THEN the main search field SHALL be disabled and empty
4. WHEN in chat mode THEN the system SHALL provide a send button for submitting messages
5. WHEN messages are sent THEN the system SHALL display them in the chat history
6. WHEN implementing chat THEN the system SHALL provide an interface for future AI model integration

### Requirement 6

**User Story:** As a developer, I want workflows to be configurable via a config file, so that I can easily add, modify, or remove workflows without code changes.

#### Acceptance Criteria

1. WHEN the extension loads THEN the system SHALL read workflow configuration from a config file
2. WHEN defining workflows THEN the config SHALL support workflow names, components, and behavior definitions
3. WHEN configuring workflows THEN the system SHALL support both single-step and multi-step flows
4. WHEN updating the config THEN the system SHALL allow dynamic workflow modification
5. WHEN implementing config THEN the structure SHALL be simple to understand and maintain

### Requirement 7

**User Story:** As a developer, I want the extension built with React, TypeScript, and Plasmo, so that I have modern tooling with live reload capabilities.

#### Acceptance Criteria

1. WHEN developing the extension THEN the system SHALL use React for UI components
2. WHEN implementing functionality THEN the system SHALL use TypeScript for type safety
3. WHEN building the extension THEN the system SHALL use Plasmo framework for development
4. WHEN developing THEN the system SHALL support live reload for efficient testing
5. WHEN the extension is complete THEN the system SHALL be testable using Playwright MCP

### Requirement 8

**User Story:** As a user, I want the interface to have Apple Spotlight-like design and styling, so that it feels familiar and polished.

#### Acceptance Criteria

1. WHEN the overlay displays THEN the system SHALL use clean, minimal design similar to macOS Spotlight
2. WHEN styling the interface THEN the system SHALL use appropriate shadows, rounded corners, and spacing
3. WHEN displaying options THEN the system SHALL use clear typography and visual hierarchy
4. WHEN showing selected items THEN the system SHALL provide subtle highlighting effects
5. WHEN implementing the design THEN the system SHALL ensure responsive behavior across different screen sizes
