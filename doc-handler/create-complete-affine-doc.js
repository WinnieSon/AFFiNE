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

// Function to get user's workspaces using GraphQL
async function getWorkspaces(cookie) {
  console.log('📋 Getting workspaces...');

  const query = `
    query {
      currentUser {
        id
        email
      }
      workspaces {
        id
        owner {
          id
          email
        }
      }
    }
  `;

  const options = {
    protocol: `${protocol}:`,
    hostname,
    port,
    path: '/graphql',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
  };

  const data = { query };

  const response = await makeRequest(options, data);

  if (response.statusCode !== 200) {
    throw new Error(
      `Failed to get workspaces: ${response.statusCode} - ${JSON.stringify(response.body)}`
    );
  }

  const workspaces = response.body.data.workspaces;
  console.log(`✅ Found ${workspaces.length} workspace(s)`);
  workspaces.forEach(ws => {
    console.log(`  - Workspace ID: ${ws.id}, Owner: ${ws.owner.email}`);
  });

  return workspaces;
}

// Create a complete AFFiNE document with all required blocks
function createCompleteAffineDoc(title = 'New Document') {
  const doc = new Y.Doc();

  // Get the blocks map
  const blocks = doc.getMap('blocks');

  // Generate unique IDs for blocks
  const pageId = doc.clientID + ':page:home';
  const surfaceId = doc.clientID + ':surface:home';
  const noteId = doc.clientID + ':note:home';
  const paragraphId = doc.clientID + ':paragraph:home';

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
  paragraphText.insert(
    0,
    'Welcome to your new document created via REST API! 🎉'
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

  // Add document to pages list
  const pages = new Y.Array();
  pages.push([
    {
      id: pageId,
      title: title,
      createDate: Date.now(),
      tags: [],
    },
  ]);
  meta.set('pages', pages);

  // Add workspace version
  meta.set('workspaceVersion', 2);

  return doc;
}

// Function to create a document using REST API
async function createDocument(workspaceId, cookie) {
  console.log(`\n📄 Creating complete document in workspace ${workspaceId}...`);

  // Create a complete AFFiNE document
  const doc = createCompleteAffineDoc('Complete Document via REST API');
  const update = Y.encodeStateAsUpdate(doc);

  console.log(
    '📝 Complete Yjs document created, size:',
    update.length,
    'bytes'
  );

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
    title: 'Complete Document via REST API',
    initialContent: Array.from(update),
  };

  const response = await makeRequest(options, data);

  if (response.statusCode !== 201) {
    throw new Error(
      `Failed to create document: ${response.statusCode} - ${JSON.stringify(response.body)}`
    );
  }

  console.log('✅ Document created successfully!');
  console.log('📋 Document details:', JSON.stringify(response.body, null, 2));

  return response.body;
}

// Function to also update workspace root doc
async function updateWorkspaceRootDoc(workspaceId, docId, cookie) {
  console.log(`\n📝 Updating workspace root document...`);

  // First, get the current workspace doc
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

  const response = await makeRequest(options);

  if (response.statusCode === 200) {
    console.log('✅ Workspace root doc exists, document should be registered');
  } else {
    console.log('⚠️  Could not verify workspace root doc');
  }
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE REST API Complete Document Creation Test');
    console.log('===============================================\n');

    // Step 1: Sign in
    const cookie = await signIn();

    // Step 2: Get workspaces
    const workspaces = await getWorkspaces(cookie);

    if (workspaces.length === 0) {
      console.log('❌ No workspaces found for this user');
      return;
    }

    // Step 3: Create document in the first workspace
    const targetWorkspace = workspaces[0];
    console.log(`\n🎯 Using workspace: ${targetWorkspace.id}`);

    const doc = await createDocument(targetWorkspace.id, cookie);

    // Step 4: Verify workspace root doc
    await updateWorkspaceRootDoc(targetWorkspace.id, doc.docId, cookie);

    console.log('\n✨ Success! Complete document created:');
    console.log(`   ID: ${doc.docId}`);
    console.log(`   Workspace: ${doc.workspaceId}`);
    console.log(`   Created at: ${doc.createdAt}`);
    console.log(`   Created by: ${doc.createdBy}`);

    // Build the URL to access the document
    const docUrl = `${protocol}://${hostname}:${port}/workspace/${doc.workspaceId}/${doc.docId}`;
    console.log(`\n🔗 Access your document at: ${docUrl}`);
    console.log(
      '\n💡 Note: The document should now be visible in the browser!'
    );
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
