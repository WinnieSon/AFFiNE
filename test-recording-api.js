#!/usr/bin/env node

/**
 * REST API Recording Control Test Script
 *
 * Usage:
 *   node test-recording-api.js <workspace-id> start 13A        # Start recording for meeting 13A
 *   node test-recording-api.js <workspace-id> stop 13A         # Stop recording for meeting 13A
 *   node test-recording-api.js <workspace-id> update <device> [meetingId] [status]  # Update device status
 *   node test-recording-api.js <workspace-id> reset            # Reset all recordings
 *   node test-recording-api.js <workspace-id> status           # Get current events
 *   node test-recording-api.js <workspace-id> health <meetingId> <status>  # Send health check
 *   node test-recording-api.js <workspace-id> health-demo      # Run health check timeout demo
 *
 * Example:
 *   node test-recording-api.js d5440a43-47cd-4a93-ae6d-968e6474f167 start 13A
 *   node test-recording-api.js d5440a43-47cd-4a93-ae6d-968e6474f167 update Device_13A 13A recording
 *   node test-recording-api.js d5440a43-47cd-4a93-ae6d-968e6474f167 health 13A recording
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
      },
    };

    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => {
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

async function startRecording(workspaceId, meetingId, description) {
  console.log(
    `Starting recording for meeting: ${meetingId} in workspace: ${workspaceId}`
  );
  const result = await makeRequest(
    'POST',
    `/api/recording/${workspaceId}/start`,
    {
      meetingId: meetingId,
      device: 'Device_' + meetingId,
      description: description || `Meeting ${meetingId} recording`,
    }
  );
  console.log('Response:', result);
}

async function startProcessing(workspaceId, meetingId, description) {
  console.log(
    `Starting processing for meeting: ${meetingId} in workspace: ${workspaceId}`
  );
  const result = await makeRequest(
    'POST',
    `/api/recording/${workspaceId}/processing`,
    {
      meetingId: meetingId,
      device: 'Device_' + meetingId,
      description: description || `Meeting ${meetingId} processing`,
    }
  );
  console.log('Response:', result);
}

async function stopRecording(workspaceId, meetingId) {
  console.log(
    `Stopping recording for meeting: ${meetingId} in workspace: ${workspaceId}`
  );
  const result = await makeRequest(
    'POST',
    `/api/recording/${workspaceId}/stop`,
    {
      meetingId: meetingId,
    }
  );
  console.log('Response:', result);
}

async function updateDeviceStatus(workspaceId, device, meetingId, status) {
  console.log(
    `Updating device ${device} status to ${status} for meeting ${meetingId || 'none'}`
  );
  const data = {
    device: device,
    status: status,
  };

  if (meetingId) {
    data.meetingId = meetingId;
  }

  const result = await makeRequest(
    'POST',
    `/api/recording/${workspaceId}/update`,
    data
  );
  console.log('Response:', result);
}

async function resetRecording(workspaceId) {
  console.log(`Resetting recordings for workspace: ${workspaceId}...`);
  const result = await makeRequest(
    'POST',
    `/api/recording/${workspaceId}/reset`
  );
  console.log('Response:', result);
}

async function getStatus(workspaceId) {
  console.log(`Getting recording events for workspace: ${workspaceId}...`);
  const result = await makeRequest(
    'GET',
    `/api/recording/${workspaceId}/events`
  );
  console.log('Response:', JSON.stringify(result, null, 2));
}

async function sendHealthCheck(workspaceId, meetingId, status, device) {
  console.log(
    `Sending health check for meeting: ${meetingId} with status: ${status}`
  );
  const result = await makeRequest(
    'POST',
    `/api/recording/${workspaceId}/health`,
    {
      meetingId: meetingId,
      device: device || 'Device_' + meetingId,
      status: status,
    }
  );
  console.log('Response:', result);
}

async function runDemo(workspaceId) {
  console.log(`Running demo sequence for workspace: ${workspaceId}...\n`);

  console.log('1. Reset state');
  await resetRecording(workspaceId);
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n2. Device_13A waiting status');
  await updateDeviceStatus(workspaceId, 'Device_13A', null, 'waiting');
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n3. Device_13B waiting status');
  await updateDeviceStatus(workspaceId, 'Device_13B', null, 'waiting');
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n4. Start recording for 13A');
  await startRecording(workspaceId, '13A');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n5. Device_13A recording status');
  await updateDeviceStatus(workspaceId, 'Device_13A', '13A', 'recording');
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n6. Start processing for 13A');
  await startProcessing(workspaceId, '13A');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n7. Device_13A processing status');
  await updateDeviceStatus(workspaceId, 'Device_13A', '13A', 'processing');
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n8. Start recording for 13B');
  await startRecording(workspaceId, '13B');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n9. Device_13B recording status');
  await updateDeviceStatus(workspaceId, 'Device_13B', '13B', 'recording');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n10. Stop recording for 13A');
  await stopRecording(workspaceId, '13A');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n11. Get final status');
  await getStatus(workspaceId);
}

async function runHealthCheckDemo(workspaceId) {
  console.log(
    `Running health check timeout demo for workspace: ${workspaceId}...\n`
  );
  console.log(
    'This demo will show how devices timeout after 10 minutes without health check\n'
  );

  console.log('1. Reset state');
  await resetRecording(workspaceId);
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n2. Start recording for TEST-HEALTH');
  await startRecording(workspaceId, 'TEST-HEALTH', 'Health check timeout test');
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n3. Send initial health check');
  await sendHealthCheck(workspaceId, 'TEST-HEALTH', 'recording');
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n4. Check status - should show active meeting');
  await getStatus(workspaceId);

  console.log('\n5. Simulating 5 minutes passing...');
  console.log('   In real usage, health checks would be sent every 5 minutes');
  console.log('   Sending another health check...');
  await sendHealthCheck(workspaceId, 'TEST-HEALTH', 'recording');

  console.log(
    '\n6. After 10+ minutes without health check, the meeting would be automatically removed'
  );
  console.log(
    '   The server would generate a recording_stop event with reason: health_check_timeout'
  );

  console.log('\n7. You can also test with waiting devices:');
  await sendHealthCheck(
    workspaceId,
    'WAITING-DEVICE-1',
    'waiting',
    'Device_Waiting_1'
  );

  console.log('\nDemo complete. In production:');
  console.log('- Devices send health checks every 5 minutes');
  console.log('- Server removes inactive devices after 10 minutes');
  console.log('- This ensures stale recordings are automatically cleaned up');
}

// Main execution
const workspaceId = process.argv[2];
const command = process.argv[3];
const arg = process.argv[4];

(async () => {
  try {
    if (!workspaceId) {
      console.error('Please provide workspace ID as first argument');
      console.log(
        'Usage: node test-recording-api.js <workspace-id> <command> [args]'
      );
      console.log(
        'Example: node test-recording-api.js d5440a43-47cd-4a93-ae6d-968e6474f167 start 13A'
      );
      process.exit(1);
    }

    switch (command) {
      case 'start':
        if (!arg) {
          console.error('Please provide meeting ID');
          process.exit(1);
        }
        await startRecording(workspaceId, arg, process.argv[5]);
        break;

      case 'processing':
        if (!arg) {
          console.error('Please provide meeting ID');
          process.exit(1);
        }
        await startProcessing(workspaceId, arg, process.argv[5]);
        break;

      case 'stop':
        if (!arg) {
          console.error('Please provide meeting ID');
          process.exit(1);
        }
        await stopRecording(workspaceId, arg);
        break;

      case 'update':
        if (!arg) {
          console.error('Please provide device name');
          console.error(
            'Usage: node test-recording-api.js <workspace-id> update <device> [meetingId] [status]'
          );
          process.exit(1);
        }
        const updateMeetingId = process.argv[5];
        const updateStatus = process.argv[6] || 'recording';
        await updateDeviceStatus(
          workspaceId,
          arg,
          updateMeetingId,
          updateStatus
        );
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

      case 'health':
        if (!arg) {
          console.error('Please provide meeting ID');
          process.exit(1);
        }
        const healthStatus = process.argv[5] || 'recording';
        if (!['recording', 'processing', 'waiting'].includes(healthStatus)) {
          console.error(
            'Status must be one of: recording, processing, waiting'
          );
          process.exit(1);
        }
        await sendHealthCheck(workspaceId, arg, healthStatus);
        break;

      case 'health-demo':
        await runHealthCheckDemo(workspaceId);
        break;

      default:
        console.log('Usage:');
        console.log(
          '  node test-recording-api.js <workspace-id> start <meetingId>'
        );
        console.log(
          '  node test-recording-api.js <workspace-id> processing <meetingId>'
        );
        console.log(
          '  node test-recording-api.js <workspace-id> stop <meetingId>'
        );
        console.log(
          '  node test-recording-api.js <workspace-id> update <device> [meetingId] [status]'
        );
        console.log('  node test-recording-api.js <workspace-id> reset');
        console.log('  node test-recording-api.js <workspace-id> status');
        console.log(
          '  node test-recording-api.js <workspace-id> health <meetingId> <status>'
        );
        console.log('  node test-recording-api.js <workspace-id> health-demo');
        console.log('  node test-recording-api.js <workspace-id> demo');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
