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

// Function to verify documents
async function verifyDocuments(workspaceId, docIds, cookie) {
  console.log(`\n📋 Verifying documents in workspace ${workspaceId}...`);

  for (const docId of docIds) {
    console.log(`\n🔍 Checking document ${docId}...`);

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

    const response = await makeRequest(options);

    if (response.statusCode === 200) {
      console.log('✅ Document exists and is accessible');
      console.log('   Size:', response.body.length || 'N/A', 'bytes');
    } else {
      console.log('❌ Document not accessible:', response.statusCode);
    }
  }
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Document Verification');
    console.log('==============================\n');

    // Step 1: Sign in
    const cookie = await signIn();

    // Step 2: Define workspace and documents to verify
    const workspaceId = '49086e68-e27d-409a-9940-abb4d5d3802d';
    const documentIds = [
      '1c83783a-ae0e-4726-acca-49df4f686e12',
      '8f0a7dbd-808b-456b-992e-7e5baa560d5d',
      '149e7f97-538d-4b66-a581-1f92ac804e21',
      '4539dc36-0775-4641-a679-3ce20048f791',
    ];

    // Step 3: Verify documents
    await verifyDocuments(workspaceId, documentIds, cookie);

    console.log('\n✨ Verification complete!');
    console.log('\n📌 Next steps:');
    console.log(
      '1. Refresh your browser (Ctrl/Cmd + Shift + R for hard refresh)'
    );
    console.log('2. Navigate to the workspace');
    console.log(
      '3. You should now see all 4 created documents in the document list'
    );
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
