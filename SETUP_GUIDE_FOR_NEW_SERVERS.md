# AFFiNE Setup Guide for New Servers

This guide provides step-by-step instructions for setting up AFFiNE on a new server after pulling the latest code.

## Prerequisites

- Node.js v18+ (but < v23)
- Yarn 4.x (Berry)
- Docker (for backend services)
- Rust (for native modules)
- 16GB+ RAM recommended
- 50GB+ free disk space

## Quick Setup Script

```bash
#!/bin/bash
# Save this as setup-affine.sh

# 1. Enable Yarn Berry
corepack enable
corepack prepare yarn@stable --activate

# 2. Install dependencies
yarn install

# 3. Build native modules (MUST do this first!)
yarn affine @affine/native build
yarn affine @affine/server-native build

# 4. Initialize project
yarn affine init

# 5. Setup Docker services (if running backend)
cp ./.docker/dev/compose.yml.example ./.docker/dev/compose.yml
cp ./.docker/dev/.env.example ./.docker/dev/.env
docker compose -f ./.docker/dev/compose.yml up -d

# 6. Setup backend server config
cp packages/backend/server/.env.example packages/backend/server/.env
yarn affine server init

echo "✅ AFFiNE setup complete!"
```

## Detailed Setup Steps

### 1. Clone and Install Dependencies

```bash
# Clone repository
git clone https://github.com/toeverything/AFFiNE.git
cd AFFiNE

# Enable Yarn 4.x
corepack enable
corepack prepare yarn@stable --activate

# Install all dependencies
yarn install
```

### 2. Build Native Modules (Critical!)

**⚠️ IMPORTANT**: Native modules MUST be built before anything else!

```bash
# Build frontend native module
yarn affine @affine/native build

# Build server native module
yarn affine @affine/server-native build

# Initialize the project
yarn affine init
```

### 3. Development Setup

#### Frontend Only
```bash
# Start frontend dev server
yarn dev

# Access at http://localhost:8080
```

#### Full Stack (Frontend + Backend)

```bash
# 1. Setup Docker services
cp ./.docker/dev/compose.yml.example ./.docker/dev/compose.yml
cp ./.docker/dev/.env.example ./.docker/dev/.env
docker compose -f ./.docker/dev/compose.yml up -d

# 2. Configure backend
cp packages/backend/server/.env.example packages/backend/server/.env
yarn affine server init

# 3. Start backend server (separate terminal)
yarn affine server dev

# 4. Start frontend (separate terminal)
yarn dev
```

### 4. Production Build

```bash
# Clean build for production
NODE_ENV=production PUBLIC_PATH=/ BUILD_TYPE=canary yarn affine web build

# The build output will be in packages/frontend/apps/web/dist/
```

### 5. Production Deployment

```bash
# 1. Run backend server
yarn affine server dev  # or use PM2/systemd for production

# 2. Run production server
cd packages/frontend/apps/web
node production-server.js

# Access at http://localhost:8080
```

## Common Issues and Solutions

### Issue 1: TypeScript Errors
```bash
# If you see "composite": true errors
# All tsconfig files have been updated, just rebuild:
yarn affine clean
yarn install
```

### Issue 2: Reader Package Errors
If you see: `TypeError: Cannot read properties of undefined (reading 'container')`

This has been fixed in the code. Just rebuild:
```bash
yarn workspace @affine/reader build
```

### Issue 3: Memory Errors During Build
```bash
# Increase Node memory
NODE_OPTIONS="--max-old-space-size=8192" yarn build
```

### Issue 4: Native Module Build Failures
```bash
# Ensure Rust is installed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Clean and rebuild
yarn affine clean
yarn affine @affine/native build
yarn affine @affine/server-native build
```

### Issue 5: Docker Services Not Starting
```bash
# Check Docker is running
docker ps

# Check logs
docker compose -f ./.docker/dev/compose.yml logs

# Restart services
docker compose -f ./.docker/dev/compose.yml down
docker compose -f ./.docker/dev/compose.yml up -d
```

## Environment Variables

### Frontend Build
- `NODE_ENV=production` - Enable production optimizations
- `PUBLIC_PATH=/` - Use local paths (not CDN)
- `BUILD_TYPE=canary` - Build channel (canary/beta/stable)

### Backend Server
- Check `packages/backend/server/.env` for configuration
- Key settings: Database URL, Redis URL, Email config

### Production Server
- `PORT=8080` - Server port
- `BACKEND_URL=http://localhost:3010` - Backend API URL
- `LOG_LEVEL=error` - Logging level (error/info/debug)

## Verification Steps

1. **Check Frontend**: http://localhost:8080
2. **Check Backend**: http://localhost:3010/graphql
3. **Check WebSocket**: Look for socket.io connections in browser DevTools
4. **Check Database**: Use `yarn affine server prisma studio`

## Production Checklist

- [ ] Native modules built successfully
- [ ] TypeScript compilation passes
- [ ] Production build completes without errors
- [ ] No console.log statements in browser (production mode)
- [ ] Assets load from local server (not CDN)
- [ ] Backend API responds correctly
- [ ] WebSocket connections work
- [ ] Database migrations applied

## Support

- GitHub Issues: https://github.com/toeverything/AFFiNE/issues
- Discord: https://discord.gg/affine
- Documentation: https://docs.affine.pro

## Notes for CI/CD

For automated deployments:
```yaml
# Example GitHub Actions workflow
- name: Setup
  run: |
    corepack enable
    yarn install
    
- name: Build Native
  run: |
    yarn affine @affine/native build
    yarn affine @affine/server-native build
    
- name: Build Production
  run: |
    NODE_ENV=production PUBLIC_PATH=/ BUILD_TYPE=canary yarn affine web build
    
- name: Deploy
  run: |
    # Copy dist/ to your server
    # Run production-server.js with PM2
```

Remember: Always build native modules first!