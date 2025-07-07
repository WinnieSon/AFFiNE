#!/usr/bin/env node

const https = require('https');
const http = require('http');

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

// Function to create a document using REST API
async function createDocument(workspaceId, cookie) {
  console.log(`\n📄 Creating document in workspace ${workspaceId}...`);

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

  // Create a simple document with a title
  const data = {
    title: 'Test Document Created via REST API',
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

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE REST API Document Creation Test');
    console.log('=========================================\n');

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

    console.log('\n✨ Success! Document created:');
    console.log(`   ID: ${doc.docId}`);
    console.log(`   Workspace: ${doc.workspaceId}`);
    console.log(`   Created at: ${doc.createdAt}`);
    console.log(`   Created by: ${doc.createdBy}`);

    // Build the URL to access the document
    const docUrl = `${protocol}://${hostname}:${port}/workspace/${doc.workspaceId}/${doc.docId}`;
    console.log(`\n🔗 Access your document at: ${docUrl}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
