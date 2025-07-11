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
  type: 'recording_start' | 'recording_stop' | 'recording_update' | 'recording_reset';
  workspaceId: string;
  data?: any;
  timestamp: Date;
}

// 워크스페이스별 이벤트 저장소 (실제로는 Redis나 DB 사용 권장)
const recordingEventsByWorkspace = new Map<string, RecordingEvent[]>();

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
    @Body() data: { meetingId: string; device?: string }
  ) {
    const event: RecordingEvent = {
      type: 'recording_start',
      workspaceId,
      data: {
        meetingId: data.meetingId,
        device: data.device,
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
  @Post(':workspaceId/stop')
  async stopRecording(
    @Param('workspaceId') workspaceId: string,
    @Body() data: { meetingId: string }
  ) {
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
    
    return {
      events,
      nextIndex: workspaceEvents.length,
      total: workspaceEvents.length,
      fromIndex: sinceIndex,
    };
  }
  
  private addEventForWorkspace(workspaceId: string, event: RecordingEvent) {
    if (!recordingEventsByWorkspace.has(workspaceId)) {
      recordingEventsByWorkspace.set(workspaceId, []);
    }
    recordingEventsByWorkspace.get(workspaceId)!.push(event);
  }
}