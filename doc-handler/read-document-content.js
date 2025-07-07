#!/usr/bin/env node

/**
 * Read and display document content
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
const docId = 'f5e8d8c1-4e7c-4cab-8603-b26ae94f0ca9';

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

// Read document content
async function readDocument(cookie) {
  console.log(`\n📖 Reading document ${docId}...`);

  // Get current document
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
    throw new Error(`Failed to get document: ${getResponse.statusCode}`);
  }

  // Parse existing document
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(getResponse.body));

  console.log('\n📊 Document Content Summary:');
  console.log('==========================');

  // Get blocks
  const blocks = doc.getMap('blocks');

  // Find and display page title
  blocks.forEach((block, id) => {
    if (block instanceof Y.Map && block.get('sys:flavour') === 'affine:page') {
      const title = block.get('prop:title');
      if (title instanceof Y.Text) {
        console.log(`\n📌 Document Title: "${title.toString()}"`);
      }
    }
  });

  // Find all paragraphs and their content
  console.log('\n📝 Document Content:');
  console.log('-------------------');

  let paragraphCount = 0;
  const paragraphs = [];

  blocks.forEach((block, id) => {
    if (
      block instanceof Y.Map &&
      block.get('sys:flavour') === 'affine:paragraph'
    ) {
      paragraphCount++;
      const text = block.get('prop:text');
      if (text instanceof Y.Text) {
        const content = text.toString();
        paragraphs.push({
          id: id,
          content: content,
          length: text.length,
        });
      }
    }
  });

  // Sort paragraphs by their appearance order (can be improved)
  paragraphs.forEach((para, index) => {
    console.log(`\nParagraph ${index + 1} (ID: ${para.id}):`);
    console.log(`Content: "${para.content}"`);
    console.log(`Length: ${para.length} characters`);

    // Show special characters
    const specialChars = para.content
      .split('')
      .map(char => {
        if (char === '\n') return '\\n';
        if (char === '\r') return '\\r';
        if (char === '\t') return '\\t';
        return char;
      })
      .join('');
    console.log(`With special chars visible: "${specialChars}"`);
  });

  console.log(`\n📊 Total paragraphs: ${paragraphCount}`);

  // Show full document structure
  console.log('\n🌳 Document Structure:');
  console.log('---------------------');

  blocks.forEach((block, id) => {
    if (block instanceof Y.Map) {
      const flavour = block.get('sys:flavour');
      const children = block.get('sys:children');

      console.log(`\n${flavour} (${id})`);

      if (children instanceof Y.Array && children.length > 0) {
        console.log('  Children:');
        children.forEach((childId, idx) => {
          console.log(`    - ${childId}`);
        });
      }
    }
  });
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Document Reader');
    console.log('========================\n');

    // Sign in
    const cookie = await signIn();

    // Read document
    await readDocument(cookie);

    console.log('\n✨ Reading complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
