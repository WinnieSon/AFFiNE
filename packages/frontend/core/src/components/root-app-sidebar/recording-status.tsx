import { useLiveData, useService } from '@toeverything/infra';
import { useEffect, useState } from 'react';

import { RecordingService } from '../../modules/recording';
import { RecordingStatusModal } from './recording-status-modal';

import * as styles from './recording-status.css';

export const RecordingStatus = () => {
  const recordingService = useService(RecordingService);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [modalOpen, setModalOpen] = useState(false);
  
  const statusText = useLiveData(recordingService.statusText$);
  const statusSubText = useLiveData(recordingService.statusSubText$);
  const isRecording = useLiveData(recordingService.isRecording$);
  const recordingInfo = useLiveData(recordingService.recordingInfo$);

  // Update current time every second for elapsed time calculation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClick = () => {
    const hasContent = isRecording 
      ? recordingInfo.meetingDetails && recordingInfo.meetingDetails.length > 0
      : recordingInfo.waitingDevices && recordingInfo.waitingDevices.length > 0;
      
    if (hasContent) {
      setModalOpen(true);
    }
  };

  return (
    <>
      <div className={styles.container} onClick={handleClick}>
        <div className={styles.statusWrapper}>
          <div className={styles.statusIndicator}>
            <div className={`${styles.dot} ${isRecording ? styles.recording : styles.idle}`} />
          </div>
          <div className={styles.textContainer}>
            <div className={styles.mainText}>{statusText}</div>
            <div className={styles.subText}>{statusSubText}</div>
          </div>
        </div>
      </div>
      
      <RecordingStatusModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        isRecording={isRecording}
        recordingInfo={recordingInfo}
        meetingDetails={recordingInfo.meetingDetails}
        waitingDevices={recordingInfo.waitingDevices}
        currentTime={currentTime}
      />
    </>
  );
};