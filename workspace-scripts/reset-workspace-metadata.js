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

// Function to reset workspace metadata to empty state
async function resetWorkspaceMetadata(workspaceId, cookie) {
  console.log(`\n🔧 Resetting workspace metadata to clean state...`);

  // Create new document with minimal structure
  const doc = new Y.Doc();
  const meta = doc.getMap('meta');

  // Create empty pages array
  meta.set('pages', new Y.Array());

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

  console.log(
    `📝 Clean workspace metadata created, size: ${update.length} bytes`
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

  console.log('✅ Workspace metadata reset to clean state!');
  console.log(
    '\n⚠️  NOTE: This has removed all page references from the workspace metadata.'
  );
  console.log(
    'Documents still exist in the database but are not linked to the workspace.'
  );

  return response.body;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Workspace Metadata Reset');
    console.log('==================================\n');

    console.log(
      '⚠️  WARNING: This will reset the workspace metadata to an empty state.'
    );
    console.log("Documents will still exist but won't be visible in the UI.");
    console.log('');

    // Step 1: Sign in
    const cookie = await signIn();

    // Step 2: Reset workspace metadata
    const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';
    await resetWorkspaceMetadata(workspaceId, cookie);

    console.log('\n✨ Reset complete!');
    console.log(
      '🔄 Refresh your browser - the workspace should load without errors'
    );
    console.log('📝 You can now create new documents through the UI');
    console.log(
      '\n💡 To restore existing documents, they need to be properly added back'
    );
    console.log(
      '   to the workspace metadata using the correct AFFiNE API methods.'
    );
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
