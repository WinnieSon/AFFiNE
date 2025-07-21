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

// Function to rebuild workspace metadata with only Y.Map entries
async function rebuildWorkspaceMetadata(workspaceId, cookie) {
  console.log(`\n🔧 Rebuilding workspace metadata with only Y.Map entries...`);

  // First get the current workspace doc to extract valid Y.Map entries
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

  console.log('📋 Current workspace document retrieved');

  // Parse existing document
  const oldDoc = new Y.Doc();
  Y.applyUpdate(oldDoc, new Uint8Array(getResponse.body));

  const oldMeta = oldDoc.getMap('meta');
  const oldPages = oldMeta.get('pages');

  console.log(`📄 Found ${oldPages.length} total entries`);

  // Create new document with proper structure
  const newDoc = new Y.Doc();
  const newMeta = newDoc.getMap('meta');

  // Create new pages array
  const newPages = new Y.Array();

  // Only copy Y.Map entries
  let validCount = 0;
  let skippedCount = 0;

  console.log('\nProcessing entries:');
  oldPages.forEach((entry, idx) => {
    if (entry instanceof Y.Map) {
      // Create a new Y.Map with the same data
      const newEntry = new Y.Map();
      newEntry.set('id', entry.get('id'));
      newEntry.set('title', entry.get('title') || '');
      newEntry.set('createDate', entry.get('createDate') || Date.now());

      // Handle tags properly
      const tags = entry.get('tags');
      if (tags instanceof Y.Array) {
        const newTags = new Y.Array();
        tags.forEach(tag => newTags.push([tag]));
        newEntry.set('tags', newTags);
      } else {
        newEntry.set('tags', new Y.Array());
      }

      newPages.push([newEntry]);
      validCount++;
      console.log(`  ✅ Kept: ${entry.get('title')} (${entry.get('id')})`);
    } else {
      skippedCount++;
      console.log(`  ❌ Skipped: Entry ${idx + 1} (not a Y.Map)`);
    }
  });

  // Set the new pages array
  newMeta.set('pages', newPages);

  // Copy block versions
  const blockVersions = new Y.Map();
  blockVersions.set('affine:page', 2);
  blockVersions.set('affine:note', 1);
  blockVersions.set('affine:paragraph', 1);
  blockVersions.set('affine:surface', 5);
  newMeta.set('blockVersions', blockVersions);

  // Add workspace version
  newMeta.set('workspaceVersion', 2);

  console.log(`\n📊 Rebuild summary:`);
  console.log(`   - Valid Y.Map entries kept: ${validCount}`);
  console.log(`   - Invalid entries removed: ${skippedCount}`);
  console.log(`   - Total documents now: ${newPages.length}`);

  // Create update
  const update = Y.encodeStateAsUpdate(newDoc);

  console.log(`📝 New workspace metadata size: ${update.length} bytes`);

  // Send update to server
  const updateOptions = {
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

  const updateData = {
    updates: [Array.from(update)],
  };

  const updateResponse = await makeRequest(updateOptions, updateData);

  if (updateResponse.statusCode !== 200) {
    throw new Error(
      `Failed to update workspace doc: ${updateResponse.statusCode}`
    );
  }

  console.log('\n✅ Workspace metadata rebuilt successfully!');
  console.log('   - All invalid entries removed');
  console.log('   - Only proper Y.Map entries remain');

  return updateResponse.body;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Workspace Metadata Rebuild');
    console.log('====================================\n');

    console.log(
      'This will remove all invalid entries from the workspace metadata'
    );
    console.log('and keep only proper Y.Map entries that work correctly.\n');

    // Step 1: Sign in
    const cookie = await signIn();

    // Step 2: Rebuild workspace metadata
    const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';
    await rebuildWorkspaceMetadata(workspaceId, cookie);

    console.log('\n✨ Rebuild complete!');
    console.log('\n📌 Next steps:');
    console.log('1. Refresh your browser (Ctrl/Cmd + Shift + R)');
    console.log('2. The workspace should load without errors');
    console.log('3. All documents with proper Y.Map structure will be visible');
    console.log('\n💡 The "v.get is not a function" error should be gone!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
