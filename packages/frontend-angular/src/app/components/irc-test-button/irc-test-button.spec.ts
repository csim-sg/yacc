import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IrcTestButton } from './irc-test-button';

/**
 * IRC Test Button spec (ANG-012 — React `IRCTestButton` port).
 *
 * Covers the four-state machine over the frozen `/api/integrations/irc/test`
 * operation on the single HttpClient seam: idle/loading button with the
 * config body request, success alert with the 5s auto-dismiss, `success:
 * false` and HTTP failure error alerts with retry, the 10s hard timeout,
 * the disabled gate, and unmount timer cleanup.
 */
describe('IrcTestButton', () => {
  let fixture: ComponentFixture<IrcTestButton>;
  let http: HttpTestingController;

  const CONFIG = {
    server: 'irc.example.com',
    port: 6697,
    username: 'yacc',
    channels: ['#ops'],
  };

  function pageElement(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function testButton(): HTMLElement | null {
    return pageElement().querySelector('[data-testid="irc-test-button"]');
  }

  /** Click the test button and flush the signal-driven re-render. */
  function clickTest(): void {
    (testButton() as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IrcTestButton],
      providers: [provideHttpClient(withInterceptors([])), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(IrcTestButton);
    fixture.componentRef.setInput('config', CONFIG);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    fixture.destroy();
    http.verify();
  });

  /**
   * Microtask drain that does NOT wait zone timer tasks — the success
   * auto-dismiss timer must neither block the test nor reset the state
   * under assertion (`whenStable` waits pending timers once scheduled).
   */
  async function settleState(): Promise<void> {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
    fixture.detectChanges();
  }

  /** Flush the ad-hoc test request and let the component state settle. */
  async function flushTest(response: Record<string, unknown>): Promise<void> {
    http.expectOne('/api/integrations/irc/test').flush(response);
    await settleState();
  }

  it('renders the idle button and POSTs the frozen config body on click', async () => {
    expect(testButton()?.getAttribute('data-state')).toBe('idle');
    expect(testButton()?.textContent).toContain('Test Connection');

    clickTest();
    expect(testButton()?.getAttribute('data-state')).toBe('loading');
    expect(testButton()?.textContent).toContain('Testing...');

    const request = http.expectOne('/api/integrations/irc/test');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(CONFIG);
    request.flush({ data: { success: true, message: 'ok' } });
    await settleState();

    expect(testButton()?.getAttribute('data-state')).toBe('success');
    expect(testButton()?.textContent).toContain('Connected to IRC server successfully');
  });

  it('auto-dismisses the success alert after 5 seconds', async () => {
    vi.useFakeTimers();
    clickTest();
    http.expectOne('/api/integrations/irc/test').flush({ data: { success: true, message: 'ok' } });
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(testButton()?.getAttribute('data-state')).toBe('success');

    await vi.advanceTimersByTimeAsync(5_000);
    fixture.detectChanges();
    expect(testButton()?.getAttribute('data-state')).toBe('idle');
  });

  it('shows the error alert for a success:false body with retry', async () => {
    clickTest();
    expect(testButton()?.getAttribute('data-state')).toBe('loading');

    await flushTest({ data: { success: false, message: 'connection refused' } });

    expect(testButton()?.getAttribute('data-state')).toBe('error');
    expect(testButton()?.textContent).toContain('connection refused');

    // Dismiss returns to idle; Retry re-fires the request.
    (pageElement().querySelector('[aria-label="Dismiss error message"]') as HTMLButtonElement)
      .click();
    fixture.detectChanges();
    expect(testButton()?.getAttribute('data-state')).toBe('idle');

    clickTest();
    const retry = http.expectOne('/api/integrations/irc/test');
    retry.flush({ data: { success: true, message: 'ok' } });
    await settleState();
    expect(testButton()?.getAttribute('data-state')).toBe('success');
    expect(pageElement().querySelector('[data-testid="irc-retry-button"]')).toBeNull();
  });

  it('maps an HTTP failure onto the surfaced error message (Retry present)', async () => {
    clickTest();
    http
      .expectOne('/api/integrations/irc/test')
      .flush({ error: 'irc_not_configured' }, { status: 409, statusText: 'Conflict' });
    await settleState();

    expect(testButton()?.getAttribute('data-state')).toBe('error');
    expect(testButton()?.textContent).toContain('irc_not_configured');
    expect(pageElement().querySelector('[data-testid="irc-retry-button"]')).not.toBeNull();
  });

  it('surfaces the timeout message when the response does not settle within 10s', async () => {
    vi.useFakeTimers();
    clickTest();
    expect(testButton()?.getAttribute('data-state')).toBe('loading');

    await vi.advanceTimersByTimeAsync(10_000);
    fixture.detectChanges();
    expect(testButton()?.getAttribute('data-state')).toBe('error');
    expect(testButton()?.textContent).toContain('IRC test timed out after 10 seconds');

    // The abandoned request still completes; the settled timeout state wins.
    http.expectOne('/api/integrations/irc/test').flush({ data: { success: true, message: 'ok' } });
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(testButton()?.getAttribute('data-state')).toBe('error');
  });

  it('keeps the button disabled while the disabled input is set', async () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect((testButton() as HTMLButtonElement).disabled).toBe(true);

    (testButton() as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectNone('/api/integrations/irc/test');
  });

  it('clears the pending timers on destroy', async () => {
    vi.useFakeTimers();
    clickTest();
    http.expectOne('/api/integrations/irc/test').flush({ data: { success: true, message: 'ok' } });
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(vi.getTimerCount()).toBe(1); // the 5s auto-dismiss

    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
