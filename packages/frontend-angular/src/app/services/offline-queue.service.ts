import { Injectable, signal, inject } from '@angular/core';

import { generateTempId } from '../lib/tempId';
import { logger } from '../lib/logger';
import type { OfflineMessage } from '../types/offline-message';
import { WebSocketStateService } from './websocket-state.service';

/** Max queue size (React `MAX_QUEUE_SIZE`). */
const MAX_QUEUE_SIZE = 50;

/** localStorage key (React persist-middleware key — parity). */
const STORAGE_KEY = 'yacc:offline-queue';

/** Structural guard for persisted rows. */
function isOfflineMessage(value: unknown): value is OfflineMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'tempId' in value &&
    typeof value.tempId === 'string' &&
    'conversationId' in value &&
    typeof value.conversationId === 'string' &&
    'body' in value &&
    typeof value.body === 'string' &&
    'timestamp' in value &&
    typeof value.timestamp === 'number' &&
    'status' in value &&
    typeof value.status === 'string' &&
    ['pending', 'syncing', 'failed'].includes(value.status)
  );
}

/**
 * Offline-queue signal store (T2 §3.2 `offline-queue.store` row): a
 * persisted FIFO (max 50) of messages composed while offline, with
 * pending/syncing/failed status tracking and a sync-on-reconnect hook.
 *
 * U8 disposition (parity of absence): the MECHANISM is ported and tested;
 * there is no `OfflineIndicator`/queue UI — building one is ANG-015's
 * recorded disposition, not silent scope.
 *
 * Sync mechanism parity note: the React `syncOfflineQueue` carries a
 * TODO for a batch-sync endpoint (`POST /api/conversations/messages/batch`)
 * that does not exist on the frozen contract — it is NOT invented here.
 * The ported mechanism is exactly the live one: mark syncing, drain
 * pending/failed rows on reconnect, stamp `lastSyncTime`, or record a
 * sync error and keep the rows queued as `failed`.
 */
@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly websocketState = inject(WebSocketStateService);

  private readonly messagesSignal = signal<OfflineMessage[]>(loadPersisted());
  /** Queued messages, FIFO order (max 50). */
  readonly messages = this.messagesSignal.asReadonly();

  private readonly syncingSignal = signal(false);
  /** Whether a sync run is in progress. */
  readonly syncing = this.syncingSignal.asReadonly();

  private readonly syncErrorSignal = signal<string | null>(null);
  /** Last sync error, if any (kept until the next run starts). */
  readonly syncError = this.syncErrorSignal.asReadonly();

  private readonly lastSyncTimeSignal = signal<number | null>(null);
  /** Epoch ms of the last successful sync. */
  readonly lastSyncTime = this.lastSyncTimeSignal.asReadonly();

  constructor() {
    // Sync-on-reconnect hook (React `useOfflineDetection` port): the
    // browser's `online` event drains the queue. The ANG-006 binding
    // additionally calls `handleReconnect()` on socket reconnect.
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        logger.info('[OfflineQueue] Connection restored — syncing queue');
        void this.sync();
      });
    }
  }

  /** Enqueue a message (FIFO tail); silently dropped when the queue is full. */
  addMessage(message: Omit<OfflineMessage, 'status' | 'timestamp' | 'tempId'>): string | null {
    if (this.messagesSignal().length >= MAX_QUEUE_SIZE) {
      logger.warn('[OfflineQueue] Queue size limit reached (50 messages)');
      return null;
    }
    const tempId = generateTempId();
    const row: OfflineMessage = {
      ...message,
      tempId,
      status: 'pending',
      timestamp: Date.now(),
    };
    this.messagesSignal.set([...this.messagesSignal(), row]);
    this.persist();
    return tempId;
  }

  removeMessage(tempId: string): void {
    this.messagesSignal.set(this.messagesSignal().filter((row) => row.tempId !== tempId));
    this.persist();
  }

  clearQueue(): void {
    this.messagesSignal.set([]);
    this.syncErrorSignal.set(null);
    this.persist();
  }

  setSyncing(syncing: boolean): void {
    this.syncingSignal.set(syncing);
    if (syncing) {
      this.syncErrorSignal.set(null);
    }
  }

  setSyncError(error: string | null): void {
    this.syncErrorSignal.set(error);
    this.syncingSignal.set(false);
  }

  setLastSyncTime(time: number): void {
    this.lastSyncTimeSignal.set(time);
  }

  updateMessageStatus(tempId: string, status: OfflineMessage['status'], error?: string): void {
    this.messagesSignal.set(
      this.messagesSignal().map((row) => (row.tempId === tempId ? { ...row, status, error } : row)),
    );
    this.persist();
  }

  /**
   * Socket-reconnect entry point (called by the ANG-006 binding service;
   * mirrors the browser `online` hook). Drains pending/failed rows when
   * the socket reached a disconnected/error state, as the React hook did.
   */
  handleReconnect(): void {
    const state = this.websocketState.connectionState();
    if (state === 'disconnected' || state === 'error') {
      void this.sync();
    }
  }

  /** Drain the queue: sync every pending/failed row (FIFO order). */
  async sync(): Promise<void> {
    const queued = this.messagesSignal();
    if (!queued.length) {
      logger.debug('[OfflineQueue] No messages to sync');
      return;
    }
    logger.info('[OfflineQueue] Starting sync', { messageCount: queued.length });
    this.setSyncing(true);
    const pending = queued.filter((row) => row.status === 'pending' || row.status === 'failed');
    if (!pending.length) {
      this.setSyncing(false);
      return;
    }
    try {
      // Batch-sync endpoint is the recorded React TODO — not invented on
      // the frozen contract. The live mechanism drains the drained rows.
      for (const row of pending) {
        this.removeMessage(row.tempId);
      }
      this.setLastSyncTime(Date.now());
      this.setSyncing(false);
      logger.info('[OfflineQueue] Sync completed successfully', { syncedCount: pending.length });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[OfflineQueue] Sync failed', { error: message });
      this.setSyncError(message);
      for (const row of pending) {
        this.updateMessageStatus(row.tempId, 'failed', message);
      }
    }
  }

  /** Manual retry affordance (React `useRetryOfflineSync` parity). */
  async retrySync(): Promise<void> {
    if (!navigator.onLine) {
      logger.warn('[OfflineQueue] Device is offline, cannot sync');
      throw new Error('Device is offline');
    }
    await this.sync();
  }

  /** Whether the queue is at its cap. */
  isFull(): boolean {
    return this.messagesSignal().length >= MAX_QUEUE_SIZE;
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.messagesSignal()));
  }
}

/** Restore persisted rows, dropping anything that fails the guard. */
function loadPersisted(): OfflineMessage[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isOfflineMessage) : [];
  } catch {
    return [];
  }
}
