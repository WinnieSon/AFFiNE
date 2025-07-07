# Document Handler Scripts

This folder contains Node.js scripts for managing AFFiNE documents via REST API.

## Scripts Overview

### Document Creation

- `create-document-minimal.js` - Creates minimal documents without surface blocks
- `create-happy-document.js` - Creates documents with Korean content
- `create-table-document.js` - Creates documents with table structures (exports reusable functions)

### Document Management

- `delete-all-documents.js` - Removes all documents from a workspace
- `read-document-content.js` - Reads and displays document content
- `analyze-table-structure.js` - Analyzes table block structures in documents

### Workspace Management

- `initialize-fresh-workspace.js` - Resets workspace to clean state

### API Documentation

- `generate-rest-api-docs.js` - Generates REST API documentation
- `generate-detailed-rest-api-docs.js` - Generates detailed API documentation

### Legacy/Test Scripts

Various other scripts for testing and development purposes.

## Usage

All scripts use the same configuration:

- Server: `http://localhost:3010`
- Credentials: `pro@affine.pro / pro`
- Workspace ID: `49086e68-e27d-409a-9940-abb4d5d3802d`

Example:

```bash
node doc-handler/create-table-document.js
```

## Key Functions Exported

From `create-table-document.js`:

- `createTableBlock(tableId, columns, rows, data)` - Creates table structure
- `generateUniqueId(length)` - Generates unique IDs
- `generateOrderString(index)` - Creates ordering strings
