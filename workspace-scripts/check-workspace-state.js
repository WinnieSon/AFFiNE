#!/usr/bin/env node

/**
 * Check and diagnose workspace state issues
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

// Check workspace state
async function checkWorkspaceState(cookie) {
  console.log('\n🔍 Checking workspace state...\n');

  // Get workspace document
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

  // Parse workspace document
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(getResponse.body));

  console.log('📊 Workspace Document Analysis:');
  console.log('================================');

  // Check meta
  const meta = doc.getMap('meta');
  console.log('\n📝 Meta Map:');
  console.log(`   - Type: ${meta.constructor.name}`);
  console.log(`   - Has pages: ${meta.has('pages')}`);
  console.log(`   - Has workspaceVersion: ${meta.has('workspaceVersion')}`);
  console.log(`   - Has blockVersions: ${meta.has('blockVersions')}`);

  // Check pages
  const pages = meta.get('pages');
  if (pages) {
    console.log('\n📄 Pages Array:');
    console.log(`   - Type: ${pages.constructor.name}`);
    console.log(`   - Length: ${pages.length}`);

    if (pages.length > 0) {
      console.log('\n   Documents in workspace:');
      pages.forEach((page, idx) => {
        if (page instanceof Y.Map) {
          console.log(
            `   ${idx + 1}. ${page.get('title') || 'Untitled'} (ID: ${page.get('id')})`
          );
          console.log(`      - Type: ${page.constructor.name} ✅`);
          console.log(
            `      - Created: ${new Date(page.get('createDate')).toLocaleString()}`
          );
        } else {
          console.log(`   ${idx + 1}. INVALID ENTRY ❌`);
          console.log(`      - Type: ${typeof page} (should be Y.Map)`);
        }
      });
    }
  }

  // Check blocks
  const blocks = doc.getMap('blocks');
  console.log('\n🔧 Blocks Map:');
  console.log(`   - Type: ${blocks.constructor.name}`);
  console.log(`   - Size: ${blocks.size}`);

  // Check for issues
  console.log('\n⚠️  Potential Issues:');

  let hasIssues = false;

  // Check for missing meta
  if (!meta || !(meta instanceof Y.Map)) {
    console.log('   - ❌ Meta is not a proper Y.Map');
    hasIssues = true;
  }

  // Check for missing pages
  if (!pages || !(pages instanceof Y.Array)) {
    console.log('   - ❌ Pages is not a proper Y.Array');
    hasIssues = true;
  }

  // Check for invalid page entries
  if (pages && pages instanceof Y.Array) {
    let invalidCount = 0;
    pages.forEach(page => {
      if (!(page instanceof Y.Map)) {
        invalidCount++;
      }
    });
    if (invalidCount > 0) {
      console.log(`   - ❌ Found ${invalidCount} invalid page entries`);
      hasIssues = true;
    }
  }

  // Check workspace version
  const version = meta.get('workspaceVersion');
  if (!version) {
    console.log('   - ⚠️  Missing workspace version');
    hasIssues = true;
  }

  if (!hasIssues) {
    console.log('   - ✅ No major structural issues found');
  }

  // Check document sizes
  console.log('\n📏 Document Sizes:');
  const update = Y.encodeStateAsUpdate(doc);
  console.log(`   - Total size: ${update.length} bytes`);
  console.log(
    `   - State vector size: ${Y.encodeStateVector(doc).length} bytes`
  );

  return { doc, pages, hasIssues };
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Workspace State Checker');
    console.log('=================================\n');

    // Sign in
    const cookie = await signIn();

    // Check workspace state
    const { doc, pages, hasIssues } = await checkWorkspaceState(cookie);

    console.log('\n📌 Recommendations:');

    if (hasIssues) {
      console.log('1. The workspace has structural issues');
      console.log('2. Run force-clean-workspace.js to reset');
      console.log('3. Clear browser cache and restart');
    } else if (pages && pages.length > 10) {
      console.log('1. Workspace has many documents');
      console.log('2. Consider archiving old documents');
      console.log('3. The sync loop might be due to too many updates');
    } else {
      console.log('1. Workspace structure looks OK');
      console.log('2. The sync loop might be a browser cache issue');
      console.log('3. Try clearing browser data for localhost:8080');
      console.log('4. Open in a new incognito window');
    }

    console.log('\n💡 To break the endless sync loop:');
    console.log('1. Stop the server (Ctrl+C)');
    console.log('2. Clear ALL browser data for localhost:8080');
    console.log('3. Restart the server');
    console.log('4. Use a fresh incognito window');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
