import { Component, computed, inject, input, output, signal } from '@angular/core';

import type { ConversationDetail } from '../../contracts/http/conversations.schema';
import { ConversationsStore } from '../../services/conversations.store';

/**
 * Assignment Section (the React `RightPanel/AssignmentSection` port — W10):
 * shows the current assignee and opens the assignment dropdown.
 *
 * Phase-2 MVP limitations ported 1:1 (React parity, not new behavior):
 * - The backend requires `assignedUserId` (non-nullable) — there is no
 *   unassign; users reassign to a different user instead.
 * - The users list is empty (the users API consumer was deferred), so the
 *   dropdown renders the "User list coming in Phase 3" empty state and the
 *   assignee renders as the raw `User #<id>`.
 * - The assignment `notification.received` push is declared but never
 *   emitted server-side (F7/U1) — parity of absence, not claimed covered.
 *
 * Assignment runs through `ConversationsStore.assign` (the manager+
 * `POST /api/conversations/:id/assign` route), which invalidates the
 * conversation detail + lists (B4) — single store write path.
 */
@Component({
  selector: 'app-assignment-section',
  templateUrl: './assignment-section.html',
})
export class AssignmentSection {
  private readonly conversationsStore = inject(ConversationsStore);

  readonly conversation = input.required<ConversationDetail>();
  /** Conversation detail changed upstream (React `onChange` parity). */
  readonly change = output<void>();

  /**
   * React Phase-1/2 MVP parity: empty users list — assignment dropdown
   * shows only the deferred-users empty state.
   */
  protected readonly users: ReadonlyArray<{ id: string; name: string; email: string }> = [];

  protected readonly isOpen = signal(false);
  protected readonly assigning = signal(false);
  protected readonly assignFailed = signal(false);

  protected readonly currentAssigneeDisplay = computed(() => {
    const assignedUserId = this.conversation().assignedUserId;
    return assignedUserId ? `User #${assignedUserId}` : 'Unassigned';
  });

  protected toggle(): void {
    this.isOpen.set(!this.isOpen());
  }

  protected async assign(userId: string): Promise<void> {
    this.assigning.set(true);
    this.assignFailed.set(false);
    try {
      await this.conversationsStore.assign(this.conversation().id, userId);
      this.isOpen.set(false);
      this.change.emit();
    } catch (error) {
      console.error('Failed to assign conversation:', error);
      this.assignFailed.set(true);
    } finally {
      this.assigning.set(false);
    }
  }
}
