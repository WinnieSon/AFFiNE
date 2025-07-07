#!/usr/bin/env node

/**
 * AFFiNE Document Creation via REST API - Complete Demo
 *
 * This script demonstrates how to create documents in AFFiNE using the REST API.
 * It handles all the necessary steps including:
 * 1. Authentication
 * 2. Document creation with proper BlockSuite structure
 * 3. Workspace metadata update for visibility
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

// Create a complete AFFiNE document with all required blocks
function createCompleteAffineDoc(
  title = 'New Document',
  content = 'Welcome to your new document!'
) {
  const doc = new Y.Doc();

  // Get the blocks map
  const blocks = doc.getMap('blocks');

  // Generate unique IDs for blocks
  const docId = crypto.randomUUID();
  const pageId = docId;
  const surfaceId = docId + ':surface:home';
  const noteId = docId + ':note:home';
  const paragraphId = docId + ':paragraph:home';

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
  titleText.insert(0, title);
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
  paragraphText.insert(0, content);
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

  return { doc, docId };
}

// Function to create a document using REST API
async function createDocument(workspaceId, title, content, cookie) {
  console.log(`\n📄 Creating document: "${title}"...`);

  // Create a complete AFFiNE document
  const { doc, docId } = createCompleteAffineDoc(title, content);
  const update = Y.encodeStateAsUpdate(doc);

  console.log('📝 Document structure created, size:', update.length, 'bytes');
  console.log('🆔 Document ID:', docId);

  const options = {
    protocol: `${protocol}:`,
    hostname,
    port,
    path: `/api/workspaces/${workspaceId}/docs`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
  };

  // Send the Yjs update as initial content
  const data = {
    title: title,
    initialContent: Array.from(update),
  };

  const response = await makeRequest(options, data);

  if (response.statusCode !== 201) {
    throw new Error(
      `Failed to create document: ${response.statusCode} - ${JSON.stringify(response.body)}`
    );
  }

  console.log('✅ Document created successfully!');

  return { ...response.body, docId };
}

// Function to update workspace metadata
async function updateWorkspaceMetadata(workspaceId, newDocs, cookie) {
  console.log(`\n📝 Updating workspace metadata...`);

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

  // Parse it as Yjs document
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(getResponse.body));

  // Get the meta map
  const meta = doc.getMap('meta');
  let pages = meta.get('pages');

  if (!pages) {
    pages = new Y.Array();
    meta.set('pages', pages);
  }

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
      pages.push([
        {
          id: newDoc.id,
          title: newDoc.title || 'Untitled',
          createDate: Date.now(),
          tags: [],
        },
      ]);
      added++;
    }
  }

  if (added === 0) {
    console.log('ℹ️  All documents already exist in workspace metadata');
    return;
  }

  // Create update
  const update = Y.encodeStateAsUpdate(doc);

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

  console.log(`✅ Added ${added} document(s) to workspace metadata`);
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Document Creation via REST API Demo');
    console.log('=============================================\n');

    // Step 1: Sign in
    const cookie = await signIn();

    // Step 2: Create multiple documents
    const documents = [
      {
        title: 'API Demo Document 1',
        content: 'This is the first document created via API! 🎉',
      },
      {
        title: 'API Demo Document 2',
        content: 'Another document demonstrating the REST API capabilities 🚀',
      },
      {
        title: 'API Demo Document 3',
        content: 'Third document with custom content 📝',
      },
    ];

    const createdDocs = [];

    for (const doc of documents) {
      const result = await createDocument(
        workspaceId,
        doc.title,
        doc.content,
        cookie
      );
      createdDocs.push({
        id: result.docId,
        title: doc.title,
      });
    }

    // Step 3: Update workspace metadata
    await updateWorkspaceMetadata(workspaceId, createdDocs, cookie);

    // Step 4: Display results
    console.log('\n✨ Success! All documents created and registered.');
    console.log('\n📋 Created documents:');
    createdDocs.forEach((doc, index) => {
      const docUrl = `${protocol}://${hostname}:${port}/workspace/${workspaceId}/${doc.id}`;
      console.log(`${index + 1}. ${doc.title}`);
      console.log(`   URL: ${docUrl}`);
    });

    console.log('\n📌 Next steps:');
    console.log('1. Refresh your browser (Ctrl/Cmd + Shift + R)');
    console.log('2. Navigate to the workspace');
    console.log('3. You should see all the newly created documents');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
