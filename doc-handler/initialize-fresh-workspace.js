#!/usr/bin/env node

/**
 * Initialize a fresh workspace after deletion
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

// Initialize workspace with minimal structure
async function initializeWorkspace(cookie) {
  console.log('\n🏗️  Initializing fresh workspace...\n');

  // Create minimal workspace document
  const doc = new Y.Doc();
  doc.clientID = Date.now() % 1000000;

  // Create meta map
  const meta = doc.getMap('meta');

  // Create empty pages array
  const pages = new Y.Array();
  meta.set('pages', pages);
  meta.set('workspaceVersion', 2);

  // Set block versions
  const blockVersions = new Y.Map();
  blockVersions.set('affine:page', 2);
  blockVersions.set('affine:note', 1);
  blockVersions.set('affine:paragraph', 1);
  blockVersions.set('affine:surface', 5);
  meta.set('blockVersions', blockVersions);

  // Create minimal blocks map
  const blocks = doc.getMap('blocks');

  console.log('📝 Created minimal workspace structure:');
  console.log('   - Empty pages array');
  console.log('   - Workspace version: 2');
  console.log('   - Block versions set');

  // Encode update
  const update = Y.encodeStateAsUpdate(doc);

  // Send to server
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

  const putData = {
    updates: [Array.from(update)],
  };

  const putResponse = await makeRequest(putOptions, putData);

  if (putResponse.statusCode !== 200) {
    throw new Error(
      `Failed to initialize workspace: ${putResponse.statusCode}`
    );
  }

  console.log('✅ Workspace initialized successfully!');

  return true;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Fresh Workspace Initializer');
    console.log('====================================\n');

    console.log('This will create a fresh, minimal workspace structure.');
    console.log('Use this after deleting corrupt workspace data.\n');

    // Sign in
    const cookie = await signIn();

    // Initialize workspace
    await initializeWorkspace(cookie);

    console.log('\n✨ Initialization complete!');
    console.log('\n📌 Next steps:');
    console.log('1. Clear browser cache completely');
    console.log('2. Open a new incognito/private window');
    console.log('3. Navigate to http://localhost:8080');
    console.log('4. Sign in with pro@affine.pro / pro');
    console.log('5. You should see an empty workspace');
    console.log('\n💡 You can now:');
    console.log('   - Create new documents manually');
    console.log('   - Run create-documents-properly.js to add test documents');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
