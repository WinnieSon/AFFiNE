# TypeScript and Build Issues Documentation

This document catalogs all TypeScript and build-related issues encountered in the AFFiNE codebase and their solutions.

## TypeScript Configuration Issues

### 1. Composite Project References Error

**Error**: `Referenced project must have setting "composite": true`

**Cause**: TypeScript project references require the `composite` flag for incremental builds.

**Solution**: 
```typescript
// In every referenced tsconfig.json, add:
{
  "compilerOptions": {
    "composite": true,
    // ... other options
  }
}
```

**Fixed Files** (81 total):
- All files in `blocksuite/affine/*/tsconfig.json`
- All files in `packages/common/*/tsconfig.json`
- All files in `tools/*/tsconfig.json`

### 2. TypeScript Target Library Errors

**Errors**:
- `Property 'findLast' does not exist on type. Try changing 'lib' to 'es2023' or later`
- `Property 'withResolvers' does not exist. Try changing 'lib' to 'es2024' or later`
- `Property 'toSorted' does not exist. Try changing 'lib' to 'es2023' or later`

**Cause**: Using newer JavaScript features without proper TypeScript lib configuration.

**Solution**: Update tsconfig.json to include newer ES libraries:
```json
{
  "compilerOptions": {
    "lib": ["es2024", "dom", "dom.iterable"]
  }
}
```

### 3. Unused @ts-expect-error Directives

**Error**: `Unused '@ts-expect-error' directive`

**Cause**: TypeScript improvements made the error suppression unnecessary.

**Solution**: Remove the `@ts-expect-error` comments or update the code.

## Build Configuration Issues

### 1. Debug Logs in Production

**Problem**: Console logs appearing in production builds.

**Root Causes**:
1. `BUILD_CONFIG.debug` was checking `buildFlags.mode === 'development'`
2. NODE_ENV not properly set during build
3. Webpack Terser not configured to drop console

**Solutions Applied**:

1. **Webpack Terser Configuration** (`tools/cli/src/webpack/index.ts`):
```javascript
terserOptions: {
  compress: {
    unused: true,
    drop_console: !buildConfig.debug,
    drop_debugger: !buildConfig.debug,
    pure_funcs: !buildConfig.debug ? ['console.log', 'console.debug', 'console.warn'] : []
  }
}
```

2. **Debug Package Update** (`packages/common/debug/src/index.ts`):
```typescript
// Disable all debug logs in production unless explicitly enabled
if (process.env.NODE_ENV === 'production' && !sessionStorage.getItem(SESSION_KEY)) {
  debug.disable();
}
```

3. **Build Command**:
```bash
NODE_ENV=production PUBLIC_PATH=/ BUILD_TYPE=canary yarn affine web build
```

### 2. Production Server Missing

**Problem**: `production-server.js` deleted on each build.

**Cause**: File was in `dist/` directory which gets cleaned.

**Solution**: Move to parent directory `packages/frontend/apps/web/production-server.js`

### 3. Public Path / CDN Issues

**Problem**: Assets trying to load from CDN instead of local server.

**Cause**: Default PUBLIC_PATH points to CDN.

**Solution**: Always build with `PUBLIC_PATH=/`:
```bash
PUBLIC_PATH=/ yarn affine web build
```

## Dependency Issues

### 1. Reader Package DI Container

**Error**: `TypeError: Cannot read properties of undefined (reading 'container')`

**Location**: `packages/common/reader/src/reader.ts`

**Root Cause**: Incorrect initialization of BlockSuite store extensions.

**Wrong Code**:
```typescript
const extensions = getStoreManager().get('store');
```

**Fixed Code**:
```typescript
const extensions = getStoreManager().config.init().value.get('store');
extensions.forEach(ext => {
  ext.setup(container);
});
```

### 2. Native Module Build Order

**Problem**: Build failures due to missing native modules.

**Cause**: Native modules must be built before other packages.

**Solution**: Always build in this order:
```bash
yarn affine @affine/native build
yarn affine @affine/server-native build
yarn affine init
```

## Memory and Performance Issues

### 1. Build Memory Exhaustion

**Error**: `JavaScript heap out of memory`

**Solutions**:
1. Increase Node memory:
```bash
NODE_OPTIONS="--max-old-space-size=8192" yarn build
```

2. Clean build:
```bash
yarn affine clean
rm -rf node_modules/.cache
```

### 2. ESLint Timeout

**Problem**: ESLint hanging or timing out.

**Causes**:
- Large codebase
- Many files to lint
- Complex rules

**Solutions**:
1. Run on specific packages:
```bash
yarn workspace @affine/core lint
```

2. Use `--no-verify` for commits:
```bash
git commit --no-verify -m "message"
```

## Bundle Size Issues

### Large Assets Warning

**Files exceeding 244 KiB**:
- Fonts: Inter, Kalam, SourceSerif4
- Images: screenshots, GIFs
- JavaScript: index.js (7.15 MiB), vendor bundles

**Potential Solutions**:
1. Font optimization: Use subset fonts
2. Image optimization: Compress, use WebP
3. Code splitting: Lazy load features
4. Tree shaking: Remove unused code

## Build Process Best Practices

### 1. Clean Build Sequence
```bash
# 1. Clean everything
yarn affine clean

# 2. Install dependencies
yarn install

# 3. Build native modules
yarn affine @affine/native build
yarn affine @affine/server-native build

# 4. Initialize
yarn affine init

# 5. Build for production
NODE_ENV=production PUBLIC_PATH=/ BUILD_TYPE=canary yarn affine web build
```

### 2. Verify Production Build
- No console logs in browser
- Assets load from local paths
- Bundle is minified
- Source maps generated (but not exposed)

### 3. Environment Variables
Always set for production:
- `NODE_ENV=production`
- `PUBLIC_PATH=/`
- `BUILD_TYPE=canary` (or beta/stable)

## Debugging Build Issues

### 1. Check Webpack Config
```bash
# See actual webpack config
NODE_ENV=production yarn affine web build --verbose
```

### 2. Analyze Bundle
```bash
# Use webpack-bundle-analyzer
yarn affine web build --analyze
```

### 3. Check TypeScript Errors
```bash
# Full typecheck
yarn typecheck

# Specific package
yarn workspace @affine/core tsc --noEmit
```

## Future Improvements

1. **Webpack Persistent Cache**: Enable for faster rebuilds
2. **SWC Instead of Babel**: Already using for minification
3. **Module Federation**: For micro-frontend architecture
4. **Turborepo**: For better monorepo caching

## Quick Reference

### Common Commands
```bash
# Development
yarn dev

# Production build
yarn build:prod

# Clean everything
yarn affine clean

# Type check
yarn typecheck

# Lint
yarn lint
yarn lint:fix

# Serve production
yarn serve:prod
```

### Critical Files
- `tools/cli/src/webpack/index.ts` - Webpack configuration
- `tools/utils/src/build-config.ts` - Build flags configuration
- `packages/common/debug/src/index.ts` - Debug logging control
- `packages/common/reader/src/reader.ts` - DI container initialization

This document will be updated as new issues are discovered and resolved.