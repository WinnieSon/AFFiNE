# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AFFiNE is an open-source, all-in-one workspace and knowledge management platform. It's a privacy-focused, local-first alternative to Notion & Miro built as a monorepo using Yarn workspaces.

**Tech Stack:**

- Frontend: React 19, TypeScript, Vite, Jotai, Emotion
- Backend: NestJS, GraphQL, Prisma, Redis
- Editor: BlockSuite (custom block-based editor framework)
- Native: Rust modules via NAPI-rs
- Platforms: Web, Desktop (Electron), Mobile (Capacitor)

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

- dev@affine.pro / dev (regular user)
- pro@affine.pro / pro (pro user)
- team@affine.pro / team (team user)

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
3. **State Management**:
   - Jotai for UI state
   - LiveData pattern for reactive data
   - Yjs for document collaboration
   - NBStore for local-first storage
4. **Editor Integration**: BlockSuite provides block-based editing with CRDT collaboration
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
