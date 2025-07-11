import { Module } from '@nestjs/common';
import { RecordingController } from './controller';

@Module({
  controllers: [RecordingController],
})
export class RecordingModule {}