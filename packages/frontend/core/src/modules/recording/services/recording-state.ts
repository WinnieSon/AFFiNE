import { LiveData, Service } from '@toeverything/infra';
import { map } from 'rxjs';

export interface MeetingInfo {
  id: string;
  startTime: Date;
  device?: string;
}

export interface RecordingInfo {
  id: string;
  status: 'idle' | 'recording';
  meetingCount: number;
  activeMeetings: string[]; // 활성 회의 ID 목록
  meetingDetails: MeetingInfo[]; // 상세 회의 정보
  waitingDevices: string[]; // 대기중인 기기 목록
  startTime?: Date; // 첫 번째 녹음 시작 시간
}

export class RecordingState extends Service {
  private _recordingInfo$ = new LiveData<RecordingInfo>({
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
      map(info => info.status === 'recording')
    ),
    false
  );

  readonly statusText$ = LiveData.from(
    this.recordingInfo$.pipe(
      map(info => {
        if (info.status === 'idle') {
          return '대기중 ..';
        } else {
          return '기록중';
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
          return `(${info.meetingCount})`;
        }
      })
    ),
    '기록중인 회의 없음'
  );

  setRecordingInfo(info: Partial<RecordingInfo>) {
    const current = this._recordingInfo$.value;
    this._recordingInfo$.next({
      ...current,
      ...info,
    });
  }

  startRecording(meetingId?: string, device?: string) {
    const current = this._recordingInfo$.value;
    const newMeetingId = meetingId || `meeting_${Date.now()}`;
    
    // Check if meeting already exists
    if (current.activeMeetings.includes(newMeetingId)) {
      console.log(`Meeting ${newMeetingId} is already recording`);
      return;
    }
    
    const newMeeting: MeetingInfo = {
      id: newMeetingId,
      startTime: new Date(),
      device,
    };
    
    this.setRecordingInfo({
      id: newMeetingId,
      status: 'recording',
      meetingCount: current.meetingCount + 1,
      activeMeetings: [...current.activeMeetings, newMeetingId],
      meetingDetails: [...current.meetingDetails, newMeeting],
      startTime: current.startTime || new Date(),
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
      startTime: updatedDetails.length > 0 ? updatedDetails[0].startTime : undefined,
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
}