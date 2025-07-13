import { LiveData, Service } from '@toeverything/infra';
import { map } from 'rxjs';

export interface MeetingInfo {
  id: string;
  startTime: Date;
  device?: string;
  description?: string;
  status: 'recording' | 'processing';
}

export interface RecordingInfo {
  id: string;
  status: 'idle' | 'recording' | 'processing';
  meetingCount: number;
  activeMeetings: string[]; // 활성 회의 ID 목록
  meetingDetails: MeetingInfo[]; // 상세 회의 정보
  waitingDevices: string[]; // 대기중인 기기 목록
  startTime?: Date; // 첫 번째 녹음 시작 시간
  device?: string; // Current device (for updates)
}

export class RecordingState extends Service {
  private readonly _recordingInfo$ = new LiveData<RecordingInfo>({
    id: 'default',
    status: 'idle',
    meetingCount: 0,
    activeMeetings: [],
    meetingDetails: [],
    waitingDevices: [],
  });

  readonly recordingInfo$ = this._recordingInfo$;

  readonly isRecording$ = LiveData.from(
    this.recordingInfo$.pipe(
      map(info => info.status === 'recording' || info.status === 'processing')
    ),
    false
  );

  readonly statusText$ = LiveData.from(
    this.recordingInfo$.pipe(
      map(info => {
        switch (info.status) {
          case 'idle':
            return '대기중 ..';
          case 'recording':
            return '기록중';
          case 'processing':
            return '기록중 ..';
          default:
            return '대기중 ..';
        }
      })
    ),
    '대기중 ..'
  );

  readonly statusSubText$ = LiveData.from(
    this.recordingInfo$.pipe(
      map(info => {
        if (info.status === 'idle') {
          return '기록중인 회의 없음';
        } else {
          return `${info.meetingCount}개의 회의를 기록중`;
        }
      })
    ),
    '기록중인 회의 없음'
  );

  setRecordingInfo(info: Partial<RecordingInfo>) {
    const current = this._recordingInfo$.value;

    // Check if this is a device-specific status update
    const isDeviceUpdate = !!(info.device && (info as any).status);

    // For device updates, we only want to handle the device state transition
    // without modifying other recording info
    let updateInfo = info;
    if (isDeviceUpdate) {
      // Remove the device-specific status to prevent overwriting global status
      const { status: _, device, ...rest } = info;
      updateInfo = { device, ...rest };
    }

    // Deep merge to preserve arrays when they're not explicitly provided
    const merged: RecordingInfo = {
      ...current,
      ...updateInfo,
      // Only update global status if it's a valid RecordingInfo status
      status:
        info.status && ['idle', 'recording', 'processing'].includes(info.status)
          ? info.status
          : current.status,
      // Preserve arrays if not provided in the update
      activeMeetings: info.activeMeetings ?? current.activeMeetings,
      meetingDetails: info.meetingDetails ?? current.meetingDetails,
      waitingDevices: info.waitingDevices ?? current.waitingDevices,
    };

    // Handle device status transitions from backend update messages
    // Note: 'waiting' status comes from backend but isn't part of RecordingInfo.status
    if (info.device && (info as any).status) {
      const updateStatus = (info as any).status;
      console.log('Device status update:', info.device, updateStatus, 'Current waiting:', merged.waitingDevices);
      
      if (updateStatus === 'waiting') {
        // Add device to waiting list if not already there
        if (!merged.waitingDevices.includes(info.device)) {
          merged.waitingDevices = [...merged.waitingDevices, info.device];
          console.log('Added device to waiting:', info.device, 'New list:', merged.waitingDevices);
        }
      } else if (
        updateStatus === 'recording' ||
        updateStatus === 'processing'
      ) {
        // Remove device from waiting list when it starts recording/processing
        merged.waitingDevices = merged.waitingDevices.filter(
          d => d !== info.device
        );
        console.log('Removed device from waiting:', info.device, 'New list:', merged.waitingDevices);
      } else if (updateStatus === 'idle') {
        // Remove device from waiting list when it goes idle (timeout or manual)
        merged.waitingDevices = merged.waitingDevices.filter(
          d => d !== info.device
        );
        console.log('Device timed out or went idle:', info.device, 'New list:', merged.waitingDevices);
      }
    }

    this._recordingInfo$.next(merged);
  }

  startRecording(
    meetingId?: string,
    device?: string,
    startTime?: string,
    description?: string
  ) {
    const current = this._recordingInfo$.value;
    const newMeetingId = meetingId || `meeting_${Date.now()}`;

    // Check if meeting already exists
    if (current.activeMeetings.includes(newMeetingId)) {
      console.log(`Meeting ${newMeetingId} is already recording`);
      return;
    }

    const newMeeting: MeetingInfo = {
      id: newMeetingId,
      startTime: startTime ? new Date(startTime) : new Date(),
      device,
      description,
      status: 'recording',
    };

    // Remove device from waiting list if it's there
    const updatedWaitingDevices = device 
      ? current.waitingDevices.filter(d => d !== device)
      : current.waitingDevices;

    this.setRecordingInfo({
      id: newMeetingId,
      status: 'recording',
      meetingCount: current.meetingCount + 1,
      activeMeetings: [...current.activeMeetings, newMeetingId],
      meetingDetails: [...current.meetingDetails, newMeeting],
      waitingDevices: updatedWaitingDevices,
      startTime: current.startTime || new Date(),
    });
  }

