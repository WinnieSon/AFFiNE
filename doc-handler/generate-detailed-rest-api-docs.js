#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 엔드포인트별 상세 정보
const endpointDetails = {
  'POST /api/workspaces/:id/docs': {
    description: 'Create a new document in a workspace',
    auth: 'Bearer token or session cookie',
    request: {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer YOUR_AUTH_TOKEN',
      },
      body: {
        title: 'Document Title (optional)',
        initialContent:
          '[1, 1, 72, 101, 108, 108, 111] // Yjs update format as array of bytes (optional)',
      },
    },
    response: {
      status: 201,
      body: {
        docId: '550e8400-e29b-41d4-a716-446655440000',
        workspaceId: 'workspace-id',
        createdAt: '2024-01-20T10:30:00Z',
        createdBy: 'user-id',
      },
    },
  },
  'PUT /api/workspaces/:id/docs/:guid': {
    description: 'Update an existing document with Yjs updates',
    auth: 'Bearer token or session cookie',
    request: {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer YOUR_AUTH_TOKEN',
      },
      body: {
        updates: [
          '[1, 1, 72, 101, 108, 108, 111] // First update',
          '[1, 1, 87, 111, 114, 108, 100] // Second update',
        ],
      },
    },
    response: {
      status: 200,
      body: {
        docId: '550e8400-e29b-41d4-a716-446655440000',
        workspaceId: 'workspace-id',
        timestamp: 1705751400000,
        updatedBy: 'user-id',
      },
    },
  },
  'GET /api/workspaces/:id/docs/:guid': {
    description: 'Read document content',
    auth: 'Bearer token or session cookie',
    response: {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: 'Binary Yjs document data',
    },
  },
};

// Controller 파일에서 라우트 정보 추출
function extractRoutesFromController(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const routes = [];

  // Controller 클래스 이름 찾기
  const controllerMatch = content.match(
    /@Controller\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/
  );
  const basePath = controllerMatch ? controllerMatch[1] : '';

  // 클래스 이름 찾기
  const classMatch = content.match(/export\s+class\s+(\w+)Controller/);
  const className = classMatch ? classMatch[1] : 'Unknown';

  // HTTP 메서드 데코레이터 찾기
  const methodRegex =
    /@(Get|Post|Put|Delete|Patch|Head|Options)\s*\(\s*(['"`]([^'"`]*)['"`])?\s*\)/g;

  let match;
  while ((match = methodRegex.exec(content)) !== null) {
    const httpMethod = match[1].toUpperCase();
    const routePath = match[3] || '';

    // 메서드 이름 찾기
    const position = match.index;
    const afterDecorator = content.substring(position);
    const methodMatch = afterDecorator.match(/\s+async\s+(\w+)|(\w+)\s*\(/);
    const methodName = methodMatch
      ? methodMatch[1] || methodMatch[2]
      : 'unknown';

    // Guard 데코레이터 찾기
    const beforeMethod = content.substring(
      Math.max(0, position - 500),
      position
    );
    const useGuardsMatch = beforeMethod.match(/@UseGuards\s*\(([^)]+)\)/);
    const guards = useGuardsMatch ? useGuardsMatch[1] : null;

    // 파라미터 찾기
    const paramsRegex =
      /@(Param|Query|Body|Headers|Req|Res)\s*\(\s*(['"`]([^'"`]+)['"`])?\s*\)/g;
    const methodEnd = content.indexOf('{', position);
    const methodSignature = content.substring(position, methodEnd);
    const params = [];

    let paramMatch;
    while ((paramMatch = paramsRegex.exec(methodSignature)) !== null) {
      params.push({
        type: paramMatch[1],
        name: paramMatch[3] || paramMatch[1].toLowerCase(),
      });
    }

    const fullPath = basePath + (routePath ? '/' + routePath : '');

    routes.push({
      className,
      method: httpMethod,
      path: fullPath.replace(/\/+/g, '/'),
      methodName,
      guards,
      params,
      filePath: path.relative(__dirname, filePath),
    });
  }

  return routes;
}

// 모든 Controller 파일 찾기
function findControllerFiles(dir) {
  const files = [];

  function walkDir(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        entry.name !== 'node_modules'
      ) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('controller.ts')) {
        files.push(fullPath);
      }
    }
  }

  walkDir(dir);
  return files;
}

// 라우트를 그룹별로 정리
function groupRoutes(routes) {
  const groups = {};

  for (const route of routes) {
    const groupName = route.className.replace(/Controller$/, '');
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(route);
  }

  return groups;
}

