# AFFiNE REST API Documentation

This document is automatically generated from the AFFiNE server controllers.

## Table of Contents

- [Captcha](#captcha)
- [Auth](#auth)
- [UserAvatar](#useravatar)
- [Copilot](#copilot)
- [OAuth](#oauth)
- [CustomSetup](#customsetup)
- [StripeWebhook](#stripewebhook)
- [License](#license)
- [Worker](#worker)
- [Workspaces](#workspaces)
- [App](#app)
- [DocRpc](#docrpc)
- [DocRenderer](#docrenderer)

## Authentication

Most endpoints require authentication. Use one of the following methods:

1. **Bearer Token**: Include in the Authorization header

   ```
   Authorization: Bearer YOUR_AUTH_TOKEN
   ```

2. **Cookie**: Session cookie from login

## Captcha

### Get

**Endpoint:** `GET /api/auth/challenge`

**Source:** `packages/backend/server/src/plugins/captcha/controller.ts`

---

## Auth

### Post

**Endpoint:** `POST /api/auth/magic-link`

**Parameters:**

- `body` (Body)

**Source:** `packages/backend/server/src/core/auth/controller.ts`

---

### Post

**Endpoint:** `POST /api/auth/preflight`

**Parameters:**

- `body` (Body)

**Source:** `packages/backend/server/src/core/auth/controller.ts`

---

### Get

**Endpoint:** `GET /api/auth/session`

**Source:** `packages/backend/server/src/core/auth/controller.ts`

---

### Get

**Endpoint:** `GET /api/auth/sessions`

**Source:** `packages/backend/server/src/core/auth/controller.ts`

---

### Post

**Endpoint:** `POST /api/auth/sign-in`

**Parameters:**

- `body` (Body)
- `redirect_uri` (Query)

**Source:** `packages/backend/server/src/core/auth/controller.ts`

---

### Get

**Endpoint:** `GET /api/auth/sign-out`

**Parameters:**

- `user_id` (Query)

**Source:** `packages/backend/server/src/core/auth/controller.ts`

---

## UserAvatar

### Get

**Endpoint:** `GET /api/avatars/:id`

**Parameters:**

- `id` (Param)

**Source:** `packages/backend/server/src/core/user/controller.ts`

---

## Copilot

### Get

**Endpoint:** `GET /api/copilot/blob/:userId/:workspaceId/:key`

**Parameters:**

- `userId` (Param)
- `workspaceId` (Param)
- `key` (Param)

**Source:** `packages/backend/server/src/plugins/copilot/controller.ts`

---

### Get

**Endpoint:** `GET /api/copilot/chat/:sessionId`

**Source:** `packages/backend/server/src/plugins/copilot/controller.ts`

---

### Get

**Endpoint:** `GET /api/copilot/unsplash/photos`

**Parameters:**

- `body` (Query)

**Source:** `packages/backend/server/src/plugins/copilot/controller.ts`

---

## OAuth

### Post

**Endpoint:** `POST /api/oauth/callback`

**Parameters:**

- `code` (Body)
- `state` (Body)
- `client_nonce` (Body)

**Source:** `packages/backend/server/src/plugins/oauth/controller.ts`

---

### Post

**Endpoint:** `POST /api/oauth/preflight`

**Parameters:**

- `provider` (Body)
- `redirect_uri` (Body)
- `client` (Body)
- `client_nonce` (Body)

**Source:** `packages/backend/server/src/plugins/oauth/controller.ts`

---

## CustomSetup

### Post

**Endpoint:** `POST /api/setup/create-admin-user`

**Parameters:**

- `body` (Body)

**Source:** `packages/backend/server/src/core/selfhost/controller.ts`

---

## StripeWebhook

### Post

**Endpoint:** `POST /api/stripe/webhook`

**Source:** `packages/backend/server/src/plugins/payment/controller.ts`

---

## License

### Post

**Endpoint:** `POST /api/team/licenses/:license/activate`

**Parameters:**

- `license` (Param)

**Source:** `packages/backend/server/src/plugins/payment/license/controller.ts`

---

### Post

**Endpoint:** `POST /api/team/licenses/:license/create-customer-portal`

**Parameters:**

- `license` (Param)

**Source:** `packages/backend/server/src/plugins/payment/license/controller.ts`

---

### Post

**Endpoint:** `POST /api/team/licenses/:license/deactivate`

**Parameters:**

- `license` (Param)

**Source:** `packages/backend/server/src/plugins/payment/license/controller.ts`

---

### Get

**Endpoint:** `GET /api/team/licenses/:license/health`

**Parameters:**

- `license` (Param)
- `x-validate-key` (Headers)

**Source:** `packages/backend/server/src/plugins/payment/license/controller.ts`

---

### Post

**Endpoint:** `POST /api/team/licenses/:license/recurring`

**Parameters:**

- `license` (Param)
- `body` (Body)

**Source:** `packages/backend/server/src/plugins/payment/license/controller.ts`

---

### Post

**Endpoint:** `POST /api/team/licenses/:license/seats`

**Parameters:**

- `license` (Param)
- `body` (Body)

**Source:** `packages/backend/server/src/plugins/payment/license/controller.ts`

---

## Worker

### Get

**Endpoint:** `GET /api/worker/image-proxy`

**Source:** `packages/backend/server/src/plugins/worker/controller.ts`

---

### Options

**Endpoint:** `OPTIONS /api/worker/link-preview`

**Source:** `packages/backend/server/src/plugins/worker/controller.ts`

---

### Post

**Endpoint:** `POST /api/worker/link-preview`

**Source:** `packages/backend/server/src/plugins/worker/controller.ts`

---

## Workspaces

### Get

**Endpoint:** `GET /api/workspaces/:id/blobs/:name`

**Parameters:**

- `id` (Param)
- `name` (Param)
- `redirect` (Query)

**Source:** `packages/backend/server/src/core/workspaces/controller.ts`

---

### Post

**Endpoint:** `POST /api/workspaces/:id/docs`

**Parameters:**

- `id` (Param)
- `body` (Body)

**Source:** `packages/backend/server/src/core/workspaces/controller.ts`

---

### Get

**Endpoint:** `GET /api/workspaces/:id/docs/:docId/comment-attachments/:key`

**Parameters:**

- `id` (Param)
- `docId` (Param)
- `key` (Param)

**Source:** `packages/backend/server/src/core/workspaces/controller.ts`

---

### Get

**Endpoint:** `GET /api/workspaces/:id/docs/:guid`

**Parameters:**

- `id` (Param)
- `guid` (Param)

**Source:** `packages/backend/server/src/core/workspaces/controller.ts`

---

### Put

**Endpoint:** `PUT /api/workspaces/:id/docs/:guid`

**Parameters:**

- `id` (Param)
- `guid` (Param)
- `body` (Body)

**Source:** `packages/backend/server/src/core/workspaces/controller.ts`

---

### Get

**Endpoint:** `GET /api/workspaces/:id/docs/:guid/histories/:timestamp`

**Parameters:**

- `id` (Param)
- `guid` (Param)
- `timestamp` (Param)

**Source:** `packages/backend/server/src/core/workspaces/controller.ts`

---

## App

### Get

**Endpoint:** `GET /info`

**Source:** `packages/backend/server/src/app.controller.ts`

---

## DocRpc

### Get

**Endpoint:** `GET /rpc/workspaces/:workspaceId/content`

**Parameters:**

- `workspaceId` (Param)

**Source:** `packages/backend/server/src/core/doc-service/controller.ts`

---

### Get

**Endpoint:** `GET /rpc/workspaces/:workspaceId/docs/:docId`

**Parameters:**

- `workspaceId` (Param)
- `docId` (Param)

**Source:** `packages/backend/server/src/core/doc-service/controller.ts`

---

### Get

**Endpoint:** `GET /rpc/workspaces/:workspaceId/docs/:docId/content`

**Parameters:**

- `workspaceId` (Param)
- `docId` (Param)
- `full` (Query)

**Source:** `packages/backend/server/src/core/doc-service/controller.ts`

---

### Post

**Endpoint:** `POST /rpc/workspaces/:workspaceId/docs/:docId/diff`

**Parameters:**

- `workspaceId` (Param)
- `docId` (Param)

**Source:** `packages/backend/server/src/core/doc-service/controller.ts`

---

### Get

**Endpoint:** `GET /rpc/workspaces/:workspaceId/docs/:docId/markdown`

**Parameters:**

- `workspaceId` (Param)
- `docId` (Param)
- `aiEditable` (Query)

**Source:** `packages/backend/server/src/core/doc-service/controller.ts`

---

## DocRenderer

### Get

**Endpoint:** `GET /workspace/*path`

**Source:** `packages/backend/server/src/core/doc-renderer/controller.ts`

---

## Common Response Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid request
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error
