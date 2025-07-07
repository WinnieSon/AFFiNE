#!/usr/bin/env node

/**
 * Proper document creation via REST API that adds Y.Map objects to workspace metadata
 * This follows the exact pattern used by AFFiNE's frontend createDoc() method
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
  docId,
  title = 'New Document',
  content = 'Welcome to your new document!'
) {
  const doc = new Y.Doc();

  // Get the blocks map
  const blocks = doc.getMap('blocks');

  // Use the provided docId as the page ID
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

  return doc;
}

// Function to create a document using REST API
async function createDocument(workspaceId, docId, title, content, cookie) {
  console.log(`\n📄 Creating document: "${title}"...`);
  console.log(`🆔 Document ID: ${docId}`);

  // Create a complete AFFiNE document
  const doc = createCompleteAffineDoc(docId, title, content);
  const update = Y.encodeStateAsUpdate(doc);

  console.log('📝 Document structure created, size:', update.length, 'bytes');

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
    guid: docId, // Specify the document ID
  };

  const response = await makeRequest(options, data);

  if (response.statusCode !== 201) {
    throw new Error(
      `Failed to create document: ${response.statusCode} - ${JSON.stringify(response.body)}`
    );
  }

  console.log('✅ Document created successfully!');

  return response.body;
}

// Function to properly add document to workspace metadata using Y.Map
async function addDocumentToWorkspaceProper(workspaceId, docId, title, cookie) {
  console.log(
    `\n📝 Adding document to workspace metadata (proper Y.Map method)...`
  );

  // Get current workspace doc
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

  // Parse workspace doc
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(getResponse.body));

  // Use transact to ensure atomic operation
  Y.transact(
    doc,
    () => {
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
        // Create a proper Y.Map for the document metadata
        // This follows the exact pattern from DocsStore.createDoc()
        const docMeta = new Y.Map([
          ['id', docId],
          ['title', title],
          ['createDate', Date.now()],
          ['tags', new Y.Array()],
        ]);

        // Push the Y.Map to the pages array
        pages.push([docMeta]);

        console.log('📋 Document added to pages array as Y.Map');
      } else {
        console.log('✓ Document already exists in workspace metadata');
        return true;
      }
    },
    'addDoc'
  );

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
      `Failed to update workspace doc: ${updateResponse.statusCode}`
    );
  }

  console.log('✅ Document added to workspace metadata as proper Y.Map');
  return true;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Document Creation with Proper Y.Map Structure');
    console.log('=======================================================\n');

    // Step 1: Sign in
    const cookie = await signIn();

    // Step 2: Create documents with proper Y.Map workflow
    const documents = [
      {
        id: crypto.randomUUID(),
        title: 'API Document with Y.Map 1',
        content:
          'This document uses proper Y.Map structure in workspace metadata! 🎉',
      },
      {
        id: crypto.randomUUID(),
        title: 'API Document with Y.Map 2',
        content: 'Another document following the exact frontend pattern 🚀',
      },
      {
        id: crypto.randomUUID(),
        title: 'API Document with Y.Map 3',
        content: 'Third document with correct Y.Map metadata structure 📝',
      },
    ];

    console.log('\n📌 Creating documents with proper Y.Map workflow:');

    for (const doc of documents) {
      // Create the document
      await createDocument(workspaceId, doc.id, doc.title, doc.content, cookie);

      // Add to workspace metadata as Y.Map
      await addDocumentToWorkspaceProper(
        workspaceId,
        doc.id,
        doc.title,
        cookie
      );

      const docUrl = `${protocol}://${hostname}:${port}/workspace/${workspaceId}/${doc.id}`;
      console.log(`\n🔗 Document URL: ${docUrl}`);
    }

    console.log(
      '\n✨ Success! All documents created with proper Y.Map structure.'
    );
    console.log('\n📌 Next steps:');
    console.log('1. Refresh your browser (Ctrl/Cmd + Shift + R)');
    console.log('2. Navigate to the workspace');
    console.log('3. All documents should be visible WITHOUT errors');
    console.log('\n💡 Key difference:');
    console.log('   - Documents are added as Y.Map objects to the pages array');
    console.log('   - This matches exactly what the frontend createDoc() does');
    console.log('   - No more "v.get is not a function" errors!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
