/**
 * IRC Profile types and DTOs
 *
 * Handles creation, updates, and responses for IRC connection profiles
 * Secrets are never included in responses (use encryptionService)
 */

/**
 * IRC-specific config (non-sensitive fields only)
 * Password is stored separately in encryptedCredentials field
 */
export interface IrcProfileConfig {
  server: string; // e.g., 'irc.libera.chat'
  port: number; // 1-65535, typically 6667 (plain) or 6697 (SSL)
  username: string; // IRC nickname/username
  channels: string[]; // e.g., ['#general', '#dev']
}

/**
 * Complete secrets (for encrypt/decrypt operations only)
 * Never returned in API responses
 */
export interface IrcProfileSecrets {
  password: string; // IRC server password (may be empty for no password)
}

/**
 * Request DTO: Create or update IRC profile
 * Client sends non-encrypted data; backend encrypts credentials before storing
 */
export interface CreateIrcProfileRequest {
  name: string; // User-friendly name
  config: IrcProfileConfig; // Server, port, username, channels
  password?: string; // Optional password; empty string = no password
}

/**
 * Request DTO: Update existing profile (partial update allowed)
 */
export interface UpdateIrcProfileRequest {
  name?: string;
  config?: Partial<IrcProfileConfig>;
  password?: string; // To change password; pass empty string to clear
  isEnabled?: boolean; // Can disable/re-enable profile
}

/**
 * Response DTO: IRC profile (never includes secrets)
 * Used for list, get, create, update endpoints
 */
export interface IrcProfileResponse {
  id: number;
  name: string;
  isEnabled: boolean;
  isActive: boolean;
  config: IrcProfileConfig; // Non-secret fields
  hasPassword: boolean; // Indicates if password is set (without exposing it)
  lastTestedAt?: string; // ISO timestamp
  lastTestPassed?: boolean;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  createdBy?: {
    id: string;
    email: string;
  };
  updatedBy?: {
    id: string;
    email: string;
  };
}

/**
 * Response DTO: Test connection result
 * Shows pass/fail + reason (no side effects, no state persistence)
 */
export interface TestConnectionResult {
  passed: boolean;
  reason?: string; // Error message if test failed
  duration?: number; // Test duration in ms (optional, for UI feedback)
}

/**
 * Internal DTO: Profile with decrypted secrets (service layer only)
 * Never exposed in HTTP responses
 */
export interface IrcProfileWithSecrets {
  id: number;
  tenantId: string;
  integrationType: 'irc';
  name: string;
  isEnabled: boolean;
  isActive: boolean;
  config: IrcProfileConfig;
  password: string; // Decrypted password
  createdByUserId: string;
  updatedByUserId?: string;
  lastTestedAt?: Date;
  lastTestPassed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Error codes for IRC profile operations
 * Aligned with error taxonomy in INT-010 specification
 */
export enum IrcProfileErrorCode {
  // Cap exceeded (409)
  PROFILE_LIMIT_EXCEEDED = 'irc_profile_limit_exceeded',

  // No active profile (409)
  NO_ACTIVE_PROFILE = 'irc_profile_not_selected',

  // Cannot delete active profile (409)
  CANNOT_DELETE_ACTIVE = 'IRC_PROFILE_DELETE_ACTIVE_FORBIDDEN',

  // Cannot activate disabled profile (409)
  CANNOT_ACTIVATE_DISABLED = 'IRC_PROFILE_ACTIVATE_DISABLED_FORBIDDEN',

  // No profiles configured at all (409)
  NOT_CONFIGURED = 'irc_not_configured',

  // Encryption key missing (400)
  ENCRYPTION_KEY_MISSING = 'encryption_key_missing',

  // Forbidden (403)
  FORBIDDEN = 'forbidden',
}
