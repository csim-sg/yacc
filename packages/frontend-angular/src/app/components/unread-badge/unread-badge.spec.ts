import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnreadBadge } from './unread-badge';

/**
 * UnreadBadge spec (W6): hidden at 0, `99+` cap, aria live-region label,
 * and class passthrough.
 */
describe('UnreadBadge', () => {
  let fixture: ComponentFixture<UnreadBadge>;

  function render(count: number, className = ''): HTMLElement {
    TestBed.configureTestingModule({ imports: [UnreadBadge] });
    fixture = TestBed.createComponent(UnreadBadge);
    fixture.componentRef.setInput('count', count);
    fixture.componentRef.setInput('className', className);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders nothing when the count is 0', () => {
    const el = render(0);
    expect(el.querySelector('span')).toBeNull();
  });

  it('renders the count with the parity classes and aria label', () => {
    const el = render(3);
    const badge = el.querySelector('span')!;
    expect(badge.textContent).toContain('3');
    const classes = badge.getAttribute('class') ?? '';
    for (const token of ['badge', 'badge-sm', 'badge-error', 'transition-all', 'duration-200']) {
      expect(classes).toContain(token);
    }
    expect(badge.getAttribute('role')).toBe('status');
    expect(badge.getAttribute('aria-live')).toBe('polite');
    expect(badge.getAttribute('aria-label')).toBe('3 unread messages');
  });

  it('uses the singular label for one unread message', () => {
    const el = render(1);
    expect(el.querySelector('span')?.getAttribute('aria-label')).toBe('1 unread message');
  });

  it('caps the displayed count at 99+', () => {
    const el = render(142);
    const badge = el.querySelector('span')!;
    expect(badge.textContent).toContain('99+');
    expect(badge.getAttribute('aria-label')).toBe('142 unread messages');
  });

  it('appends the optional class name', () => {
    const el = render(2, 'badge-lg');
    expect(el.querySelector('span')?.getAttribute('class')).toContain('badge-lg');
  });
});
