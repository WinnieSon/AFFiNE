#!/usr/bin/env node

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

// Function to create minimal valid workspace
async function createMinimalWorkspace(workspaceId, cookie) {
  console.log(`\n🔧 Creating minimal valid workspace structure...`);

  // Create absolutely minimal document
  const doc = new Y.Doc();
  doc.clientID = Date.now() % 1000000; // Random client ID

  // Just set the very minimum required
  const meta = doc.getMap('meta');

  // Create empty pages array
  const pages = new Y.Array();
  meta.set('pages', pages);

  // Set workspace version
  meta.set('workspaceVersion', 2);

  // Create empty blocks map
  const blocks = doc.getMap('blocks');

  // Create update
  const update = Y.encodeStateAsUpdate(doc);

  console.log(`📝 Minimal workspace created:`);
  console.log(`   - Size: ${update.length} bytes`);
  console.log(`   - Pages: 0 (empty array)`);
  console.log(`   - Blocks: empty map`);
  console.log(`   - Version: 2`);

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
    throw new Error(`Failed to update workspace doc: ${response.statusCode}`);
  }

  console.log('✅ Minimal workspace structure created');

  return true;
}

// Main function
async function main() {
  try {
    console.log('🛑 AFFiNE Workspace Stop & Reset');
    console.log('=================================\n');

    console.log('This script will:');
    console.log('1. Create a minimal valid workspace structure');
    console.log('2. Remove all problematic metadata');
    console.log('3. Allow the workspace to load properly\n');

    // Step 1: Sign in
    const cookie = await signIn();

    // Step 2: Create minimal workspace
    const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';
    await createMinimalWorkspace(workspaceId, cookie);

    console.log('\n✨ Reset complete!');
    console.log('\n📌 CRITICAL NEXT STEPS:');
    console.log('1. STOP the backend server NOW (Ctrl+C)');
    console.log('2. Wait 5 seconds for complete shutdown');
    console.log('3. Clear browser data:');
    console.log('   - Close ALL browser tabs');
    console.log(
      '   - Clear cache, cookies, and local storage for localhost:8080'
    );
    console.log('   - Or use a completely new incognito/private window');
    console.log('4. Start the backend server: yarn affine server dev');
    console.log(
      '5. Wait for server to fully start (watch for "Application is running" message)'
    );
    console.log('6. Open http://localhost:8080 in a fresh browser');
    console.log('7. Sign in with pro@affine.pro / pro');
    console.log(
      '\n⚠️  IMPORTANT: The endless loading is caused by the browser trying to sync old data.'
    );
    console.log('You MUST clear browser data to break this cycle!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
