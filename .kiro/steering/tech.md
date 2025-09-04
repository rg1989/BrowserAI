# Technology Stack

## Build System & Framework

- **Plasmo**: Primary build system and framework for browser extension development
- **TypeScript**: Strict TypeScript configuration with ES2020 target
- **React 19**: UI framework with React DOM for component rendering
- **Chrome Extension Manifest V3**: Modern extension architecture

## Testing

- **Jest**: Test runner with jsdom environment for DOM testing
- **Testing Library**: React Testing Library for component testing
- **ts-jest**: TypeScript transformation for Jest
- **Coverage**: Full coverage reporting with lcov and clover formats

## Development Dependencies

- **@types/chrome**: Chrome extension API types
- **@types/react**: React TypeScript definitions
- **identity-obj-proxy**: CSS module mocking for tests

## Common Commands

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build production extension
npm test             # Run test suite with coverage

# Testing
npm test -- --watch          # Run tests in watch mode
npm test -- --coverage       # Generate coverage report
```

## Architecture Patterns

- **Content Script Pattern**: Single content script injection across all pages
- **Service Layer**: Centralized services for keyboard management, AI, workflows, and configuration
- **Component-Based UI**: React components with co-located CSS files
- **Singleton Pattern**: KeyboardManager uses singleton for global state
- **Event-Driven**: Keyboard events and workflow navigation via callbacks

## Configuration

- **Workflow Config**: JSON-based workflow definitions in `config/workflow-config.json`
- **TypeScript**: Strict mode enabled with consistent casing enforcement
- **Module Resolution**: Node-style resolution with path aliases (`@/` for src)
- **CSS Modules**: Identity proxy for CSS imports in tests
