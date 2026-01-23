/**
 * R2 Storage Service
 *
 * Handles raw payload and attachment storage on Cloudflare R2
 */

import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type { RawPayloadInfo } from '@yacc/common/types/RawPayloadInfo.interface';
import { getR2Client, R2_BUCKET_NAME, RAW_PAYLOAD_RETENTION_DAYS, ATTACHMENT_MAX_SIZE_BYTES } from '../infrastructure/r2';
import logger from '../utils/logger';

// ============================================
// Storage Key Generators
// ============================================

/**
 * Generate storage key for raw payload
 */
export function generatePayloadKey(messageId: string, timestamp: Date): string {
  const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
  return `raw-payloads/${dateStr}/${messageId}.json`;
}

/**
 * Generate storage key for attachment
 */
export function generateAttachmentKey(conversationId: string, messageId: string, filename: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const uuid = crypto.randomUUID();
  return `attachments/${conversationId}/${messageId}_${uuid}_${filename}`;
}

// ============================================
// Raw Payload Storage
// ============================================

/**
 * Store raw platform payload as JSON text
 *
 * @param payloadInfo - Payload metadata
 * @returns Storage key
 */
export async function storeRawPayload(payloadInfo: RawPayloadInfo): Promise<string> {
  const client = getR2Client();
  const storageKey = generatePayloadKey(payloadInfo.messageId, payloadInfo.timestamp);

  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
      Body: JSON.stringify(payloadInfo.payload, null, 2), // Pretty-print JSON
      ContentType: 'application/json',
      Metadata: {
        'message-id': payloadInfo.messageId,
        'platform': 'unknown',
        'stored-at': payloadInfo.timestamp.toISOString(),
        'expires-at': payloadInfo.expiresAt.toISOString(),
      },
    });

    await client.send(command);

    logger.info('Raw payload stored', {
      messageId: payloadInfo.messageId,
      storageKey,
      sizeBytes: JSON.stringify(payloadInfo.payload).length,
    });

    return storageKey;
  } catch (error) {
    logger.error('Failed to store raw payload', {
      messageId: payloadInfo.messageId,
      storageKey,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Retrieve raw payload from R2
 *
 * @param storageKey - R2 storage key
 * @returns Raw payload object
 */
export async function getRawPayload(storageKey: string): Promise<unknown> {
  const client = getR2Client();

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
    });

    const response = await client.send(command);
    const body = response.Body;

    if (!body) {
      throw new Error(`Payload not found: ${storageKey}`);
    }

    // Parse JSON
    const payload = await body.transformToString();

    logger.info('Raw payload retrieved', {
      storageKey,
      sizeBytes: payload.length,
    });

    return JSON.parse(payload);
  } catch (error) {
    logger.error('Failed to retrieve raw payload', {
      storageKey,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================
// Attachment Storage
// ============================================

/**
 * Upload attachment buffer to R2
 *
 * @param file - File buffer
 * @param filename - Original filename
 * @param conversationId - Conversation ID
 * @param messageId - Message ID
 * @param mimeType - File MIME type
 * @returns Storage key
 */
export async function uploadAttachment(
  file: Buffer,
  filename: string,
  conversationId: string,
  messageId: string,
  mimeType: string
): Promise<{
  storageKey: string;
  cdnUrl: string;
  size: number;
}> {
  // Validate file size
  const fileSize = file.length;
  if (fileSize > ATTACHMENT_MAX_SIZE_BYTES) {
    throw new Error(
      `Attachment exceeds maximum size of ${ATTACHMENT_MAX_SIZE_BYTES} bytes (${ATTACHMENT_MAX_SIZE_BYTES / 1024 / 1024}MB)`
    );
  }

  const client = getR2Client();
  const storageKey = generateAttachmentKey(conversationId, messageId, filename);

  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
      Body: file,
      ContentType: mimeType,
      Metadata: {
        'original-filename': filename,
        'conversation-id': conversationId,
        'message-id': messageId,
        'size-bytes': String(fileSize),
        'uploaded-at': new Date().toISOString(),
      },
    });

    await client.send(command);

    const cdnUrl = getPublicUrl(storageKey);

    logger.info('Attachment uploaded', {
      filename,
      storageKey,
      sizeBytes: fileSize,
      cdnUrl,
    });

    return { storageKey, cdnUrl, size: fileSize };
  } catch (error) {
    logger.error('Failed to upload attachment', {
      filename,
      conversationId,
      messageId,
      storageKey,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Download attachment from URL and re-upload to R2
 *
 * @param url - Original URL (Telegram file_url)
 * @param filename - Original filename
 * @param conversationId - Conversation ID
 * @param messageId - Message ID
 * @returns Storage key and CDN URL
 */
export async function rehostAttachment(
  url: string,
  filename: string,
  conversationId: string,
  messageId: string,
  mimeType: string
): Promise<{
  storageKey: string;
  cdnUrl: string;
  size: number;
}> {
  try {
    // Download file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Upload to R2
    return await uploadAttachment(buffer, filename, conversationId, messageId, mimeType);
  } catch (error) {
    logger.error('Failed to rehost attachment', {
      url,
      filename,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================
// Cleanup (Expired Payloads)
// ============================================

/**
 * Delete raw payload from R2
 *
 * @param storageKey - R2 storage key
 */
export async function deleteRawPayload(storageKey: string): Promise<void> {
  const client = getR2Client();

  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
    });

    await client.send(command);

    logger.info('Raw payload deleted', { storageKey });
  } catch (error) {
    logger.error('Failed to delete raw payload', {
      storageKey,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================
// Export
// ============================================

export {
  // Raw payload storage
  storeRawPayload,
  getRawPayload,
  deleteRawPayload,

  // Attachment storage
  uploadAttachment,
  rehostAttachment,

  // Utilities
  generatePayloadKey,
  generateAttachmentKey,
};
