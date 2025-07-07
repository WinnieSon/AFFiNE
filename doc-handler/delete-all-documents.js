#!/usr/bin/env node

/**
 * Delete all documents from workspace
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

// Delete all documents from workspace
async function deleteAllDocuments(cookie) {
  console.log('\n🗑️  Deleting all documents from workspace...\n');

  // Get current workspace document
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

  if (getResponse.statusCode !== 200) {
    throw new Error(`Failed to get workspace doc: ${getResponse.statusCode}`);
  }

  // Parse existing document
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(getResponse.body));

  // Get meta and pages
  const meta = doc.getMap('meta');
  const pages = meta.get('pages');

  if (!pages || pages.length === 0) {
    console.log('No documents to delete.');
    return { deletedCount: 0, docIds: [] };
  }

  console.log(`📄 Found ${pages.length} documents`);

  // Collect document IDs
  const docIds = [];
  pages.forEach((page, idx) => {
    if (page instanceof Y.Map) {
      const id = page.get('id');
      const title = page.get('title') || 'Untitled';
      docIds.push(id);
      console.log(`   ${idx + 1}. ${title} (${id})`);
    }
  });

  // Clear the pages array
  Y.transact(doc, () => {
    const newPages = new Y.Array();
    meta.set('pages', newPages);
  });

  // Update workspace
  const update = Y.encodeStateAsUpdate(doc);

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
      `Failed to update workspace doc: ${putResponse.statusCode}`
    );
  }

  console.log(
    `\n✅ Removed ${docIds.length} documents from workspace metadata`
  );

  // Optional: Delete actual document data
  console.log('\n🧹 Cleaning up document data...');

  for (const docId of docIds) {
    try {
      // Delete the document by sending an empty update
      const emptyDoc = new Y.Doc();
      const emptyUpdate = Y.encodeStateAsUpdate(emptyDoc);

      const deleteOptions = {
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

      const deleteData = {
        updates: [Array.from(emptyUpdate)],
      };

      await makeRequest(deleteOptions, deleteData);
      console.log(`   ✓ Deleted document data: ${docId}`);
    } catch (err) {
      console.log(`   ⚠️  Failed to delete document data: ${docId}`);
    }
  }

  return { deletedCount: docIds.length, docIds };
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Document Cleanup Tool');
    console.log('===============================\n');

    console.log('This will delete ALL documents from the workspace.');
    console.log('Use this to clean up buggy documents.\n');

    // Sign in
    const cookie = await signIn();

    // Delete all documents
    const { deletedCount, docIds } = await deleteAllDocuments(cookie);

    console.log('\n✨ Cleanup complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Documents deleted: ${deletedCount}`);
    console.log('\n📌 Next steps:');
    console.log('1. Clear browser cache');
    console.log('2. Refresh the workspace');
    console.log('3. The workspace should be empty');
    console.log('4. You can now create new documents');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
