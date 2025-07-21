#!/usr/bin/env node

/**
 * Remove invalid entries from workspace pages array
 */

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

// Remove invalid entries
async function removeInvalidEntries(cookie) {
  console.log('\n🧹 Removing invalid entries from workspace...\n');

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
  const oldPages = meta.get('pages');

  console.log(`📄 Current pages: ${oldPages.length}`);

  // Create new pages array with only valid entries
  const newPages = new Y.Array();
  let validCount = 0;
  let invalidCount = 0;

  // Use transaction to ensure atomic operation
  Y.transact(doc, () => {
    oldPages.forEach((page, idx) => {
      if (page instanceof Y.Map) {
        // Valid Y.Map entry
        const newEntry = new Y.Map();
        newEntry.set('id', page.get('id'));
        newEntry.set('title', page.get('title') || '');
        newEntry.set('createDate', page.get('createDate') || Date.now());

        // Handle tags
        const tags = page.get('tags');
        if (tags instanceof Y.Array) {
          const newTags = new Y.Array();
          tags.forEach(tag => newTags.push([tag]));
          newEntry.set('tags', newTags);
        } else {
          newEntry.set('tags', new Y.Array());
        }

        newPages.push([newEntry]);
        validCount++;
        console.log(
          `✅ Kept: ${page.get('title') || 'Untitled'} (${page.get('id')})`
        );
      } else {
        // Invalid entry
        invalidCount++;
        console.log(`❌ Removed: Invalid entry at position ${idx + 1}`);
      }
    });

    // Replace the pages array
    meta.set('pages', newPages);
  });

  console.log(`\n📊 Results:`);
  console.log(`   - Valid entries kept: ${validCount}`);
  console.log(`   - Invalid entries removed: ${invalidCount}`);
  console.log(`   - New total: ${newPages.length}`);

  // Create update
  const update = Y.encodeStateAsUpdate(doc);

  // Send update to server
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

  console.log('\n✅ Workspace cleaned successfully!');

  return { validCount, invalidCount };
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Workspace Invalid Entry Remover');
    console.log('========================================\n');

    console.log(
      'This will remove all invalid (non-Y.Map) entries from the workspace.'
    );
    console.log('Valid documents will be preserved.\n');

    // Sign in
    const cookie = await signIn();

    // Remove invalid entries
    const { validCount, invalidCount } = await removeInvalidEntries(cookie);

    console.log('\n✨ Cleanup complete!');
    console.log('\n📌 Next steps:');
    console.log('1. The endless sync loop should stop now');
    console.log('2. Refresh your browser (Ctrl/Cmd + Shift + R)');
    console.log('3. If still having issues:');
    console.log('   - Stop the server');
    console.log('   - Clear browser cache for localhost:8080');
    console.log('   - Restart and use incognito window');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
