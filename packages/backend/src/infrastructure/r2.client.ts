/**
 * Cloudflare R2 Storage Client (Singleton)
 *
 * Initializes and provides access to R2/S3-compatible storage
 * Follows ADR-005: Infrastructure folder for client initialization
 */

import { S3Client, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import { config } from '../config/config';

// Singleton: Initialize S3 client once at module load
const s3Config: S3ClientConfig = {
  region: 'auto',
  endpoint: config.storage.r2.endpoint,
  credentials: {
    accessKeyId: config.storage.r2.accessKey,
    secretAccessKey: config.storage.r2.secretKey,
  },
  maxAttempts: 3,
};

export const r2Client = new S3Client(s3Config);

/**
 * Get S3/R2 client configuration (for use with signed URLs)
 */
export function getR2ClientConfig(): S3ClientConfig {
  return s3Config;
}

/**
 * Get public CDN URL for files
 */
export function getPublicUrl(storageKey: string): string {
  const cdnUrl = config.storage.r2.cdnUrl || `https://pub-${config.storage.r2.endpoint}.r2.dev`;
  return `${cdnUrl}/${storageKey}`;
}

/**
 * Check if R2 is configured
 */
export function isR2Configured(): boolean {
  return !!(
    config.storage.r2.endpoint &&
    config.storage.r2.accessKey &&
    config.storage.r2.secretKey &&
    config.storage.r2.bucket
  );
}

/**
 * Check R2 connection health
 */
export async function checkR2Health(): Promise<boolean> {
  try {
    // Check if we can access the bucket
    await r2Client.send(new HeadBucketCommand({ Bucket: config.storage.r2.bucket }));
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Upload file to R2
 */
export async function uploadFile(
  key: string,
  body: Buffer | string,
  contentType: string
): Promise<{ url: string; key: string }> {
  try {
    await r2Client.send(new PutObjectCommand({
      Bucket: config.storage.r2.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));

    return {
      url: getPublicUrl(key),
      key,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Download file from R2
 */
export async function downloadFile(key: string): Promise<Buffer> {
  try {
    const result = await r2Client.send(new GetObjectCommand({
      Bucket: config.storage.r2.bucket,
      Key: key,
    }));

    if (!result.Body) {
      throw new Error('Empty response from R2');
    }

    const buffer = await result.Body.transformToByteArray();
    return Buffer.from(buffer);
  } catch (error) {
    throw error;
  }
}
