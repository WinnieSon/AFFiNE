export class CreateDocDto {
  title?: string;
  initialContent?: number[] | Uint8Array;
}

export class UpdateDocDto {
  updates: (number[] | Uint8Array)[] = [];
}
