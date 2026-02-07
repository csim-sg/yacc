import { z } from 'zod';

/**
 * Message Retry Job Types and Payloads
 *
 * Defines types for BullMQ message retry queue with exponential backoff strategy
 * Retry Schedule: 1 minute → 5 minutes → 30 minutes (3 attempts max)
 */

// ============================================
// Job Payload Schema & Types
// ============================================

/**
 * Message job payload for retry queue
 */
export const SendMessageJobPayloadSchema = z.object({
  messageId: z.string().uuid('Invalid message ID'),
  conversationId: z.string().uuid('Invalid conversation ID'),
  recipientId: z.string().uuid('Invalid recipient ID'),
  body: z.string().min(1, 'Message body required'),
  direction: z.enum(['inbound', 'outbound']),
  platformType: z.enum(['telegram', 'irc', 'internal']),
  retryCount: z.number().int().min(0).max(3, 'Retry count cannot exceed 3'),
  lastError: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type SendMessageJobPayload = z.infer<typeof SendMessageJobPayloadSchema>;

/**
 * Job completion result
 */
export interface JobCompletionResult {
  jobId: string;
  messageId: string;
  status: 'sent' | 'failed' | 'dlq';
  timestamp: string;
  error?: string;
}

/**
 * Job retry metadata
 */
export interface JobRetryMetadata {
  jobId: string;
  messageId: string;
  attemptNumber: number;
  maxAttempts: number;
  nextRetryTime: string;
  error: string;
}

/**
 * Dead-letter queue entry
 */
export const DLQEntrySchema = z.object({
  messageId: z.string().uuid('Invalid message ID'),
  conversationId: z.string().uuid('Invalid conversation ID'),
  payload: SendMessageJobPayloadSchema,
  failedAt: z.string().datetime('Invalid timestamp'),
  failureReason: z.enum(
    ['max_retries_exceeded', 'validation_error', 'platform_error', 'network_error', 'unknown']
  ),
  totalAttempts: z.number().int().min(1),
  lastError: z.string(),
});

export type DLQEntry = z.infer<typeof DLQEntrySchema>;

/**
 * Queue statistics
 */
export interface QueueStatistics {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
  dlq: number;
  totalJobs: number;
}

/**
 * Job progress event
 */
export interface JobProgressEvent {
  jobId: string;
  messageId: string;
  conversationId: string;
  progress: number; // 0-100
  status: 'processing' | 'completed' | 'failed' | 'retrying';
  timestamp: string;
}

// ============================================
// Configuration Constants
// ============================================

/**
 * Retry backoff configuration
 * Exponential backoff: 1m → 5m → 30m
 */
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  // Backoff delays in milliseconds for each retry
  BACKOFF_DELAYS: [60000, 300000, 1800000], // 1m, 5m, 30m
  TIMEOUT_MS: 30000, // 30 seconds per job
  CONCURRENCY: 5, // Process 5 jobs concurrently
} as const;

/**
 * Queue names
 */
export const QUEUE_NAMES = {
  MESSAGE_QUEUE: 'message-retry-queue',
  DLQ: 'message-dlq',
} as const;

/**
 * Job statuses
 */
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  DLQ = 'dlq',
}

/**
 * Failure reasons
 */
export enum FailureReason {
  MAX_RETRIES_EXCEEDED = 'max_retries_exceeded',
  VALIDATION_ERROR = 'validation_error',
  PLATFORM_ERROR = 'platform_error',
  NETWORK_ERROR = 'network_error',
  UNKNOWN = 'unknown',
}
