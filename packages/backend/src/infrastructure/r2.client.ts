/**
 * Cloudflare R2 Storage Client (Singleton)
 *
 * Initializes and provides access to R2/S3-compatible storage
 * Follows ADR-005: Infrastructure folder for client initialization
 */

import { S3Client, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import { appConfig } from '../config/appConfig';

// Singleton: Initialize S3 client once at module load
const s3Config: S3ClientConfig = {
  region: 'auto',
  endpoint: appConfig.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: appConfig.CLOUDFLARE_R2_ACCESS_KEY,
    secretAccessKey: appConfig.CLOUDFLARE_R2_SECRET_KEY,
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
  const cdnUrl = appConfig.CLOUDFLARE_CDN_URL || `https://pub-${appConfig.CLOUDFLARE_R2_ENDPOINT}.r2.dev`;
  return `${cdnUrl}/${storageKey}`;
}

/**
 * Check if R2 is configured
 */
export function isR2Configured(): boolean {
  return !!(
    appConfig.CLOUDFLARE_R2_ENDPOINT &&
    appConfig.CLOUDFLARE_R2_ACCESS_KEY &&
    appConfig.CLOUDFLARE_R2_SECRET_KEY &&
    appConfig.CLOUDFLARE_R2_BUCKET
  );
}

/**
 * Check R2 connection health
 */
export async function checkR2Health(): Promise<boolean> {
  try {
    // Check if we can access the bucket
    await r2Client.send(new HeadBucketCommand({ Bucket: appConfig.CLOUDFLARE_R2_BUCKET }));
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
       Bucket: appConfig.CLOUDFLARE_R2_BUCKET,
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
       Bucket: appConfig.CLOUDFLARE_R2_BUCKET,
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
