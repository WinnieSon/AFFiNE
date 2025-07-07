#!/usr/bin/env node

/**
 * Fix document meta structure to prevent "meta.get is not a function" errors
 */

const https = require('https');
const http = require('http');
const Y = require('yjs');

// Server configuration
const protocol = 'http';
const hostname = 'localhost';
const port = 3010;

// User credentials
const email = 'pro@affine.pro';
const password = 'pro';

// Target workspace
const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';

// Document IDs from the previous run
const documentIds = [
  'c82150f2-fa44-48d2-b53e-291d9af35ac4',
  '3e33404f-b08c-4bc0-b87a-4cee27d948e5',
  '4c866562-da68-4136-baca-92b6c802e653',
];

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
        } catch (e) {
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

// Fix document meta structure
async function fixDocumentMeta(docId, cookie) {
  console.log(`\n📝 Fixing document ${docId}...`);

  // Get current document
  const getOptions = {
    protocol: `${protocol}:`,
    hostname,
    port,
    path: `/api/workspaces/${workspaceId}/docs/${docId}`,
    method: 'GET',
    headers: {
      Cookie: cookie,
    },
  };

  const getResponse = await makeRequest(getOptions, null, true);

  if (getResponse.statusCode !== 200) {
    console.log(`⚠️  Document ${docId} not found, skipping`);
    return false;
  }

  // Parse existing document
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(getResponse.body));

  // Ensure meta is a proper Y.Map
  let meta = doc.getMap('meta');

  // Set required meta properties
  if (!meta.has('pages')) {
    meta.set('pages', new Y.Array());
  }

  if (!meta.has('workspaceVersion')) {
    meta.set('workspaceVersion', 2);
  }

  if (!meta.has('blockVersions')) {
    const blockVersions = new Y.Map();
    blockVersions.set('affine:page', 2);
    blockVersions.set('affine:note', 1);
    blockVersions.set('affine:paragraph', 1);
    blockVersions.set('affine:surface', 5);
    meta.set('blockVersions', blockVersions);
  }

  // Ensure the page block has correct meta
  const blocks = doc.getMap('blocks');
  const pageBlock = blocks.get(docId);

  if (pageBlock instanceof Y.Map) {
    // Ensure page has a meta map
    if (!pageBlock.has('meta')) {
      const pageMeta = new Y.Map();
      pageBlock.set('meta', pageMeta);
    }

    // Set page meta properties
    const pageMeta = pageBlock.get('meta');
    if (pageMeta instanceof Y.Map) {
      if (!pageMeta.has('createDate')) {
        pageMeta.set('createDate', Date.now());
      }
      if (!pageMeta.has('tags')) {
        pageMeta.set('tags', new Y.Array());
      }
    }
  }

  // Create update
  const update = Y.encodeStateAsUpdate(doc);

  // Send update
  const putOptions = {
    protocol: `${protocol}:`,
    hostname,
    port,
    path: `/api/workspaces/${workspaceId}/docs/${docId}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
  };

  const putData = {
    updates: [Array.from(update)],
  };

  const putResponse = await makeRequest(putOptions, putData);

  if (putResponse.statusCode !== 200) {
    throw new Error(
      `Failed to update document ${docId}: ${putResponse.statusCode}`
    );
  }

  console.log(`✅ Fixed document ${docId}`);
  return true;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Document Meta Fix');
    console.log('===========================\n');

    console.log('This will fix the "meta.get is not a function" error');
    console.log(
      'by ensuring all documents have proper Y.Map meta structures.\n'
    );

    // Sign in
    const cookie = await signIn();

    // Fix each document
    for (const docId of documentIds) {
      await fixDocumentMeta(docId, cookie);
    }

    // Also fix the workspace document itself
    console.log(`\n📝 Fixing workspace document...`);
    await fixDocumentMeta(workspaceId, cookie);

    console.log('\n✨ All documents fixed!');
    console.log('\n📌 The indexer errors should stop now.');
    console.log('You can check the documents at http://localhost:8080');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
