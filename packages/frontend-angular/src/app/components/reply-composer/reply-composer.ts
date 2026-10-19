import { Component, computed, input, output, signal } from '@angular/core';

/**
 * Reply Composer (the React `ReplyComposer.tsx` port — W7 reply surface).
 *
 * Textarea + send button with a character limit (5000), a textarea-scoped
 * Ctrl/Cmd+Enter shortcut, Tab indentation, and the parent-driven
 * error alert. The send contract mirrors the React prop exactly:
 * `onSend` is the awaited async callback — the input clears on success
 * and is kept on failure (the error surfaces through the `error` input
 * the parent owns; the composer only logs). `isLocalSending` closes the
 * gap between the send click and the parent's `isSending` flip so the
 * composer cannot double-submit.
 *
 * Status UX note (U3): the composer has no delivery-status UI of its
 * own — status rides the HTTP append path rendered by the page.
 */
@Component({
  selector: 'app-reply-composer',
  templateUrl: './reply-composer.html',
})
export class ReplyComposer {
  /** Called when the user submits the reply (React `onSend` prop). */
  readonly onSend = input.required<(body: string) => Promise<void>>();

  /** Whether the parent-side send operation is in progress. */
  readonly isSending = input(false);

  /** Error message if the send failed (parent-owned state). */
  readonly error = input<string | undefined>(undefined);

  /** Whether to show the error alert (React `showError`). */
  readonly showError = input(true);

  /** Max character limit (React default 5000). */
  readonly maxLength = input(5000);

  /** Placeholder text. */
  readonly placeholder = input('Type your reply here...');

  /** Dismiss the parent-owned error alert (React `onErrorDismiss`). */
  readonly errorDismiss = output<void>();

  /** Draft body. */
  protected readonly body = signal('');

  /** Local send guard until the awaited `onSend` settles. */
  protected readonly isLocalSending = signal(false);

  protected readonly charCount = computed(() => this.body().length);
  protected readonly isAtLimit = computed(() => this.charCount() >= this.maxLength());
  protected readonly isEmpty = computed(() => !this.body().trim());
  protected readonly isDisabled = computed(
    () => this.isEmpty() || this.isSending() || this.isLocalSending(),
  );

  protected async handleSend(): Promise<void> {
    if (this.isEmpty() || this.isDisabled()) {
      return;
    }
    const messageBody = this.body().trim();
    if (!messageBody) {
      return;
    }
    try {
      this.isLocalSending.set(true);
      await this.onSend()(messageBody);
      this.body.set(''); // Clear input on success
    } catch (err: unknown) {
      // Error is handled by the parent component via the `error` input.
      console.error('[ReplyComposer] Failed to send message:', err);
    } finally {
      this.isLocalSending.set(false);
    }
  }

  /** Textarea-scoped keyboard shortcuts (React `handleTextareaKeyDown`). */
  protected handleTextareaKeyDown(event: KeyboardEvent): void {
    // Ctrl+Enter or Cmd+Enter to send (scoped to the textarea only).
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      void this.handleSend();
    }

    // Handle Tab key for indentation.
    if (event.key === 'Tab') {
      event.preventDefault();
      const textarea = event.target instanceof HTMLTextAreaElement ? event.target : null;
      if (!textarea) {
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const current = this.body();
      const newValue = current.substring(0, start) + '\t' + current.substring(end);
      this.body.set(newValue);
      // Move the cursor after the inserted tab.
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      }, 0);
    }
  }

  protected onInput(event: Event): void {
    if (event.target instanceof HTMLTextAreaElement) {
      this.body.set(event.target.value.slice(0, this.maxLength()));
    }
  }

  protected onErrorDismiss(): void {
    this.errorDismiss.emit();
  }
}
