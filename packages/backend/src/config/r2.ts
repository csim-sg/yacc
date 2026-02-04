/**
 * Cloudflare R2 Configuration
 *
 * Manages S3-compatible R2 storage for payloads and attachments
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import { logger } from '../infrastructure/logger';

// ============================================
// Configuration
// ============================================

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'yacc-inbox';
const R2_REGION = process.env.R2_REGION || 'auto'; // Cloudflare R2 uses 'auto'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-...' + R2_ACCOUNT_ID + '.r2.dev';

const RAW_PAYLOAD_RETENTION_DAYS = parseInt(process.env.RAW_PAYLOAD_RETENTION_DAYS || '7', 10);
const ATTACHMENT_MAX_SIZE_MB = parseInt(process.env.ATTACHMENT_MAX_SIZE_MB || '5', 10);
const ATTACHMENT_MAX_SIZE_BYTES = ATTACHMENT_MAX_SIZE_MB * 1024 * 1024;

// ============================================
// R2 Client (Singleton)
// ============================================

let r2Client: S3Client | null = null;
let r2ClientConfig: S3ClientConfig | null = null;

/**
 * Get or create R2 client singleton
 */
export function getR2Client(): S3Client {
  if (!r2Client) {
    r2Client = createR2Client();
  }
  return r2Client;
}

/**
 * Create R2 client with Cloudflare configuration
 */
function createR2Client(): S3Client {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('Missing R2 credentials. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.');
  }

   const config: S3ClientConfig = {
     region: R2_REGION as string,
     endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
     credentials: {
       accessKeyId: R2_ACCESS_KEY_ID,
       secretAccessKey: R2_SECRET_ACCESS_KEY,
     },
     maxAttempts: 3,
   };

   r2ClientConfig = config;

   const client = new S3Client(config);

   logger.info('R2 client created - accountId: %s, bucket: %s, region: %s', R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_REGION);

   return client;
}

/**
 * Get R2 client configuration (for use with signed URLs)
 */
export function getR2ClientConfig(): S3ClientConfig {
   if (!r2ClientConfig) {
     getR2Client();
   }
   return r2ClientConfig!;
 }

/**
 * Get public CDN URL for files
 */
export function getPublicUrl(storageKey: string): string {
  return `${R2_PUBLIC_URL}/${storageKey}`;
}

/**
 * Check if R2 is configured
 */
export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
}

/**
 * Check R2 connection health
 */
export async function checkR2Health(): Promise<boolean> {
   try {
     const client = getR2Client();

     // Check if we can list bucket contents (simple health check)
     await client.send(new ListObjectsV2Command({
       Bucket: R2_BUCKET_NAME,
       MaxKeys: 1, // Only check if bucket is accessible
     }));

     logger.info('R2 health check passed - bucket: %s, region: %s', R2_BUCKET_NAME, R2_REGION);

     return true;
   } catch (error) {
     logger.error('R2 health check failed - error: %s', error instanceof Error ? error.message : String(error));
     return false;
   }
 }

// ============================================
// Export (Constants)
// ============================================

export {
  // Constants
  R2_BUCKET_NAME,
  R2_REGION,
  RAW_PAYLOAD_RETENTION_DAYS,
  ATTACHMENT_MAX_SIZE_BYTES,
};
