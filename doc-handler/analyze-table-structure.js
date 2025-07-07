#!/usr/bin/env node

/**
 * Analyze table structure in document
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

// Analyze table structure
async function analyzeTableStructure(cookie) {
  console.log(`\n📖 Analyzing table structure in document ${docId}...`);

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

  console.log('\n📊 Table Analysis:');
  console.log('================');

  // Get blocks
  const blocks = doc.getMap('blocks');

  // Find table blocks
  blocks.forEach((block, id) => {
    if (block instanceof Y.Map) {
      const flavour = block.get('sys:flavour');

      if (flavour === 'affine:table') {
        console.log(`\n🏗️ Table Block Found: ${id}`);
        console.log('Properties:');

        // Analyze all properties
        const keys = [];
        block.forEach((value, key) => {
          keys.push(key);
        });

        keys.sort().forEach(key => {
          const value = block.get(key);

          if (value instanceof Y.Map) {
            console.log(`  ${key}: [Y.Map with ${value.size} entries]`);
            value.forEach((v, k) => {
              console.log(
                `    - ${k}: ${v instanceof Y.Map ? '[Y.Map]' : v instanceof Y.Array ? '[Y.Array]' : v instanceof Y.Text ? `[Y.Text: "${v.toString()}"]` : JSON.stringify(v)}`
              );
            });
          } else if (value instanceof Y.Array) {
            console.log(`  ${key}: [Y.Array with ${value.length} items]`);
            value.forEach((item, idx) => {
              if (typeof item === 'string') {
                console.log(`    [${idx}]: "${item}"`);
              } else {
                console.log(`    [${idx}]: ${JSON.stringify(item)}`);
              }
            });
          } else if (value instanceof Y.Text) {
            console.log(`  ${key}: [Y.Text] "${value.toString()}"`);
          } else {
            console.log(`  ${key}: ${JSON.stringify(value)}`);
          }
        });

        // Check children for cells
        const children = block.get('sys:children');
        if (children instanceof Y.Array) {
          console.log(`\nTable has ${children.length} cells:`);

          children.forEach((cellId, idx) => {
            const cellBlock = blocks.get(cellId);
            if (cellBlock instanceof Y.Map) {
              console.log(`\n  Cell ${idx + 1} (${cellId}):`);
              const cellFlavour = cellBlock.get('sys:flavour');
              console.log(`    Flavour: ${cellFlavour}`);

              // Get cell properties
              const cellProps = [];
              cellBlock.forEach((value, key) => {
                if (key.startsWith('prop:')) {
                  cellProps.push(key);
                }
              });

              cellProps.forEach(prop => {
                const value = cellBlock.get(prop);
                if (value instanceof Y.Text) {
                  console.log(`    ${prop}: "${value.toString()}"`);
                } else {
                  console.log(`    ${prop}: ${JSON.stringify(value)}`);
                }
              });

              // Check cell children (paragraphs)
              const cellChildren = cellBlock.get('sys:children');
              if (cellChildren instanceof Y.Array && cellChildren.length > 0) {
                console.log(`    Contains ${cellChildren.length} paragraph(s)`);
              }
            }
          });
        }
      }
    }
  });
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Table Structure Analyzer');
    console.log('=================================\n');

    // Sign in
    const cookie = await signIn();

    // Analyze table structure
    await analyzeTableStructure(cookie);

    console.log('\n✨ Analysis complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
