#!/usr/bin/env node

/**
 * Test tag creation flow step by step
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

  const cookies = response.headers['set-cookie'];
  const sessionCookie = cookies.find(cookie =>
    cookie.includes('affine_session')
  );

  console.log('✅ Signed in successfully');
  return sessionCookie.split(';')[0];
}

// Create meeting note document with single tag
async function createTestDocument(cookie, tagName) {
  console.log(`\n📄 Creating test document with tag: "${tagName}"`);

  const options = {
    protocol: `${protocol}:`,
    hostname,
    port,
    path: `/api/workspaces/${workspaceId}/docs/from-meeting`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
  };

  const data = {
    title: `Test Document - ${new Date().toISOString()}`,
    date: '2025-07-11',
    time: '14:00',
    location: 'Test Location',
    participants: ['Test User'],
    tags: [tagName],
    summary: ['Test summary'],
  };

  const response = await makeRequest(options, data);

  if (response.statusCode !== 201) {
    throw new Error(
      `Failed to create document: ${response.statusCode} - ${JSON.stringify(response.body)}`
    );
  }

  console.log('✅ Document created:', response.body.docId);
  return response.body.docId;
}

// Read workspace to check tags
async function readWorkspaceAndCheckTags(cookie) {
  console.log(`\n🔍 Reading workspace to check tags...`);

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

  // Parse Yjs document
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(response.body));

  // Get workspace tags
  const meta = doc.getMap('meta');
  const properties = meta.get('properties');
  const tags = [];

  if (properties && properties instanceof Y.Map) {
    const tagsMap = properties.get('tags');
    if (tagsMap && tagsMap instanceof Y.Map) {
      const options = tagsMap.get('options');
      if (options && options instanceof Y.Array) {
        for (let i = 0; i < options.length; i++) {
          const tag = options.get(i);
          if (tag instanceof Y.Map) {
            tags.push({
              id: tag.get('id'),
              value: tag.get('value'),
            });
          }
        }
      }
    }
  }

  console.log(`✅ Found ${tags.length} workspace tags:`);
  tags.forEach(tag => {
    console.log(`   • ${tag.value} (${tag.id})`);
  });

  return { doc, tags };
}

// Check document tags
function checkDocumentTags(doc, docId) {
  console.log(`\n📄 Checking tags for document ${docId}...`);

  const meta = doc.getMap('meta');
  const pages = meta.get('pages');

  if (!pages || !(pages instanceof Y.Array)) {
    console.log('❌ No pages found');
    return [];
  }

  for (let i = 0; i < pages.length; i++) {
    const page = pages.get(i);
    if (page instanceof Y.Map && page.get('id') === docId) {
      const tags = page.get('tags');
      if (tags && tags instanceof Y.Array) {
        const tagList = [];
        for (let j = 0; j < tags.length; j++) {
          tagList.push(tags.get(j));
        }
        console.log(`✅ Found ${tagList.length} tags on document:`, tagList);
        return tagList;
      } else {
        console.log('❌ No tags found on document');
        return [];
      }
    }
  }

  console.log('❌ Document not found in pages');
  return [];
}

// Main test
async function main() {
  try {
    console.log('🧪 Tag Creation Flow Test');
    console.log('=========================');

    // Sign in
    const cookie = await signIn();

    // Check initial workspace tags
    console.log('\n1️⃣ Initial workspace state:');
    await readWorkspaceAndCheckTags(cookie);

    // Create a document with a new tag
    const testTagName = `TestTag_${Date.now()}`;
    console.log(`\n2️⃣ Creating document with new tag: "${testTagName}"`);
    const docId = await createTestDocument(cookie, testTagName);

    // Wait a moment for sync
    console.log('\n⏳ Waiting for sync...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check workspace tags again
    console.log('\n3️⃣ Checking workspace after document creation:');
    const { doc: workspaceDoc, tags: updatedTags } =
      await readWorkspaceAndCheckTags(cookie);

    // Check if new tag was added
    const newTag = updatedTags.find(tag => tag.value === testTagName);
    if (newTag) {
      console.log(
        `✅ New tag found in workspace: ${newTag.value} (${newTag.id})`
      );
    } else {
      console.log(`❌ New tag "${testTagName}" NOT found in workspace!`);
    }

    // Check document tags
    console.log('\n4️⃣ Checking document tags:');
    const docTags = checkDocumentTags(workspaceDoc, docId);

    // Verify tag assignment
    if (newTag && docTags.includes(newTag.id)) {
      console.log('✅ Tag correctly assigned to document!');
    } else {
      console.log('❌ Tag NOT correctly assigned to document');
      console.log('   Expected tag ID:', newTag?.id);
      console.log('   Document tag IDs:', docTags);
    }

    console.log('\n✨ Test complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  main();
}
