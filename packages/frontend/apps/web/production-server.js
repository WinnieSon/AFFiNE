const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3010';
const PORT = process.env.PORT || 8080;
const DIST_PATH = path.join(__dirname, 'dist');

// Production mode - reduce logging
const LOG_LEVEL = process.env.LOG_LEVEL || 'error'; // 'debug', 'info', 'error'

// Helper function for conditional logging
function log(level, message) {
  if (LOG_LEVEL === 'debug' || (LOG_LEVEL === 'info' && level !== 'debug') || (LOG_LEVEL === 'error' && level === 'error')) {
    console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`);
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
  '.mp4': 'video/mp4',
  '.zip': 'application/zip',
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

  // Serve static files from dist directory
  let filePath = path.join(DIST_PATH, req.url);
  if (req.url === '/') {
    filePath = path.join(DIST_PATH, 'index.html');
  }

  // For SPA routing, serve index.html for paths that don't have file extensions
  if (!path.extname(filePath) && !filePath.endsWith('/')) {
    filePath = path.join(DIST_PATH, 'index.html');
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // For SPA, serve index.html for any route not found
        fs.readFile(path.join(DIST_PATH, 'index.html'), (error, content) => {
          if (error) {
            log('error', `Cannot find index.html: ${error.message}`);
            res.writeHead(404);
            res.end('File not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          }
        });
      } else {
        log('error', `File read error: ${error.message}`);
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
  console.log(`📁 Serving files from ${DIST_PATH}`);
  console.log(`📊 Log level: ${LOG_LEVEL} (set LOG_LEVEL env var to change: debug, info, error)`);
});