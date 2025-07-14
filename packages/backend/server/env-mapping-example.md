# AFFiNE Backend Environment Variable Mapping

## How Environment Variables Map to Configuration

Based on my analysis of the AFFiNE backend configuration system, here's how environment variables are mapped to configuration values:

### 1. Configuration System Overview

The configuration system uses a hierarchical structure where:
- Module configs are defined using `defineModuleConfig(moduleName, { ... })`
- Each configuration key can have an associated environment variable
- Environment variables are parsed based on their declared type

### 2. Environment Variable Declaration

Environment variables are declared in the config definition using the `env` property, which can be:
- A simple string: `env: 'AFFINE_PRIVATE_KEY'` (defaults to string type)
- A tuple with type: `env: ['AFFINE_INDEXER_ENABLED', 'boolean']`

### 3. Mapping Pattern

The environment variable naming convention would follow this pattern:
- Module: `oauth`
- Nested path: `providers.google.clientId`
- Environment variable: `AFFINE_OAUTH_PROVIDERS_GOOGLE_CLIENT_ID`

However, **the OAuth config currently doesn't have environment variable mappings defined**.

### 4. How It Works

From `/packages/backend/server/src/base/config/register.ts`:

```typescript
// In getDefaultConfig() function:
for (const [module, defs] of Object.entries(APP_CONFIG_DESCRIPTORS)) {
  for (const [key, desc] of Object.entries(defs)) {
    let defaultValue = desc.default;
    
    if (desc.env) {
      const [env, parser] = desc.env;
      const envValue = envs[env];
      if (envValue) {
        defaultValue = parseEnvValue(envValue, parser);
      }
    }
    // ... validation and setting
  }
}
```

### 5. Current OAuth Configuration

The OAuth configuration in `/packages/backend/server/src/plugins/oauth/config.ts` doesn't define environment variables:

```typescript
defineModuleConfig('oauth', {
  'providers.google': {
    desc: 'Google OAuth provider config',
    default: {
      clientId: '',
      clientSecret: '',
    },
    schema,
    // NO env property defined!
  },
  // ... other providers
});
```

### 6. To Enable Environment Variable Mapping for OAuth

To make `AFFINE_OAUTH_PROVIDERS_GOOGLE_CLIENT_ID` work, the OAuth config would need to be updated:

```typescript
defineModuleConfig('oauth', {
  'providers.google.clientId': {
    desc: 'Google OAuth client ID',
    default: '',
    env: 'AFFINE_OAUTH_PROVIDERS_GOOGLE_CLIENT_ID',
  },
  'providers.google.clientSecret': {
    desc: 'Google OAuth client secret',
    default: '',
    env: 'AFFINE_OAUTH_PROVIDERS_GOOGLE_CLIENT_SECRET',
  },
  // ... repeat for other providers
});
```

### 7. Examples from Other Modules

Here are working examples of environment variable mappings:

- Simple string:
  ```typescript
  env: 'AFFINE_PRIVATE_KEY'  // crypto.privateKey
  ```

- With type specification:
  ```typescript
  env: ['AFFINE_SERVER_PORT', 'integer']  // server.port
  env: ['AFFINE_INDEXER_ENABLED', 'boolean']  // indexer.enabled
  ```

- Nested configuration:
  ```typescript
  'provider.endpoint': {
    env: ['AFFINE_INDEXER_SEARCH_ENDPOINT', 'string']
  }
  ```

### 8. Type Parsing

The system supports these environment variable types:
- `string`: Direct pass-through
- `integer`: Parsed with `parseInt()`
- `float`: Parsed with `parseFloat()`
- `boolean`: True if value is '1' or 'true' (case-insensitive)

### Conclusion

The environment variable `AFFINE_OAUTH_PROVIDERS_GOOGLE_CLIENT_ID` would map to `oauth.providers.google.clientId` **IF** the OAuth configuration module was updated to include environment variable mappings. Currently, OAuth providers must be configured through:
1. JSON config files
2. Direct configuration overrides
3. Runtime configuration updates

The naming convention for environment variables follows:
`AFFINE_<MODULE>_<NESTED_PATH>` where nested paths use underscores to separate levels.