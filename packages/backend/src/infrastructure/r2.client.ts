/**
 * Cloudflare R2 Storage Client
 *
 * Initializes and provides access to R2/S3-compatible storage
 * Follows ADR-005: Infrastructure folder for client initialization with DI
 */

import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import { config } from '../config/config';

/**
 * R2 client class
 * Manages Cloudflare R2 storage for payloads and attachments
 * Uses DI pattern: accepts config in constructor
 */
export class R2Client {
  private client: S3Client;
  private clientConfig: S3ClientConfig;
  private config: {
    accountId: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region: string;
  };

  /**
   * Initialize R2 client with provided config
   */
  constructor(r2Config = {
    accountId: config.storage.r2.endpoint,
    accessKey: config.storage.r2.accessKey,
    secretKey: config.storage.r2.secretKey,
    bucket: config.storage.r2.bucket,
    region: config.storage.r2.region,
  }) {
    this.config = r2Config;

    if (!this.config.accountId || !this.config.accessKey || !this.config.secretKey) {
      throw new Error('Missing R2 credentials. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY, and R2_SECRET_ACCESS_KEY.');
    }

    this.clientConfig = {
      region: this.config.region,
      endpoint: `https://${this.config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.accessKey,
        secretAccessKey: this.config.secretKey,
      },
      maxAttempts: 3,
    };

    this.client = new S3Client(this.clientConfig);
  }

  /**
   * Get R2 client instance
   */
  getClient(): S3Client {
    return this.client;
  }

  /**
   * Get R2 client configuration (for use with signed URLs)
   */
  getClientConfig(): S3ClientConfig {
    return this.clientConfig;
  }

  /**
   * Get public CDN URL for files
   */
  getPublicUrl(storageKey: string): string {
    const cdnUrl = config.storage.r2.cdnUrl || `https://pub-${this.config.accountId}.r2.dev`;
    return `${cdnUrl}/${storageKey}`;
  }

  /**
   * Check if R2 is configured
   */
  isConfigured(): boolean {
    return !!(
      this.config.accountId &&
      this.config.accessKey &&
      this.config.secretKey &&
      this.config.bucket
    );
  }

  /**
   * Check R2 connection health
   */
  async checkHealth(): Promise<boolean> {
    try {
      // Check if we can list bucket contents (simple health check)
      await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          MaxKeys: 0, // Only check if bucket is accessible
        })
      );

      console.log('R2 health check passed', {
        bucket: this.config.bucket,
        region: this.config.region,
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
  async uploadFile(
    key: string,
    body: Buffer | string,
    contentType: string
  ): Promise<{ url: string; key: string }> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        })
      );

      return {
        url: this.getPublicUrl(key),
        key,
      };
    } catch (error) {
      console.error('Failed to upload file to R2', { key, error });
      throw error;
    }
  }
}
