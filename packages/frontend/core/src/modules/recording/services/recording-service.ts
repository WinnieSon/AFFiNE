import { Service } from '@toeverything/infra';
import { WorkspaceService } from '../../workspace';

import type { RecordingInfo } from './recording-state';
import { RecordingState } from './recording-state';
import { RecordingMessageHandler } from './recording-message-handler';

export class RecordingService extends Service {
  private messageHandler?: RecordingMessageHandler;
  private workspaceId: string;
  
  constructor(private readonly recordingState: RecordingState) {
    super();
    const workspaceService = this.framework.get(WorkspaceService);
    this.workspaceId = workspaceService.workspace.id;
    // Initialize message handler when service is created
    this.initializeMessageHandler();
  }
  
  private initializeMessageHandler() {
    // Delay initialization to avoid circular dependency
    setTimeout(() => {
      const handler = this.framework.get(RecordingMessageHandler);
      if (handler) {
        handler.initialize(this.workspaceId);
        this.messageHandler = handler;
      }
    }, 0);
  }

  get recordingInfo$() {
    return this.recordingState.recordingInfo$;
  }

  get isRecording$() {
    return this.recordingState.isRecording$;
  }

  get statusText$() {
    return this.recordingState.statusText$;
  }

  get statusSubText$() {
    return this.recordingState.statusSubText$;
  }

  startRecording(meetingId?: string, device?: string) {
    this.recordingState.startRecording(meetingId, device);
    console.log('Recording started:', meetingId, device);
  }

  stopRecording(meetingId?: string) {
    this.recordingState.stopRecording(meetingId);
    console.log('Recording stopped:', meetingId);
  }

  updateRecordingInfo(info: Partial<RecordingInfo>) {
    this.recordingState.setRecordingInfo(info);
  }

  reset() {
    this.recordingState.reset();
    console.log('Recording state reset');
  }

  // External message handler for window communication
  handleExternalMessage(message: {
    type: 'recording_start' | 'recording_stop' | 'recording_update';
    data?: any;
  }) {
    switch (message.type) {
      case 'recording_start':
        this.startRecording(message.data?.meetingId);
        break;
      case 'recording_stop':
        this.stopRecording();
        break;
      case 'recording_update':
        if (message.data) {
          this.updateRecordingInfo(message.data);
        }
        break;
      default:
        console.warn('Unknown recording message type:', message.type);
    }
  }
}