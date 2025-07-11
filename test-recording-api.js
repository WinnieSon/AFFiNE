#!/usr/bin/env node

/**
 * REST API Recording Control Test Script
 * 
 * Usage:
 *   node test-recording-api.js <workspace-id> start 13A        # Start recording for meeting 13A
 *   node test-recording-api.js <workspace-id> stop 13A         # Stop recording for meeting 13A
 *   node test-recording-api.js <workspace-id> update           # Update with sample data
 *   node test-recording-api.js <workspace-id> reset            # Reset all recordings
 *   node test-recording-api.js <workspace-id> status           # Get current events
 * 
 * Example:
 *   node test-recording-api.js d5440a43-47cd-4a93-ae6d-968e6474f167 start 13A
 */

const http = require('node:http');

const API_HOST = 'localhost';
const API_PORT = 3010;

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
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

async function startRecording(workspaceId, meetingId) {
  console.log(`Starting recording for meeting: ${meetingId} in workspace: ${workspaceId}`);
  const result = await makeRequest('POST', `/api/recording/${workspaceId}/start`, {
    meetingId: meetingId,
    device: 'Device_' + meetingId
  });
  console.log('Response:', result);
}

async function startProcessing(workspaceId, meetingId) {
  console.log(`Starting processing for meeting: ${meetingId} in workspace: ${workspaceId}`);
  const result = await makeRequest('POST', `/api/recording/${workspaceId}/processing`, {
    meetingId: meetingId
  });
  console.log('Response:', result);
}

async function stopRecording(workspaceId, meetingId) {
  console.log(`Stopping recording for meeting: ${meetingId} in workspace: ${workspaceId}`);
  const result = await makeRequest('POST', `/api/recording/${workspaceId}/stop`, {
    meetingId: meetingId
  });
  console.log('Response:', result);
}

async function updateRecording(workspaceId) {
  console.log(`Updating recording for workspace: ${workspaceId}...`);
  const result = await makeRequest('POST', `/api/recording/${workspaceId}/update`, {
    status: 'recording',
    meetingCount: 2,
    activeMeetings: ['13A', '13B'],
    waitingDevices: []
  });
  console.log('Response:', result);
}

async function updateWaitingDevices(workspaceId) {
  console.log(`Updating waiting devices for workspace: ${workspaceId}...`);
  const result = await makeRequest('POST', `/api/recording/${workspaceId}/update`, {
    status: 'idle',
    meetingCount: 0,
    activeMeetings: [],
    waitingDevices: ['13A', '13B', '13C']
  });
  console.log('Response:', result);
}

async function resetRecording(workspaceId) {
  console.log(`Resetting recordings for workspace: ${workspaceId}...`);
  const result = await makeRequest('POST', `/api/recording/${workspaceId}/reset`);
  console.log('Response:', result);
}

async function getStatus(workspaceId) {
  console.log(`Getting recording events for workspace: ${workspaceId}...`);
  const result = await makeRequest('GET', `/api/recording/${workspaceId}/events`);
  console.log('Response:', JSON.stringify(result, null, 2));
}

async function runDemo(workspaceId) {
  console.log(`Running demo sequence for workspace: ${workspaceId}...\n`);

  console.log('1. Reset state');
  await resetRecording(workspaceId);
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n2. Set waiting devices');
  await updateWaitingDevices(workspaceId);
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n3. Start recording for 13A');
  await startRecording(workspaceId, '13A');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n4. Start processing');
  await startProcessing(workspaceId, '13A');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n5. Start recording for 13B');
  await startRecording(workspaceId, '13B');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n6. Update status');
  await updateRecording(workspaceId);
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n7. Stop recording for 13A');
  await stopRecording(workspaceId, '13A');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n8. Get final status');
  await getStatus(workspaceId);
}

// Main execution
const workspaceId = process.argv[2];
const command = process.argv[3];
const arg = process.argv[4];

(async () => {
  try {
    if (!workspaceId) {
      console.error('Please provide workspace ID as first argument');
      console.log('Usage: node test-recording-api.js <workspace-id> <command> [args]');
      console.log('Example: node test-recording-api.js d5440a43-47cd-4a93-ae6d-968e6474f167 start 13A');
      process.exit(1);
    }

    switch (command) {
      case 'start':
        if (!arg) {
          console.error('Please provide meeting ID');
          process.exit(1);
        }
        await startRecording(workspaceId, arg);
        break;
      
      case 'processing':
        if (!arg) {
          console.error('Please provide meeting ID');
          process.exit(1);
        }
        await startProcessing(workspaceId, arg);
        break;
      
      case 'stop':
        if (!arg) {
          console.error('Please provide meeting ID');
          process.exit(1);
        }
        await stopRecording(workspaceId, arg);
        break;
      
      case 'update':
        await updateRecording(workspaceId);
        break;
      
      case 'waiting':
        await updateWaitingDevices(workspaceId);
        break;
      
      case 'reset':
        await resetRecording(workspaceId);
        break;
      
      case 'status':
        await getStatus(workspaceId);
        break;
      
      case 'demo':
        await runDemo(workspaceId);
        break;
      
      default:
        console.log('Usage:');
        console.log('  node test-recording-api.js <workspace-id> start <meetingId>');
        console.log('  node test-recording-api.js <workspace-id> processing <meetingId>');
        console.log('  node test-recording-api.js <workspace-id> stop <meetingId>');
        console.log('  node test-recording-api.js <workspace-id> update');
        console.log('  node test-recording-api.js <workspace-id> waiting');
        console.log('  node test-recording-api.js <workspace-id> reset');
        console.log('  node test-recording-api.js <workspace-id> status');
        console.log('  node test-recording-api.js <workspace-id> demo');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();