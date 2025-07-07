#!/usr/bin/env node

/**
 * Create document with table based on analyzed structure
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

// Generate unique ID for columns/rows
function generateUniqueId(length = 10) {
  const chars =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate order string for sorting
function generateOrderString(index) {
  const base = 'a' + (index * 10).toString().padStart(2, '0');
  const random = generateUniqueId(32);
  return base + random;
}

// Create table block structure
function createTableBlock(tableId, columns, rows, data) {
  const tableBlock = new Y.Map();

  // Basic properties
  tableBlock.set('sys:id', tableId);
  tableBlock.set('sys:flavour', 'affine:table');
  tableBlock.set('sys:version', 1);
  tableBlock.set('sys:children', new Y.Array());

  // Metadata
  tableBlock.set('prop:meta:createdAt', Date.now());
  tableBlock.set('prop:meta:createdBy', '9a82c741-ebf0-4d82-ac1a-f32b64c784d8');
  tableBlock.set('prop:meta:updatedAt', Date.now());
  tableBlock.set('prop:meta:updatedBy', '9a82c741-ebf0-4d82-ac1a-f32b64c784d8');

  // Create columns
  columns.forEach((col, colIndex) => {
    tableBlock.set(`prop:columns.${col.id}.columnId`, col.id);
    tableBlock.set(
      `prop:columns.${col.id}.order`,
      generateOrderString(colIndex)
    );
  });

  // Create rows and cells
  rows.forEach((row, rowIndex) => {
    // Row properties
    tableBlock.set(`prop:rows.${row.id}.rowId`, row.id);
    tableBlock.set(`prop:rows.${row.id}.order`, generateOrderString(rowIndex));

    // Create cells for this row
    columns.forEach(col => {
      const cellData = data[rowIndex][col.id] || '';
      const cellText = new Y.Text();
      cellText.insert(0, cellData);
      tableBlock.set(`prop:cells.${row.id}:${col.id}.text`, cellText);
    });
  });

  return tableBlock;
}

// Create document with table
function createDocumentWithTable(docId, title = 'Table Test') {
  const doc = new Y.Doc();

  // Get the blocks map
  const blocks = doc.getMap('blocks');

  // Create IDs
  const pageId = docId;
  const noteId = `${docId}:note:${crypto.randomBytes(4).toString('hex')}`;
  const titleParagraphId = generateUniqueId(10);
  const descParagraphId = generateUniqueId(10);
  const tableId = generateUniqueId(10);

  // Create root page block
  const pageBlock = new Y.Map();
  pageBlock.set('sys:id', pageId);
  pageBlock.set('sys:flavour', 'affine:page');
  pageBlock.set('sys:version', 2);

  // Children array - only note
  const pageChildren = new Y.Array();
  pageChildren.push([noteId]);
  pageBlock.set('sys:children', pageChildren);

  // Create title as Y.Text
  const titleText = new Y.Text();
  titleText.insert(0, title);
  pageBlock.set('prop:title', titleText);

  // Add page block to blocks
  blocks.set(pageId, pageBlock);

  // Create note block
  const noteBlock = new Y.Map();
  noteBlock.set('sys:id', noteId);
  noteBlock.set('sys:flavour', 'affine:note');
  noteBlock.set('sys:version', 1);

  // Note children - paragraphs and table
  const noteChildren = new Y.Array();
  noteChildren.push([titleParagraphId, descParagraphId, tableId]);
  noteBlock.set('sys:children', noteChildren);

  // Note properties
  noteBlock.set('prop:xywh', '[0,0,800,600]');
  noteBlock.set('prop:background', '--affine-palette-shape-tangerine');
  noteBlock.set('prop:index', 'a0');
  noteBlock.set('prop:hidden', false);

  blocks.set(noteId, noteBlock);

  // Create title paragraph
  const titleParagraph = new Y.Map();
  titleParagraph.set('sys:id', titleParagraphId);
  titleParagraph.set('sys:flavour', 'affine:paragraph');
  titleParagraph.set('sys:version', 1);
  titleParagraph.set('sys:children', new Y.Array());
  titleParagraph.set('prop:type', 'text');

  const titleParaText = new Y.Text();
  titleParaText.insert(0, '📊 프로젝트 진행 현황');
  titleParagraph.set('prop:text', titleParaText);

  blocks.set(titleParagraphId, titleParagraph);

  // Create description paragraph
  const descParagraph = new Y.Map();
  descParagraph.set('sys:id', descParagraphId);
  descParagraph.set('sys:flavour', 'affine:paragraph');
  descParagraph.set('sys:version', 1);
  descParagraph.set('sys:children', new Y.Array());
  descParagraph.set('prop:type', 'text');

  const descParaText = new Y.Text();
  descParaText.insert(0, '🚀 2025년 1월 프로젝트 현황 | 진행률 표시');
  descParagraph.set('prop:text', descParaText);

  blocks.set(descParagraphId, descParagraph);

  // Create table with sample data
  const columns = [
    { id: generateUniqueId(10), name: '프로젝트명' },
    { id: generateUniqueId(10), name: '담당자' },
    { id: generateUniqueId(10), name: '진행률' },
    { id: generateUniqueId(10), name: '상태' },
  ];

  const rows = [
    { id: generateUniqueId(10) }, // Header row
    { id: generateUniqueId(10) }, // Data row 1
    { id: generateUniqueId(10) }, // Data row 2
    { id: generateUniqueId(10) }, // Data row 3
    { id: generateUniqueId(10) }, // Data row 4
  ];

  const tableData = [
    // Header row
    {
      [columns[0].id]: '프로젝트명',
      [columns[1].id]: '담당자',
      [columns[2].id]: '진행률',
      [columns[3].id]: '상태',
    },
    // Data rows
    {
      [columns[0].id]: 'AFFiNE API 개발',
      [columns[1].id]: '김개발',
      [columns[2].id]: '75%',
      [columns[3].id]: '진행중',
    },
    {
      [columns[0].id]: '모바일 앱 디자인',
      [columns[1].id]: '이디자인',
      [columns[2].id]: '90%',
      [columns[3].id]: '검토중',
    },
    {
      [columns[0].id]: '데이터베이스 마이그레이션',
      [columns[1].id]: '박데이터',
      [columns[2].id]: '100%',
      [columns[3].id]: '완료',
    },
    {
      [columns[0].id]: 'UI/UX 개선',
      [columns[1].id]: '최유엑스',
      [columns[2].id]: '30%',
      [columns[3].id]: '시작',
    },
  ];

  const tableBlock = createTableBlock(tableId, columns, rows, tableData);
  blocks.set(tableId, tableBlock);

  // Set metadata
  const meta = doc.getMap('meta');
  meta.set('workspaceVersion', 2);

  const blockVersions = new Y.Map();
  blockVersions.set('affine:page', 2);
  blockVersions.set('affine:note', 1);
  blockVersions.set('affine:paragraph', 1);
  blockVersions.set('affine:table', 1);
  meta.set('blockVersions', blockVersions);

  // Add empty pages array to meta
  meta.set('pages', new Y.Array());

  return doc;
}

// Create document via API
async function createDocumentViaAPI(docId, title, cookie) {
  console.log(`\n📄 Creating document: "${title}"`);
  console.log(`   ID: ${docId}`);

  // Create the document structure
  const doc = createDocumentWithTable(docId, title);
  const update = Y.encodeStateAsUpdate(doc);

  // Create document via API
  const options = {
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

  const data = {
    updates: [Array.from(update)],
  };

  const response = await makeRequest(options, data);

  if (response.statusCode !== 200 && response.statusCode !== 201) {
    throw new Error(`Failed to create document: ${response.statusCode}`);
  }

  console.log('✅ Document created successfully');
  return true;
}

// Add document to workspace metadata
async function addToWorkspaceMetadata(docId, title, cookie) {
  console.log(`📝 Adding to workspace metadata...`);

  // Get current workspace document
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

  // Update existing workspace doc
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(getResponse.body));

  // Use transact for atomic operation
  Y.transact(doc, () => {
    const meta = doc.getMap('meta');
    let pages = meta.get('pages');

    if (!pages || !(pages instanceof Y.Array)) {
      pages = new Y.Array();
      meta.set('pages', pages);
    }

    // Create proper Y.Map for document metadata
    const docMeta = new Y.Map();
    docMeta.set('id', docId);
    docMeta.set('title', title);
    docMeta.set('createDate', Date.now());
    docMeta.set('tags', new Y.Array());

    // Push to pages array
    pages.push([docMeta]);
  });

  const update = Y.encodeStateAsUpdate(doc);

  const putOptions = {
    protocol: `${protocol}:`,
    hostname,
    port,
    path: `/api/workspaces/${workspaceId}/docs/${workspaceId}`,
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
    throw new Error(
      `Failed to update workspace doc: ${putResponse.statusCode}`
    );
  }

  console.log('✅ Added to workspace metadata');
  return true;
}

// Main function
async function main() {
  try {
    console.log('🚀 AFFiNE Table Document Creator');
    console.log('===============================\n');

    console.log('Creating document with table structure\n');

    // Sign in
    const cookie = await signIn();

    // Create document with table
    const tableDoc = {
      id: crypto.randomUUID(),
      title: '프로젝트 현황 테이블',
    };

    // Create the document
    await createDocumentViaAPI(tableDoc.id, tableDoc.title, cookie);

    // Add to workspace metadata
    await addToWorkspaceMetadata(tableDoc.id, tableDoc.title, cookie);

    console.log(
      `\n🔗 View at: http://localhost:8080/workspace/${workspaceId}/${tableDoc.id}`
    );

    console.log('\n✨ Document with table created successfully!');
    console.log('\n📊 Table contains:');
    console.log('- 4 columns: 프로젝트명, 담당자, 진행률, 상태');
    console.log('- 5 rows: 1 header + 4 data rows');
    console.log('- Sample project data');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Export table creation function for reuse
module.exports = {
  createTableBlock,
  generateUniqueId,
  generateOrderString,
};

// Run if called directly
if (require.main === module) {
  main();
}
