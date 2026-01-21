/**
 * Raw Payload Domain Type
 */

export interface RawPayload {
  id: string;
  messageId: string;
  storageKey: string;
  createdAt: string;
  expiresAt: string;
}
