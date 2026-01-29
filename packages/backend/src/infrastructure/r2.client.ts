/**
 * Cloudflare R2 Storage Client (Singleton)
 *
 * Initializes and provides access to R2/S3-compatible storage
 * Follows ADR-005: Infrastructure folder for client initialization
 */

import { S3Client } from '@aws-sdk/client-s3';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import { config } from '../config/config';

// Singleton: Initialize S3 client once at module load
const s3Config: S3ClientConfig = {
  region: config.storage.r2.region,
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
    // Check if we can list bucket contents (simple health check)
    await r2Client.listObjectsV2({
      Bucket: config.storage.r2.bucket,
      MaxKeys: 0, // Only check if bucket is accessible
    });

    console.log('R2 health check passed', {
      bucket: config.storage.r2.bucket,
      region: config.storage.r2.region,
    });

    return true;
  } catch (error) {
    console.error('R2 health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
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
    await r2Client.putObject({
      Bucket: config.storage.r2.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    return {
      url: getPublicUrl(key),
      key,
    };
  } catch (error) {
    console.error('Failed to upload file to R2', { key, error });
    throw error;
  }
}

/**
 * Download file from R2
 */
export async function downloadFile(key: string): Promise<Buffer> {
  try {
    const result = await r2Client.getObject({
      Bucket: config.storage.r2.bucket,
      Key: key,
    });

    return result.Body as Buffer;
  } catch (error) {
    console.error('Failed to download file from R2', { key, error });
    throw error;
  }
}
