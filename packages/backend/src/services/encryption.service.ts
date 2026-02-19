/**
 * Encryption Service
 *
 * Handles AES-256-GCM encryption/decryption for sensitive data (passwords, API keys).
 * Uses INTEGRATION_CREDENTIALS_ENCRYPTION_KEY from environment.
 *
 * Architecture: AES-256-GCM with authenticated encryption (prevents tampering).
 * Format: 'iv:encryptedData:authTag' (hex-encoded)
 */

import crypto from 'crypto';
import { appConfig } from '../config/appConfig';
import { logger } from '../infrastructure/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

export class EncryptionService {
  private static encryptionKey: Buffer | null = null;

  /**
   * Initialize encryption key from environment
   * Called at application startup
   * Throws if INTEGRATION_CREDENTIALS_ENCRYPTION_KEY not set when using DB storage
   */
  public static initializeKey(): void {
    if (!appConfig.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY) {
      logger.warn(
        { feature: 'encryption' },
        'INTEGRATION_CREDENTIALS_ENCRYPTION_KEY not set; DB credential storage disabled'
      );
      return;
    }

    // Validate key length
    if (appConfig.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY.length < KEY_LENGTH) {
      throw new Error(
        `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY must be at least ${KEY_LENGTH} characters long`
      );
    }

    // Use first KEY_LENGTH characters as the encryption key
    this.encryptionKey = Buffer.from(
      appConfig.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY.slice(0, KEY_LENGTH),
      'utf8'
    );

    logger.info({ feature: 'encryption' }, 'Encryption key initialized');
  }

  /**
   * Encrypt a plaintext string
   * Returns format: 'iv:encryptedData:authTag' (all hex-encoded)
   *
   * @param plaintext - Text to encrypt (e.g., password)
   * @returns Encrypted string or null if encryption key not available
   * @throws Error if encryption fails
   */
  public static encrypt(plaintext: string): string | null {
    if (!this.encryptionKey) {
      logger.warn(
        { feature: 'encryption' },
        'Encryption key not initialized; cannot encrypt'
      );
      return null;
    }

    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Format: iv:encryptedData:authTag
      const result = `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;

      logger.debug(
        { feature: 'encryption', method: 'encrypt' },
        'Data encrypted successfully'
      );

      return result;
    } catch (error) {
      logger.error(
        {
          feature: 'encryption',
          method: 'encrypt',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Encryption failed'
      );
      throw error;
    }
  }

  /**
   * Decrypt an encrypted string
   * Expects format: 'iv:encryptedData:authTag' (hex-encoded)
   *
   * @param encrypted - Encrypted string from encrypt()
   * @returns Decrypted plaintext
   * @throws Error if decryption fails or format is invalid
   */
  public static decrypt(encrypted: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    try {
      const parts = encrypted.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted format: expected iv:encryptedData:authTag');
      }

      const [ivHex, encryptedData, authTagHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      logger.debug(
        { feature: 'encryption', method: 'decrypt' },
        'Data decrypted successfully'
      );

      return decrypted;
    } catch (error) {
      logger.error(
        {
          feature: 'encryption',
          method: 'decrypt',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Decryption failed'
      );
      throw error;
    }
  }

  /**
   * Check if encryption is available (key initialized)
   * @returns true if encryption key is set
   */
  public static isEncryptionAvailable(): boolean {
    return this.encryptionKey !== null;
  }

  /**
   * Encrypt a JSON object
   * @param obj - Object to encrypt
   * @returns Encrypted string
   */
  public static encryptJSON(obj: any): string | null {
    return this.encrypt(JSON.stringify(obj));
  }

  /**
   * Decrypt a JSON object
   * @param encrypted - Encrypted string from encryptJSON()
   * @returns Decrypted object
   */
  public static decryptJSON(encrypted: string): any {
    const decrypted = this.decrypt(encrypted);
    return JSON.parse(decrypted);
  }
}

// Initialize encryption key at module load
EncryptionService.initializeKey();
