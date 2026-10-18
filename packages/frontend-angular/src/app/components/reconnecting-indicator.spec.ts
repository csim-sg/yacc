import { TestBed, ComponentFixture } from '@angular/core/testing';

import { WS_SOCKET_FACTORY, WebSocketClientService } from '../services/websocket-client.service';
import {
  FakeRealtimeSocket,
  latestFakeSocket,
  resetFakeSockets,
} from '../../test/ws-test-socket';
import { ReconnectingIndicator } from './reconnecting-indicator';

/**
 * ReconnectingIndicator spec (W19): the banner appears only while the
 * app-owned ladder is running or exhausted, shows the canonical attempt
 * counter and countdown, and the manual Retry drives `retryNow()`. The
 * countdown ticker leaves no interval behind.
 */

const socketFactory = vi.fn((url: string) => new FakeRealtimeSocket(url));

describe('ReconnectingIndicator', () => {
  let client: WebSocketClientService;
  let fixture: ComponentFixture<ReconnectingIndicator>;

  beforeEach(() => {
    resetFakeSockets(socketFactory);
    TestBed.configureTestingModule({
      imports: [ReconnectingIndicator],
      providers: [{ provide: WS_SOCKET_FACTORY, useValue: socketFactory }],
    });
    client = TestBed.inject(WebSocketClientService);
    fixture = TestBed.createComponent(ReconnectingIndicator);
  });

  afterEach(() => {
    fixture.destroy();
    client.disconnect();
    vi.useRealTimers();
  });

  function banner(): HTMLElement | null {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('.alert');
  }

  it('renders nothing while connected', () => {
    client.connect('token-1');
    latestFakeSocket().open();

    expect(banner()).toBeNull();
  });

  it('renders nothing while disconnected with attempts left (initial state)', () => {
    expect(banner()).toBeNull();
  });

  it('shows the reconnecting banner with attempt counter and countdown', async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    client.connect('token-1');
    latestFakeSocket().open();
    latestFakeSocket().close(); // ladder rung 1 scheduled (+1s)

    const element = banner();
    expect(element?.getAttribute('class')).toContain('alert-warning');
    expect(element?.textContent).toContain('Reconnecting...');
    expect(element?.textContent).toContain('Attempt 1 of 10');
    expect(element?.textContent).toContain('Next retry in 1s');
    expect(element?.getAttribute('aria-label')).toContain('Reconnecting. Attempt 1 of 10.');
  });

  it('clears the countdown once the rung elapses and the attempt runs', async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    client.connect('token-1');
    latestFakeSocket().open();
    latestFakeSocket().close();
    fixture.detectChanges();

    expect(banner()?.textContent).toContain('Next retry in 1s');

    await vi.advanceTimersByTimeAsync(1000); // rung elapsed → attempt executes
    expect(banner()?.textContent).not.toContain('Next retry in');
    expect(client.reconnectAttempt()).toBe(1);
  });

  it('shows the connection-lost banner with manual retry after exhaustion', async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    client.connect('token-1');
    latestFakeSocket().open();
    // Spend the ladder: 10 attempts (1+2+4+8+30×6 seconds).
    latestFakeSocket().close();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await vi.advanceTimersByTimeAsync(30_000);
      latestFakeSocket().close();
    }

    const element = banner();
    expect(element?.getAttribute('class')).toContain('alert-error');
    expect(element?.textContent).toContain('Connection Lost');
    expect(element?.textContent).toContain('Unable to reconnect after 10 attempts');

    element?.querySelector<HTMLButtonElement>('button')?.click();
    expect(client.connectionState()).toBe('connecting');
    expect(client.isExhausted()).toBe(false);
  });

  it('cleans the countdown ticker interval up on destroy', async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    client.connect('token-1');
    latestFakeSocket().open();
    latestFakeSocket().close(); // reconnecting → ticker starts
    fixture.detectChanges();
    const withTicker = vi.getTimerCount();
    expect(withTicker).toBeGreaterThan(1); // reconnect timer + countdown ticker

    fixture.destroy();
    expect(vi.getTimerCount()).toBe(withTicker - 1); // only the client timer remains
  });
});
