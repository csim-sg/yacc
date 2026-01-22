import type { Timestamp } from './Timestamp.interface';

export interface RawPayload extends Timestamp {
  id: string;
  messageId: string;
  storageKey: string;
  contentType?: string;
  expiresAt?: string;
}
