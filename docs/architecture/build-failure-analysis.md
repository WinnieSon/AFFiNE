# Production Build Failure Analysis

## Overview
This document analyzes potential causes of production build failures in the AFFiNE monorepo based on the codebase structure and recent changes.

## Recent Changes That May Impact Builds

### 1. TypeScript Composite Configuration (Commit: f434ba767)
All TypeScript projects now have `composite: true` added to their tsconfig.json files. This change affects:
- All BlockSuite packages
- Frontend and backend packages
- Requires proper project reference configuration

**Potential Issues:**
- Missing `tsBuildInfoFile` in some configs
- Incorrect reference paths
- Incremental compilation cache conflicts

### 2. Native Module Updates (Commit: 45d5e4533)
Updates to dependencies and native module types may cause:
- Binary compatibility issues
- Missing type definitions
- Platform-specific build failures

## Common Build Failure Scenarios

### 1. Native Module Build Failures

**Symptoms:**
- "Cannot find module '@affine/native'"
- "Cannot find module '@affine/server-native'"
- Missing .node files

**Solutions:**
```bash
# Rebuild native modules
yarn affine @affine/native build
yarn affine @affine/server-native build

# For clean rebuild
rm -rf packages/frontend/native/dist
rm -rf packages/backend/native/dist
yarn affine @affine/native build
yarn affine @affine/server-native build
```

### 2. Worker File Resolution

**Issue:** The build expects these worker files:
- `workspace-profile.worker.ts`
- `pdf.worker.ts`
- `turbo-painter.worker.ts`
- `nbstore.worker.ts`

**Verification:**
All worker files exist in their expected locations.

### 3. TypeScript Compilation Errors

**Common Issues:**
- Project reference cycles
- Missing type definitions
- Incompatible TypeScript versions

**Debug Commands:**
```bash
# Full typecheck
yarn typecheck

# Check specific package
cd packages/frontend/core && npx tsc --noEmit

# Clean TypeScript cache
find . -name "tsconfig.tsbuildinfo" -delete
find . -name "*.tsbuildinfo" -delete
```

### 4. Webpack Configuration Issues

**Key Configuration Points:**
- `PUBLIC_PATH` must be set to `/` for production
- `BUILD_TYPE` must be valid (canary, beta, stable, internal)
- Worker entries must be correctly configured

**Debug Build:**
```bash
# Verbose webpack build
PUBLIC_PATH=/ BUILD_TYPE=canary NODE_OPTIONS="--max-old-space-size=8192" yarn affine web build
```

### 5. Memory Issues

**Symptoms:**
- "JavaScript heap out of memory"
- Build process killed

**Solutions:**
```bash
# Increase memory limit
export NODE_OPTIONS="--max-old-space-size=8192"

# Or inline
NODE_OPTIONS="--max-old-space-size=8192" yarn build
```

## Recommended Build Process

### Clean Build Steps

```bash
# 1. Clean everything
yarn affine clean
rm -rf node_modules
rm -rf packages/*/node_modules
rm -rf packages/*/*/node_modules
find . -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "*.tsbuildinfo" -delete

# 2. Fresh install
yarn install

# 3. Build native modules
yarn affine @affine/native build
yarn affine @affine/server-native build

# 4. Initialize
yarn affine init

# 5. Type check
yarn typecheck

# 6. Production build
PUBLIC_PATH=/ BUILD_TYPE=canary NODE_OPTIONS="--max-old-space-size=8192" yarn affine web build
```

### CI/CD Considerations

```yaml
# Example CI steps
- name: Setup
  run: |
    corepack enable
    corepack prepare yarn@stable --activate
    
- name: Install
  run: yarn install --immutable
  
- name: Build Native
  run: |
    yarn affine @affine/native build
    yarn affine @affine/server-native build
    
- name: Initialize
  run: yarn affine init
  
- name: Build
  env:
    NODE_OPTIONS: "--max-old-space-size=8192"
    PUBLIC_PATH: "/"
    BUILD_TYPE: "canary"
  run: yarn affine web build
```

## Debugging Checklist

- [ ] Native modules built successfully
- [ ] All worker files exist
- [ ] TypeScript compilation passes
- [ ] PUBLIC_PATH environment variable set
- [ ] BUILD_TYPE environment variable valid
- [ ] Sufficient memory allocated
- [ ] No conflicting node_modules
- [ ] Clean dist directories
- [ ] Webpack cache cleared
- [ ] All project references valid

## Emergency Fixes

### Quick Fix Script
```bash
#!/bin/bash
# emergency-build-fix.sh

echo "Emergency build fix starting..."

# Clean
find . -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "*.tsbuildinfo" -delete
rm -rf .yarn/cache
rm -rf .yarn/install-state.gz

# Reinstall
yarn install

# Rebuild natives
yarn affine @affine/native build
yarn affine @affine/server-native build

# Initialize
yarn affine init

# Build with increased memory
NODE_OPTIONS="--max-old-space-size=16384" PUBLIC_PATH=/ BUILD_TYPE=canary yarn affine web build
```

## Monitoring Build Health

### Key Metrics
- Build time (should be < 10 minutes)
- Memory usage (peak < 8GB)
- Bundle size (check for unexpected increases)
- TypeScript errors (should be 0)

### Health Check Commands
```bash
# Check workspace integrity
yarn workspaces list

# Verify dependencies
yarn dedupe --check

# Analyze bundle
yarn affine web build --analyze
```