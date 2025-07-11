export class CreateDocDto {
  title?: string;
  initialContent?: number[] | Uint8Array;
}

export class UpdateDocDto {
  updates: (number[] | Uint8Array)[] = [];
}

export class CreateMeetingDocDto {
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  participants?: string[];
  tags?: string[];
  agenda?: string[];
  summary?: Array<string | { [agenda: string]: string[] }>;
  action?: string[];
  conversation?: Array<{
    speaker: string;
    text: string;
    time: string;
  }>;
}
