import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { Public } from '../../core/auth';

interface RecordingStatusUpdate {
  status: 'idle' | 'recording' | 'waiting';
  device?: string;
  meetingId?: string;
  meetingCount?: number;
  activeMeetings?: string[];
  waitingDevices?: string[];
  workspaceId?: string;
}

interface RecordingEvent {
  type:
    | 'recording_start'
    | 'recording_stop'
    | 'recording_processing'
    | 'recording_update'
    | 'recording_reset';
  workspaceId: string;
  data?: any;
  timestamp: Date;
}

// 워크스페이스별 이벤트 저장소 (실제로는 Redis나 DB 사용 권장)
const recordingEventsByWorkspace = new Map<string, RecordingEvent[]>();

// 워크스페이스별 미팅 시작 시간 저장소
interface MeetingStartTime {
  meetingId: string;
  startTime: Date;
  device?: string;
  description?: string;
  lastHealthCheck?: Date;
}

interface DeviceHealthCheck {
  workspaceId: string;
  meetingId: string;
  device: string;
  status: 'recording' | 'processing' | 'waiting';
  timestamp: Date;
}

// Track waiting devices separately with their last update time
interface WaitingDevice {
  device: string;
  lastUpdate: Date;
}

const meetingStartTimesByWorkspace = new Map<string, MeetingStartTime[]>();
const deviceHealthChecksByWorkspace = new Map<
  string,
  Map<string, DeviceHealthCheck>
>();
const waitingDevicesByWorkspace = new Map<string, Map<string, WaitingDevice>>();

// 10분 타임아웃
const HEALTH_CHECK_TIMEOUT_MS = 10 * 60 * 1000;

