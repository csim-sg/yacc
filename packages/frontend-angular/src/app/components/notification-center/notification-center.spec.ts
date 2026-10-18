import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { NotificationsStore, type Notification } from '../../services/notifications.store';
import { NotificationCenter } from './notification-center';

/**
 * NotificationCenter spec (W17): the P0 assignment-only filter, unread
 * badge, mark-read / dismiss / mark-all / clear-all controls, the
 * click-through navigation, and the outside-click close. The component
 * reads the single canonical `NotificationsStore` (B6 fix) — the store is
 * seeded directly, exactly like the socket handler writes it.
 */
describe('NotificationCenter', () => {
  let fixture: ComponentFixture<NotificationCenter>;
  let store: NotificationsStore;
  let router: Router;
  let http: HttpTestingController;

  function assignment(overrides: Partial<Notification> = {}): Notification {
    return {
      id: 'n1',
      userId: 'u1',
      type: 'assignment',
      conversationId: 'conv-1',
      message: 'Conversation assigned to you',
      isRead: false,
      createdAt: '2026-10-19T10:00:00Z',
      ...overrides,
    };
  }

  function bell(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('button')!;
  }

  function panel(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('[role="region"]');
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [NotificationCenter],
      providers: [
        provideHttpClient(withInterceptors([])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    store = TestBed.inject(NotificationsStore);
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(NotificationCenter);
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
    localStorage.clear();
  });

  it('renders the bell with the unread count from the canonical store (assignment-only)', () => {
    store.addNotification(assignment());
    store.addNotification(assignment({ id: 'n2', isRead: true, conversationId: 'conv-2' }));
    store.addNotification(assignment({ id: 'n3', type: 'mention', message: 'Mention' }));
    fixture.detectChanges();

    // The mention notification is excluded by the P0 assignment filter.
    expect(bell().getAttribute('aria-label')).toBe('Notifications (1 unread)');
    const badge = (fixture.nativeElement as HTMLElement).querySelector('.bg-error');
    expect(badge?.textContent?.trim()).toBe('1');
  });

  it('omits the badge and the unread suffix when nothing is unread', () => {
    store.addNotification(assignment({ isRead: true }));
    fixture.detectChanges();

    expect(bell().getAttribute('aria-label')).toBe('Notifications ');
    expect((fixture.nativeElement as HTMLElement).querySelector('.bg-error')).toBeNull();
  });

  it('opens the panel listing only assignment notifications', () => {
    store.addNotification(assignment());
    store.addNotification(assignment({ id: 'n3', type: 'mention', message: 'You were mentioned' }));
    fixture.detectChanges();

    bell().click();
    fixture.detectChanges();

    const region = panel();
    expect(region).toBeTruthy();
    expect(region?.textContent).toContain('Notifications');
    expect(region?.textContent).toContain('Conversation assigned to you');
    expect(region?.textContent).not.toContain('You were mentioned');
  });

  it('marks a notification as read from the item action', () => {
    store.addNotification(assignment());
    fixture.detectChanges();

    bell().click();
    fixture.detectChanges();
    const markButton = (panel() as HTMLElement).querySelector('button[aria-label="Mark notification as read"]') as HTMLButtonElement;
    markButton.click();
    fixture.detectChanges();

    expect(store.notifications()[0]?.isRead).toBe(true);
  });

  it('dismisses a notification from the item action', () => {
    store.addNotification(assignment());
    fixture.detectChanges();

    bell().click();
    fixture.detectChanges();
    const dismissButton = (panel() as HTMLElement).querySelector('button[aria-label="Dismiss notification"]') as HTMLButtonElement;
    dismissButton.click();
    fixture.detectChanges();

    expect(store.notifications()).toHaveLength(0);
  });

  it('marks all as read', () => {
    store.addNotification(assignment());
    store.addNotification(assignment({ id: 'n2', conversationId: 'conv-2' }));
    fixture.detectChanges();

    bell().click();
    fixture.detectChanges();
    const markAllButton = Array.from((panel() as HTMLElement).querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === 'Mark all as read',
    );
    expect(markAllButton).toBeTruthy();
    markAllButton!.click();
    fixture.detectChanges();

    expect(store.unreadCount()).toBe(0);
  });

  it('clears all notifications and closes the panel', () => {
    store.addNotification(assignment());
    fixture.detectChanges();

    bell().click();
    fixture.detectChanges();
    const clearButton = Array.from((panel() as HTMLElement).querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === 'Clear all',
    );
    clearButton!.click();
    fixture.detectChanges();

    expect(store.notifications()).toHaveLength(0);
    expect(panel()).toBeNull();
  });

  it('clicks through to the conversation and marks the row read', () => {
    store.addNotification(assignment());
    fixture.detectChanges();

    bell().click();
    fixture.detectChanges();
    (panel() as HTMLElement).querySelector('.cursor-pointer')!.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(store.notifications()[0]?.isRead).toBe(true);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/conversations/conv-1');
    expect(panel()).toBeNull();
  });

  it('keeps the panel open when the notification has no conversation', () => {
    store.addNotification(assignment({ conversationId: '' }));
    fixture.detectChanges();

    bell().click();
    fixture.detectChanges();
    (panel() as HTMLElement).querySelector('.cursor-pointer')!.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(panel()).toBeTruthy();
  });

  it('closes on a mousedown outside the component', () => {
    store.addNotification(assignment());
    fixture.detectChanges();

    bell().click();
    fixture.detectChanges();
    expect(panel()).toBeTruthy();

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();

    expect(panel()).toBeNull();
  });

  it('stays open on a mousedown inside the component', () => {
    store.addNotification(assignment());
    fixture.detectChanges();

    bell().click();
    fixture.detectChanges();
    bell().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();

    expect(panel()).toBeTruthy();
  });

  it('shows the empty fallback when the store has no assignment notifications', () => {
    fixture.detectChanges();

    bell().click();
    fixture.detectChanges();

    expect(panel()?.textContent).toContain('No notifications yet');
  });
});
