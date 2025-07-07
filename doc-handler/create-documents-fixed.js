#!/usr/bin/env node

/**
 * Fixed document creation for AFFiNE with proper Y.Map for surface elements
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

// Create a complete AFFiNE document structure with fixed surface elements
function createAffineDocument(
  docId,
  title = 'New Document',
  content = 'Welcome to your new document!'
) {
  const doc = new Y.Doc();

  // Get the blocks map
  const blocks = doc.getMap('blocks');

  // Create IDs for all blocks
  const pageId = docId;
  const surfaceId = `${docId}:surface:${crypto.randomBytes(4).toString('hex')}`;
  const noteId = `${docId}:note:${crypto.randomBytes(4).toString('hex')}`;
  const paragraphId = `${docId}:paragraph:${crypto.randomBytes(4).toString('hex')}`;

  // Create root page block
  const pageBlock = new Y.Map();
  pageBlock.set('sys:id', pageId);
  pageBlock.set('sys:flavour', 'affine:page');
  pageBlock.set('sys:version', 2);

  // Create children array with surface and note
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
  surfaceBlock.set('sys:version', 5);
  surfaceBlock.set('sys:children', new Y.Array());

  // CRITICAL FIX: Surface elements must be a Y.Map, not a plain object
  const elementsMap = new Y.Map();
  // Don't add any elements initially - let the frontend handle it
  surfaceBlock.set('prop:elements', elementsMap);

  blocks.set(surfaceId, surfaceBlock);

  // Create note block
  const noteBlock = new Y.Map();
  noteBlock.set('sys:id', noteId);
  noteBlock.set('sys:flavour', 'affine:note');
  noteBlock.set('sys:version', 1);

  // Create children array for note
  const noteChildren = new Y.Array();
  noteChildren.push([paragraphId]);
  noteBlock.set('sys:children', noteChildren);

  // Note properties
  noteBlock.set('prop:xywh', '[0,0,800,95]');
  noteBlock.set('prop:background', '--affine-palette-shape-tangerine');
  noteBlock.set('prop:index', 'a0');
  noteBlock.set('prop:hidden', false);
  noteBlock.set('prop:displayMode', 'both');

  // Edgeless properties
  const edgelessMap = new Y.Map();
  const styleMap = new Y.Map();
  styleMap.set('borderRadius', 8);
  styleMap.set('borderSize', 4);
  styleMap.set('borderStyle', 'solid');
  styleMap.set('shadowType', '--affine-note-shadow-box');
  edgelessMap.set('style', styleMap);
  noteBlock.set('prop:edgeless', edgelessMap);

  blocks.set(noteId, noteBlock);

  // Create paragraph block with text
  const paragraphBlock = new Y.Map();
  paragraphBlock.set('sys:id', paragraphId);
  paragraphBlock.set('sys:flavour', 'affine:paragraph');
  paragraphBlock.set('sys:version', 1);
  paragraphBlock.set('sys:children', new Y.Array());
  paragraphBlock.set('prop:type', 'text');

  // Create text content
  const paragraphText = new Y.Text();
  paragraphText.insert(0, content);
  paragraphBlock.set('prop:text', paragraphText);

  blocks.set(paragraphId, paragraphBlock);

  // Set metadata
  const meta = doc.getMap('meta');
  meta.set('workspaceVersion', 2);

  const blockVersions = new Y.Map();
  blockVersions.set('affine:page', 2);
  blockVersions.set('affine:note', 1);
  blockVersions.set('affine:paragraph', 1);
  blockVersions.set('affine:surface', 5);
  meta.set('blockVersions', blockVersions);

  // Add pages array to meta (empty for document meta)
  meta.set('pages', new Y.Array());

  return doc;
}

// Create document via API
async function createDocumentViaAPI(docId, title, content, cookie) {
  console.log(`\n📄 Creating document: "${title}"`);
  console.log(`   ID: ${docId}`);

  // Create the document structure
  const doc = createAffineDocument(docId, title, content);
  const update = Y.encodeStateAsUpdate(doc);

  // Create document via API
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

  if (response.statusCode !== 200 && response.statusCode !== 201) {
    throw new Error(`Failed to create document: ${response.statusCode}`);
  }

  console.log('✅ Document created successfully');
  return true;
}

// Add document to workspace metadata using Y.Map
async function addToWorkspaceMetadata(docId, title, cookie) {
  console.log(`📝 Adding to workspace metadata...`);

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

  // Update existing workspace doc
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(getResponse.body));

  // Use transact for atomic operation
  Y.transact(doc, () => {
    const meta = doc.getMap('meta');
    let pages = meta.get('pages');

    if (!pages || !(pages instanceof Y.Array)) {
      pages = new Y.Array();
      meta.set('pages', pages);
    }

    // Check if document already exists
    let exists = false;
    pages.forEach(page => {
      if (page instanceof Y.Map && page.get('id') === docId) {
        exists = true;
      }
    });

    if (!exists) {
      // Create proper Y.Map for document metadata
      const docMeta = new Y.Map();
      docMeta.set('id', docId);
      docMeta.set('title', title);
      docMeta.set('createDate', Date.now());
      docMeta.set('tags', new Y.Array());

      // Push to pages array
      pages.push([docMeta]);
    }
  });

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

  console.log('✅ Added to workspace metadata');
  return true;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Document Creation (Fixed Surface Elements)');
    console.log('=================================================\n');

    // Sign in
    const cookie = await signIn();

    // Create multiple documents
    const documents = [
      {
        id: crypto.randomUUID(),
        title: 'Fixed Document 1',
        content:
          'This document has properly structured surface elements using Y.Map.',
      },
      {
        id: crypto.randomUUID(),
        title: 'Fixed Document 2',
        content:
          'All elements in this document use the correct Yjs data structures.',
      },
      {
        id: crypto.randomUUID(),
        title: 'Fixed Document 3',
        content:
          'Surface elements are now Y.Map objects, not plain JavaScript objects.',
      },
    ];

    for (const doc of documents) {
      // Create the document
      await createDocumentViaAPI(doc.id, doc.title, doc.content, cookie);

      // Add to workspace metadata
      await addToWorkspaceMetadata(doc.id, doc.title, cookie);

      console.log(
        `🔗 View at: http://localhost:8080/workspace/${workspaceId}/${doc.id}\n`
      );
    }

    console.log('\n✨ All documents created successfully!');
    console.log('\n📌 What to do next:');
    console.log('1. Clear browser cache (Ctrl/Cmd + Shift + Delete)');
    console.log('2. Open a new incognito/private window');
    console.log('3. Go to http://localhost:8080');
    console.log('4. Sign in with pro@affine.pro / pro');
    console.log('5. Your documents should now display without errors');
    console.log('\n💡 Key fixes:');
    console.log('- Surface elements are now proper Y.Map objects');
    console.log('- No more "getValue is not a function" errors');
    console.log('- All Yjs structures properly initialized');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
