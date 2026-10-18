import { ComponentFixture, TestBed } from '@angular/core/testing';
import { flushTasks } from '../../../testing/flush-tasks';
import type { ConversationDetail } from '../../contracts/http/conversations.schema';
import { ConversationsStore } from '../../services/conversations.store';
import { AssignmentSection } from './assignment-section';

/**
 * AssignmentSection spec (W10): shows the raw assignee (or Unassigned),
 * toggles the dropdown with the Phase-2 MVP empty users state, and assigns
 * through `ConversationsStore.assign` (the manager+ POST route; store-owned
 * invalidation). Failures render the inline error alert (React parity).
 */
describe('AssignmentSection', () => {
  function conversationWith(assignedUserId: string | null): ConversationDetail {
    return {
      id: '11111111-1111-1111-1111-111111111111',
      channel: 'irc',
      externalThreadId: '#support',
      title: 'IRC thread',
      status: 'open',
      priority: 'high',
      assignedUserId,
      createdAt: '2026-10-18T00:00:00',
      updatedAt: '2026-10-18T00:00:00',
      tags: [],
    };
  }

  interface ConversationsStoreDouble {
    assign: ReturnType<typeof vi.fn<(conversationId: string, assignedUserId: string) => Promise<void>>>;
  }

  let fixture: ComponentFixture<AssignmentSection>;
  let store: ConversationsStoreDouble;
  let changes: number[];

  function find(testid: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testid}"]`);
  }

  function button(testid: string): HTMLButtonElement {
    const element = find(testid);
    if (element === null) {
      throw new Error(`Missing [data-testid="${testid}"]`);
    }
    return element as HTMLButtonElement;
  }

  function textContent(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  /** The Phase-2 MVP dropdown has no user rows; the spec drives assign() directly. */
  function assignVia(userId: string): Promise<void> {
    const component = fixture.componentInstance as unknown as {
      assign: (userId: string) => Promise<void>;
    };
    return component.assign(userId);
  }

  beforeEach(() => {
    store = {
      assign: vi.fn(async () => {}),
    };
    TestBed.configureTestingModule({
      imports: [AssignmentSection],
      providers: [{ provide: ConversationsStore, useValue: store }],
    });
    fixture = TestBed.createComponent(AssignmentSection);
    fixture.componentRef.setInput('conversation', conversationWith(null));
    changes = [];
    fixture.componentInstance.change.subscribe(() => changes.push(changes.length));
    fixture.detectChanges();
  });

  it('shows Unassigned when no user is assigned', () => {
    expect(find('assignment-section')).toBeTruthy();
    expect(button('assignment-button').textContent).toContain('Unassigned');
  });

  it('shows the raw assignee id when assigned (MVP parity)', () => {
    fixture.componentRef.setInput('conversation', conversationWith('44444444-4444-4444-4444-444444444444'));
    fixture.detectChanges();
    expect(button('assignment-button').textContent).toContain('User #44444444-4444-4444-4444-444444444444');
  });

  it('toggles the dropdown with the deferred-users empty state', () => {
    button('assignment-button').click();
    fixture.detectChanges();
    expect(find('assignment-dropdown')).toBeTruthy();
    expect(find('no-users-message')?.textContent).toContain('User list coming in Phase 3');

    button('assignment-button').click();
    fixture.detectChanges();
    expect(find('assignment-dropdown')).toBeNull();
  });

  it('assigns through the store, closes the dropdown and emits change', async () => {
    button('assignment-button').click();
    fixture.detectChanges();

    let resolveAssign: (() => void) | undefined;
    store.assign.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveAssign = resolve;
        }),
    );

    const pending = assignVia('44444444-4444-4444-4444-444444444444');
    fixture.detectChanges();
    expect(store.assign).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      '44444444-4444-4444-4444-444444444444',
    );
    expect(textContent()).toContain('Updating...');
    expect(button('assignment-button').disabled).toBe(true);

    resolveAssign?.();
    await pending;
    fixture.detectChanges();

    expect(find('assignment-dropdown')).toBeNull(); // closed on success
    expect(changes).toEqual([0]);
    expect(textContent()).not.toContain('Updating...');
  });

  it('renders the error alert when the assignment fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    store.assign.mockRejectedValue(new Error('403 forbidden'));

    await assignVia('44444444-4444-4444-4444-444444444444');
    fixture.detectChanges();

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to assign conversation:',
      expect.any(Error),
    );
    expect(textContent()).toContain('Failed to update assignment');
    expect(find('assignment-dropdown')).toBeNull(); // stayed closed (was never opened)
    expect(changes).toEqual([]);
    consoleError.mockRestore();
  });
});
