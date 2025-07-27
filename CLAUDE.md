# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AFFiNE is an open-source, all-in-one workspace and knowledge management platform. It's a privacy-focused, local-first alternative to Notion & Miro built as a monorepo using Yarn workspaces.

**Tech Stack:**

- Frontend: React 19, TypeScript, Vite, Jotai, Emotion
- Backend: NestJS, GraphQL, Prisma, Redis, BullMQ
- Editor: BlockSuite (custom block-based editor framework with Yjs/CRDT)
- Native: Rust modules via NAPI-rs
- Platforms: Web, Desktop (Electron), Mobile (Capacitor)
- Real-time: Socket.io, WebSocket, Yjs for collaboration

## Essential Commands

### Setup

```bash
# Enable Yarn 4.x
corepack enable
corepack prepare yarn@stable --activate

# Install dependencies
yarn install

# Build native modules (required)
yarn affine @affine/native build
yarn affine @affine/server-native build

# Initialize project
yarn affine init
```

### Development

```bash
# Start development server
yarn dev

# Run tests
yarn test                                          # Unit tests
yarn workspace @affine-test/affine-local e2e       # E2E tests (requires server running)

# Code quality
yarn typecheck                                     # TypeScript checking
yarn lint                                          # Run linting
yarn lint:fix                                      # Fix linting issues

# Build
yarn build

# Production deployment (see PRODUCTION_DEPLOYMENT.md for details)
PUBLIC_PATH=/ BUILD_TYPE=canary yarn affine web build
```

### Backend Development

```bash
# Setup Docker services (postgres, redis, mailhog)
cp ./.docker/dev/compose.yml.example ./.docker/dev/compose.yml
cp ./.docker/dev/.env.example ./.docker/dev/.env
docker compose -f ./.docker/dev/compose.yml up

# Configure server
cp packages/backend/server/.env.example packages/backend/server/.env
yarn affine server init

# Start server
yarn affine server dev

# Database tools
yarn affine server prisma studio                   # Open Prisma Studio
```

Test accounts:

- pro@affine.pro / pro (pro user)

### Desktop App Development

```bash
# Build native modules first
BUILD_TYPE=canary yarn affine @affine/electron build
BUILD_TYPE=canary yarn affine @affine/electron generate-assets

# Package (requires special yarn config)
yarn config set nmMode classic
yarn config set nmHoistingLimits workspaces
BUILD_TYPE=canary SKIP_WEB_BUILD=1 HOIST_NODE_MODULES=1 yarn affine @affine/electron make
```

## High-Level Architecture

### Directory Structure

```
/
├── blocksuite/          # Editor framework
│   ├── affine/         # AFFiNE-specific blocks
│   └── framework/      # Core editor infrastructure
├── packages/
│   ├── backend/        # Server implementation
│   │   ├── native/     # Rust modules for server
│   │   └── server/     # NestJS GraphQL server
│   ├── frontend/       # Client applications
│   │   ├── core/       # Main web application
│   │   ├── apps/       # Platform-specific apps
│   │   └── native/     # Rust modules for frontend
│   └── common/         # Shared libraries
│       ├── graphql/    # GraphQL client/schema
│       ├── infra/      # DI framework
│       └── nbstore/    # Local-first storage
└── tests/             # E2E test suites
```

### Key Architectural Concepts

1. **Dependency Injection Framework**: Custom DI system (`@toeverything/infra`) with Services, Stores, and Entities
2. **Module System**: Feature modules in `packages/frontend/core/src/modules/`
   - workspace, doc, editor, ai-button, collection, tag, comment, share-doc, quota, pdf, theme, navigation, media
3. **State Management**:
   - Jotai for UI state
   - LiveData pattern for reactive data
   - Yjs for document collaboration (CRDT)
   - NBStore for local-first storage (IDB, SQLite, Cloud backends)
