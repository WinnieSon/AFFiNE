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
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const client = protocol === 'https' ? https : http;
    const req = client.request(options, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try {
          const result = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null,
          };
          resolve(result);
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
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

// Create the Yjs document structure for the missing document
function createDocumentContent() {
  const doc = new Y.Doc();

  // Get the blocks map
  const blocks = doc.getMap('blocks');

  // Generate unique IDs for blocks
  const pageId = '4539dc36-0775-4641-a679-3ce20048f791';
  const surfaceId = pageId + ':surface:home';
  const noteId = pageId + ':note:home';
  const paragraphId = pageId + ':paragraph:home';

  // Create root page block
  const pageBlock = new Y.Map();
  pageBlock.set('sys:id', pageId);
  pageBlock.set('sys:flavour', 'affine:page');

  // Create children array with correct references
  const pageChildren = new Y.Array();
  pageChildren.push([surfaceId, noteId]);
  pageBlock.set('sys:children', pageChildren);

  // Create title as Y.Text
  const titleText = new Y.Text();
  titleText.insert(0, 'Test Document Created via REST API');
  pageBlock.set('prop:title', titleText);

  // Add page block to blocks
  blocks.set(pageId, pageBlock);

  // Create surface block (required for AFFiNE)
  const surfaceBlock = new Y.Map();
  surfaceBlock.set('sys:id', surfaceId);
  surfaceBlock.set('sys:flavour', 'affine:surface');
  surfaceBlock.set('sys:children', new Y.Array());
  surfaceBlock.set('prop:elements', new Y.Map());

  blocks.set(surfaceId, surfaceBlock);

  // Create note block with proper properties
  const noteBlock = new Y.Map();
  noteBlock.set('sys:id', noteId);
  noteBlock.set('sys:flavour', 'affine:note');

  // Create children array for note
  const noteChildren = new Y.Array();
  noteChildren.push([paragraphId]);
  noteBlock.set('sys:children', noteChildren);

  // Note properties
  noteBlock.set('prop:xywh', '[0,0,800,95]');
  noteBlock.set('prop:background', '--affine-palette-shape-tangerine');
  noteBlock.set('prop:index', 'a0');
  noteBlock.set('prop:lockedBySelf', false);
  noteBlock.set('prop:hidden', false);
  noteBlock.set('prop:displayMode', 'both');
  noteBlock.set(
    'prop:edgeless',
    new Y.Map([
      [
        'style',
        new Y.Map([
          ['borderRadius', 8],
          ['borderSize', 4],
          ['borderStyle', 'solid'],
          ['shadowType', '--affine-note-shadow-box'],
        ]),
      ],
    ])
  );

  blocks.set(noteId, noteBlock);

  // Create paragraph block with text
  const paragraphBlock = new Y.Map();
  paragraphBlock.set('sys:id', paragraphId);
  paragraphBlock.set('sys:flavour', 'affine:paragraph');
  paragraphBlock.set('sys:children', new Y.Array());
  paragraphBlock.set('prop:type', 'text');

  // Create text content
  const paragraphText = new Y.Text();
  paragraphText.insert(
    0,
    'This document was missing a snapshot - now fixed! 🔧'
  );
  paragraphBlock.set('prop:text', paragraphText);

  blocks.set(paragraphId, paragraphBlock);

  // Create meta information
  const meta = doc.getMap('meta');
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

  return doc;
}

// Function to fix the missing document
async function fixMissingDocument(workspaceId, docId, cookie) {
  console.log(`\n🔧 Fixing missing snapshot for document ${docId}...`);

  // Create the document content
  const doc = createDocumentContent();
  const update = Y.encodeStateAsUpdate(doc);

  console.log('📝 Document content created, size:', update.length, 'bytes');

  const options = {
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

  const data = {
    updates: [Array.from(update)],
  };

  const response = await makeRequest(options, data);

  if (response.statusCode !== 200) {
    throw new Error(
      `Failed to update document: ${response.statusCode} - ${JSON.stringify(response.body)}`
    );
  }

  console.log('✅ Document snapshot created successfully!');

  return response.body;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Missing Document Fix');
    console.log('==============================\n');

    // Step 1: Sign in
    const cookie = await signIn();

    // Step 2: Fix the missing document
    const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';
    const missingDocId = '4539dc36-0775-4641-a679-3ce20048f791';

    await fixMissingDocument(workspaceId, missingDocId, cookie);

    console.log('\n✨ Fix complete!');
    console.log(
      'The document should now be accessible via the REST API and visible in the browser.'
    );
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
