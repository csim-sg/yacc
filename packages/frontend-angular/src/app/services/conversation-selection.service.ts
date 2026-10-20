import { Injectable, signal } from '@angular/core';

/**
 * Conversation selection signal store (T2 §3.2
 * `selectedConversations.store` row — session-only bulk-action intent;
 * no UI built today, W13 gap routed to T3 — porting the mechanism is the
 * parity behavior: same absence, not a silent drop). Semantics mirror the
 * React store exactly, including its `deselectAll` clearing the ids.
 */
@Injectable({ providedIn: 'root' })
export class ConversationSelectionService {
  private readonly selectedSignal = signal<ReadonlySet<string>>(new Set());
  /** Selected conversation ids (bulk-action intent). */
  readonly selectedIds = this.selectedSignal.asReadonly();

  private readonly selectAllSignal = signal(false);
  /** Whether the current selection came from a select-all action. */
  readonly isSelectAll = this.selectAllSignal.asReadonly();

  /** Toggle one conversation's selection. */
  toggleConversation(id: string): void {
    const next = new Set(this.selectedSignal());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedSignal.set(next);
  }

  /** Select an explicit set of conversations (select-all intent). */
  selectAll(ids: string[]): void {
    this.selectedSignal.set(new Set(ids));
    this.selectAllSignal.set(true);
  }

  /** Drop the selection and the select-all flag (React semantics). */
  deselectAll(): void {
    this.selectedSignal.set(new Set());
    this.selectAllSignal.set(false);
  }

  /** Drop the whole selection (identical to `deselectAll` in React). */
  clearSelection(): void {
    this.selectedSignal.set(new Set());
    this.selectAllSignal.set(false);
  }

  /** Whether one conversation is currently selected. */
  isSelected(id: string): boolean {
    return this.selectedSignal().has(id);
  }

  /** Snapshot of the selected ids as an array. */
  getSelectedIds(): string[] {
    return [...this.selectedSignal()];
  }
}
