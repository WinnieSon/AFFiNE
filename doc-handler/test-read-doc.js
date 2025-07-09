#!/usr/bin/env node

const https = require('https');
const http = require('http');

// Server configuration
const protocol = 'http';
const hostname = 'localhost';
const port = 3010;

// User credentials
const email = 'pro@affine.pro';
const password = 'pro';

// Document to read
const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';
const docId = '0ad6fc3f-46fe-4645-bdc2-b1e1bd396b19';

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const client = protocol === 'https' ? https : http;
    const req = client.request(options, res => {
      let body = Buffer.alloc(0);
      res.on('data', chunk => {
        body = Buffer.concat([body, chunk]);
      });
      res.on('end', () => {
        const result = {
          statusCode: res.statusCode,
          headers: res.headers,
          body: body,
        };
        resolve(result);
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Function to sign in and get auth token
async function signIn() {
  console.log('🔐 Signing in...');

  const options = {
    protocol: `${protocol}:`,
    hostname,
    port,
    path: '/api/auth/sign-in',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const data = { email, password };

  const response = await makeRequest(options, data);

  if (response.statusCode !== 200) {
    throw new Error(`Sign in failed: ${response.statusCode}`);
  }

  // Extract token from Set-Cookie header
  const cookies = response.headers['set-cookie'];
  if (!cookies) {
    throw new Error('No cookies returned from sign-in');
  }

  // Find the session cookie
  const sessionCookie = cookies.find(cookie =>
    cookie.includes('affine_session')
  );
  if (!sessionCookie) {
    throw new Error('No session cookie found');
  }

  console.log('✅ Signed in successfully');
  return sessionCookie.split(';')[0];
}

// Function to read document using REST API
async function readDocument(cookie) {
  console.log(`\n📄 Reading document ${docId}...`);

  const options = {
    protocol: `${protocol}:`,
    hostname,
    port,
    path: `/api/workspaces/${workspaceId}/docs/${docId}`,
    method: 'GET',
    headers: {
      Cookie: cookie,
    },
  };

  const response = await makeRequest(options);

  if (response.statusCode !== 200) {
    throw new Error(`Failed to read document: ${response.statusCode}`);
  }

  console.log('✅ Document read successfully!');
  console.log(`📋 Document size: ${response.body.length} bytes`);
  console.log(`📋 Content-Type: ${response.headers['content-type']}`);

  // The response is a binary Yjs document
  return response.body;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE REST API Document Read Test');
    console.log('=====================================\n');

    // Step 1: Sign in
    const cookie = await signIn();

    // Step 2: Read document
    const docBinary = await readDocument(cookie);

    console.log('\n✨ Success! Document binary retrieved');
    console.log('ℹ️  Note: The document is in Yjs binary format');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
