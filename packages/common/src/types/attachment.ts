/**
 * Attachment Domain Type
 */

export interface Attachment {
  id: string;
  messageId: string;
  url: string;
  storageKey: string;
  type: string;  // MIME type
  name: string;
  size: number;
  uploadedById?: string;
  uploadedAt: string;
}
