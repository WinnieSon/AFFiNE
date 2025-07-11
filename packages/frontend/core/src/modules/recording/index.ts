import { type Framework } from '@toeverything/infra';

import { GlobalState } from '../storage';
import { WorkspaceScope } from '../workspace';

import { RecordingState } from './services/recording-state';
import { RecordingMessageHandler } from './services/recording-message-handler';
import { RecordingService } from './services/recording-service';

export function configureRecordingModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .service(RecordingState)
    .service(RecordingService, [RecordingState])
    .service(RecordingMessageHandler, [RecordingService]);
}

export { RecordingService } from './services/recording-service';
export { RecordingMessageHandler } from './services/recording-message-handler';
export { RecordingState } from './services/recording-state';
export type { RecordingInfo, MeetingInfo } from './services/recording-state';
export type { RecordingMessage } from './services/recording-message-handler';