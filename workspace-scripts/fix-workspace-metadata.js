#!/usr/bin/env node

const https = require('node:https');
const http = require('node:http');
const Y = require('yjs');

// Server configuration
const protocol = 'http';
const hostname = 'localhost';
const port = 3010;

// User credentials
const email = 'pro@affine.pro';
const password = 'pro';

// Helper function to make HTTP requests
function makeRequest(options, data = null, binary = false) {
  return new Promise((resolve, reject) => {
    const client = protocol === 'https' ? https : http;
    const req = client.request(options, res => {
      let body = binary ? [] : '';
      res.on('data', chunk => {
        if (binary) {
          body.push(chunk);
        } else {
          body += chunk;
        }
      });
      res.on('end', () => {
        try {
          const result = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: binary ? Buffer.concat(body) : body ? JSON.parse(body) : null,
          };
          resolve(result);
        } catch {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: binary ? Buffer.concat(body) : body,
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      if (binary) {
        req.write(data);
      } else {
        req.write(JSON.stringify(data));
      }
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
    throw new Error(
      `Sign in failed: ${response.statusCode} - ${JSON.stringify(response.body)}`
    );
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

// Function to fix workspace metadata
async function fixWorkspaceMetadata(workspaceId, cookie) {
  console.log(`\n🔧 Fixing workspace metadata structure...`);

  // Create a new clean workspace document
  const doc = new Y.Doc();

  // Create meta map
  const meta = doc.getMap('meta');

  // Create pages array with Y.Map objects
  const pages = new Y.Array();

  // Add properly structured page entries
  const pageEntries = [
    {
      id: '1c83783a-ae0e-4726-acca-49df4f686e12',
      title: 'Complete Document via REST API',
    },
    {
      id: '8f0a7dbd-808b-456b-992e-7e5baa560d5d',
      title: 'Document created via REST API with Yjs',
    },
    {
      id: '149e7f97-538d-4b66-a581-1f92ac804e21',
      title: 'Document created via REST API with Yjs',
    },
    {
      id: '4539dc36-0775-4641-a679-3ce20048f791',
      title: 'Test Document Created via REST API',
    },
  ];

  // Add each page as a Y.Map
  for (const entry of pageEntries) {
    const pageMap = new Y.Map();
    pageMap.set('id', entry.id);
    pageMap.set('title', entry.title);
    pageMap.set('createDate', Date.now());
    pageMap.set('tags', new Y.Array());
    pages.push([pageMap]);
  }

  // Set pages array
  meta.set('pages', pages);

  // Add block versions
  meta.set(
    'blockVersions',
    new Y.Map([
      ['affine:page', 2],
      ['affine:note', 1],
      ['affine:paragraph', 1],
      ['affine:surface', 5],
    ])
  );

  // Add workspace version
  meta.set('workspaceVersion', 2);

  // Create update
  const update = Y.encodeStateAsUpdate(doc);

  console.log(
    '📝 New workspace metadata created, size:',
    update.length,
    'bytes'
  );

  // Send update to server
  const options = {
    protocol: `${protocol}:`,
    hostname,
    port,
    path: `/api/workspaces/${workspaceId}/docs/${workspaceId}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
  };

  const data = {
    updates: [Array.from(update)],
  };

  const response = await makeRequest(options, data);

  if (response.statusCode !== 200) {
    throw new Error(
      `Failed to update workspace doc: ${response.statusCode} - ${JSON.stringify(response.body)}`
    );
  }

  console.log('✅ Workspace metadata fixed successfully!');
  return response.body;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Workspace Metadata Fix');
    console.log('================================\n');

    // Step 1: Sign in
    const cookie = await signIn();

    // Step 2: Fix workspace metadata
    const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';
    await fixWorkspaceMetadata(workspaceId, cookie);

    console.log('\n✨ Fix complete!');
    console.log(
      '🔄 Please refresh your browser to see the documents without errors'
    );
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
