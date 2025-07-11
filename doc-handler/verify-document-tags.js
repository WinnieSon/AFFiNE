#!/usr/bin/env node

/**
 * Verify tags in a document
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

// Target workspace and document
const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';
const docId = process.argv[2] || '35287d3f-697a-44e8-9f54-5eafd77cfdf5';

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

// Get all tags from workspace
function getWorkspaceTags(doc) {
  const tags = new Map();
  const meta = doc.getMap('meta');
  const properties = meta.get('properties');

  if (!properties || !(properties instanceof Y.Map)) {
    return tags;
  }

  const tagsMap = properties.get('tags');
  if (!tagsMap || !(tagsMap instanceof Y.Map)) {
    return tags;
  }

  const options = tagsMap.get('options');
  if (!options || !(options instanceof Y.Array)) {
    return tags;
  }

  for (let i = 0; i < options.length; i++) {
    const tag = options.get(i);
    if (tag instanceof Y.Map) {
      const id = tag.get('id');
      const value = tag.get('value');
      if (id && value) {
        tags.set(id, value);
      }
    }
  }

  return tags;
}

// Get document metadata
function getDocumentMetadata(workspaceDoc, docId) {
  const meta = workspaceDoc.getMap('meta');
  const pages = meta.get('pages');

  if (!pages || !(pages instanceof Y.Array)) {
    return null;
  }

  for (let i = 0; i < pages.length; i++) {
    const page = pages.get(i);
    if (page instanceof Y.Map && page.get('id') === docId) {
      return page;
    }
  }

  return null;
}

// Main function
async function main() {
  try {
    console.log('🏷️  Document Tag Verifier');
    console.log('=========================\n');
    console.log(`Document ID: ${docId}`);

    // Sign in
    const cookie = await signIn();

    // Read workspace
    const workspaceDoc = await readWorkspace(cookie);

    // Get all workspace tags
    console.log('\n📋 Workspace Tags:');
    const workspaceTags = getWorkspaceTags(workspaceDoc);
    workspaceTags.forEach((value, id) => {
      console.log(`   • ${value} (${id})`);
    });

    // Get document metadata
    console.log('\n📄 Document Metadata:');
    const docMeta = getDocumentMetadata(workspaceDoc, docId);

    if (!docMeta) {
      console.log('   ❌ Document metadata not found!');
      return;
    }

    console.log(`   Title: ${docMeta.get('title')}`);
    console.log(
      `   Created: ${new Date(docMeta.get('createDate')).toLocaleString()}`
    );
    console.log(
      `   Updated: ${new Date(docMeta.get('updatedDate')).toLocaleString()}`
    );

    // Check document tags
    const docTags = docMeta.get('tags');
    if (!docTags || !(docTags instanceof Y.Array)) {
      console.log('\n🏷️  Document Tags: None');
    } else {
      console.log(`\n🏷️  Document Tags (${docTags.length}):`);

      for (let i = 0; i < docTags.length; i++) {
        const tagId = docTags.get(i);
        if (typeof tagId === 'string') {
          const tagName = workspaceTags.get(tagId);
          console.log(`   • ${tagName || 'Unknown'} (${tagId})`);
        } else {
          console.log(`   • Invalid tag format:`, tagId);
        }
      }
    }

    console.log('\n✨ Verification complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
