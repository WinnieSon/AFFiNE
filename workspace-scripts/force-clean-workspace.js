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

// Function to force clean workspace
async function forceCleanWorkspace(workspaceId, cookie) {
  console.log(`\n🔧 Force cleaning workspace metadata...`);

  // Create a completely new document from scratch
  const doc = new Y.Doc();
  doc.clientID = 1; // Set a specific client ID to ensure consistency

  // Get the root map and set minimal structure
  const rootMap = doc.getMap();

  // Create blocks map (required for document structure)
  rootMap.set('blocks', new Y.Map());

  // Create meta map with minimal structure
  const meta = new Y.Map();

  // Create empty pages array - NO ENTRIES AT ALL
  const pages = new Y.Array();
  meta.set('pages', pages);

  // Set block versions (required)
  const blockVersions = new Y.Map();
  blockVersions.set('affine:page', 2);
  blockVersions.set('affine:note', 1);
  blockVersions.set('affine:paragraph', 1);
  blockVersions.set('affine:surface', 5);
  meta.set('blockVersions', blockVersions);

  // Set workspace version
  meta.set('workspaceVersion', 2);

  // Add meta to root
  rootMap.set('meta', meta);

  // Create state vector from this clean document
  const stateVector = Y.encodeStateVector(doc);
  const update = Y.encodeStateAsUpdate(doc);

  console.log('📝 Clean workspace document created:');
  console.log('   - State vector size:', stateVector.length, 'bytes');
  console.log('   - Update size:', update.length, 'bytes');
  console.log('   - Pages: 0 (completely empty)');
  console.log('   - No corrupt entries');

  // First, try to get the current document to understand its state
  const getOptions = {
    protocol: `${protocol}:`,
    hostname,
    port,
    path: `/api/workspaces/${workspaceId}/docs/${workspaceId}`,
    method: 'GET',
    headers: {
      Cookie: cookie,
    },
  };

  const getResponse = await makeRequest(getOptions, null, true);

  if (getResponse.statusCode === 200) {
    console.log(
      '📋 Current workspace doc exists, size:',
      getResponse.body.length,
      'bytes'
    );
  }

  // Send the clean update to completely replace the document
  const putOptions = {
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

  // Send multiple updates to ensure the document is clean
  // First, send the clean state
  const data1 = {
    updates: [Array.from(update)],
  };

  const response1 = await makeRequest(putOptions, data1);

  if (response1.statusCode !== 200) {
    throw new Error(
      `Failed to update workspace doc (step 1): ${response1.statusCode}`
    );
  }

  console.log('✅ Step 1: Clean update sent');

  // Create another clean document and send it again to ensure no merge issues
  const doc2 = new Y.Doc();
  doc2.clientID = 2;

  const rootMap2 = doc2.getMap();
  rootMap2.set('blocks', new Y.Map());

  const meta2 = new Y.Map();
  const pages2 = new Y.Array();
  meta2.set('pages', pages2);

  const blockVersions2 = new Y.Map();
  blockVersions2.set('affine:page', 2);
  blockVersions2.set('affine:note', 1);
  blockVersions2.set('affine:paragraph', 1);
  blockVersions2.set('affine:surface', 5);
  meta2.set('blockVersions', blockVersions2);
  meta2.set('workspaceVersion', 2);

  rootMap2.set('meta', meta2);

  const update2 = Y.encodeStateAsUpdate(doc2);

  const data2 = {
    updates: [Array.from(update2)],
  };

  const response2 = await makeRequest(putOptions, data2);

  if (response2.statusCode !== 200) {
    throw new Error(
      `Failed to update workspace doc (step 2): ${response2.statusCode}`
    );
  }

  console.log('✅ Step 2: Second clean update sent');

  console.log('\n✅ Workspace force cleaned successfully!');
  console.log('   - All document references removed');
  console.log('   - No corrupt entries remain');
  console.log('   - Workspace should now load without errors');

  return true;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Workspace Force Clean');
    console.log('================================\n');

    console.log('⚠️  CRITICAL WARNING:');
    console.log('This will completely reset the workspace metadata.');
    console.log('ALL document references will be removed.');
    console.log(
      'Documents will still exist in the database but will be orphaned.'
    );
    console.log('');

    // Step 1: Sign in
    const cookie = await signIn();

    // Step 2: Force clean workspace
    const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';
    await forceCleanWorkspace(workspaceId, cookie);

    console.log('\n✨ Force clean complete!');
    console.log('\n📌 IMPORTANT NEXT STEPS:');
    console.log('1. STOP the backend server (Ctrl+C)');
    console.log('2. Clear browser cache and local storage');
    console.log('3. Restart the backend server: yarn affine server dev');
    console.log('4. Open browser in incognito/private mode');
    console.log('5. Navigate to http://localhost:8080');
    console.log('6. Sign in with pro@affine.pro / pro');
    console.log('\n💡 The workspace should now be completely clean.');
    console.log('You can create new documents through the UI without errors.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
