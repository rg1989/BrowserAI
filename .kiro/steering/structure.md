# Project Structure

## Root Directory

- `src/`: Main source code
- `config/`: Configuration files (workflow definitions)
- `assets/`: Static assets (icons, images)
- `.plasmo/`: Plasmo build artifacts and generated files
- `build/`: Production build output
- `coverage/`: Test coverage reports

## Source Organization (`src/`)

```
src/
├── components/           # React UI components
│   ├── __tests__/       # Component unit tests
│   ├── *.tsx            # Component implementations
│   └── *.css            # Component-specific styles
├── services/            # Business logic and external integrations
│   ├── __tests__/       # Service unit tests
│   └── *.ts             # Service implementations
├── types/               # TypeScript type definitions
├── utils/               # Utility functions and helpers
├── styles/              # Global styles and themes
├── __tests__/           # Integration tests
├── content.ts           # Main content script entry point
├── manifest.json        # Extension manifest
└── setupTests.ts        # Jest test configuration
```

## Component Structure

- **Co-located CSS**: Each component has its own CSS file (e.g., `ChatInterface.tsx` + `ChatInterface.css`)
- **Test Files**: Components have corresponding test files in `__tests__/` subdirectories
- **Index Exports**: Use barrel exports where appropriate for clean imports

## Service Layer

- `AIService.ts`: AI integration and chat functionality
- `ConfigLoader.ts`: Workflow configuration loading and management
- `KeyboardManager.ts`: Global keyboard event handling (singleton)
- `WorkflowActions.ts`: Workflow execution and action handling
- `WorkflowManager.ts`: Workflow state and navigation management

## Naming Conventions

- **Components**: PascalCase (e.g., `SpotlightOverlay.tsx`)
- **Services**: PascalCase with Service suffix (e.g., `AIService.ts`)
- **Types**: PascalCase interfaces (e.g., `WorkflowConfig`)
- **CSS Classes**: kebab-case following BEM methodology
- **Test Files**: Match source file name with `.test.tsx` or `.test.ts` suffix

## Configuration Files

- `config/workflow-config.json`: Workflow definitions and routing
- `tsconfig.json`: TypeScript compiler configuration
- `jest.config.js`: Test runner configuration
- `package.json`: Dependencies and build scripts

## Build Artifacts

- `.plasmo/`: Generated Plasmo files (do not edit manually)
- `build/`: Production extension bundle
- `coverage/`: Test coverage reports and HTML output