// Markdown 문서 생성
function generateMarkdown(groups) {
  let markdown = '# AFFiNE REST API Documentation\n\n';
  markdown +=
    'This document is automatically generated from the AFFiNE server controllers.\n';
  markdown += 'Last updated: ' + new Date().toISOString() + '\n\n';

  markdown += '## Base URL\n\n';
  markdown += 'Development: `http://localhost:3010`\n';
  markdown += 'Production: `https://affine.pro`\n\n';

  markdown += '## Table of Contents\n\n';

  // 목차 생성
  for (const [groupName, routes] of Object.entries(groups)) {
    markdown += `- [${groupName}](#${groupName.toLowerCase().replace(/\s+/g, '-')})\n`;
  }

  markdown += '\n## Authentication\n\n';
  markdown +=
    'Most endpoints require authentication. Use one of the following methods:\n\n';
  markdown += '1. **Bearer Token**: Include in the Authorization header\n';
  markdown += '   ```\n   Authorization: Bearer YOUR_AUTH_TOKEN\n   ```\n\n';
  markdown += '2. **Cookie**: Session cookie from login\n\n';

  // 각 그룹별 문서 생성
  for (const [groupName, routes] of Object.entries(groups)) {
    markdown += `## ${groupName}\n\n`;

    for (const route of routes) {
      const endpointKey = `${route.method} ${route.path}`;
      const details = endpointDetails[endpointKey];

      markdown += `### ${route.methodName}\n\n`;

      if (details && details.description) {
        markdown += `${details.description}\n\n`;
      }

      markdown += `**Endpoint:** \`${route.method} ${route.path}\`\n\n`;

      if (route.guards) {
        markdown += `**Authentication:** Required (${route.guards})\n\n`;
      } else if (details && details.auth) {
        markdown += `**Authentication:** ${details.auth}\n\n`;
      }

      if (route.params.length > 0) {
        markdown += '**Parameters:**\n';
        for (const param of route.params) {
          markdown += `- \`${param.name}\` (${param.type})\n`;
        }
        markdown += '\n';
      }

      // 상세 정보가 있으면 추가
      if (details) {
        if (details.request) {
          markdown += '**Request:**\n';
          if (details.request.headers) {
            markdown += '\nHeaders:\n```json\n';
            markdown += JSON.stringify(details.request.headers, null, 2);
            markdown += '\n```\n';
          }
          if (details.request.body) {
            markdown += '\nBody:\n```json\n';
            markdown += JSON.stringify(details.request.body, null, 2);
            markdown += '\n```\n';
          }
        }

        if (details.response) {
          markdown += '\n**Response:**\n';
          markdown += `\nStatus: ${details.response.status}\n`;
          if (details.response.headers) {
            markdown += '\nHeaders:\n```json\n';
            markdown += JSON.stringify(details.response.headers, null, 2);
            markdown += '\n```\n';
          }
          if (details.response.body) {
            markdown += '\nBody:\n```json\n';
            if (typeof details.response.body === 'string') {
              markdown += details.response.body;
            } else {
              markdown += JSON.stringify(details.response.body, null, 2);
            }
            markdown += '\n```\n';
          }
        }
      }

      markdown += '\n**Source:** `' + route.filePath + '`\n\n';
      markdown += '---\n\n';
    }
  }

  // 일반적인 응답 코드
  markdown += '## Common Response Codes\n\n';
  markdown += '- `200 OK` - Success\n';
  markdown += '- `201 Created` - Resource created\n';
  markdown += '- `400 Bad Request` - Invalid request\n';
  markdown += '- `401 Unauthorized` - Authentication required\n';
  markdown += '- `403 Forbidden` - Insufficient permissions\n';
  markdown += '- `404 Not Found` - Resource not found\n';
  markdown += '- `500 Internal Server Error` - Server error\n\n';

  // Yjs 정보 추가
  markdown += '## Working with Yjs Documents\n\n';
  markdown +=
    'AFFiNE uses Yjs for document collaboration. When creating or updating documents via the REST API, ';
  markdown += 'you need to provide content in Yjs update format.\n\n';
  markdown += '### Example: Creating a document with Yjs\n\n';
  markdown += '```javascript\n';
  markdown += "import * as Y from 'yjs';\n\n";
  markdown += 'const doc = new Y.Doc();\n';
  markdown += "const text = doc.getText('content');\n";
  markdown += "text.insert(0, 'Hello World');\n\n";
  markdown += '// Get update as Uint8Array\n';
  markdown += 'const update = Y.encodeStateAsUpdate(doc);\n\n';
  markdown += '// Convert to array for JSON\n';
  markdown += 'const updateArray = Array.from(update);\n\n';
  markdown += '// Send to API\n';
  markdown += "fetch('/api/workspaces/WORKSPACE_ID/docs', {\n";
  markdown += "  method: 'POST',\n";
  markdown += '  headers: {\n';
  markdown += "    'Content-Type': 'application/json',\n";
  markdown += "    'Authorization': 'Bearer YOUR_TOKEN'\n";
  markdown += '  },\n';
  markdown += '  body: JSON.stringify({\n';
  markdown += "    title: 'My Document',\n";
  markdown += '    initialContent: updateArray\n';
  markdown += '  })\n';
  markdown += '});\n';
  markdown += '```\n';

  return markdown;
}

// 메인 함수
function main() {
  console.log('Searching for controller files...');

  const serverDir = path.join(__dirname, 'packages/backend/server/src');
  const controllerFiles = findControllerFiles(serverDir);

  console.log(`Found ${controllerFiles.length} controller files`);

  const allRoutes = [];

  for (const file of controllerFiles) {
    try {
      const routes = extractRoutesFromController(file);
      allRoutes.push(...routes);
      console.log(
        `Extracted ${routes.length} routes from ${path.basename(file)}`
      );
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
    }
  }

  console.log(`\nTotal routes found: ${allRoutes.length}`);

  // 라우트 정렬
  allRoutes.sort((a, b) => {
    if (a.path < b.path) return -1;
    if (a.path > b.path) return 1;
    return 0;
  });

  // 그룹화
  const groups = groupRoutes(allRoutes);

  // Markdown 생성
  const markdown = generateMarkdown(groups);

  // 파일 저장
  const outputPath = path.join(__dirname, 'affine-rest-api-detailed.md');
  fs.writeFileSync(outputPath, markdown);

  console.log(`\nDetailed documentation generated: ${outputPath}`);

  // 간단한 통계 출력
  console.log('\nAPI Summary:');
  for (const [groupName, routes] of Object.entries(groups)) {
    console.log(`  ${groupName}: ${routes.length} endpoints`);
  }
}

// 실행
main();
