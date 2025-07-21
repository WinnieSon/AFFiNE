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

// Function to get workspace root document
async function getWorkspaceDoc(workspaceId, cookie) {
  console.log(`📋 Getting workspace root document...`);

  const options = {
    protocol: `${protocol}:`,
    hostname,
    port,
    path: `/api/workspaces/${workspaceId}/docs/${workspaceId}`,
    method: 'GET',
    headers: {
      Cookie: cookie,
    },
  };

  const response = await makeRequest(options, null, true);

  if (response.statusCode !== 200) {
    throw new Error(`Failed to get workspace doc: ${response.statusCode}`);
  }

  console.log(
    '✅ Got workspace document, size:',
    response.body.length,
    'bytes'
  );
  return response.body;
}

// Function to update workspace with new doc metadata
async function updateWorkspaceDoc(workspaceId, cookie, newDocs) {
  console.log(`\n📝 Updating workspace root document...`);

  // First get the current workspace doc
  const currentDocBinary = await getWorkspaceDoc(workspaceId, cookie);

  // Parse it as Yjs document
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(currentDocBinary));

  // Get the meta map
  const meta = doc.getMap('meta');
  let pages = meta.get('pages');

  if (!pages) {
    console.log('⚠️  No pages array found in workspace meta, creating one');
    pages = new Y.Array();
    meta.set('pages', pages);
  }

  console.log(`📄 Current pages in workspace: ${pages.length}`);

  // Check if our documents already exist
  const existingIds = new Set();
  pages.forEach(page => {
    if (page && page.id) {
      existingIds.add(page.id);
    }
  });

  // Add new documents if they don't exist
  let added = 0;
  for (const newDoc of newDocs) {
    if (!existingIds.has(newDoc.id)) {
      console.log(`➕ Adding document ${newDoc.id} to workspace metadata`);
      pages.push([
        {
          id: newDoc.id,
          title: newDoc.title || 'Untitled',
          createDate: Date.now(),
          tags: [],
        },
      ]);
      added++;
    } else {
      console.log(`✓ Document ${newDoc.id} already in workspace metadata`);
    }
  }

  if (added === 0) {
    console.log('ℹ️  All documents already exist in workspace metadata');
    return;
  }

  // Create update
  const update = Y.encodeStateAsUpdate(doc);

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

  console.log(
    `✅ Successfully added ${added} document(s) to workspace metadata`
  );
  return response.body;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Workspace Metadata Update');
    console.log('===================================\n');

    // Step 1: Sign in
    const cookie = await signIn();

    // Step 2: Define workspace and documents to add
    const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';
    const documentsToAdd = [
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

    // Step 3: Update workspace metadata
    await updateWorkspaceDoc(workspaceId, cookie, documentsToAdd);

    console.log('\n✨ Workspace metadata updated!');
    console.log('🔄 Please refresh your browser to see the documents');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
