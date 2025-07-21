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

// Function to clean workspace completely
async function cleanWorkspaceCompletely(workspaceId, cookie) {
  console.log(`\n🧹 Cleaning workspace completely...`);

  // Create new document with only essential structure
  const doc = new Y.Doc();

  // Create meta map
  const meta = doc.getMap('meta');

  // Create empty pages array with no entries
  const pages = new Y.Array();
  meta.set('pages', pages);

  // Add block versions
  const blockVersions = new Y.Map();
  blockVersions.set('affine:page', 2);
  blockVersions.set('affine:note', 1);
  blockVersions.set('affine:paragraph', 1);
  blockVersions.set('affine:surface', 5);
  meta.set('blockVersions', blockVersions);

  // Add workspace version
  meta.set('workspaceVersion', 2);

  // Create update
  const update = Y.encodeStateAsUpdate(doc);

  console.log(`📝 Clean workspace metadata created:`);
  console.log(`   - Pages: 0 (empty)`);
  console.log(`   - Size: ${update.length} bytes`);

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

  console.log('\n✅ Workspace cleaned successfully!');
  console.log('   - All document references removed from workspace metadata');
  console.log('   - Documents still exist in database but are orphaned');
  console.log('   - No corrupt entries in pages array');

  return response.body;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Workspace Complete Cleanup');
    console.log('====================================\n');

    console.log(
      '⚠️  WARNING: This will remove all document references from the workspace.'
    );
    console.log(
      "Documents will still exist in the database but won't be accessible."
    );
    console.log('');

    // Step 1: Sign in
    const cookie = await signIn();

    // Step 2: Clean workspace
    const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';
    await cleanWorkspaceCompletely(workspaceId, cookie);

    console.log('\n✨ Cleanup complete!');
    console.log('\n📌 Next steps:');
    console.log('1. Refresh your browser (Ctrl/Cmd + Shift + R)');
    console.log('2. The workspace should load without errors');
    console.log('3. Create new documents through the AFFiNE UI');
    console.log('\n💡 For API document creation:');
    console.log(
      '   - Documents MUST be added as Y.Map objects to the pages array'
    );
    console.log(
      '   - Plain JavaScript objects will cause the "v.get is not a function" error'
    );
    console.log(
      '   - Use the AFFiNE SDK or follow the exact pattern used by createDoc()'
    );
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
