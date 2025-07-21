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

// Function to migrate workspace metadata
async function migrateWorkspaceMetadata(workspaceId, cookie) {
  console.log(`\n🔄 Migrating workspace metadata to proper Y.Map structure...`);

  // First get the current workspace doc
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

  console.log(
    '📋 Current workspace document size:',
    getResponse.body.length,
    'bytes'
  );

  // Parse existing document
  const oldDoc = new Y.Doc();
  Y.applyUpdate(oldDoc, new Uint8Array(getResponse.body));

  const oldMeta = oldDoc.getMap('meta');
  const oldPages = oldMeta.get('pages');

  console.log(`📄 Found ${oldPages.length} pages to migrate`);

  // Create new document with proper structure
  const newDoc = new Y.Doc();
  const newMeta = newDoc.getMap('meta');

  // Create new pages array
  const newPages = new Y.Array();

  // Migrate each page
  let migratedCount = 0;
  let preservedCount = 0;

  for (let i = 0; i < oldPages.length; i++) {
    const entry = oldPages.get(i);

    if (entry instanceof Y.Map) {
      // Already a Y.Map, preserve as is
      const pageMap = new Y.Map();
      pageMap.set('id', entry.get('id'));
      pageMap.set('title', entry.get('title'));
      pageMap.set('createDate', entry.get('createDate') || Date.now());

      const tags = entry.get('tags');
      if (tags instanceof Y.Array) {
        const newTags = new Y.Array();
        tags.forEach(tag => newTags.push([tag]));
        pageMap.set('tags', newTags);
      } else {
        pageMap.set('tags', new Y.Array());
      }

      newPages.push([pageMap]);
      preservedCount++;
      console.log(`  ✓ Preserved: ${entry.get('title')} (${entry.get('id')})`);
    } else if (entry && typeof entry === 'object') {
      // Plain object, need to convert to Y.Map
      const pageMap = new Y.Map();
      pageMap.set('id', entry.id);
      pageMap.set('title', entry.title || 'Untitled');
      pageMap.set('createDate', entry.createDate || Date.now());

      // Convert tags array to Y.Array
      const tagsArray = new Y.Array();
      if (Array.isArray(entry.tags)) {
        entry.tags.forEach(tag => tagsArray.push([tag]));
      }
      pageMap.set('tags', tagsArray);

      newPages.push([pageMap]);
      migratedCount++;
      console.log(`  ➡️  Migrated: ${entry.title} (${entry.id})`);
    }
  }

  // Set the new pages array
  newMeta.set('pages', newPages);

  // Copy other metadata
  const blockVersions = oldMeta.get('blockVersions');
  const newBlockVersions = new Y.Map();

  if (blockVersions instanceof Y.Map) {
    // Copy existing block versions
    blockVersions.forEach((value, key) => {
      newBlockVersions.set(key, value);
    });
  } else {
    // Set default block versions
    newBlockVersions.set('affine:page', 2);
    newBlockVersions.set('affine:note', 1);
    newBlockVersions.set('affine:paragraph', 1);
    newBlockVersions.set('affine:surface', 5);
  }

  newMeta.set('blockVersions', newBlockVersions);

  const workspaceVersion = oldMeta.get('workspaceVersion');
  newMeta.set('workspaceVersion', workspaceVersion || 2);

  console.log(`\n📊 Migration summary:`);
  console.log(`   - Preserved: ${preservedCount} Y.Map entries`);
  console.log(`   - Migrated: ${migratedCount} plain objects to Y.Map`);
  console.log(`   - Total pages: ${newPages.length}`);

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
      `Failed to update workspace doc: ${updateResponse.statusCode} - ${JSON.stringify(updateResponse.body)}`
    );
  }

  console.log('\n✅ Workspace metadata migrated successfully!');
  return updateResponse.body;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Workspace Metadata Migration');
    console.log('======================================\n');

    // Step 1: Sign in
    const cookie = await signIn();

    // Step 2: Migrate workspace metadata
    const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';
    await migrateWorkspaceMetadata(workspaceId, cookie);

    console.log('\n✨ Migration complete!');
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
