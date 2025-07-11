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

// Function to fix workspace metadata completely
async function fixWorkspaceMetadataCompletely(workspaceId, cookie) {
  console.log(`\n🔧 Creating clean workspace metadata with all documents...`);

  // All documents that should be in the workspace
  const allDocuments = [
    { id: 'u0G5-920oO', title: 'Document' },
    { id: 'cV6x_Zk14l', title: 'How to use folder and Tags' },
    { id: '_rUTfiS2Vw1Sqnrgyuo-G', title: '!!2' },
    { id: 's3jRANGNhK7j2qD_R682_', title: 'ㅁㅈㅇㅁㅈ' },
    { id: '8sq4zZpv2G2_OV3c0QD8N', title: '2025-07-07' },
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
    { id: 'happy-doc-1751875480175', title: '헤피헤피' },
    { id: 'happy_mcsug8bf', title: '헤피헤피' },
  ];

  // Create new document with proper structure
  const doc = new Y.Doc();
  const meta = doc.getMap('meta');

  // Create pages array
  const pages = new Y.Array();

  // Add each document as a proper Y.Map
  console.log('📄 Adding documents to workspace:');
  for (const docInfo of allDocuments) {
    const pageMap = new Y.Map();
    pageMap.set('id', docInfo.id);
    pageMap.set('title', docInfo.title);
    pageMap.set('createDate', Date.now());
    pageMap.set('tags', new Y.Array());

    // Push the Y.Map directly, not wrapped in an array
    pages.push([pageMap]);
    console.log(`  ✓ Added: ${docInfo.title} (${docInfo.id})`);
  }

  // Set pages array
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

  console.log(`\n📝 New workspace metadata created:`);
  console.log(`   - Total documents: ${pages.length}`);
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

  console.log('\n✅ Workspace metadata fixed completely!');

  // Verify the fix
  console.log('\n🔍 Verifying the fix...');

  // Get the updated workspace doc
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
    const verifyDoc = new Y.Doc();
    Y.applyUpdate(verifyDoc, new Uint8Array(getResponse.body));
    const verifyMeta = verifyDoc.getMap('meta');
    const verifyPages = verifyMeta.get('pages');

    console.log('📊 Verification results:');
    console.log(`   - Total pages: ${verifyPages.length}`);

    let allValid = true;
    verifyPages.forEach((page, idx) => {
      if (!(page instanceof Y.Map)) {
        allValid = false;
        console.log(`   ❌ Entry ${idx} is not a Y.Map`);
      }
    });

    if (allValid) {
      console.log('   ✅ All entries are valid Y.Map objects!');
    }
  }

  return response.body;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Workspace Metadata Final Fix');
    console.log('=====================================\n');

    // Step 1: Sign in
    const cookie = await signIn();

    // Step 2: Fix workspace metadata completely
    const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';
    await fixWorkspaceMetadataCompletely(workspaceId, cookie);

    console.log('\n✨ Fix complete!');
    console.log(
      '🔄 Please refresh your browser to see all documents without errors'
    );
    console.log(
      '\n📌 The workspace should now work correctly with all documents visible'
    );
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
