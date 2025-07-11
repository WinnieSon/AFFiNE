#!/usr/bin/env node

/**
 * Complete test: Create meeting note document and verify content
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
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

// Load sample meeting note data
function loadSampleData() {
  const samplePath = path.join(__dirname, 'meetingnote_sample.json');
  try {
    const data = fs.readFileSync(samplePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Failed to load sample data:', error);
    throw error;
  }
}

// Create meeting note document via API
async function createMeetingNoteDoc(cookie, meetingData) {
  console.log(`\n📋 Creating meeting note document from sample JSON...`);

  const options = {
    protocol: `${protocol}:`,
    hostname,
    port,
    path: `/api/workspaces/${workspaceId}/docs/from-meeting`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
  };

  console.log('📤 Meeting data summary:');
  console.log(`   Title: ${meetingData.title}`);
  console.log(`   Date: ${meetingData.date} ${meetingData.time}`);
  console.log(`   Location: ${meetingData.location}`);
  console.log(`   Participants: ${meetingData.participants?.length || 0}`);
  console.log(`   Agenda items: ${meetingData.agenda?.length || 0}`);
  console.log(`   Summary items: ${meetingData.summary?.length || 0}`);
  console.log(`   Action items: ${meetingData.action?.length || 0}`);
  console.log(
    `   Conversation items: ${meetingData.conversation?.length || 0}`
  );
  console.log(`   Tags: ${meetingData.tags?.length || 0}`);

  const response = await makeRequest(options, meetingData);

  if (response.statusCode !== 200 && response.statusCode !== 201) {
    throw new Error(
      `Failed to create meeting note document: ${response.statusCode} - ${JSON.stringify(response.body)}`
    );
  }

  console.log('✅ Meeting note document created successfully');
  console.log(`   Document ID: ${response.body.docId}`);
  console.log(`   Document Type: ${response.body.type}`);

  return response.body.docId;
}

// Read document content and parse structure
async function readDocumentContent(docId, cookie) {
  console.log(`\n📖 Reading document content...`);

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

  if (response.statusCode !== 200) {
    throw new Error(`Failed to read document: ${response.statusCode}`);
  }

  console.log(`✅ Document read successfully`);
  console.log(`   Binary size: ${response.body.length} bytes`);

  // Parse Yjs document
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(response.body));

  return doc;
}

// Analyze document structure
function analyzeDocumentStructure(doc) {
  console.log(`\n🔍 Analyzing document structure...`);

  const blocks = doc.getMap('blocks');
  const meta = doc.getMap('meta');

  console.log(`📄 Document Analysis:`);
  console.log(`   Total blocks: ${blocks.size}`);

  // Get page info
  const pages = meta.get('pages');
  if (pages && pages instanceof Y.Array && pages.length > 0) {
    const pageInfo = pages.get(0);
    if (pageInfo instanceof Y.Map) {
      console.log(`   Page title: "${pageInfo.get('title')}"`);
      console.log(
        `   Created: ${new Date(pageInfo.get('createDate')).toLocaleString()}`
      );
      console.log(
        `   Updated: ${new Date(pageInfo.get('updatedDate')).toLocaleString()}`
      );

      // Check tags
      const tags = pageInfo.get('tags');
      if (tags && tags instanceof Y.Array && tags.length > 0) {
        const tagList = [];
        for (let i = 0; i < tags.length; i++) {
          tagList.push(tags.get(i));
        }
        console.log(`   Tags: ${tagList.map(tag => `#${tag}`).join(' ')}`);
      }
    }
  }

  // Analyze block types
  const blockTypes = {};
  const blockContents = [];

  blocks.forEach((block, blockId) => {
    if (block instanceof Y.Map) {
      const flavour = block.get('sys:flavour');
      if (flavour) {
        blockTypes[flavour] = (blockTypes[flavour] || 0) + 1;

        // Extract text content
        const text = block.get('prop:text');
        const type = block.get('prop:type');
        if (text instanceof Y.Text && text.length > 0) {
          const content = text.toString();
          blockContents.push({
            id: blockId,
            flavour,
            type,
            content:
              content.substring(0, 100) + (content.length > 100 ? '...' : ''),
          });
        }
      }
    }
  });

  console.log(`\n📊 Block Types:`);
  Object.entries(blockTypes).forEach(([type, count]) => {
    console.log(`   ${type}: ${count} blocks`);
  });

  console.log(`\n📝 Content Preview (first 10 blocks with text):`);
  blockContents.slice(0, 10).forEach((block, index) => {
    console.log(
      `   ${index + 1}. [${block.flavour}${block.type ? ':' + block.type : ''}] ${block.content}`
    );
  });

  return { blockTypes, blockContents };
}

// Verify meeting content matches original data
function verifyMeetingContent(doc, originalData) {
  console.log(`\n✅ Verifying meeting content...`);

  const blocks = doc.getMap('blocks');
  const allText = [];

  // Extract all text content
  blocks.forEach(block => {
    if (block instanceof Y.Map) {
      const text = block.get('prop:text');
      if (text instanceof Y.Text && text.length > 0) {
        allText.push(text.toString().toLowerCase());
      }
    }
  });

  const fullText = allText.join(' ');

  const checks = [];

  // Check title
  if (originalData.title) {
    const found = fullText.includes(originalData.title.toLowerCase());
    checks.push({ item: 'Title', found, value: originalData.title });
  }

  // Check date and time
  if (originalData.date) {
    const found = fullText.includes(originalData.date);
    checks.push({ item: 'Date', found, value: originalData.date });
  }

  if (originalData.time) {
    const found = fullText.includes(originalData.time);
    checks.push({ item: 'Time', found, value: originalData.time });
  }

  // Check location
  if (originalData.location) {
    const found = fullText.includes(originalData.location);
    checks.push({ item: 'Location', found, value: originalData.location });
  }

  // Check participants
  if (originalData.participants) {
    originalData.participants.forEach(participant => {
      const found = fullText.includes(participant.toLowerCase());
      checks.push({ item: 'Participant', found, value: participant });
    });
  }

  // Check agenda items
  if (originalData.agenda) {
    originalData.agenda.forEach(item => {
      const found = fullText.includes(item.toLowerCase());
      checks.push({ item: 'Agenda', found, value: item });
    });
  }

  // Check action items
  if (originalData.action) {
    originalData.action.slice(0, 3).forEach(item => {
      // Check first 3 actions
      const found = fullText.includes(item.toLowerCase().substring(0, 20));
      checks.push({
        item: 'Action',
        found,
        value: item.substring(0, 50) + '...',
      });
    });
  }

  // Check tags in metadata
  if (originalData.tags) {
    const meta = doc.getMap('meta');
    const pages = meta.get('pages');
    let tagsFound = [];

    if (pages && pages instanceof Y.Array && pages.length > 0) {
      const pageInfo = pages.get(0);
      if (pageInfo instanceof Y.Map) {
        const tags = pageInfo.get('tags');
        if (tags && tags instanceof Y.Array) {
          for (let i = 0; i < tags.length; i++) {
            tagsFound.push(tags.get(i));
          }
        }
      }
    }

    originalData.tags.forEach(tag => {
      const found = tagsFound.includes(tag);
      checks.push({ item: 'Tag (metadata)', found, value: tag });
    });
  }

  console.log(`\n📋 Content Verification Results:`);
  const passed = checks.filter(c => c.found).length;
  const total = checks.length;

  console.log(
    `   Overall: ${passed}/${total} items found (${Math.round((passed / total) * 100)}%)`
  );

  checks.forEach(check => {
    const status = check.found ? '✅' : '❌';
    console.log(`   ${status} ${check.item}: ${check.value}`);
  });

  return { passed, total, percentage: Math.round((passed / total) * 100) };
}

// Main function
async function main() {
  try {
    console.log('🚀 Complete Meeting Note Document Test');
    console.log('=====================================\n');

    // Load sample meeting data
    console.log('📁 Loading sample meeting data...');
    const meetingData = loadSampleData();
    console.log('✅ Sample data loaded successfully');

    // Sign in
    const cookie = await signIn();

    // Create meeting note document
    const docId = await createMeetingNoteDoc(cookie, meetingData);

    // Wait for processing
    console.log(`\n⏳ Waiting for document processing...`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Read document content
    const doc = await readDocumentContent(docId, cookie);

    // Analyze structure
    const analysis = analyzeDocumentStructure(doc);

    // Verify content
    const verification = verifyMeetingContent(doc, meetingData);

    // Final summary
    console.log(`\n🎉 Test Completed Successfully!`);
    console.log(`=============================`);
    console.log(`📋 Document ID: ${docId}`);
    console.log(
      `📊 Block Types: ${Object.keys(analysis.blockTypes).length} different types`
    );
    console.log(`📝 Total Text Blocks: ${analysis.blockContents.length}`);
    console.log(`✅ Content Verification: ${verification.percentage}% match`);
    console.log(
      `🔗 View at: http://localhost:8080/workspace/${workspaceId}/${docId}`
    );

    if (verification.percentage >= 80) {
      console.log(
        `\n🎯 SUCCESS: Meeting note document creation and content verification passed!`
      );
    } else {
      console.log(
        `\n⚠️  WARNING: Content verification below 80%. Please check the document structure.`
      );
    }
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

module.exports = {
  createMeetingNoteDoc,
  readDocumentContent,
  analyzeDocumentStructure,
  verifyMeetingContent,
};
