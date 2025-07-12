import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../../core/auth';

interface RecordingStatusUpdate {
  status: 'idle' | 'recording';
  meetingId?: string;
  meetingCount?: number;
  activeMeetings?: string[];
  waitingDevices?: string[];
  workspaceId?: string;
}

interface RecordingEvent {
  type: 'recording_start' | 'recording_stop' | 'recording_processing' | 'recording_update' | 'recording_reset';
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
}
const meetingStartTimesByWorkspace = new Map<string, MeetingStartTime[]>();

@Controller('/api/recording')
export class RecordingController {
  @Public()
  @Post(':workspaceId/status')
  async updateRecordingStatus(
    @Param('workspaceId') workspaceId: string,
    @Body() update: RecordingStatusUpdate
  ) {
    const event: RecordingEvent = {
      type: update.status === 'recording' ? 'recording_start' : 'recording_stop',
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
    const meetings = meetingStartTimesByWorkspace.get(workspaceId)!;
    const existingIndex = meetings.findIndex(m => m.meetingId === data.meetingId);
    
    if (existingIndex >= 0) {
      meetings[existingIndex] = { meetingId: data.meetingId, startTime, device: data.device, description: data.description };
    } else {
      meetings.push({ meetingId: data.meetingId, startTime, device: data.device, description: data.description });
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
      const meetings = meetingStartTimesByWorkspace.get(workspaceId)!;
      const existingMeeting = meetings.find(m => m.meetingId === data.meetingId);
      if (existingMeeting) {
        startTime = existingMeeting.startTime;
      } else {
        // processing으로 시작하는 경우 새로 추가
        meetings.push({
          meetingId: data.meetingId,
          startTime,
          device: data.device || `Device_${data.meetingId}`,
          description: data.description,
        });
      }
    } else if (data.meetingId && !meetingStartTimesByWorkspace.has(workspaceId)) {
      // 워크스페이스가 없으면 생성
      meetingStartTimesByWorkspace.set(workspaceId, [{
        meetingId: data.meetingId,
        startTime,
        device: data.device || `Device_${data.meetingId}`,
        description: data.description,
      }]);
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
    // 미팅 시작 시간 제거
    if (meetingStartTimesByWorkspace.has(workspaceId)) {
      const meetings = meetingStartTimesByWorkspace.get(workspaceId)!;
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
      },
      timestamp: new Date(),
    };
    
    this.addEventForWorkspace(workspaceId, event);
    
    return {
      success: true,
      meetingId: data.meetingId,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Post(':workspaceId/update')
  async updateRecording(
    @Param('workspaceId') workspaceId: string,
    @Body() data: RecordingStatusUpdate
  ) {
    const event: RecordingEvent = {
      type: 'recording_update',
      workspaceId,
      data,
      timestamp: new Date(),
    };
    
    this.addEventForWorkspace(workspaceId, event);
    
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Post(':workspaceId/reset')
  async resetRecording(@Param('workspaceId') workspaceId: string) {
    // 미팅 시작 시간 정보 초기화
    meetingStartTimesByWorkspace.delete(workspaceId);
    
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
  @Get(':workspaceId/events')
  async getEvents(
    @Param('workspaceId') workspaceId: string,
    @Query('since') since?: string
  ) {
    const sinceIndex = since ? parseInt(since, 10) : 0;
    const workspaceEvents = recordingEventsByWorkspace.get(workspaceId) || [];
    
    // Only return events after the specified index
    const events = sinceIndex >= 0 && sinceIndex < workspaceEvents.length 
      ? workspaceEvents.slice(sinceIndex)
      : [];
    
    // 현재 활성 미팅의 시작 시간 정보 포함
    const activeMeetings = meetingStartTimesByWorkspace.get(workspaceId) || [];
    
    return {
      events,
      nextIndex: workspaceEvents.length,
      total: workspaceEvents.length,
      fromIndex: sinceIndex,
      activeMeetings: activeMeetings.map(m => ({
        meetingId: m.meetingId,
        startTime: m.startTime.toISOString(),
        device: m.device,
        description: m.description,
      })),
    };
  }
  
  private addEventForWorkspace(workspaceId: string, event: RecordingEvent) {
    if (!recordingEventsByWorkspace.has(workspaceId)) {
      recordingEventsByWorkspace.set(workspaceId, []);
    }
    recordingEventsByWorkspace.get(workspaceId)!.push(event);
  }
}