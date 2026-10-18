import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';

import { WebSocketClientService } from '../services/websocket-client.service';

/**
 * Reconnecting Indicator (the React `ReconnectingIndicator` port on the
 * canonical reconnect owner — W19).
 *
 * - `reconnecting` → non-blocking daisyUI warning alert with the
 *   attempt counter ("Attempt N of 10"), a countdown to the scheduled
 *   retry, and a progress bar — aria labels ported 1:1.
 * - Ladder exhausted → error alert ("Connection Lost") with the manual
 *   Retry button (`retryNow()`: reset the app-owned budget, reconnect
 *   immediately).
 * - Connected/connecting/disconnected otherwise → renders nothing.
 *
 * The React `useReconnectionLogic` schedule (1s..60s × 5 with jitter)
 * is deliberately NOT ported — the countdown here reads the canonical
 * app-owned ladder state (`WebSocketClientService.nextRetryAt`).
 */
@Component({
  selector: 'app-reconnecting-indicator',
  templateUrl: './reconnecting-indicator.html',
})
export class ReconnectingIndicator implements OnDestroy {
  private readonly client = inject(WebSocketClientService);

  /** Seconds tick for the countdown (1s interval, cleaned up on destroy). */
  private readonly nowSignal = signal(Date.now());
  private ticker: ReturnType<typeof setInterval> | null = null;

  protected readonly isReconnecting = computed(
    () => this.client.connectionState() === 'reconnecting',
  );
  protected readonly attemptNumber = this.client.reconnectAttempt;
  protected readonly maxAttempts = this.client.maxReconnectAttempts;
  protected readonly isExhausted = this.client.isExhausted;

  /** Whole seconds until the scheduled retry (always ≥1 while pending). */
  protected readonly countdownSeconds = computed(() => {
    const target = this.client.nextRetryAt();
    if (target === null) {
      return null;
    }
    return Math.max(1, Math.ceil((target - this.nowSignal()) / 1000));
  });

  constructor() {
    // Tick only while a retry is scheduled; never leaves a timer behind.
    effect(() => {
      if (this.client.nextRetryAt() !== null) {
        this.startTicker();
      } else {
        this.stopTicker();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopTicker();
  }

  protected retry(): void {
    this.client.retryNow();
  }

  private startTicker(): void {
    if (this.ticker !== null) {
      return;
    }
    this.ticker = setInterval(() => this.nowSignal.set(Date.now()), 1000);
  }

  private stopTicker(): void {
    if (this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }
}
