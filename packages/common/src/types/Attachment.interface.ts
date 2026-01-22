export interface Attachment {
  id: string;
  messageId: string;
  url: string;
  storageKey: string;
  type: string;
  name: string;
  size: number;
  uploadedById?: string;
  uploadedAt: string;
}
