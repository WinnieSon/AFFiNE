#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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
  const methodsContent = content
    .split(/\n/)
    .map((line, index) => ({ line, index }));

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
      Math.max(0, position - 200),
      position
    );
    const useGuardsMatch = beforeMethod.match(/@UseGuards\s*\(([^)]+)\)/);
    const guards = useGuardsMatch ? useGuardsMatch[1] : null;

    // 파라미터 찾기
    const paramsRegex =
      /@(Param|Query|Body|Headers)\s*\(\s*(['"`]([^'"`]+)['"`])?\s*\)/g;
    const methodEnd = content.indexOf('{', position);
    const methodSignature = content.substring(position, methodEnd);
    const params = [];

    let paramMatch;
    while ((paramMatch = paramsRegex.exec(methodSignature)) !== null) {
      params.push({
        type: paramMatch[1],
        name: paramMatch[3] || 'body',
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
    'This document is automatically generated from the AFFiNE server controllers.\n\n';
  markdown += '## Table of Contents\n\n';

  // 목차 생성
  for (const [groupName, routes] of Object.entries(groups)) {
    markdown += `- [${groupName}](#${groupName.toLowerCase()})\n`;
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
      markdown += `### ${route.methodName}\n\n`;
      markdown += `**Endpoint:** \`${route.method} ${route.path}\`\n\n`;

      if (route.guards) {
        markdown += `**Authentication:** Required (${route.guards})\n\n`;
      }

      if (route.params.length > 0) {
        markdown += '**Parameters:**\n';
        for (const param of route.params) {
          markdown += `- \`${param.name}\` (${param.type})\n`;
        }
        markdown += '\n';
      }

      markdown += `**Source:** \`${route.filePath}\`\n\n`;
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
  markdown += '- `500 Internal Server Error` - Server error\n';

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
  const outputPath = path.join(__dirname, 'rest-api-documentation.md');
  fs.writeFileSync(outputPath, markdown);

  console.log(`\nDocumentation generated: ${outputPath}`);

  // 간단한 통계 출력
  console.log('\nAPI Summary:');
  for (const [groupName, routes] of Object.entries(groups)) {
    console.log(`  ${groupName}: ${routes.length} endpoints`);
  }
}

// 실행
main();