@Controller('/api/recording')
export class RecordingController {
  @Public()
  @Post(':workspaceId/status')
  async updateRecordingStatus(
    @Param('workspaceId') workspaceId: string,
    @Body() update: RecordingStatusUpdate
  ) {
    const event: RecordingEvent = {
      type:
        update.status === 'recording' ? 'recording_start' : 'recording_stop',
      workspaceId,
      data: update,
      timestamp: new Date(),
    };

    this.addEventForWorkspace(workspaceId, event);

    return {
      success: true,
      event,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Post(':workspaceId/start')
  async startRecording(
    @Param('workspaceId') workspaceId: string,
    @Body() data: { meetingId: string; device?: string; description?: string }
  ) {
    const startTime = new Date();

    // 미팅 시작 시간 저장
    if (!meetingStartTimesByWorkspace.has(workspaceId)) {
      meetingStartTimesByWorkspace.set(workspaceId, []);
    }
    const meetings = meetingStartTimesByWorkspace.get(workspaceId) ?? [];
    const existingIndex = meetings.findIndex(
      m => m.meetingId === data.meetingId
    );

    if (existingIndex >= 0) {
      meetings[existingIndex] = {
        meetingId: data.meetingId,
        startTime,
        device: data.device,
        description: data.description,
        lastHealthCheck: undefined, // Health check는 /health 엔드포인트를 통해서만 업데이트
      };
    } else {
      meetings.push({
        meetingId: data.meetingId,
        startTime,
        device: data.device,
        description: data.description,
        lastHealthCheck: undefined, // Health check는 /health 엔드포인트를 통해서만 업데이트
      });
    }

    const event: RecordingEvent = {
      type: 'recording_start',
      workspaceId,
      data: {
        meetingId: data.meetingId,
        device: data.device,
        description: data.description,
        startTime: startTime.toISOString(),
      },
      timestamp: startTime,
    };

    this.addEventForWorkspace(workspaceId, event);

    return {
      success: true,
      meetingId: data.meetingId,
      startTime: startTime.toISOString(),
      timestamp: startTime.toISOString(),
    };
  }

  @Public()
  @Post(':workspaceId/processing')
  async startProcessing(
    @Param('workspaceId') workspaceId: string,
    @Body() data: { meetingId?: string; device?: string; description?: string }
  ) {
    // meetingId가 있는 경우 해당 미팅의 시작 시간 가져오기
    let startTime = new Date();
    if (data.meetingId && meetingStartTimesByWorkspace.has(workspaceId)) {
      const meetings = meetingStartTimesByWorkspace.get(workspaceId) ?? [];
      const existingMeeting = meetings.find(
        m => m.meetingId === data.meetingId
      );
      if (existingMeeting) {
        startTime = existingMeeting.startTime;
      } else {
        // processing으로 시작하는 경우 새로 추가
        meetings.push({
          meetingId: data.meetingId,
          startTime,
          device: data.device || `Device_${data.meetingId}`,
          description: data.description,
          lastHealthCheck: undefined, // Health check는 /health 엔드포인트를 통해서만 업데이트
        });
      }
    } else if (
      data.meetingId &&
      !meetingStartTimesByWorkspace.has(workspaceId)
    ) {
      // 워크스페이스가 없으면 생성
      meetingStartTimesByWorkspace.set(workspaceId, [
        {
          meetingId: data.meetingId,
          startTime,
          device: data.device || `Device_${data.meetingId}`,
          description: data.description,
          lastHealthCheck: undefined, // Health check는 /health 엔드포인트를 통해서만 업데이트
        },
      ]);
    }

    const event: RecordingEvent = {
      type: 'recording_processing',
      workspaceId,
      data: {
        meetingId: data.meetingId,
        device: data.device,
        description: data.description,
        startTime: startTime.toISOString(),
      },
      timestamp: new Date(),
    };

    this.addEventForWorkspace(workspaceId, event);

    return {
      success: true,
      meetingId: data.meetingId,
      startTime: startTime.toISOString(),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Post(':workspaceId/stop')
  async stopRecording(
    @Param('workspaceId') workspaceId: string,
    @Body() data: { meetingId: string }
  ) {
    // Get device info before removing meeting
    let deviceName: string | undefined;
    if (meetingStartTimesByWorkspace.has(workspaceId)) {
      const meetings = meetingStartTimesByWorkspace.get(workspaceId) ?? [];
      const meeting = meetings.find(m => m.meetingId === data.meetingId);
      if (meeting) {
        deviceName = meeting.device;
      }

      // 미팅 시작 시간 제거
      const index = meetings.findIndex(m => m.meetingId === data.meetingId);
      if (index >= 0) {
        meetings.splice(index, 1);
      }
    }

    const event: RecordingEvent = {
      type: 'recording_stop',
      workspaceId,
      data: {
        meetingId: data.meetingId,
        device: deviceName,
      },
      timestamp: new Date(),
    };

    this.addEventForWorkspace(workspaceId, event);

    // Automatically transition device to waiting status
    if (deviceName) {
      // Track in waiting devices
      if (!waitingDevicesByWorkspace.has(workspaceId)) {
        waitingDevicesByWorkspace.set(workspaceId, new Map());
      }
      const waitingDevices = waitingDevicesByWorkspace.get(workspaceId);
      if (waitingDevices) {
        waitingDevices.set(deviceName, {
          device: deviceName,
          lastUpdate: new Date(),
        });
      }

      const waitingEvent: RecordingEvent = {
        type: 'recording_update',
        workspaceId,
        data: {
          device: deviceName,
          status: 'waiting',
        },
        timestamp: new Date(),
      };
      this.addEventForWorkspace(workspaceId, waitingEvent);
    }

    return {
      success: true,
      meetingId: data.meetingId,
      device: deviceName,
      newStatus: 'waiting',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Post(':workspaceId/update')
  async updateRecording(
    @Param('workspaceId') workspaceId: string,
    @Body() data: RecordingStatusUpdate
  ) {
    const now = new Date();

    // If device is recording with a meetingId, ensure the meeting exists
    if (data.status === 'recording' && data.meetingId) {
      if (!meetingStartTimesByWorkspace.has(workspaceId)) {
        meetingStartTimesByWorkspace.set(workspaceId, []);
      }

      const meetings = meetingStartTimesByWorkspace.get(workspaceId) ?? [];
      const existingMeeting = meetings.find(
        m => m.meetingId === data.meetingId
      );

      if (!existingMeeting) {
        // Create a new meeting entry if it doesn't exist
        meetings.push({
          meetingId: data.meetingId,
          startTime: now,
          device: data.device || `Device_${data.meetingId}`,
          description: `Meeting ${data.meetingId}`,
          lastHealthCheck: undefined, // Health check는 /health 엔드포인트를 통해서만 업데이트
        });

        // Also emit a recording_start event
        this.addEventForWorkspace(workspaceId, {
          type: 'recording_start',
          workspaceId,
          data: {
            meetingId: data.meetingId,
            device: data.device || `Device_${data.meetingId}`,
            startTime: now.toISOString(),
          },
          timestamp: now,
        });
      } else {
        // Do NOT update last health check time here
        // Health checks should only be updated via the /health endpoint
      }
    }

    // Track waiting devices for cleanup
    if (data.device && data.status === 'waiting') {
      if (!waitingDevicesByWorkspace.has(workspaceId)) {
        waitingDevicesByWorkspace.set(workspaceId, new Map());
      }
      const waitingDevices = waitingDevicesByWorkspace.get(workspaceId);
      if (waitingDevices) {
        waitingDevices.set(data.device, {
          device: data.device,
          lastUpdate: now,
        });
      }
    } else if (
      data.device &&
      (data.status === 'recording' || data.status === 'processing')
    ) {
      // Remove from waiting devices when it starts recording/processing
      const waitingDevices = waitingDevicesByWorkspace.get(workspaceId);
      if (waitingDevices) {
        waitingDevices.delete(data.device);
      }
    }

    // Pass through the original data as-is
    // The frontend will handle device status transitions intelligently

    const event: RecordingEvent = {
      type: 'recording_update',
      workspaceId,
      data,
      timestamp: now,
    };

    this.addEventForWorkspace(workspaceId, event);

    return {
      success: true,
      data,
      timestamp: now.toISOString(),
    };
  }

  @Public()
  @Post(':workspaceId/reset')
  async resetRecording(@Param('workspaceId') workspaceId: string) {
    // 미팅 시작 시간 정보 초기화
    meetingStartTimesByWorkspace.delete(workspaceId);
    // 대기중인 기기 정보 초기화
    waitingDevicesByWorkspace.delete(workspaceId);
    // 헬스체크 정보 초기화
    deviceHealthChecksByWorkspace.delete(workspaceId);

    const event: RecordingEvent = {
      type: 'recording_reset',
      workspaceId,
      timestamp: new Date(),
    };

    this.addEventForWorkspace(workspaceId, event);

    return {
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Post(':workspaceId/health')
  async healthCheck(
    @Param('workspaceId') workspaceId: string,
    @Body()
    data: {
      meetingId: string;
      device: string;
      status: 'recording' | 'processing' | 'waiting';
    }
  ) {
    const now = new Date();

    // 워크스페이스별 health check 맵 초기화
    if (!deviceHealthChecksByWorkspace.has(workspaceId)) {
      deviceHealthChecksByWorkspace.set(workspaceId, new Map());
    }

    const workspaceHealthChecks =
      deviceHealthChecksByWorkspace.get(workspaceId);
    if (!workspaceHealthChecks) {
      return {
        success: true,
        timestamp: now.toISOString(),
      };
    }
    const deviceKey = `${data.device}_${data.meetingId}`;

    // health check 정보 업데이트
    workspaceHealthChecks.set(deviceKey, {
      workspaceId,
      meetingId: data.meetingId,
      device: data.device,
      status: data.status,
      timestamp: now,
    });

    // 미팅 시작 시간 정보에도 마지막 health check 시간 업데이트
    if (meetingStartTimesByWorkspace.has(workspaceId)) {
      const meetings = meetingStartTimesByWorkspace.get(workspaceId) ?? [];
      const meeting = meetings.find(m => m.meetingId === data.meetingId);
      if (meeting) {
        meeting.lastHealthCheck = now;
      }
    }

    // 만료된 health check 제거
    this.cleanupStaleHealthChecks(workspaceId);

    return {
      success: true,
      timestamp: now.toISOString(),
    };
  }

  @Public()
  @Get(':workspaceId/events')
  async getEvents(
    @Param('workspaceId') workspaceId: string,
    @Query('since') since?: string
  ) {
    const sinceIndex = since ? parseInt(since, 10) : 0;
    const workspaceEvents = recordingEventsByWorkspace.get(workspaceId) || [];

    // Only return events after the specified index
    const events =
      sinceIndex >= 0 && sinceIndex < workspaceEvents.length
        ? workspaceEvents.slice(sinceIndex)
        : [];

    // 만료된 health check 정리
    this.cleanupStaleHealthChecks(workspaceId);

    // 현재 활성 미팅의 시작 시간 정보 포함 (health check 타임아웃 고려)
    const activeMeetings = meetingStartTimesByWorkspace.get(workspaceId) || [];
    const validMeetings = activeMeetings.filter(m => {
      if (!m.lastHealthCheck) {
        // health check가 없으면 시작 시간으로부터 10분 이내인지 확인
        const timeSinceStart = Date.now() - m.startTime.getTime();
        return timeSinceStart < HEALTH_CHECK_TIMEOUT_MS;
      }
      const timeSinceLastCheck = Date.now() - m.lastHealthCheck.getTime();
      return timeSinceLastCheck < HEALTH_CHECK_TIMEOUT_MS;
    });

    return {
      events,
      nextIndex: workspaceEvents.length,
      total: workspaceEvents.length,
      fromIndex: sinceIndex,
      activeMeetings: validMeetings.map(m => ({
        meetingId: m.meetingId,
        startTime: m.startTime.toISOString(),
        device: m.device,
        description: m.description,
        lastHealthCheck: m.lastHealthCheck?.toISOString(),
      })),
    };
  }

  private addEventForWorkspace(workspaceId: string, event: RecordingEvent) {
    if (!recordingEventsByWorkspace.has(workspaceId)) {
      recordingEventsByWorkspace.set(workspaceId, []);
    }
    const events = recordingEventsByWorkspace.get(workspaceId);
    if (events) {
      events.push(event);
    }
  }

  private cleanupStaleHealthChecks(workspaceId: string) {
    const now = Date.now();

    // health check 정리
    if (deviceHealthChecksByWorkspace.has(workspaceId)) {
      const workspaceHealthChecks =
        deviceHealthChecksByWorkspace.get(workspaceId);
      if (!workspaceHealthChecks) return;
      const keysToDelete: string[] = [];

      workspaceHealthChecks.forEach((check, key) => {
        const timeSinceLastCheck = now - check.timestamp.getTime();
        if (timeSinceLastCheck > HEALTH_CHECK_TIMEOUT_MS) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => workspaceHealthChecks.delete(key));
    }

    // Clean up stale waiting devices
    if (waitingDevicesByWorkspace.has(workspaceId)) {
      const waitingDevices = waitingDevicesByWorkspace.get(workspaceId);
      if (!waitingDevices) return;
      const devicesToDelete: string[] = [];

      waitingDevices.forEach((device, key) => {
        const timeSinceLastUpdate = now - device.lastUpdate.getTime();
        if (timeSinceLastUpdate > HEALTH_CHECK_TIMEOUT_MS) {
          devicesToDelete.push(key);

          // Send a stop event to notify frontend
          this.addEventForWorkspace(workspaceId, {
            type: 'recording_update',
            workspaceId,
            data: {
              device: device.device,
              status: 'idle',
              reason: 'timeout',
            },
            timestamp: new Date(),
          });
        }
      });

      devicesToDelete.forEach(key => waitingDevices.delete(key));
    }

    // 미팅 정보에서 타임아웃된 것 제거
    if (meetingStartTimesByWorkspace.has(workspaceId)) {
      const meetings = meetingStartTimesByWorkspace.get(workspaceId) ?? [];
      const validMeetings = meetings.filter(m => {
        let shouldTimeout = false;

        if (!m.lastHealthCheck) {
          // health check가 없으면 시작 시간으로부터 확인
          const timeSinceStart = now - m.startTime.getTime();
          shouldTimeout = timeSinceStart > HEALTH_CHECK_TIMEOUT_MS;
        } else {
          const timeSinceLastCheck = now - m.lastHealthCheck.getTime();
          shouldTimeout = timeSinceLastCheck > HEALTH_CHECK_TIMEOUT_MS;
        }

        if (shouldTimeout) {
          // 타임아웃된 미팅에 대한 stop 이벤트 생성
          this.addEventForWorkspace(workspaceId, {
            type: 'recording_stop',
            workspaceId,
            data: {
              meetingId: m.meetingId,
              reason: 'health_check_timeout',
            },
            timestamp: new Date(),
          });
          return false;
        }
        return true;
      });
      meetingStartTimesByWorkspace.set(workspaceId, validMeetings);
    }
  }
}