4. **Editor Integration**: BlockSuite provides block-based editing with CRDT collaboration
   - Custom blocks in `/blocksuite/affine/blocks/`
   - Rich text, tables, code blocks, embeds, whiteboard/canvas
5. **Sync System**: Local SQLite + sync engine for offline-first functionality
6. **GraphQL API**: Type-safe, context-based with DataLoader optimization

### Important Patterns

- **Local-first**: All data stored locally with sync to server
- **Plugin Architecture**: Extensible via BlockSuite specs
- **Command Pattern**: For editor operations
- **Repository Pattern**: For data access layer
- **Service Layer**: Business logic separation

### Development Tips

- The main branch is `canary` (not main/master)
- Always build native modules after fresh clone
- E2E tests require the server to be running
- Windows users need Developer Mode and symlinks enabled
- Use `yarn affine` CLI for most development tasks
- GraphQL schema is in `packages/backend/server/src/schema.gql`
- Frontend modules follow a consistent DI pattern
- BlockSuite docs: https://blocksuite.io

### Testing Approach

- Unit tests: Vitest with `*.spec.ts` files
- E2E tests: Playwright in `/tests` directory
- Run specific test: `yarn test path/to/test.spec.ts`
- Coverage: `yarn test --coverage`

### Production Deployment

**For production deployment instructions, see [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)**

Key points:
- Use `PUBLIC_PATH=/` to avoid CDN dependencies
- Run backend server separately
- Use production server with API proxy for static deployment

## REST API Architecture on BlockSuite/Yjs

### Overview

AFFiNE implements REST APIs on top of BlockSuite/Yjs using a layered architecture that preserves CRDT collaboration benefits while providing traditional HTTP endpoints.

### Architecture Layers

1. **REST Controllers** → 2. **Storage Adapters** → 3. **Yjs Document Handling** → 4. **Database Storage**

### Key Components

#### REST Endpoints

- `WorkspacesController` (`/api/workspaces`):
  - `GET /api/workspaces/:id/docs/:guid` - Retrieve document binary
  - `POST /api/workspaces/:id/docs` - Create new documents
  - `PUT /api/workspaces/:id/docs/:guid` - Update documents
  - `POST /api/workspaces/:id/docs/from-meeting` - Create meeting notes
- `TagController` - Workspace tag management

#### Document Serialization

```typescript
// Binary serialization (stored format)
Y.encodeStateAsUpdate(ydoc); // → Uint8Array
// Deserialization
Y.applyUpdate(ydoc, binaryData);
```

#### Storage Adapter Pattern

`PgWorkspaceDocStorageAdapter` provides:

- `pushDocUpdates()` - Store Yjs updates
- `getDoc()` - Retrieve and merge updates
- Snapshot management for performance

#### Document Reader Pattern

- `DocReader` abstract class
- `DatabaseDocReader` - Direct DB access
- Content parsing and Markdown conversion

### Implementation Patterns

1. **Update-based Storage**: Stores individual Yjs updates + periodic snapshots
2. **Binary Data Flow**: All documents handled as `Uint8Array`/`Buffer`
3. **Permission Integration**: All endpoints check access control
4. **Event-driven Processing**: Document operations emit events

### Special Features

- **Meeting Note Generator**: Creates structured Yjs documents with mindmap visualizations
- **Tag Management**: Tags stored in workspace Yjs document (`meta.properties.tags.options`)
- **Content Parsing**: BlockSuite utilities for title extraction and Markdown conversion

### Key Insights

- No direct BlockSuite imports in REST layer
- Binary-first approach maintains CRDT compatibility
- Separation of HTTP concerns from document operations
- Performance optimized with caching and queued processing

## Core Features

### Document & Editor
- **Block-based editing**: Rich text, tables, code, embeds, etc.
- **Whiteboard/Canvas**: Edgeless mode for free-form content
- **Real-time collaboration**: Yjs/CRDT for conflict-free editing
- **Local-first**: All data stored locally with optional sync

