/**
 * Message API Types
 */

export interface SendMessageRequest {
  body: string;
  attachments?: FileUpload[];
}

export interface FileUpload {
  name: string;
  type: string;
  size: number;
  url: string;  // CDN URL
}
