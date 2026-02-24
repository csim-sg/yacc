/**
 * Attachment Entity
 * Files attached to messages (inbound re-hosted or outbound uploads)
 * Max size: 5MB, stored on Cloudflare R2
 *
 * @see POST /api/conversations/:id/messages - SendMessageRequest
 * @see GET /api/attachments/:id - Download attachment
 */
export interface Attachment {
  /** Unique identifier (UUID) */
  id: string;
  /** UUID of the message this attachment belongs to */
  messageId: string;
  /** CDN URL for downloading the attachment */
  url: string;
  /** Storage key in Cloudflare R2 */
  storageKey: string;
  /** MIME type (e.g., 'image/png', 'application/pdf') */
  type: string;
  /** Original filename */
  name: string;
  /** File size in bytes */
  size: number;
  /** UUID of user who uploaded (for outbound) or null (for inbound) */
  uploadedById?: string;
  /** ISO8601 timestamp when attachment was uploaded */
  uploadedAt: string;
}
