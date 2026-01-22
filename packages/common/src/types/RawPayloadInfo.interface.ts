import type { Platform } from './Platform.type';

export interface RawPayloadInfo {
  messageId: string;
  payload: unknown;
  timestamp: Date;
  expiresAt: Date;
  platform?: Platform;
}
