import { ComponentFixture, TestBed } from '@angular/core/testing';

import { flushTasks } from '../../../testing/flush-tasks';
import { ReplyComposer } from './reply-composer';

/**
 * ReplyComposer spec (W7 composer mechanics; PARITY.md unit run set row
 * "Components (interactive logic only)"): trim/limit/disable gating, the
 * awaited `onSend` contract (clear on success, keep + parent-error on
 * failure), the textarea-scoped Ctrl/Cmd+Enter shortcut, Tab
 * indentation, and the dismissable error alert. Full reply/retry
 * behavior stays E2E's job (page + Tier-0 rows).
 */
describe('ReplyComposer', () => {
  let fixture: ComponentFixture<ReplyComposer>;

  function render(inputs: Partial<Record<string, unknown>> = {}): {
    el: HTMLElement;
    component: ReplyComposer;
  } {
    TestBed.configureTestingModule({ imports: [ReplyComposer] });
    fixture = TestBed.createComponent(ReplyComposer);
    fixture.componentRef.setInput('onSend', (inputs['onSend'] ?? (async () => undefined)) as (body: string) => Promise<void>);
    for (const [key, value] of Object.entries(inputs)) {
      if (key === 'onSend') continue;
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return { el: fixture.nativeElement as HTMLElement, component: fixture.componentInstance };
  }

  function textarea(): HTMLTextAreaElement {
    return fixture.nativeElement.querySelector('[data-testid="reply-composer-textarea"]')!;
  }

  function sendButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('[data-testid="reply-composer-send-button"]')!;
  }

  function type(body: string): void {
    textarea().value = body;
    textarea().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('renders the textarea, counter, and send button; send disabled while empty', () => {
    const { el } = render();
    expect(textarea()).toBeDefined();
    expect(el.querySelector('[data-testid="character-counter"]')?.textContent).toContain('0 / 5,000');
    expect(el.textContent).toContain('Ctrl+Enter');
    expect(sendButton().disabled).toBe(true);
  });

  it('trims the body and clears the input when onSend resolves', async () => {
    const sent: string[] = [];
    render({
      onSend: async (body: string) => {
        sent.push(body);
      },
    });
    type('  hello reply  ');
    sendButton().click();
    fixture.detectChanges();
    await flushTasks();
    fixture.detectChanges();

    expect(sent).toEqual(['hello reply']);
    expect(textarea().value).toBe('');
    expect(sendButton().disabled).toBe(true);
  });

  it('keeps the input on failure and surfaces the parent error with a dismiss button', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fail = async (): Promise<void> => {
      throw new Error('send rejected');
    };
    render({ onSend: fail, error: 'send rejected' });
    type('a draft');
    sendButton().click();
    fixture.detectChanges();
    await flushTasks();
    fixture.detectChanges();

    expect(textarea().value).toBe('a draft');
    const alert = fixture.nativeElement.querySelector('[data-testid="error-message"]');
    expect(alert?.textContent).toContain('Failed to send message');
    expect(alert?.textContent).toContain('send rejected');
    expect(consoleError).toHaveBeenCalled();

    const dismiss = fixture.nativeElement.querySelector(
      '[data-testid="error-dismiss-button"]',
    ) as HTMLButtonElement;
    let dismissed = false;
    fixture.componentInstance.errorDismiss.subscribe(() => {
      dismissed = true;
    });
    dismiss.click();
    expect(dismissed).toBe(true);
    consoleError.mockRestore();
  });

  it('hides the error alert when showError is false', () => {
    render({ error: 'boom', showError: false });
    expect(fixture.nativeElement.querySelector('[data-testid="error-message"]')).toBeNull();
  });

  it('sends on textarea-scoped Ctrl+Enter (and Cmd+Enter), not on plain Enter', async () => {
    const sent: string[] = [];
    render({
      onSend: async (body: string) => {
        sent.push(body);
      },
    });
    type('shortcut body');

    textarea().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
    );
    await flushTasks();
    expect(sent).toEqual(['shortcut body']);

    type('mac body');
    textarea().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }),
    );
    await flushTasks();
    expect(sent).toEqual(['shortcut body', 'mac body']);

    type('not sent');
    textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flushTasks();
    expect(sent).toHaveLength(2);
  });

  it('inserts a tab at the cursor on Tab keydown without sending', async () => {
    const sent: string[] = [];
    render({
      onSend: async (body: string) => {
        sent.push(body);
      },
    });
    type('ab');
    textarea().setSelectionRange(1, 1);
    textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    fixture.detectChanges();
    await flushTasks();

    expect(textarea().value).toBe('a\tb');
    expect(sent).toEqual([]);
  });

  it('clamps the input to maxLength and flags the limit', () => {
    render({ maxLength: 5 });
    type('abcdefgh');
    expect(textarea().value).toBe('abcde');
    const counter = fixture.nativeElement.querySelector('[data-testid="character-counter"]');
    expect(counter?.textContent).toContain('5 / 5');
    expect(counter?.textContent).toContain('(limit reached)');
    expect(counter?.id).toBe('char-limit-warning');
  });

  it('disables the composer while the parent send is in flight and shows the spinner state', () => {
    render({ isSending: true });
    expect(textarea().disabled).toBe(true);
    expect(sendButton().disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Sending...');
  });

  it('ignores whitespace-only drafts (React empty guard parity)', async () => {
    const sent: string[] = [];
    render({
      onSend: async (body: string) => {
        sent.push(body);
      },
    });
    type('   ');
    sendButton().click();
    await flushTasks();
    expect(sent).toEqual([]);
  });
});
