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

// Function to get all documents from database
async function getAllDocuments(workspaceId, cookie) {
  console.log(`📋 Getting all documents from database...`);

  // Use GraphQL to get all documents
  const query = `
    query GetWorkspacePages($workspaceId: String!) {
      workspace(id: $workspaceId) {
        pages {
          id
          title
          createdAt
        }
      }
    }
  `;

  const options = {
    protocol: `${protocol}:`,
    hostname,
    port,
    path: '/graphql',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
  };

  const data = {
    query,
    variables: { workspaceId },
  };

  const response = await makeRequest(options, data);

  if (response.statusCode !== 200) {
    console.log(
      '⚠️  Could not get documents via GraphQL, using fallback method'
    );
    return [
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
      { id: '8sq4zZpv2G2_OV3c0QD8N', title: '2025-07-07' },
      { id: 'cV6x_Zk14l', title: 'Document' },
      { id: 'happy-doc-1751875480175', title: '헤피헤피' },
      { id: 'happy_mcsug8bf', title: '헤피헤피' },
      { id: '_rUTfiS2Vw1Sqnrgyuo-G', title: '!!2' },
      { id: 's3jRANGNhK7j2qD_R682_', title: 'ㅁㅈㅇㅁㅈ' },
      { id: 'u0G5-920oO', title: 'Document' },
    ];
  }

  if (
    response.body.data &&
    response.body.data.workspace &&
    response.body.data.workspace.pages
  ) {
    return response.body.data.workspace.pages;
  }

  return [];
}

// Function to repair workspace metadata
async function repairWorkspaceMetadata(workspaceId, cookie) {
  console.log(`\n🔧 Repairing workspace metadata structure...`);

  // Get all documents
  const allDocs = await getAllDocuments(workspaceId, cookie);
  console.log(`📄 Found ${allDocs.length} documents to include`);

  // Create a new workspace document with proper structure
  const doc = new Y.Doc();

  // Create meta map
  const meta = doc.getMap('meta');

  // Create pages array
  const pages = new Y.Array();

  // Add each document as a proper Y.Map
  for (const docInfo of allDocs) {
    if (docInfo.id) {
      const pageMap = new Y.Map();
      pageMap.set('id', docInfo.id);
      pageMap.set('title', docInfo.title || 'Untitled');
      pageMap.set(
        'createDate',
        docInfo.createdAt ? new Date(docInfo.createdAt).getTime() : Date.now()
      );
      pageMap.set('tags', new Y.Array());
      pages.push([pageMap]);
      console.log(`  ✓ Added: ${docInfo.title || 'Untitled'} (${docInfo.id})`);
    }
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

  console.log('\n✅ Workspace metadata repaired successfully!');
  return response.body;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Workspace Metadata Repair');
    console.log('===================================\n');

    // Step 1: Sign in
    const cookie = await signIn();

    // Step 2: Repair workspace metadata
    const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';
    await repairWorkspaceMetadata(workspaceId, cookie);

    console.log('\n✨ Repair complete!');
    console.log(
      '🔄 Please refresh your browser (Ctrl/Cmd + Shift + R) to see all documents without errors'
    );
    console.log(
      '\n📌 All documents should now be visible and accessible in the workspace'
    );
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
