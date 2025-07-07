#!/usr/bin/env node

/**
 * Fix specific document content that appears broken in the browser
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

// Target workspace and document
const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';
const brokenDocId = '4c866562-da68-4136-baca-92b6c802e653';

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

// Analyze document structure
async function analyzeDocument(docId, cookie) {
  console.log(`\n🔍 Analyzing document ${docId}...`);

  const getOptions = {
    protocol: `${protocol}:`,
    hostname,
    port,
    path: `/api/workspaces/${workspaceId}/docs/${docId}`,
    method: 'GET',
    headers: {
      Cookie: cookie,
    },
  };

  const getResponse = await makeRequest(getOptions, null, true);

  if (getResponse.statusCode !== 200) {
    console.log(`❌ Document not found: ${getResponse.statusCode}`);
    return null;
  }

  // Parse document
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(getResponse.body));

  console.log('\n📊 Document Structure Analysis:');
  console.log('================================');

  // Check blocks
  const blocks = doc.getMap('blocks');
  console.log(`\n📦 Blocks: ${blocks.size} total`);

  let hasIssues = false;
  let pageBlock = null;

  blocks.forEach((block, id) => {
    if (block instanceof Y.Map) {
      const flavour = block.get('sys:flavour');
      const version = block.get('sys:version');
      console.log(`   - ${id}: ${flavour} (v${version || 'unknown'})`);

      if (flavour === 'affine:page') {
        pageBlock = block;
        // Check page structure
        if (!block.has('sys:children')) {
          console.log(`     ⚠️  Missing sys:children`);
          hasIssues = true;
        }
        if (!block.has('prop:title')) {
          console.log(`     ⚠️  Missing prop:title`);
          hasIssues = true;
        }
      }
    } else {
      console.log(`   - ${id}: ❌ NOT A Y.MAP (${typeof block})`);
      hasIssues = true;
    }
  });

  // Check meta
  const meta = doc.getMap('meta');
  console.log(
    `\n📝 Meta: ${meta instanceof Y.Map ? '✅ Y.Map' : '❌ Not Y.Map'}`
  );

  if (meta instanceof Y.Map) {
    console.log(`   - workspaceVersion: ${meta.get('workspaceVersion')}`);
    console.log(
      `   - blockVersions: ${meta.has('blockVersions') ? '✅' : '❌'}`
    );
  }

  return { doc, hasIssues, pageBlock, blocks };
}

// Create proper document structure
function createProperDocument(docId, title = 'Meeting Notes') {
  const doc = new Y.Doc();

  // Get blocks map
  const blocks = doc.getMap('blocks');

  // Create IDs
  const pageId = docId;
  const surfaceId = `${docId}:surface:${crypto.randomBytes(4).toString('hex')}`;
  const noteId = `${docId}:note:${crypto.randomBytes(4).toString('hex')}`;
  const paragraphId = `${docId}:paragraph:${crypto.randomBytes(4).toString('hex')}`;

  // Create page block
  const pageBlock = new Y.Map();
  pageBlock.set('sys:id', pageId);
  pageBlock.set('sys:flavour', 'affine:page');
  pageBlock.set('sys:version', 2);

  // Children array
  const pageChildren = new Y.Array();
  pageChildren.push([surfaceId, noteId]);
  pageBlock.set('sys:children', pageChildren);

  // Title
  const titleText = new Y.Text();
  titleText.insert(0, title);
  pageBlock.set('prop:title', titleText);

  blocks.set(pageId, pageBlock);

  // Create surface block
  const surfaceBlock = new Y.Map();
  surfaceBlock.set('sys:id', surfaceId);
  surfaceBlock.set('sys:flavour', 'affine:surface');
  surfaceBlock.set('sys:version', 5);
  surfaceBlock.set('sys:children', new Y.Array());
  surfaceBlock.set('prop:elements', new Y.Map());

  blocks.set(surfaceId, surfaceBlock);

  // Create note block
  const noteBlock = new Y.Map();
  noteBlock.set('sys:id', noteId);
  noteBlock.set('sys:flavour', 'affine:note');
  noteBlock.set('sys:version', 1);

  const noteChildren = new Y.Array();
  noteChildren.push([paragraphId]);
  noteBlock.set('sys:children', noteChildren);

  // Note properties
  noteBlock.set('prop:xywh', '[0,0,800,95]');
  noteBlock.set('prop:background', '--affine-palette-shape-tangerine');
  noteBlock.set('prop:index', 'a0');
  noteBlock.set('prop:hidden', false);
  noteBlock.set('prop:displayMode', 'both');

  const edgelessMap = new Y.Map();
  const styleMap = new Y.Map();
  styleMap.set('borderRadius', 8);
  styleMap.set('borderSize', 4);
  styleMap.set('borderStyle', 'solid');
  styleMap.set('shadowType', '--affine-note-shadow-box');
  edgelessMap.set('style', styleMap);
  noteBlock.set('prop:edgeless', edgelessMap);

  blocks.set(noteId, noteBlock);

  // Create paragraph block
  const paragraphBlock = new Y.Map();
  paragraphBlock.set('sys:id', paragraphId);
  paragraphBlock.set('sys:flavour', 'affine:paragraph');
  paragraphBlock.set('sys:version', 1);
  paragraphBlock.set('sys:children', new Y.Array());
  paragraphBlock.set('prop:type', 'text');

  const paragraphText = new Y.Text();
  paragraphText.insert(
    0,
    'All documents are created with proper Y.Map objects in the workspace metadata.'
  );
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

  return doc;
}

// Fix document
async function fixDocument(docId, cookie) {
  console.log(`\n🔧 Fixing document ${docId}...`);

  // Create proper document structure
  const doc = createProperDocument(docId, 'Meeting Notes');
  const update = Y.encodeStateAsUpdate(doc);

  console.log(`📝 New document size: ${update.length} bytes`);

  // Send update
  const putOptions = {
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

  const putData = {
    updates: [Array.from(update)],
  };

  const putResponse = await makeRequest(putOptions, putData);

  if (putResponse.statusCode !== 200) {
    throw new Error(`Failed to update document: ${putResponse.statusCode}`);
  }

  console.log('✅ Document fixed successfully!');

  return true;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Document Content Fixer');
    console.log('================================\n');

    console.log(`Target document: ${brokenDocId}`);
    console.log('This will analyze and fix the broken document structure.\n');

    // Sign in
    const cookie = await signIn();

    // Analyze current document
    const analysis = await analyzeDocument(brokenDocId, cookie);

    if (!analysis) {
      console.log('\n❌ Document not found, creating new one...');
    } else if (analysis.hasIssues) {
      console.log('\n⚠️  Document has structural issues, fixing...');
    } else {
      console.log('\n✅ Document structure looks OK');
      console.log('The display issue might be due to corrupted content.');
    }

    // Fix the document
    await fixDocument(brokenDocId, cookie);

    console.log('\n✨ Fix complete!');
    console.log('\n📌 Next steps:');
    console.log('1. Clear browser cache (Ctrl/Cmd + Shift + R)');
    console.log('2. Navigate to the document:');
    console.log(
      `   http://localhost:8080/workspace/${workspaceId}/${brokenDocId}`
    );
    console.log('3. The document should now display properly');
    console.log('\n💡 If still having issues:');
    console.log('   - Try opening in an incognito window');
    console.log('   - Check browser console for errors');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
