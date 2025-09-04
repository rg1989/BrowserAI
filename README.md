# Spotlight Browser Extension

A Chrome browser extension that provides a Spotlight-like interface for configurable workflows, offering quick access to AI chat interfaces, search functionality, and custom workflows across all web pages.

## 🚀 Features

- **Spotlight-style overlay**: Keyboard-triggered overlay interface similar to macOS Spotlight
- **AI Integration**: Built-in chat interfaces for AI interactions (AI Ask and AI Agent modes)
- **Configurable Workflows**: JSON-based workflow configuration system supporting multiple interaction types
- **Search Capabilities**: User search functionality with form-based detail views
- **Cross-page Functionality**: Works on all web pages via content script injection
- **Keyboard Navigation**: Full keyboard support for efficient workflow navigation

## 🛠️ Technology Stack

- **Framework**: [Plasmo](https://www.plasmo.com/) - Modern browser extension framework
- **Frontend**: React 19 with TypeScript
- **Build System**: Plasmo with Chrome Extension Manifest V3
- **Testing**: Jest + React Testing Library + Playwright E2E
- **Styling**: CSS Modules with component co-location

## 📦 Installation

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Chrome browser (for development and testing)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd spotlight-browser-extension
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Load extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `build/chrome-mv3-dev` directory

### Production Build

```bash
npm run build
```

The production build will be available in the `build/chrome-mv3-prod` directory.

## 🎯 Usage

### Activation

- **Keyboard Shortcut**: Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) on any webpage
- The Spotlight overlay will appear with available workflows

### Available Workflows

#### AI Ask
Quick AI assistance for questions and tasks
- Type your question or request
- Get instant AI responses
- Perfect for quick help while browsing

#### AI Agent
Advanced AI interactions with context awareness
- More sophisticated AI conversations
- Context-aware responses
- Ideal for complex tasks and analysis

#### Search Users
User lookup and management functionality
- Search for users by name or criteria
- View detailed user information
- Navigate to user detail forms

### Navigation

- **Arrow Keys**: Navigate between workflow options
- **Enter**: Select and execute a workflow
- **Escape**: Close the overlay
- **Tab**: Navigate within active workflows

## 🔧 Configuration

### Workflow Configuration

Workflows are defined in `config/workflow-config.json`:

```json
{
  "workflows": {
    "ai-ask": {
      "id": "ai-ask",
      "name": "AI Ask",
      "type": "chat",
      "component": "ChatInterface",
      "searchEnabled": false
    }
  },
  "initialWorkflows": ["ai-ask", "ai-agent", "search-users", "close"]
}
```

### Supported Workflow Types

- `chat`: AI conversation interfaces
- `search`: Search functionality with results
- `form`: Data input and display forms
- `action`: Simple action triggers (like close)
- `navigation`: Navigation between workflows
- `list`: List-based interfaces
- `loader`: Loading states

## 🧪 Testing

### Unit Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm test -- --coverage
```

### End-to-End Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI (interactive)
npm run test:e2e:ui

# Run E2E tests in headed mode (visible browser)
npm run test:e2e:headed

# Run all tests (unit + E2E)
npm run test:all
```

### MCP Integration Tests

```bash
# Run MCP-specific tests
npm run test:e2e:mcp

# Run MCP tests with UI
npm run test:e2e:mcp:ui

# Run all MCP tests
npm run test:all:mcp
```

## 📁 Project Structure

```
spotlight-browser-extension/
├── src/                          # Source code
│   ├── components/               # React UI components
│   │   ├── __tests__/           # Component unit tests
│   │   ├── ChatInterface.tsx    # AI chat interface
│   │   ├── SpotlightOverlay.tsx # Main overlay component
│   │   └── *.css               # Component-specific styles
│   ├── services/               # Business logic services
│   │   ├── __tests__/         # Service unit tests
│   │   ├── AIService.ts       # AI integration
│   │   ├── KeyboardManager.ts # Keyboard event handling
│   │   └── WorkflowManager.ts # Workflow state management
│   ├── types/                 # TypeScript type definitions
│   ├── utils/                 # Utility functions
│   └── content.ts            # Main content script entry
├── config/                   # Configuration files
│   └── workflow-config.json  # Workflow definitions
├── assets/                   # Static assets
├── e2e/                     # End-to-end tests
├── build/                   # Build output
└── coverage/               # Test coverage reports
```

## 🔨 Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production extension
- `npm run build:test` - Build for testing
- `npm test` - Run unit tests with coverage
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:all` - Run all tests

### Architecture Patterns

- **Content Script Pattern**: Single content script injection across all pages
- **Service Layer**: Centralized services for keyboard management, AI, workflows, and configuration
- **Component-Based UI**: React components with co-located CSS files
- **Singleton Pattern**: KeyboardManager uses singleton for global state
- **Event-Driven**: Keyboard events and workflow navigation via callbacks

### Adding New Workflows

1. **Define the workflow** in `config/workflow-config.json`
2. **Create the component** in `src/components/`
3. **Add corresponding tests** in `src/components/__tests__/`
4. **Update the WorkflowManager** to handle the new workflow type
5. **Add E2E tests** in the `e2e/` directory

### Code Style

- **TypeScript**: Strict mode enabled with consistent casing enforcement
- **React**: Functional components with hooks
- **CSS**: Component co-location with CSS modules
- **Testing**: Comprehensive unit and E2E test coverage

## 🐛 Troubleshooting

### Extension Not Loading

- Ensure the build completed successfully
- Check Chrome's extension management page for errors
- Verify manifest.json is valid
- Try reloading the extension

### Keyboard Shortcuts Not Working

- Check if another extension is using the same shortcut
- Verify the page has focus
- Try refreshing the page
- Check browser console for errors

### Tests Failing

- Ensure all dependencies are installed
- Run `npm run build:test` before E2E tests
- Check that Chrome is properly installed
- Verify test data attributes are present in components

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm run test:all`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Development Guidelines

- Follow the existing code style and patterns
- Add unit tests for new components and services
- Add E2E tests for new workflows
- Update documentation for new features
- Ensure TypeScript strict mode compliance

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Plasmo](https://www.plasmo.com/) framework
- Inspired by macOS Spotlight interface
- Powered by React and TypeScript
- Tested with Jest and Playwright

---

For more detailed information about specific components or workflows, check the inline documentation in the source code or the E2E test specifications in the `e2e/` directory.