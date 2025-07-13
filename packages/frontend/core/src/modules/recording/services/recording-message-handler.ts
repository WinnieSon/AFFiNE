import { Service } from '@toeverything/infra';

import { RecordingService } from './recording-service';

export interface RecordingMessage {
  type:
    | 'recording_start'
    | 'recording_stop'
    | 'recording_processing'
    | 'recording_update'
    | 'recording_reset';
  data?: {
    meetingId?: string;
    meetingCount?: number;
    activeMeetings?: string[];
    waitingDevices?: string[];
    [key: string]: any;
  };
}

export class RecordingMessageHandler extends Service {
  private lastEventIndex = 0;
  private pollInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private workspaceId?: string;

  constructor(private readonly recordingService: RecordingService) {
    super();
  }

  override dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.handleWindowMessage);
      window.removeEventListener(
        'recording-message',
        this.handleCustomEvent as EventListener
      );
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    super.dispose();
  }

  initialize(workspaceId: string) {
    if (this.workspaceId === workspaceId || typeof window === 'undefined') {
      return;
    }

    // Clean up previous polling if workspace changed
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.workspaceId = workspaceId;
    this.lastEventIndex = 0; // Reset index for new workspace

    // Listen for window messages (for external communication)
    window.removeEventListener('message', this.handleWindowMessage);
    window.addEventListener('message', this.handleWindowMessage);

    // Listen for custom events (for internal communication)
    window.removeEventListener(
      'recording-message',
      this.handleCustomEvent as EventListener
    );
    window.addEventListener(
      'recording-message',
      this.handleCustomEvent as EventListener
    );

    // Start polling for REST API events
    this.pollInterval = setInterval(() => {
      this.pollEvents().catch(console.error);
    }, 2000); // Poll every 2 seconds
    this.pollEvents().catch(console.error); // Initial poll

    // Start health check interval (5 minutes = 300000ms)
    this.healthCheckInterval = setInterval(
      () => {
        this.sendHealthCheck().catch(console.error);
      },
      5 * 60 * 1000
    ); // Send health check every 5 minutes
    this.sendHealthCheck().catch(console.error); // Initial health check

    console.log(
      `Recording message handler initialized for workspace: ${workspaceId}`
    );
  }

  private async sendHealthCheck() {
    if (!this.workspaceId) {
      return;
    }

    // Get current recording info
    const recordingInfo = this.recordingService.recordingInfo$.value;
    if (
      !recordingInfo ||
      (recordingInfo.status === 'idle' &&
        recordingInfo.waitingDevices?.length === 0)
    ) {
      return; // No active recording or waiting devices
    }

    // Send health check for each active meeting
    const meetingDetails = recordingInfo.meetingDetails || [];
    const waitingDevices = recordingInfo.waitingDevices || [];

    // For active meetings
    for (const meeting of meetingDetails) {
      const device = meeting.device || `Device_${meeting.id}`;
      try {
        await fetch(`/api/recording/${this.workspaceId}/health`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetingId: meeting.id,
            device,
            status: meeting.status,
          }),
        });
      } catch (error) {
        console.error(
          `Failed to send health check for meeting ${meeting.id}:`,
          error
        );
      }
    }

    // For waiting devices
    for (const deviceId of waitingDevices) {
      try {
        await fetch(`/api/recording/${this.workspaceId}/health`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetingId: deviceId, // Use device ID as meeting ID for waiting devices
            device: deviceId,
            status: 'waiting',
          }),
        });
      } catch (error) {
        console.error(
          `Failed to send health check for waiting device ${deviceId}:`,
          error
        );
      }
    }
  }

  private async pollEvents() {
    if (!this.workspaceId) {
      return;
    }

    try {
      const response = await fetch(
        `/api/recording/${this.workspaceId}/events?since=${this.lastEventIndex}`
      );
      if (response.ok) {
        const data = (await response.json()) as {
          events: RecordingMessage[];
          nextIndex: number;
          activeMeetings?: Array<{
            meetingId: string;
            startTime: string;
            device?: string;
            description?: string;
          }>;
        };
        void console.log(
          `[${this.workspaceId}] Polling events since ${this.lastEventIndex}, got ${data.events?.length || 0} events`
        );

        if (
          data.events &&
          Array.isArray(data.events) &&
          data.events.length > 0
        ) {
          data.events.forEach((event: RecordingMessage) => {
            this.handleRecordingMessage(event);
          });
          this.lastEventIndex = data.nextIndex;
          void console.log(
            `[${this.workspaceId}] Updated lastEventIndex to ${this.lastEventIndex}`
          );
        }

        // 활성 미팅의 시작 시간 정보 업데이트
        if (data.activeMeetings) {
          this.recordingService.updateActiveMeetingTimes(data.activeMeetings);
        }
      }
    } catch (error) {
      console.error(
        `Failed to poll recording events for workspace ${this.workspaceId}:`,
        error
      );
    }
  }

  private readonly handleWindowMessage = (event: MessageEvent) => {
    // Only accept messages from same origin or trusted origins
    if (
      event.origin !== window.location.origin &&
      !event.origin.includes('localhost') &&
      !event.origin.includes('127.0.0.1')
    ) {
      return;
    }

    try {
      const message = event.data as RecordingMessage;
      if (this.isValidRecordingMessage(message)) {
        this.handleRecordingMessage(message);
      }
    } catch (error) {
      console.error('Error handling recording message:', error);
    }
  };

  private readonly handleCustomEvent = (
    event: CustomEvent<RecordingMessage>
  ) => {
    try {
      const message = event.detail;
      if (this.isValidRecordingMessage(message)) {
        this.handleRecordingMessage(message);
      }
    } catch (error) {
      console.error('Error handling recording custom event:', error);
    }
  };

  private isValidRecordingMessage(message: any): message is RecordingMessage {
    if (
      !message ||
      typeof message !== 'object' ||
      typeof message.type !== 'string'
    ) {
      return false;
    }
    return [
      'recording_start',
      'recording_stop',
      'recording_processing',
      'recording_update',
      'recording_reset',
    ].includes(message.type);
  }

  private handleRecordingMessage(message: RecordingMessage) {
    console.log('Received recording message:', message);

    switch (message.type) {
      case 'recording_start':
        this.recordingService.startRecording(
          message.data?.meetingId,
          message.data?.device,
          message.data?.startTime,
          message.data?.description
        );
        break;

      case 'recording_processing':
        this.recordingService.startProcessing(
          message.data?.meetingId,
          message.data?.startTime,
          message.data?.device,
          message.data?.description
        );
        break;

      case 'recording_stop':
        this.recordingService.stopRecording(message.data?.meetingId);
        break;

      case 'recording_update':
        if (message.data) {
          this.recordingService.updateRecordingInfo(message.data);
        }
        break;

      case 'recording_reset':
        this.recordingService.reset();
        break;

      default:
        console.warn('Unknown recording message type:', message.type);
    }
  }

  // Public method to manually dispatch recording messages
  dispatchRecordingMessage(message: RecordingMessage) {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('recording-message', { detail: message });
      window.dispatchEvent(event);
    }
  }
}
