#!/usr/bin/env node

/**
 * Read document content with table analysis
 * Combines functionality to read document and analyze table structures
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
const docId = '0ad6fc3f-46fe-4645-bdc2-b1e1bd396b19';

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

// Function to analyze table content
function analyzeTableBlock(block, blocks) {
  const tableData = {
    id: block.get('sys:id'),
    rows: {},
    columns: {},
    cells: {},
  };

  console.log(`\n📊 Table Analysis:`);

  // Extract table structure from properties
  block.forEach((value, key) => {
    if (key.startsWith('prop:columns.')) {
      const parts = key.split('.');
      const columnId = parts[1];
      const prop = parts[2];

      if (!tableData.columns[columnId]) {
        tableData.columns[columnId] = {};
      }
      tableData.columns[columnId][prop] = value;
    } else if (key.startsWith('prop:rows.')) {
      const parts = key.split('.');
      const rowId = parts[1];
      const prop = parts[2];

      if (!tableData.rows[rowId]) {
        tableData.rows[rowId] = {};
      }
      tableData.rows[rowId][prop] = value;
    } else if (key.startsWith('prop:cells.')) {
      const parts = key.split('.');
      const cellKey = parts[1];
      const prop = parts[2];

      if (!tableData.cells[cellKey]) {
        tableData.cells[cellKey] = {};
      }

      if (prop === 'text' && value instanceof Y.Text) {
        tableData.cells[cellKey].text = value.toString();
      } else {
        tableData.cells[cellKey][prop] = value;
      }
    }
  });

  // Sort columns and rows by order
  const sortedColumns = Object.entries(tableData.columns).sort((a, b) =>
    (a[1].order || '').localeCompare(b[1].order || '')
  );

  const sortedRows = Object.entries(tableData.rows).sort((a, b) =>
    (a[1].order || '').localeCompare(b[1].order || '')
  );

  console.log(`\n📋 Table Structure:`);
  console.log(`  Columns: ${sortedColumns.length}`);
  console.log(`  Rows: ${sortedRows.length}`);

  // Display table in a formatted way
  console.log(`\n📊 Table Content:`);
  console.log('  ┌' + '─'.repeat(100) + '┐');

  // Header row
  let header = '  │ ';
  sortedColumns.forEach(([colId, col], idx) => {
    // Find header cell for this column (first row)
    if (sortedRows.length > 0) {
      const firstRowId = sortedRows[0][0];
      const cellKey = `${firstRowId}:${colId}`;
      const cellText = tableData.cells[cellKey]?.text || '';
      header += cellText.padEnd(20) + ' │ ';
    }
  });
  console.log(header);
  console.log('  ├' + '─'.repeat(100) + '┤');

  // Data rows (skip header row)
  sortedRows.slice(1).forEach(([rowId, row]) => {
    let rowStr = '  │ ';
    sortedColumns.forEach(([colId, col]) => {
      const cellKey = `${rowId}:${colId}`;
      const cellText = tableData.cells[cellKey]?.text || '';
      rowStr += cellText.padEnd(20) + ' │ ';
    });
    console.log(rowStr);
  });

  console.log('  └' + '─'.repeat(100) + '┘');

  return tableData;
}

// Read and analyze document
async function readAndAnalyzeDocument(cookie) {
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

  console.log('\n📄 Document Content:');
  console.log('==================');

  // Get blocks
  const blocks = doc.getMap('blocks');
  const tables = [];

  // Find and display page title
  blocks.forEach((block, id) => {
    if (block instanceof Y.Map && block.get('sys:flavour') === 'affine:page') {
      const title = block.get('prop:title');
      if (title instanceof Y.Text) {
        console.log(`\n📌 Document Title: "${title.toString()}"`);
      }
    }
  });

  // Find all content blocks
  console.log('\n📝 Document Structure:');

  blocks.forEach((block, id) => {
    if (block instanceof Y.Map) {
      const flavour = block.get('sys:flavour');

      switch (flavour) {
        case 'affine:paragraph':
          const text = block.get('prop:text');
          if (text instanceof Y.Text && text.length > 0) {
            console.log(`\n💬 Paragraph: "${text.toString()}"`);
          }
          break;

        case 'affine:table':
          console.log(`\n🏗️ Table found!`);
          const tableData = analyzeTableBlock(block, blocks);
          tables.push(tableData);
          break;

        case 'affine:list':
          console.log(`\n📝 List found`);
          break;

        case 'affine:image':
          console.log(`\n🖼️ Image found`);
          break;
      }
    }
  });

  // Summary
  console.log('\n\n📊 Document Summary:');
  console.log('===================');
  console.log(`Total blocks: ${blocks.size}`);
  console.log(`Tables found: ${tables.length}`);

  if (tables.length > 0) {
    console.log('\n📋 Table Details:');
    tables.forEach((table, idx) => {
      console.log(`  Table ${idx + 1}: ${table.cells.length} cells`);
    });
  }

  return { doc, blocks, tables };
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Document Reader with Table Analysis');
    console.log('============================================\n');

    // Sign in
    const cookie = await signIn();

    // Read and analyze document
    const result = await readAndAnalyzeDocument(cookie);

    console.log('\n✨ Reading complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