  startProcessing(
    meetingId?: string,
    startTime?: string,
    device?: string,
    description?: string
  ) {
    const current = this._recordingInfo$.value;

    if (!meetingId) {
      // 미팅 ID가 없으면 전체 상태를 processing으로 변경
      this.setRecordingInfo({
        status: 'processing',
      });
      return;
    }

    // 특정 미팅의 상태를 processing으로 변경
    let updatedDetails = [...current.meetingDetails];
    const existingMeetingIndex = updatedDetails.findIndex(
      m => m.id === meetingId
    );

    if (existingMeetingIndex >= 0) {
      // 기존 미팅의 상태만 변경
      updatedDetails[existingMeetingIndex] = {
        ...updatedDetails[existingMeetingIndex],
        status: 'processing',
      };
    } else {
      // 새로운 미팅 생성 (start를 거치지 않은 경우)
      const newMeeting: MeetingInfo = {
        id: meetingId,
        startTime: startTime ? new Date(startTime) : new Date(),
        device,
        description,
        status: 'processing',
      };
      updatedDetails.push(newMeeting);

      // activeMeetings에도 추가 및 대기 목록에서 제거
      if (!current.activeMeetings.includes(meetingId)) {
        const updatedWaitingDevices = device 
          ? current.waitingDevices.filter(d => d !== device)
          : current.waitingDevices;
          
        this.setRecordingInfo({
          activeMeetings: [...current.activeMeetings, meetingId],
          meetingCount: current.meetingCount + 1,
          waitingDevices: updatedWaitingDevices,
        });
      }
    }

    // 적어도 하나의 미팅이 recording 상태면 전체 상태는 recording
    const hasRecording = updatedDetails.some(m => m.status === 'recording');
    const overallStatus = hasRecording ? 'recording' : 'processing';

    this.setRecordingInfo({
      status: overallStatus,
      meetingDetails: updatedDetails,
    });
  }

  stopRecording(meetingId?: string) {
    const current = this._recordingInfo$.value;
    let updatedMeetings = current.activeMeetings;
    let updatedDetails = current.meetingDetails;

    if (meetingId) {
      updatedMeetings = current.activeMeetings.filter(id => id !== meetingId);
      updatedDetails = current.meetingDetails.filter(m => m.id !== meetingId);
    } else {
      // Remove the last one if no ID specified
      updatedMeetings = current.activeMeetings.slice(0, -1);
      updatedDetails = current.meetingDetails.slice(0, -1);
    }

    this.setRecordingInfo({
      status: updatedMeetings.length > 0 ? 'recording' : 'idle',
      meetingCount: updatedMeetings.length,
      activeMeetings: updatedMeetings,
      meetingDetails: updatedDetails,
      startTime:
        updatedDetails.length > 0 ? updatedDetails[0].startTime : undefined,
    });
  }

  reset() {
    this.setRecordingInfo({
      id: 'default',
      status: 'idle',
      meetingCount: 0,
      activeMeetings: [],
      meetingDetails: [],
      waitingDevices: [],
      startTime: undefined,
    });
  }

  updateActiveMeetingTimes(
    activeMeetings: Array<{
      meetingId: string;
      startTime: string;
      device?: string;
      description?: string;
    }>
  ) {
    const current = this._recordingInfo$.value;

    // Update meeting details with server-provided start times
    const updatedDetails = current.meetingDetails.map(meeting => {
      const serverMeeting = activeMeetings.find(
        m => m.meetingId === meeting.id
      );
      if (serverMeeting) {
        return {
          ...meeting,
          startTime: new Date(serverMeeting.startTime),
          device: serverMeeting.device || meeting.device,
          description: serverMeeting.description || meeting.description,
        };
      }
      return meeting;
    });

    // Add any new meetings from server that we don't have locally
    activeMeetings.forEach(serverMeeting => {
      if (!current.meetingDetails.find(m => m.id === serverMeeting.meetingId)) {
        updatedDetails.push({
          id: serverMeeting.meetingId,
          startTime: new Date(serverMeeting.startTime),
          device: serverMeeting.device,
          description: serverMeeting.description,
          status: 'recording', // 서버에서 온 새 미팅은 기본적으로 recording 상태
        });
      }
    });

    if (
      updatedDetails.length !== current.meetingDetails.length ||
      updatedDetails.some(
        (m, i) =>
          m.startTime?.getTime() !==
          current.meetingDetails[i]?.startTime?.getTime()
      )
    ) {
      this.setRecordingInfo({
        meetingDetails: updatedDetails,
        activeMeetings: activeMeetings.map(m => m.meetingId),
        meetingCount: activeMeetings.length,
        status: activeMeetings.length > 0 ? current.status : 'idle',
      });
    }
  }
}
