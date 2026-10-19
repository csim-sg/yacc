import { Component, OnDestroy, inject, input, signal } from '@angular/core';

import type { IrcTestRequest, IrcTestResponse } from '../../contracts/http/irc.schema';
import { apiErrorMessage } from '../../lib/api-error-message';
import { IrcProfilesStore } from '../../services/irc-profiles.store';

/** React `TestState` union. */
type TestState = 'idle' | 'loading' | 'success' | 'error';

/** React `DEFAULT_TIMEOUT_MS` — hard timeout on the test request. */
const TEST_TIMEOUT_MS = 10_000;

/** Success auto-dismiss delay (React parity). */
const SUCCESS_AUTO_DISMISS_MS = 5_000;

/** React `IRCTestTimeoutError` default message. */
const TIMEOUT_MESSAGE = 'IRC test timed out after 10 seconds';

/**
 * IRC Test Button (React `components/admin/IRCTestButton.tsx` port).
 *
 * Tests an IRC connection configuration before saving: POSTs the frozen
 * `/api/integrations/irc/test` through `IrcProfilesStore` (the single
 * HttpClient seam — React's raw-`fetch` `ircTestHandler` is NOT
 * replicated), with a 10s hard timeout and a 5s success auto-dismiss.
 *
 * Timeout parity note: React aborted the in-flight fetch at 10s; here the
 * UI settles identically at 10s via a timer race while the underlying
 * request is left to finish unobserved (the single HttpClient seam has no
 * abort affordance for `firstValueFrom` promises).
 *
 * Keyboard accessibility is native: a `<button>` fires `click` on
 * Enter/Space, matching React's `onKeyDown` handler.
 */
@Component({
  selector: 'app-irc-test-button',
  templateUrl: './irc-test-button.html',
})
export class IrcTestButton implements OnDestroy {
  private readonly store = inject(IrcProfilesStore);

  /** React `ircConfig` prop — the frozen test body. */
  readonly config = input.required<IrcTestRequest>();

  /** React `disabled` prop (e.g. the create form's testability gate). */
  readonly disabled = input(false);

  /** React `className` passthrough (styling hooks only). */
  readonly extraClass = input('');

  protected readonly testState = signal<TestState>('idle');
  protected readonly errorMessage = signal<string | null>(null);

  private autoDismissTimer: ReturnType<typeof setTimeout> | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  /** React unmount cleanup — clear the auto-dismiss + timeout timers. */
  ngOnDestroy(): void {
    this.clearAutoDismissTimer();
    this.clearTimeoutTimer();
  }

  /**
   * React `handleTest` — clear any previous result, then POST the frozen
   * test body; success auto-dismisses after 5s, a `success: false` body or
   * a failure/timeout surfaces the error alert with retry.
   */
  protected async runTest(): Promise<void> {
    if (this.disabled() || this.testState() === 'loading') {
      return;
    }
    this.clearResult();
    this.testState.set('loading');
    try {
      const response = await this.withTimeout(this.store.testAdHocConnection(this.config()));
      if (response.data.success) {
        this.testState.set('success');
        this.autoDismissTimer = setTimeout(() => this.clearResult(), SUCCESS_AUTO_DISMISS_MS);
      } else {
        this.testState.set('error');
        this.errorMessage.set(response.data.message || 'Connection test failed');
      }
    } catch (err: unknown) {
      this.testState.set('error');
      this.errorMessage.set(apiErrorMessage(err, 'Connection test failed'));
    }
  }

  /** React `clearResult` — reset to idle and stop the auto-dismiss. */
  protected clearResult(): void {
    this.clearAutoDismissTimer();
    this.testState.set('idle');
    this.errorMessage.set(null);
  }

  /**
   * React `AbortController` parity: reject with the timeout message if the
   * response has not settled within 10s (the loser of the race is then
   * ignored — a late resolution/rejection mutates nothing).
   */
  private withTimeout(pending: Promise<IrcTestResponse>): Promise<IrcTestResponse> {
    return new Promise<IrcTestResponse>((resolve, reject) => {
      this.timeoutTimer = setTimeout(() => reject(new Error(TIMEOUT_MESSAGE)), TEST_TIMEOUT_MS);
      pending.then(
        (value) => {
          this.clearTimeoutTimer();
          resolve(value);
        },
        (reason: unknown) => {
          this.clearTimeoutTimer();
          reject(reason);
        },
      );
    });
  }

  private clearAutoDismissTimer(): void {
    if (this.autoDismissTimer !== null) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
  }

  private clearTimeoutTimer(): void {
    if (this.timeoutTimer !== null) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }
}
