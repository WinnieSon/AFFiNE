#!/usr/bin/env node

/**
 * Diagnose document access issues
 */

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

// Target workspace and document
const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';
const docId = '69a43697-f457-4eda-a2a7-3eb0ad75dce6';

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

// Check document metadata in workspace
async function checkWorkspaceMeta(cookie) {
  console.log('\n📋 Checking workspace metadata...');

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
    console.log(`❌ Failed to get workspace metadata: ${response.statusCode}`);
    return false;
  }

  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(response.body));

  const meta = doc.getMap('meta');
  const pages = meta.get('pages');

  if (pages && pages instanceof Y.Array) {
    let found = false;
    for (let i = 0; i < pages.length; i++) {
      const page = pages.get(i);
      if (page && page.get('id') === docId) {
        found = true;
        console.log(`✅ Document found in workspace metadata`);
        console.log(`   ID: ${page.get('id')}`);
        console.log(`   Title: ${page.get('title')}`);
        console.log(
          `   Created: ${new Date(page.get('createDate')).toISOString()}`
        );
        console.log(
          `   Updated: ${new Date(page.get('updatedDate')).toISOString()}`
        );
        console.log(
          `   Tags: ${JSON.stringify(page.get('tags')?.toJSON() || [])}`
        );
        break;
      }
    }

    if (!found) {
      console.log(`❌ Document NOT found in workspace metadata`);
      console.log(`   Total pages in workspace: ${pages.length}`);
    }

    return found;
  }

  return false;
}

// Check document access
async function checkDocumentAccess(cookie) {
  console.log('\n🔍 Checking document access...');

  const options = {
    protocol: `${protocol}:`,
    hostname,
    port,
    path: `/api/workspaces/${workspaceId}/docs/${docId}`,
    method: 'GET',
    headers: {
      Cookie: cookie,
    },
  };

  const response = await makeRequest(options, null, true);

  console.log(`   Status: ${response.statusCode}`);
  console.log(`   Size: ${response.body ? response.body.length : 0} bytes`);

  if (response.statusCode === 200 && response.body) {
    // Try to parse the document
    try {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, new Uint8Array(response.body));

      const blocks = doc.getMap('blocks');
      console.log(`   Blocks: ${blocks.size}`);

      // Check for page block
      let pageFound = false;
      blocks.forEach((block, id) => {
        if (block.get('sys:flavour') === 'affine:page') {
          pageFound = true;
          console.log(`   Page block found: ${id}`);
          console.log(
            `   Title: ${block.get('prop:title')?.toString() || '(empty)'}`
          );
        }
      });

      if (!pageFound) {
        console.log(`   ⚠️  No page block found in document`);
      }

      return true;
    } catch (e) {
      console.log(`   ❌ Failed to parse document: ${e.message}`);
      return false;
    }
  } else {
    console.log(`   ❌ Document not accessible`);
    return false;
  }
}

// Check document metadata in database
async function checkDocumentMetadata(cookie) {
  console.log('\n📊 Checking document metadata via GraphQL...');

  const query = `
    query GetDocMeta($workspaceId: String!, $docId: String!) {
      workspace(id: $workspaceId) {
        doc(id: $docId) {
          id
          title
          mode
          public
          blocked
          defaultRole
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

  const response = await makeRequest(options, {
    query,
    variables: { workspaceId, docId },
  });

  if (response.statusCode === 200) {
    const data = response.body.data;
    if (data?.workspace?.doc) {
      const doc = data.workspace.doc;
      console.log(`✅ Document metadata found in database`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Title: ${doc.title}`);
      console.log(`   Mode: ${doc.mode}`);
      console.log(`   Public: ${doc.public}`);
      console.log(`   Blocked: ${doc.blocked}`);
      console.log(`   Default Role: ${doc.defaultRole}`);
      return true;
    } else {
      console.log(`❌ Document metadata NOT found in database`);
      return false;
    }
  } else {
    console.log(`❌ GraphQL query failed: ${response.statusCode}`);
    return false;
  }
}

// Check permissions
async function checkPermissions(cookie) {
  console.log('\n🔐 Checking document permissions...');

  const query = `
    query CheckPermission($workspaceId: String!, $docId: String!) {
      checkPermission(workspaceId: $workspaceId, docId: $docId, permission: "Doc.Read")
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

  const response = await makeRequest(options, {
    query,
    variables: { workspaceId, docId },
  });

  if (response.statusCode === 200) {
    const hasPermission = response.body.data?.checkPermission;
    console.log(
      `   Read permission: ${hasPermission ? '✅ Granted' : '❌ Denied'}`
    );
    return hasPermission;
  } else {
    console.log(`   ❌ Permission check failed: ${response.statusCode}`);
    return false;
  }
}

// Main diagnostic function
async function diagnose() {
  try {
    console.log('🏥 AFFiNE Document Access Diagnostics');
    console.log('====================================\n');
    console.log(`Workspace: ${workspaceId}`);
    console.log(`Document:  ${docId}`);

    // Sign in with fresh session
    const cookie = await signIn();

    // Run all checks
    const results = {
      workspaceMeta: await checkWorkspaceMeta(cookie),
      documentAccess: await checkDocumentAccess(cookie),
      documentMetadata: await checkDocumentMetadata(cookie),
      permissions: await checkPermissions(cookie),
    };

    // Summary
    console.log('\n📋 Summary');
    console.log('==========');
    console.log(`Workspace metadata:  ${results.workspaceMeta ? '✅' : '❌'}`);
    console.log(`Document access:     ${results.documentAccess ? '✅' : '❌'}`);
    console.log(
      `Database metadata:   ${results.documentMetadata ? '✅' : '❌'}`
    );
    console.log(`Read permissions:    ${results.permissions ? '✅' : '❌'}`);

    // Diagnosis
    console.log('\n🔍 Diagnosis');
    console.log('============');

    if (!results.workspaceMeta) {
      console.log('❌ Document is NOT in workspace metadata');
      console.log("   This explains why it's not visible in the UI");
      console.log(
        '   The document needs to be added to the workspace pages array'
      );
    } else if (!results.documentMetadata) {
      console.log('❌ Document metadata is missing from database');
      console.log(
        '   The document needs proper metadata in workspace_pages table'
      );
    } else if (!results.permissions) {
      console.log('❌ User lacks read permissions');
      console.log('   Check document ownership and permissions');
    } else if (!results.documentAccess) {
      console.log('❌ Document binary data is not accessible');
      console.log('   The document content may be missing or corrupted');
    } else {
      console.log('✅ All checks passed - document should be accessible');
    }
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run diagnostics
diagnose();
