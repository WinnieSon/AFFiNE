# AFFiNE Codebase Analysis

## 1. Project Architecture Overview

### Monorepo Structure
AFFiNE is organized as a Yarn 4.x monorepo with the following key workspace patterns:

```
Workspaces:
- blocksuite/**/*         # BlockSuite editor framework
- packages/*/*            # Core packages (backend, frontend, common)
- packages/frontend/apps/* # Platform-specific applications
- tools/*                 # Build tools and CLI
- tests/*                 # E2E test suites
```

### Key Directories

#### `/blocksuite` - Editor Framework
- **affine/**: AFFiNE-specific blocks and components
  - `blocks/`: Individual block types (paragraph, list, code, etc.)
  - `gfx/`: Graphics elements (shapes, mindmap, connectors)
  - `widgets/`: UI widgets (toolbar, slash-menu, drag-handle)
  - `inlines/`: Inline elements (links, mentions, comments)
- **framework/**: Core BlockSuite infrastructure
  - `store/`: Yjs-based document store
  - `std/`: Standard library and utilities
  - `sync/`: Synchronization layer

#### `/packages` - Core Implementation
- **backend/**:
  - `native/`: Rust-based native modules for server
  - `server/`: NestJS GraphQL API server
- **frontend/**:
  - `core/`: Main web application modules
  - `apps/`: Platform-specific apps (web, electron, mobile)
  - `native/`: Rust-based native modules for frontend
  - `component/`: Shared React components
- **common/**:
  - `infra/`: Dependency injection framework
  - `nbstore/`: Local-first storage abstraction
  - `graphql/`: GraphQL client and schemas

#### `/tools` - Build Infrastructure
- `cli/`: Custom build CLI (`yarn affine`)
- `utils/`: Build utilities and workspace management

## 2. Dependency Analysis

### Package Dependencies
The project uses a complex dependency graph with:
- **React 19.0.0**: Main UI framework
- **Yjs 13.6.21**: CRDT for real-time collaboration (patched)
- **BlockSuite**: Custom editor framework
- **@toeverything/infra**: Custom DI framework
- **Emotion**: CSS-in-JS styling
- **Jotai**: State management
- **SWR**: Data fetching

### Circular Dependencies
No circular dependencies detected at the package level due to proper workspace organization.

### Version Conflicts
- TypeScript is patched to version 5.8.3 across the monorepo
- Yjs is patched for custom modifications
- Many polyfills are replaced with @nolyfill alternatives to reduce bundle size

## 3. Build Configuration

### Webpack Configuration
The build system uses Webpack 5 with custom configurations:

```javascript
// Key configuration points:
{
  output: {
    publicPath: '/', // Always '/' regardless of deployment
    filename: buildConfig.debug ? 'js/[name].js' : 'js/[name].[contenthash:8].js',
  },
  target: ['web', 'es2022'],
  experiments: {
    topLevelAwait: true,
    outputModule: false,
    syncWebAssembly: true,
  }
}
```

### TypeScript Configuration
- **Project References**: All packages use TypeScript project references with `composite: true`
- **Module Resolution**: `bundler` mode for web packages
- **Target**: ES2022 for modern JavaScript features
- **Strict Mode**: Disabled (`strict: false`)

### Build Scripts
```bash
# Production build
PUBLIC_PATH=/ BUILD_TYPE=canary yarn affine web build

# Development
yarn dev

# Type checking
yarn typecheck
```

## 4. Critical Build Paths

### Production Build Pipeline
1. **Native Module Build**: Required before main build
   ```bash
   yarn affine @affine/native build
   yarn affine @affine/server-native build
   ```

2. **Web Application Build**:
   - Entry: `packages/frontend/apps/web/src/index.tsx`
   - Workers: workspace-engine, pdf-renderer, turbo-painter, nbstore
   - HTML generation with asset manifest
   - CSS extraction and optimization
   - Code splitting with custom cache groups

### Asset Handling
- Static assets served from `/public`
- Fonts and images optimized as resources
- Support for S3 deployment (when configured)

## 5. Potential Build Issues

### Missing Dependencies
- Native modules must be built before web build
- Platform-specific node modules for Electron

### Configuration Conflicts
- `PUBLIC_PATH` environment variable critical for deployment
- `BUILD_TYPE` must be one of: canary, beta, stable, internal

### TypeScript Compilation
- Recent addition of `composite: true` to all tsconfig files
- Ensure all project references are correctly linked
- Watch for missing type definitions in native modules

### Module Resolution
- Custom aliases for yjs, lit, and preact/signals-core
- Fallbacks disabled for Node.js modules (crypto, buffer, stream)

## 6. Key Services and Modules

### Frontend Core Modules (`packages/frontend/core/src/modules/`)
- **workspace**: Workspace management and sync
- **doc**: Document operations and storage
- **editor**: BlockSuite editor integration
- **ai-button**: AI copilot features
- **collection**: Folder-like organization
- **tag**: Tagging system
- **comment**: Commenting functionality
- **share-doc**: Document sharing
- **quota**: Usage quotas
- **pdf**: PDF viewing and export
- **theme**: Theme management
- **navigation**: Routing and navigation
- **media**: Media capture and handling

### Backend Services
- **GraphQL API**: Main API layer with DataLoader optimization
- **Auth**: OAuth and session management
- **Workspace**: Workspace and permission management
- **Sync**: WebSocket-based real-time sync
- **AI/Copilot**: AI integration services
- **Blob Storage**: File and attachment handling

### Native Modules
- **Frontend Native** (`packages/frontend/native/`):
  - SQLite database operations
  - Media capture
  - Hashcash for anti-spam
- **Backend Native** (`packages/backend/native/`):
  - Document loading and processing
  - HTML sanitization
  - Tiktoken for AI tokenization

### Shared Packages
- **@toeverything/infra**: DI framework with Services, Stores, and Entities
- **@affine/nbstore**: Storage abstraction for local-first architecture
- **@affine/graphql**: Type-safe GraphQL client
- **@affine/component**: Shared UI components

## 7. ESLint Configuration

### Current Setup
- Uses flat config format (eslint.config.mjs)
- TypeScript parser with project references
- React and React Hooks rules enabled
- Many rules disabled due to oxlint usage
- Custom import sorting with simple-import-sort

### Recommendations
1. **Enable stricter TypeScript rules** for better type safety
2. **Add workspace-specific configs** for server vs web code
3. **Configure import resolution** to match Webpack aliases
4. **Add custom rules** for DI pattern compliance

## 8. Build Optimization Recommendations

### Immediate Fixes
1. Ensure native modules are built in CI/CD pipeline
2. Set `NODE_OPTIONS="--max-old-space-size=8192"` for large builds
3. Use production cache groups for optimal chunking

### Performance Improvements
1. Enable Webpack 5 persistent caching
2. Use SWC for faster TypeScript compilation
3. Implement incremental TypeScript builds

### Deployment Considerations
1. Always use `PUBLIC_PATH=/` for self-hosted deployments
2. Configure proper CORS headers for API endpoints
3. Enable gzip/brotli compression for static assets
4. Set up proper caching headers for immutable assets

## 9. Common Build Commands

```bash
# Full development setup
yarn install
yarn affine @affine/native build
yarn affine @affine/server-native build
yarn affine init
yarn dev

# Production build
PUBLIC_PATH=/ BUILD_TYPE=canary yarn affine web build

# Run production server
yarn serve:prod

# Type checking
yarn typecheck

# Linting
yarn lint
yarn lint:fix

# Testing
yarn test
yarn workspace @affine-test/affine-local e2e
```

## 10. Troubleshooting Guide

### Build Failures
1. **"Cannot find module"**: Run `yarn install` and rebuild native modules
2. **TypeScript errors**: Run `yarn typecheck` to identify issues
3. **Memory errors**: Increase Node.js memory limit
4. **Native module errors**: Ensure correct platform and architecture

### Development Issues
1. **Hot reload not working**: Check webpack-dev-server proxy configuration
2. **GraphQL errors**: Regenerate GraphQL types with codegen
3. **Module resolution**: Verify tsconfig paths match webpack aliases

### Production Deployment
1. **Assets not loading**: Verify PUBLIC_PATH configuration
2. **API connection failures**: Check proxy settings in production server
3. **Performance issues**: Enable production optimizations and caching