# AFFiNE 프로덕션 배포 가이드

이 가이드는 AFFiNE를 프로덕션 환경에서 정적 파일로 배포하는 방법을 설명합니다.

## 1. 프로덕션 빌드 생성

```bash
# 프로젝트 루트에서 실행
PUBLIC_PATH=/ BUILD_TYPE=canary yarn affine web build
```

**중요**: `PUBLIC_PATH=/`를 설정하지 않으면 CDN URL이 하드코딩되어 로컬에서 파일을 찾을 수 없습니다.

## 2. 백엔드 서버 실행

```bash
# 백엔드 서버 시작 (별도 터미널에서)
yarn affine server dev
```

백엔드 서버는 기본적으로 `http://localhost:3010`에서 실행됩니다.

## 3. 프로덕션 서버 설정

빌드된 파일이 있는 `dist` 폴더에 다음 서버 파일을 생성합니다:

**파일 위치**: `packages/frontend/apps/web/dist/production-server.js`

```javascript
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const BACKEND_URL = 'http://localhost:3010';
const PORT = 8080; // 기본 포트 8080으로 변경

// Production mode - reduce logging
const PRODUCTION_MODE = process.env.NODE_ENV === 'production' || true;
const LOG_LEVEL = process.env.LOG_LEVEL || 'error'; // 'debug', 'info', 'error'

// Helper function for conditional logging
function log(level, message) {
  if (LOG_LEVEL === 'debug' || (LOG_LEVEL === 'info' && level !== 'debug') || (LOG_LEVEL === 'error' && level === 'error')) {
    console.log(message);
  }
}

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

// Proxy function using built-in http module
function proxyRequest(req, res, targetUrl) {
  const url = new URL(req.url, targetUrl);

  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: url.host,
    },
  };

  const proxyReq = http.request(options, proxyRes => {
    // Copy headers from backend response
    Object.keys(proxyRes.headers).forEach(key => {
      res.setHeader(key, proxyRes.headers[key]);
    });

    res.writeHead(proxyRes.statusCode);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', err => {
    log('error', `Proxy error: ${err}`);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  // Forward request body
  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  // Only log in debug mode
  log('debug', `${req.method} ${req.url}`);

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Proxy API requests to backend
  if (req.url.startsWith('/api/') || req.url.startsWith('/graphql') || req.url.startsWith('/socket.io/')) {
    log('info', `Proxying to backend: ${req.url}`);
    proxyRequest(req, res, BACKEND_URL);
    return;
  }

  // Serve static files
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }

  // For SPA routing, serve index.html for paths that don't have file extensions
  if (!path.extname(filePath) && !filePath.endsWith('/')) {
    filePath = './index.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // For SPA, serve index.html for any route not found
        fs.readFile('./index.html', (error, content) => {
          if (error) {
            res.writeHead(404);
            res.end('File not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Production server running at http://localhost:${PORT}/`);
  console.log(`📡 Proxying API requests to ${BACKEND_URL}`);
  console.log(`📊 Log level: ${LOG_LEVEL} (set LOG_LEVEL env var to change: debug, info, error)`);
});
```

## 4. 프로덕션 서버 실행

```bash
# dist 폴더로 이동
cd packages/frontend/apps/web/dist

# 프로덕션 서버 시작
node production-server.js
```

## 5. 접속 확인

브라우저에서 `http://localhost:8080`으로 접속합니다.

## 주요 특징

### ✅ 해결된 문제들

- **CDN 의존성 제거**: `PUBLIC_PATH=/` 설정으로 로컬 파일 참조
- **API 프록시**: GraphQL, REST API, Socket.io 요청을 백엔드로 프록시
- **SPA 라우팅**: 클라이언트 사이드 라우팅을 위한 fallback 처리
- **CORS 헤더**: 크로스 오리진 요청 지원
- **정적 파일 서빙**: 모든 정적 자원 (JS, CSS, 이미지 등) 제공

### 🔧 서버 기능

- **Static File Serving**: HTML, CSS, JS, 이미지, 폰트 등 모든 정적 자원
- **API Proxy**: `/api/*`, `/graphql`, `/socket.io/*` 요청을 백엔드로 전달
- **SPA Support**: 클라이언트 라우팅을 위한 index.html fallback
- **CORS Support**: 크로스 오리진 요청 처리
- **로그 레벨 제어**: 프로덕션 환경을 위한 로그 레벨 설정 (error, info, debug)

## 배포 스크립트 (선택사항)

편의를 위해 다음 스크립트를 `package.json`에 추가할 수 있습니다:

```json
{
  "scripts": {
    "build:prod": "PUBLIC_PATH=/ BUILD_TYPE=canary yarn affine web build",
    "serve:prod": "cd packages/frontend/apps/web/dist && LOG_LEVEL=error node production-server.js",
    "serve:prod:debug": "cd packages/frontend/apps/web/dist && LOG_LEVEL=debug node production-server.js"
  }
}
```

### 사용법:

```bash
# 프로덕션 빌드
yarn build:prod

# 프로덕션 서버 실행 (에러만 출력)
yarn serve:prod

# 디버그 모드로 실행 (모든 요청 로그 출력)
yarn serve:prod:debug
```

## 환경 설정

### 환경 변수

- `PUBLIC_PATH=/`: 정적 파일 경로를 로컬로 설정
- `BUILD_TYPE=canary`: 빌드 타입 설정
- `BACKEND_URL`: 프로덕션 서버에서 백엔드 URL 변경 가능 (기본값: `http://localhost:3010`)
- `LOG_LEVEL`: 로그 레벨 설정 (기본값: `error`)
  - `error`: 에러만 출력 (프로덕션 권장)
  - `info`: API 프록시 요청과 에러 출력
  - `debug`: 모든 HTTP 요청 출력

### 포트 설정

- **프론트엔드**: `8080` (production-server.js에서 변경 가능)
- **백엔드**: `3010` (기본값)

## 문제 해결

### 1. 무한 로딩

- 백엔드 서버가 실행 중인지 확인: `curl http://localhost:3010/graphql`
- 프록시 로그에서 API 요청이 전달되는지 확인

### 2. 정적 파일 404

- `PUBLIC_PATH=/` 환경 변수로 빌드했는지 확인
- `dist` 폴더에 파일들이 존재하는지 확인

### 3. CORS 에러

- 프로덕션 서버가 CORS 헤더를 추가하는지 확인
- 브라우저 개발자 도구 Network 탭에서 응답 헤더 확인

## 실제 프로덕션 배포

실제 서버에 배포할 때는:

1. Nginx, Apache 등의 웹 서버 사용 권장
2. `production-server.js`를 PM2 등의 프로세스 매니저로 관리
3. 환경 변수로 백엔드 URL 설정
4. HTTPS 설정 및 보안 헤더 추가

이 방법으로 AFFiNE를 CDN 없이 완전히 독립적인 정적 파일로 배포할 수 있습니다.
