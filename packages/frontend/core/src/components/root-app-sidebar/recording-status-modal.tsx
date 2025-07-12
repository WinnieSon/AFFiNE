import { Modal } from '@affine/component/ui/modal';
import type { MeetingInfo, RecordingInfo } from '../../modules/recording';

import * as styles from './recording-status-modal.css';

interface RecordingStatusModalProps {
  open: boolean;
  onClose: () => void;
  isRecording: boolean;
  recordingInfo: RecordingInfo;
  meetingDetails?: MeetingInfo[];
  waitingDevices?: string[];
  currentTime: number;
}

export const RecordingStatusModal = ({
  open,
  onClose,
  isRecording,
  recordingInfo,
  meetingDetails = [],
  waitingDevices = [],
  currentTime,
}: RecordingStatusModalProps) => {
  const formatElapsedTime = (startTime: Date | undefined) => {
    if (!startTime) return '0초';
    
    const elapsed = Math.floor((currentTime - new Date(startTime).getTime()) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (minutes > 0) {
      return `${minutes}분 ${seconds}초`;
    }
    return `${seconds}초`;
  };

  return (
    <Modal
      open={open}
      onOpenChange={() => onClose()}
      width={400}
      contentOptions={{
        className: styles.modalContent,
      }}
    >
      <div className={styles.modalHeader}>
        <div className={styles.titleSection}>
          <div className={`${styles.statusDot} ${isRecording ? styles.recording : styles.idle}`} />
          <h2 className={styles.modalTitle}>
            {isRecording ? '실시간 기록/분석중 ...' : '대기 상태'}
          </h2>
        </div>
      </div>

      <div className={styles.modalBody}>
        {isRecording && meetingDetails.length > 0 ? (
          <div className={styles.meetingList}>
            {meetingDetails.map((meeting, index) => (
              <div key={meeting.id} className={styles.meetingItem}>
                <div className={styles.meetingHeader}>
                  <div className={styles.meetingInfo}>
                    <div className={styles.meetingId}>{meeting.id}</div>
                    {meeting.description && (
                      <div className={styles.description}>{meeting.description}</div>
                    )}
                    {meeting.device && (
                      <div className={styles.deviceName}>{meeting.device}</div>
                    )}
                  </div>
                  <div className={styles.elapsedTime}>
                    {meeting.status === 'processing' ? '분석중' : formatElapsedTime(meeting.startTime)}
                  </div>
                </div>
                {index < meetingDetails.length - 1 && <div className={styles.divider} />}
              </div>
            ))}
          </div>
        ) : !isRecording && waitingDevices.length > 0 ? (
          <div className={styles.deviceList}>
            <div className={styles.sectionTitle}>대기 중인 기기</div>
            <div className={styles.deviceGrid}>
              {waitingDevices.map((device) => (
                <div key={device} className={styles.deviceChip}>
                  {device}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            {isRecording ? '진행 중인 녹음이 없습니다' : '대기 중인 기기가 없습니다'}
          </div>
        )}
      </div>

      <div className={styles.modalFooter}>
        <button className={styles.closeButton} onClick={onClose}>
          닫기
        </button>
      </div>
    </Modal>
  );
};