### AI Integration
- **Copilot features**: AI-powered assistance
- **Multiple providers**: OpenAI, Anthropic, etc.
- **Content generation**: AI-powered search and writing
- **Transcription**: Audio/video to text

### Organization
- **Collections**: Folder-like organization
- **Tags**: Flexible tagging system
- **Comments**: Document commenting
- **Sharing**: Public and private sharing options

### Platform Support
- **Web**: Full-featured web app
- **Desktop**: Electron app with native features
- **Mobile**: iOS/Android via Capacitor
- **Self-hosting**: Complete deployment support

## Important Fixes and Solutions

### TypeScript Composite Configuration
All tsconfig.json files in project references must have `"composite": true`:
```bash
# After modifying tsconfig files, clear TypeScript cache:
yarn affine clean
yarn install
```

### Reader Package DI Container Fix
The `@affine/reader` package requires proper DI initialization:
```typescript
// WRONG - causes "Cannot read properties of undefined (reading 'container')"
const extensions = getStoreManager().get('store');

// CORRECT - properly initializes the container
const extensions = getStoreManager().config.init().value.get('store');
extensions.forEach(ext => {
  ext.setup(container);
});
```

### Production Build Configuration
For true production builds without debug logs:
```bash
# Build with all optimizations
NODE_ENV=production PUBLIC_PATH=/ BUILD_TYPE=canary yarn affine web build

# Run production server
yarn serve:prod  # Uses production-server.js from packages/frontend/apps/web/
```

Webpack configuration automatically removes console logs in production:
- `drop_console: true` - Removes all console.* calls
- `drop_debugger: true` - Removes debugger statements
- `pure_funcs: ['console.log', 'console.debug', 'console.warn']` - Additional cleanup

### Known Issues and Solutions

#### 1. ESLint Pre-commit Hook Failures
Many existing files have ESLint violations. Solutions:
- Use `git commit --no-verify` when necessary
- Run `yarn lint:fix` to auto-fix issues
- Fix specific issues manually

#### 2. Memory Issues During Build
```bash
# Increase Node memory for large builds
NODE_OPTIONS="--max-old-space-size=8192" yarn build
```

#### 3. Native Module Build Required
Always build native modules after fresh clone:
```bash
yarn affine @affine/native build
yarn affine @affine/server-native build
yarn affine init
```

#### 4. Production Server Setup
The `production-server.js` must be in `packages/frontend/apps/web/` (NOT in dist/):
- Serves static files from `dist/` subdirectory
- Proxies `/api/*`, `/graphql`, `/socket.io/*` to backend
- Supports SPA routing with index.html fallback
- Configurable via environment variables:
  - `PORT` (default: 8080)
  - `BACKEND_URL` (default: http://localhost:3010)
  - `LOG_LEVEL` (error/info/debug)

### Build Troubleshooting

#### Clean Build Process
```bash
# Complete clean build
yarn affine clean
yarn install
yarn affine @affine/native build
yarn affine @affine/server-native build
yarn affine init
NODE_ENV=production PUBLIC_PATH=/ BUILD_TYPE=canary yarn affine web build
```

#### Verify Production Build
- Check browser console - should have NO debug logs
- Check network tab - assets should load from local paths (not CDN)
- Check bundle size - should be optimized and minified

### Architecture Insights

#### Dependency Injection (DI) Pattern
AFFiNE uses a custom DI system throughout:
- Services registered in Container
- Provider pattern for dependency resolution
- Extensions must be properly initialized with `config.init()`

#### Local-First Storage
- NBStore handles local storage with multiple backends
- IDB (IndexedDB) for web
- SQLite for desktop/mobile
- Cloud sync as optional layer

#### Yjs/CRDT Integration
- All documents stored as Yjs binary updates
- Snapshots created periodically for performance
- REST APIs work with binary data, not BlockSuite objects directly
