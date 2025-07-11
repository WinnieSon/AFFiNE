#!/usr/bin/env node

/**
 * Manage workspace tags in AFFiNE
 */

const https = require('https');
const http = require('http');
const Y = require('yjs');
const crypto = require('crypto');

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

  const cookies = response.headers['set-cookie'];
  if (!cookies) {
    throw new Error('No cookies returned from sign-in');
  }

  const sessionCookie = cookies.find(cookie =>
    cookie.includes('affine_session')
  );
  if (!sessionCookie) {
    throw new Error('No session cookie found');
  }

  console.log('✅ Signed in successfully');
  return sessionCookie.split(';')[0];
}

// Generate unique ID for tags
function generateUniqueId(length = 10) {
  const chars =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Read workspace document
async function readWorkspace(cookie) {
  console.log(`\n📖 Reading workspace document...`);

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
    throw new Error(`Failed to read workspace: ${response.statusCode}`);
  }

  console.log(`✅ Workspace read successfully`);

  // Parse Yjs document
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(response.body));

  return doc;
}

// Get all existing tags
function getAllTags(doc) {
  console.log(`\n🏷️  Getting all workspace tags...`);

  const tags = [];
  const meta = doc.getMap('meta');
  const properties = meta.get('properties');

  if (!properties || !(properties instanceof Y.Map)) {
    console.log(`   ⚠️  No properties found in meta`);
    return tags;
  }

  const tagsMap = properties.get('tags');
  if (!tagsMap || !(tagsMap instanceof Y.Map)) {
    console.log(`   ⚠️  No tags map found in properties`);
    return tags;
  }

  const options = tagsMap.get('options');
  if (!options || !(options instanceof Y.Array)) {
    console.log(`   ⚠️  No options array found in tags`);
    return tags;
  }

  console.log(`   Found ${options.length} tags in workspace`);

  for (let i = 0; i < options.length; i++) {
    const tag = options.get(i);
    if (tag instanceof Y.Map) {
      const tagInfo = {
        id: tag.get('id'),
        value: tag.get('value'),
        color: tag.get('color'),
        createDate: tag.get('createDate'),
        updateDate: tag.get('updateDate'),
      };
      tags.push(tagInfo);
      console.log(
        `   📌 Tag: "${tagInfo.value}" (${tagInfo.id}) - Color: ${tagInfo.color}`
      );
    }
  }

  return tags;
}

// Add a new tag to workspace
function addTagToWorkspace(doc, tagName, tagColor = null) {
  console.log(`\n➕ Adding tag "${tagName}" to workspace...`);

  const meta = doc.getMap('meta');
  let properties = meta.get('properties');

  // Create properties if doesn't exist
  if (!properties || !(properties instanceof Y.Map)) {
    properties = new Y.Map();
    meta.set('properties', properties);
  }

  let tagsMap = properties.get('tags');

  // Create tags map if doesn't exist
  if (!tagsMap || !(tagsMap instanceof Y.Map)) {
    tagsMap = new Y.Map();
    properties.set('tags', tagsMap);
  }

  let options = tagsMap.get('options');

  // Create options array if doesn't exist
  if (!options || !(options instanceof Y.Array)) {
    options = new Y.Array();
    tagsMap.set('options', options);
  }

  // Check if tag already exists
  for (let i = 0; i < options.length; i++) {
    const tag = options.get(i);
    if (tag instanceof Y.Map && tag.get('value') === tagName) {
      console.log(
        `   ⚠️  Tag "${tagName}" already exists with ID: ${tag.get('id')}`
      );
      return tag.get('id');
    }
  }

  // Create new tag
  const tagId = generateUniqueId(20);
  const timestamp = Date.now();
  const newTag = new Y.Map();

  newTag.set('id', tagId);
  newTag.set('value', tagName);
  newTag.set('color', tagColor || generateRandomColor());
  newTag.set('createDate', timestamp);
  newTag.set('updateDate', timestamp);

  // Add to options array
  options.push([newTag]);

  console.log(`   ✅ Tag "${tagName}" added with ID: ${tagId}`);
  return tagId;
}

// Generate random color for tag
function generateRandomColor() {
  const colors = [
    'var(--affine-tag-yellow)',
    'var(--affine-tag-red)',
    'var(--affine-tag-green)',
    'var(--affine-tag-blue)',
    'var(--affine-tag-purple)',
    'var(--affine-tag-orange)',
    'var(--affine-tag-pink)',
    'var(--affine-tag-gray)',
    'var(--affine-tag-teal)',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Update workspace document
async function updateWorkspace(doc, cookie, stateVector = null) {
  console.log(`\n💾 Saving workspace changes...`);

  let update;
  if (stateVector) {
    // Create incremental update
    update = Y.encodeStateAsUpdateV2(doc, stateVector);
  } else {
    update = Y.encodeStateAsUpdate(doc);
  }

  console.log(`   Update size: ${update.length} bytes`);

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
      `Failed to update workspace: ${response.statusCode} - ${JSON.stringify(response.body)}`
    );
  }

  console.log('✅ Workspace updated successfully');
}

// Main function to test adding "tt" tag
async function main() {
  try {
    console.log('🏷️  AFFiNE Workspace Tag Manager');
    console.log('===============================\n');

    // Sign in
    const cookie = await signIn();

    // Read workspace
    const doc = await readWorkspace(cookie);

    // Get state vector before changes
    const stateVector = Y.encodeStateVector(doc);

    // Get existing tags
    console.log('\n📋 Current tags:');
    const existingTags = getAllTags(doc);

    // Add new "tt" tag
    const newTagId = addTagToWorkspace(doc, 'tt');

    // Update workspace with incremental update
    await updateWorkspace(doc, cookie, stateVector);

    // Verify by reading again
    console.log('\n🔄 Verifying tag addition...');
    const verifyDoc = await readWorkspace(cookie);
    const updatedTags = getAllTags(verifyDoc);

    console.log('\n✨ Tag management complete!');
    console.log(`   Added tag "tt" with ID: ${newTagId}`);
    console.log(`   Total tags in workspace: ${updatedTags.length}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Export functions for use in other scripts
module.exports = {
  getAllTags,
  addTagToWorkspace,
  readWorkspace,
  updateWorkspace,
  signIn,
};

// Run if called directly
if (require.main === module) {
  main();
}
