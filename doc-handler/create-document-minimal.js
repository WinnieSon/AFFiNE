#!/usr/bin/env node

/**
 * Create minimal document structure for AFFiNE
 * Avoiding complex surface elements to prevent getValue errors
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

// Create minimal document without surface elements
function createMinimalDocument(
  docId,
  title = 'New Document',
  content = 'Welcome to your new document!'
) {
  const doc = new Y.Doc();

  // Get the blocks map
  const blocks = doc.getMap('blocks');

  // Create IDs for blocks
  const pageId = docId;
  const noteId = `${docId}:note:${crypto.randomBytes(4).toString('hex')}`;
  const paragraphId = `${docId}:paragraph:${crypto.randomBytes(4).toString('hex')}`;

  // Create root page block
  const pageBlock = new Y.Map();
  pageBlock.set('sys:id', pageId);
  pageBlock.set('sys:flavour', 'affine:page');
  pageBlock.set('sys:version', 2);

  // Children array - only note, no surface
  const pageChildren = new Y.Array();
  pageChildren.push([noteId]);
  pageBlock.set('sys:children', pageChildren);

  // Create title as Y.Text
  const titleText = new Y.Text();
  titleText.insert(0, title);
  pageBlock.set('prop:title', titleText);

  // Add page block to blocks
  blocks.set(pageId, pageBlock);

  // Create note block (without surface)
  const noteBlock = new Y.Map();
  noteBlock.set('sys:id', noteId);
  noteBlock.set('sys:flavour', 'affine:note');
  noteBlock.set('sys:version', 1);

  // Create children array for note
  const noteChildren = new Y.Array();
  noteChildren.push([paragraphId]);
  noteBlock.set('sys:children', noteChildren);

  // Note properties - simplified
  noteBlock.set('prop:xywh', '[0,0,800,600]');
  noteBlock.set('prop:background', '--affine-palette-shape-tangerine');
  noteBlock.set('prop:index', 'a0');
  noteBlock.set('prop:hidden', false);

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
  meta.set('blockVersions', blockVersions);

  // Add empty pages array to meta
  meta.set('pages', new Y.Array());

  return doc;
}

// Create document via API
async function createDocumentViaAPI(docId, title, content, cookie) {
  console.log(`\n📄 Creating document: "${title}"`);
  console.log(`   ID: ${docId}`);

  // Create the document structure
  const doc = createMinimalDocument(docId, title, content);
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
    console.log('🚀 AFFiNE Minimal Document Creation');
    console.log('==================================\n');

    console.log(
      'Creating documents without surface blocks to avoid getValue errors.\n'
    );

    // Sign in
    const cookie = await signIn();

    // Create a single test document
    const testDoc = {
      id: crypto.randomUUID(),
      title: 'Test Document (No Surface)',
      content:
        'This is a minimal document without surface blocks. It should not cause getValue errors.',
    };

    // Create the document
    await createDocumentViaAPI(
      testDoc.id,
      testDoc.title,
      testDoc.content,
      cookie
    );

    // Add to workspace metadata
    await addToWorkspaceMetadata(testDoc.id, testDoc.title, cookie);

    console.log(
      `\n🔗 View at: http://localhost:8080/workspace/${workspaceId}/${testDoc.id}`
    );

    console.log('\n✨ Document created successfully!');
    console.log('\n📌 What to do next:');
    console.log('1. Clear browser cache');
    console.log('2. Navigate to the document URL above');
    console.log('3. The document should display without errors');
    console.log('\n💡 Notes:');
    console.log('- This document has no surface block (whiteboard)');
    console.log('- It only contains text content');
    console.log('- No getValue errors should occur');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
