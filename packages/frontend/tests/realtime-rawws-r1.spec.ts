import { exec, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { promisify } from 'node:util';
import { expect, test, type APIRequestContext, type BrowserContext, type Page, type WebSocket } from '@playwright/test';

const execAsync = promisify(exec);

/**
 * Resolves the pid actually LISTENING on the service port (`ss -tlnp`) —
 * the authoritative kill target. The runner's pidfile can name a wrapper
 * (e.g. a toolchain shim) rather than the JVM itself.
 */
function listeningServicePid(): number | null {
  try {
    const output = execSync('ss -tlnp', { encoding: 'utf8' });
    const line = output
      .split('\n')
      .find((entry) => entry.includes(':8080') && entry.includes('pid='));
    if (!line) {
      return null;
    }
    const match = /pid=(\d+)/.exec(line);
    return match ? Number.parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

/**
 * R1 real-time evidence rows — ANG-006 (#376), W19/W20/W21 + the real-time
 * halves of W5/W6/W7 (SPEC-003 §Java Baseline Approval — AD-2/R1).
 *
 * OWNERSHIP AND ADDITIVITY (recorded, not silent): this file is NEW and is
 * owned by #376 — no existing suite spec is edited (the ANG-003
 * "0 spec-file edits" state is preserved; ANG-015 owns the final
 * disposition-register / CI-scope classification of harness files). The
 * excluded Node/Socket.io-era `packages/frontend/e2e/FE-013-014-015-...`
 * rows cannot run against the Java raw-WebSocket service (R1 superseded
 * that transport), so these rows implement the approved R1 evidence model
 * in their place: frozen `asyncapi.yaml` shapes + the merged Java
 * real-time server + the Angular raw-WS client, all through REAL
 * authentication and REAL transport — no mocks, no route stubs, no
 * substitutions.
 *
 * Run posture (S1 fixture seed + allowed-origin): the Java service is
 * booted by the runner with the S1 E2E posture (e2e profile +
 * `yacc.e2e.seed-enabled=true` + loopback DATABASE_URL) plus
 * `YACC_REALTIME_WS_ALLOWED_ORIGINS=<the Angular origin>`; the runner also
 * provides `API_URL`, `YACC_JAVA_PID_FILE` and `YACC_JAVA_RESTART_CMD`
 * (the W19 rows restart the real service through those handles — never a
 * fabricated disconnect). The Angular dev server is the harness webServer
 * (:4200).
 *
 * Channel coverage truth (per the merged Java server surface):
 * - Evidenced inbound to the inbound-only Angular client:
 *   `system.connection.established`, `system.heartbeat`,
 *   `system.reconnection.started`, `system.backlog.replay.*`,
 *   `message.failed` (global queue-dispatch broadcast), `presence.updated`
 *   (global presence fan-out), and the real reconnect ladder.
 * - `conversation.updated` / `conversation.reopened` / `notification.*`
 *   are unwired producers on the merged Java service (parity-of-absence
 *   dispositions U1/U2 — no server emitter exists to trigger).
 * - `message.received` / `typing.*` fan out to `conversation:{id}` rooms
 *   the client joins only via `subscribe.conversation`, which the verified
 *   inbound-only client surface never sends (the React baseline had no E2E
 *   here either — SPEC-001 T1 W20/W21 "none E2E"). R1-WS-TYPE-1 evidences
 *   the server relay half on the real wire plus the client's correct
 *   parity-of-absence; the client listener half stays unit-evidenced.
 *   The exact blocker is recorded on PR #428 for tech-lead routing.
 *
 * Serial execution: the rows share one authenticated browser context and a
 * real server-restart lifecycle (a mid-run restart would break
 * concurrently running files, so run this file targeted). The
 * failure-cascade stop is a run-mode property, not a test skip.
 */
test.describe.configure({ mode: 'serial' });

const API_BASE_URL = process.env.API_URL || 'http://localhost:8080/api';
const WS_BASE_URL =
  process.env.YACC_E2E_WS_URL || API_BASE_URL.replace(/^http/, 'ws').replace(/\/api\/?$/, '/ws');

/** Fixture identities (S1 seed; `admin123` per the S1 posture). */
const FIXTURES = {
  user: { email: 'user@yacc.local', password: 'admin123' },
  manager: { email: 'manager@yacc.local', password: 'admin123' },
  /** Telegram fixture conversation (avoided for sends: its message list
   *  accumulates queue retry-cycle rows, pushing probe rows past the
   *  list's first page). */
  conversationId: '00000000-0000-0000-0000-000000001002',
} as const;

/** One frozen `{event, data, timestamp}` wire frame. */
interface WireFrame {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/** Minimal typed view of the dev-only realtime seam (lib/realtime-devtools.ts). */
interface RealtimeDevtoolsApi {
  client(): {
    connectionState: string;
    isConnected: boolean;
    reconnectAttempt: number;
    maxReconnectAttempts: number;
    isExhausted: boolean;
    nextRetryAt: number | null;
    lastHeartbeatAt: string | null;
  };
  retryNow(): void;
  websocketState(): {
    connectionState: string;
    lastConnectTime: string | null;
    userPresence: Record<string, { status: string; lastSeen: string }>;
    typingUsers: Record<string, unknown>;
  };
  conversationsLoad(params?: Record<string, unknown>): Promise<unknown>;
  messagesLoad(conversationId: string): Promise<unknown>;
  /** The store's real send path (server-confirmed append; real HTTP). */
  messagesSend(conversationId: string, body: string): Promise<{ id: string }>;
  messagesSnapshot(conversationId: string): {
    data?: { messages?: Array<{ id: string; status: string }> };
  } | null;
}

// -- Shared serial state ------------------------------------------------------

let browserContext: BrowserContext;
let page: Page;
let accessToken: string | null = null;
let sentMessageId: string | null = null;

/** Frames received by the app's own raw-WS sockets, in arrival order. */
const appFrames: WireFrame[] = [];

interface TrackedSocket {
  ws: WebSocket;
  token: string | null;
  closed: boolean;
  isInstrument: boolean;
}

const sockets: TrackedSocket[] = [];

/**
 * True while a test-driven instrument socket (a REAL raw-WS session the
 * test opens inside the page realm to trigger server-originated events) is
 * being created. Instrument sockets of the SAME identity as the app must
 * not enter the app frame log — only the app's own client sockets do.
 */
let instrumentSocketWindow = false;

function trackSockets(target: Page): void {
  target.on('websocket', (ws) => {
    const isInstrument = instrumentSocketWindow;
    let token: string | null = null;
    try {
      token = new URL(ws.url()).searchParams.get('token');
    } catch {
      token = null;
    }
    const tracked: TrackedSocket = { ws, token, closed: false, isInstrument };
    ws.on('framereceived', (frame) => {
      if (!isInstrument && tracked.token !== null && tracked.token === accessToken) {
        try {
          appFrames.push(JSON.parse(String(frame.payload)) as WireFrame);
        } catch {
          // Non-JSON frame — the frozen transport is JSON text only.
        }
      }
    });
    ws.on('close', () => {
      tracked.closed = true;
    });
    sockets.push(tracked);
  });
}

async function withDevtools<T>(
  fn: (api: RealtimeDevtoolsApi, arg: never) => T | Promise<T>,
  arg?: unknown,
): Promise<T> {
  return page.evaluate(
    async ({ source, invokeArg }) => {
      const api = (window as unknown as { __yaccRealtimeDevtools?: RealtimeDevtoolsApi })
        .__yaccRealtimeDevtools;
      if (!api) {
        throw new Error('realtime devtools seam not installed (dev build expected)');
      }
      // The source is a caller-provided pure arrow over (api, arg) only —
      // no closure capture survives the realm boundary.
      const invoke = eval(source) as (api: RealtimeDevtoolsApi, arg: unknown) => unknown;
      return (await invoke(api, invokeArg)) as T;
    },
    { source: fn.toString(), invokeArg: arg ?? null },
  ) as Promise<T>;
}

async function waitForFrame(
  predicate: (frame: WireFrame) => boolean,
  cursor: number,
  timeoutMs: number,
): Promise<WireFrame> {
  let match: WireFrame | undefined;
  await expect
    .poll(
      () => {
        match = appFrames.slice(cursor).find((frame) => predicate(frame));
        return match ?? null;
      },
      { timeout: timeoutMs },
    )
    .toBeTruthy();
  return match as WireFrame;
}

function assertFrozenEnvelope(frame: WireFrame): void {
  expect(Object.keys(frame).sort()).toEqual(['data', 'event', 'timestamp']);
  expect(typeof frame.timestamp).toBe('string');
  expect(typeof frame.data).toBe('object');
}

function decodeJwtClaims(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
}

/** Real sign-in against the Java service (frozen `POST /api/auth/sign-in/email`). */
async function signIn(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<{ accessToken: string; role: string; id: string }> {
  const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    accessToken: string;
    user: { id: string; role: string };
  };
  return { accessToken: body.accessToken, role: body.user.role, id: body.user.id };
}

function requireRunnerHandles(): { pidFile: string; restartCmd: string } {
  const pidFile = process.env.YACC_JAVA_PID_FILE;
  const restartCmd = process.env.YACC_JAVA_RESTART_CMD;
  if (!pidFile || !restartCmd) {
    throw new Error(
      'The W19 rows require the runner-provided YACC_JAVA_PID_FILE and ' +
        'YACC_JAVA_RESTART_CMD handles for the S1-posture Java service ' +
        '(never a fabricated disconnect).',
    );
  }
  return { pidFile, restartCmd };
}

/**
 * Loopback service base for runner-side health probes (IPv4, fresh
 * connections only — `node:http` bypasses undici's shared keep-alive pool,
 * which poisons itself across a kill/restart of the probe target).
 */
const SERVICE_PROBE_URL = WS_BASE_URL.replace(/^ws/, 'http')
  .replace(/\/ws$/, '')
  .replace('localhost', '127.0.0.1');

function probeService(): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(
      `${SERVICE_PROBE_URL}/health/live`,
      { timeout: 1500 },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      },
    );
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });
}

async function stopService(pidFile: string): Promise<void> {
  const listener = listeningServicePid();
  const pidFilePid = Number.parseInt(readFileSync(pidFile, 'utf8').trim(), 10);
  const target = listener ?? (Number.isFinite(pidFilePid) ? pidFilePid : NaN);
  if (!Number.isFinite(target)) {
    throw new Error(
      `no service kill target: nothing listening on :8080 and ${pidFile} has no usable pid`,
    );
  }
  process.kill(target, 'SIGTERM');
  await expect.poll(probeService, { timeout: 45_000 }).toBe(false);
}

async function startService(restartCmd: string, pidFile: string): Promise<void> {
  await execAsync(restartCmd, { timeout: 30_000 });
  const diagnostics: string[] = [];
  try {
    await expect
      .poll(
        async () => {
          const attempt = (async () => {
            // Fail fast if the boot process died instead of starving the poll.
            const pid = Number.parseInt(readFileSync(pidFile, 'utf8').trim(), 10);
            let alive = true;
            try {
              process.kill(pid, 0);
            } catch {
              alive = false;
            }
            const healthy = await probeService();
            diagnostics.push(
              `${new Date().toISOString()} pid=${pid} alive=${alive} healthy=${healthy}`,
            );
            if (!alive && !healthy) {
              throw new Error(
                `restart boot process exited before the service became healthy; probes:\n${diagnostics.join('\n')}`,
              );
            }
            return healthy;
          })();
          return attempt.then(
            (v) => v,
            (e) => {
              diagnostics.push(String(e).slice(0, 200));
              return false;
            },
          );
        },
        { timeout: 150_000 },
      )
      .toBe(true);
  } catch (error) {
    throw new Error(
      `service restart health poll failed; probes:\n${diagnostics.join('\n')}`,
      { cause: error },
    );
  }
}

// -- Rows ---------------------------------------------------------------------

test.beforeAll(async ({ browser }) => {
  requireRunnerHandles(); // loud failure before any row runs
  browserContext = await browser.newContext();
  page = await browserContext.newPage();
  trackSockets(page);
});

test.afterAll(async () => {
  await browserContext?.close();
});

test('R1-AUTH-1: real UI sign-in against the Java service issues the session (fixture user role)', async () => {
  test.setTimeout(60_000);
  await page.goto('/login');
  await page.getByTestId('login-email').fill(FIXTURES.user.email);
  await page.getByTestId('login-password').fill(FIXTURES.user.password);
  await page.getByTestId('login-submit').click();

  // The real AuthService/TokenStorageService flow stored the session.
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('yacc_token')), {
      timeout: 15_000,
    })
    .toBeTruthy();
  accessToken = await page.evaluate(() => window.localStorage.getItem('yacc_token'));
  expect(accessToken).toBeTruthy();

  // Server-issued JWT claims: the authenticated identity is the fixture
  // user (role `user`) — real authentication, not a stubbed token.
  const claims = decodeJwtClaims(accessToken as string);
  expect(String(claims.role)).toBe('user');
});

test('R1-AUTH-2: app boot upgrades on the raw-WS entry with the real token and receives the frozen connection-established envelope', async () => {
  test.setTimeout(60_000);
  const wsPromise = page.waitForEvent('websocket', {
    predicate: (ws) => ws.url().startsWith(`${WS_BASE_URL}?token=`),
  });
  await page.reload(); // boot with the stored session (the app's restore path)
  await wsPromise;

  const established = await waitForFrame(
    (frame) => frame.event === 'system.connection.established',
    0,
    15_000,
  );
  assertFrozenEnvelope(established);
  expect(established.data).toMatchObject({ type: 'connection_established' });

  const clientState = await withDevtools((api) => api.client());
  expect(clientState.connectionState).toBe('connected');
  expect(clientState.isConnected).toBe(true);
  const boundaryState = await withDevtools((api) => api.websocketState());
  expect(boundaryState.lastConnectTime).toBeTruthy();
});

test('R1-AUTH-3: the server handshake is fail-closed — missing and invalid tokens are rejected', async () => {
  test.setTimeout(30_000);
  const probe = (url: string) =>
    page.evaluate(
      (target) =>
        new Promise<{ closed: boolean; frames: number }>((resolve) => {
          const socket = new WebSocket(target);
          let frames = 0;
          socket.onmessage = () => {
            frames += 1;
          };
          socket.onclose = () => resolve({ closed: true, frames });
          setTimeout(() => resolve({ closed: socket.readyState >= 2, frames }), 8_000);
        }),
      url,
    );

  const missing = await probe(WS_BASE_URL);
  expect(missing.closed).toBe(true);
  expect(missing.frames).toBe(0);

  const invalid = await probe(`${WS_BASE_URL}?token=${encodeURIComponent('not-a-real-jwt')}`);
  expect(invalid.closed).toBe(true);
  expect(invalid.frames).toBe(0);
});

test('R1-RBAC-1: REST RBAC tiering holds for the WS-authenticated identity', async () => {
  test.setTimeout(30_000);
  // Role-restricted surface: `user` cannot list accounts/users.
  const users = await page.context().request.get(`${API_BASE_URL}/users`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(users.status()).toBe(403);

  // The same identity may send messages (frozen contract allows user+).
  const send = await page.context().request.post(
    `${API_BASE_URL}/conversations/${FIXTURES.conversationId}/messages`,
    {
      data: { body: 'R1-RBAC-1 send canary' },
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  expect(send.status()).toBe(201);
});

test('R1-MSG-1: the server-originated message.failed broadcast reaches the browser and patches the loaded cache', async () => {
  test.setTimeout(90_000);
  // Load the caches through the app's own stores (real HTTP, real token —
  // the same public store API a consumer component uses).
  await withDevtools((api) => api.conversationsLoad({}));
  await withDevtools((api, id) => api.messagesLoad(id), FIXTURES.conversationId);

  // The handler's conversations invalidation fires the real list refetch;
  // watch for it from before the broadcast can arrive.
  const refetchPromise = page.waitForRequest(
    (request) =>
      request.method() === 'GET' &&
      request.url().includes('/api/conversations') &&
      !request.url().includes('/messages'),
    { timeout: 45_000 },
  );

  // Real authenticated send (REST, session token). The server dispatches
  // the outbound delivery asynchronously after the frozen 201/PENDING
  // response; with no connector registered the dispatch fails and the queue
  // layer BROADCASTS the frozen `message.failed` envelope globally
  // (server-originated). NOTE: the in-cache status PATCH half of the
  // handler is not asserted here — the merged ANG-005 send contract
  // (`SendMessageResponseSchema = MessageSchema`) does not unwrap the
  // frozen `{data: Message}` 201 envelope, so the store's send-append never
  // lands a row with the real id and the patch no-ops. Recorded on PR #428
  // for owner routing; the patch wiring itself stays unit-evidenced.
  const send = await page.context().request.post(
    `${API_BASE_URL}/conversations/${FIXTURES.conversationId}/messages`,
    {
      data: { body: 'R1-MSG-1 realtime dispatch probe' },
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  expect(send.status()).toBe(201);
  const created = (await send.json()) as { data: { id: string } };
  sentMessageId = created.data.id;
  expect(sentMessageId).toBeTruthy();

  const cursor = appFrames.length;
  const failed = await waitForFrame(
    (frame) => frame.event === 'message.failed' && frame.data.messageId === sentMessageId,
    cursor,
    45_000,
  );
  assertFrozenEnvelope(failed);
  expect(failed.data).toMatchObject({
    messageId: sentMessageId,
    conversationId: FIXTURES.conversationId,
    status: 'failed',
  });
  expect(typeof failed.data.error).toBe('string');
  expect(typeof failed.data.retryAt).toBe('string');
  expect(Number(failed.data.attempt)).toBeGreaterThanOrEqual(1);

  // The conversations-list refetch (connect-independent invalidation half).
  await refetchPromise;

});

test('R1-PRES-1: server-originated presence.updated drives the presence store for a second real session', async () => {
  test.setTimeout(90_000);
  // Second REAL session: the manager signs in through the real REST
  // contract, then connects a real raw-WS session and sends the frozen
  // `user.online` lifecycle channel — the server broadcasts the canonical
  // presence frame to every other session.
  const manager = await signIn(
    page.context().request,
    FIXTURES.manager.email,
    FIXTURES.manager.password,
  );
  expect(manager.role).toBe('manager');

  const cursor = appFrames.length;
  // Step 1: open the second REAL session and announce it online; the
  // socket stays open until step 3 so the online state is observable.
  instrumentSocketWindow = true;
  await page.evaluate(
    async ({ wsUrl, token, userId }) => {
      const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
      await new Promise((resolve, reject) => {
        socket.onopen = resolve;
        socket.onerror = () => reject(new Error('instrument socket upgrade failed'));
      });
      socket.send(JSON.stringify({ event: 'user.online', data: { userId } }));
      (window as unknown as { __r1InstrumentSocket?: WebSocket }).__r1InstrumentSocket = socket;
    },
    { wsUrl: WS_BASE_URL, token: manager.accessToken, userId: manager.id },
  );
  instrumentSocketWindow = false;

  const online = await waitForFrame(
    (frame) =>
      frame.event === 'presence.updated' &&
      frame.data.userId === manager.id &&
      frame.data.status === 'online',
    cursor,
    15_000,
  );
  assertFrozenEnvelope(online);
  expect(typeof online.data.lastSeen).toBe('string');

  await expect
    .poll(
      () =>
        withDevtools(
          (api, userId) => api.websocketState().userPresence[userId as string]?.status ?? null,
          manager.id,
        ),
      { timeout: 15_000 },
    )
    .toBe('online');

  // Step 3: drop the manager's only socket — the server broadcasts the
  // canonical offline presence (last-socket rule).
  await page.evaluate(() => {
      (window as unknown as { __r1InstrumentSocket?: WebSocket }).__r1InstrumentSocket?.close();
    });

  const offline = await waitForFrame(
    (frame) =>
      frame.event === 'presence.updated' &&
      frame.data.userId === manager.id &&
      frame.data.status === 'offline',
    cursor,
    15_000,
  );
  assertFrozenEnvelope(offline);

  await expect
    .poll(
      () =>
        withDevtools(
          (api, userId) => api.websocketState().userPresence[userId as string]?.status ?? null,
          manager.id,
        ),
      { timeout: 15_000 },
    )
    .toBe('offline');
});

test('R1-WS-TYPE-1: typing relay is server-truth on the wire; the inbound-only client (no room join) correctly receives none (W20 disposition evidence)', async () => {
  test.setTimeout(90_000);
  const manager = await signIn(
    page.context().request,
    FIXTURES.manager.email,
    FIXTURES.manager.password,
  );

  // Two REAL raw-WS sessions inside the page realm: the subscriber joins
  // the fixture conversation room (frozen `subscribe.conversation`), the
  // manager session emits the frozen `typing.*` lifecycle. This evidences
  // the server relay half of W20 against the frozen AsyncAPI shapes. Both
  // instruments ride the MANAGER identity — a same-user session here would
  // consume the user's durable-backlog replay on establishment (server
  // truth: restore runs per session establishment) and starve R1-W19-1.
  instrumentSocketWindow = true;
  const relay = await page.evaluate(
    async ({ wsUrl, managerToken, conversationId, userId, name }) => {
      const subscriber = new WebSocket(`${wsUrl}?token=${encodeURIComponent(managerToken)}`);
      const typer = new WebSocket(`${wsUrl}?token=${encodeURIComponent(managerToken)}`);

      const subscribedPromise = new Promise<Record<string, unknown>>((resolve) => {
        subscriber.onmessage = (message) => {
          const parsed = JSON.parse(String(message.data)) as Record<string, unknown>;
          if (parsed.event === 'conversation.subscribed') {
            resolve(parsed);
          }
        };
      });
      const nextFrame = (socket: WebSocket, event: string) =>
        new Promise<Record<string, unknown>>((resolve) => {
          socket.onmessage = (message) => {
            const parsed = JSON.parse(String(message.data)) as Record<string, unknown>;
            if (parsed.event === event) {
              resolve(parsed);
            }
          };
        });

      await Promise.all([
        new Promise<void>((resolve, reject) => {
          subscriber.onopen = () => {
            subscriber.send(
              JSON.stringify({ event: 'subscribe.conversation', data: conversationId }),
            );
            resolve();
          };
          subscriber.onerror = () => reject(new Error('subscriber upgrade failed'));
        }),
        new Promise<void>((resolve, reject) => {
          typer.onopen = () => resolve();
          typer.onerror = () => reject(new Error('typer upgrade failed'));
        }),
      ]);

      await subscribedPromise;
      typer.send(JSON.stringify({ event: 'typing.started', data: { conversationId, userId, name } }));
      const started = await nextFrame(subscriber, 'typing.started');
      typer.send(JSON.stringify({ event: 'typing.stopped', data: { conversationId, userId } }));
      const stopped = await nextFrame(subscriber, 'typing.stopped');

      subscriber.close();
      typer.close();
      return { started, stopped };
    },
    {
      wsUrl: WS_BASE_URL,
      managerToken: manager.accessToken,
      conversationId: FIXTURES.conversationId,
      userId: manager.id,
      name: 'Manager User',
    },
  );
  instrumentSocketWindow = false;

  // Frozen envelope + per-channel payload shapes, observed on the wire.
  expect(relay.started).toMatchObject({
    event: 'typing.started',
    data: { conversationId: FIXTURES.conversationId, userId: manager.id, name: 'Manager User' },
  });
  expect(relay.stopped).toMatchObject({
    event: 'typing.stopped',
    data: { conversationId: FIXTURES.conversationId, userId: manager.id },
  });

  // The Angular client never joined the room (inbound-only surface — it
  // sends nothing), so the server delivered it no typing frame at all.
  await page.waitForTimeout(1_500);
  const clientTypingFrames = appFrames.filter((frame) => frame.event.startsWith('typing.'));
  expect(clientTypingFrames).toHaveLength(0);
});

test('R1-HB-1: the frozen 60s system.heartbeat reaches the browser and drives client liveness', async () => {
  test.setTimeout(110_000);
  const cursor = appFrames.length;
  const heartbeat = await waitForFrame(
    (frame) => frame.event === 'system.heartbeat',
    cursor,
    80_000,
  );
  assertFrozenEnvelope(heartbeat);
  expect(heartbeat.data).toMatchObject({ type: 'heartbeat' });

  const clientState = await withDevtools((api) => api.client());
  expect(clientState.lastHeartbeatAt).toBe(heartbeat.timestamp);
});

test('R1-W19-1: transport drop enters the app-owned ladder (indicator); server return reconnects with the reconnection marker, backlog replay and cache invalidation', async () => {
  test.setTimeout(300_000);
  const { pidFile, restartCmd } = requireRunnerHandles();

  // Touch both caches so they are loaded/loaded-and-fresh at drop time —
  // connect$ invalidation then refetches them on reconnect (observable
  // HTTP through the dev-server proxy).
  await withDevtools((api) => api.conversationsLoad({}));
  await withDevtools((api, id) => api.messagesLoad(id), FIXTURES.conversationId);

  const preDropConnectTime = (await withDevtools((api) => api.websocketState())).lastConnectTime;
  const reconnectCursor = appFrames.length;

  // The refetches happen as soon as the client reconnects; watch from now.
  // (Message-list GET responses are COLLECTED — a stale-while-revalidate
  // touch may interleave, so the failed row is asserted over the collected
  // set instead of one specific response.)
  const conversationsRefetch = page.waitForRequest(
    (request) =>
      request.method() === 'GET' &&
      request.url().includes('/api/conversations') &&
      !request.url().includes('/messages'),
    { timeout: 180_000 },
  );
  const messageListResponses: import('@playwright/test').Response[] = [];
  const messageResponseCollector = (response: import('@playwright/test').Response) => {
    if (
      response.request().method() === 'GET' &&
      response.url().includes('/api/conversations') &&
      response.url().includes('/messages')
    ) {
      messageListResponses.push(response);
    }
  };
  page.on('response', messageResponseCollector);

  await stopService(pidFile);

  // The drop must land the client in the application-owned ladder with the
  // W19 indicator visible (real DOM, not a stub).
  await expect
    .poll(
      () => sockets.some((socket) => socket.token === accessToken && socket.closed),
      { timeout: 30_000 },
    )
    .toBe(true);
  const indicator = page.getByRole('alert', { name: /Reconnecting\. Attempt \d+ of 10\./ });
  await expect(indicator).toBeVisible({ timeout: 30_000 });
  expect(await indicator.textContent()).toContain('of 10');

  const ladderState = await withDevtools((api) => api.client());
  expect(ladderState.connectionState).toBe('reconnecting');

  await startService(restartCmd, pidFile);

  // The ladder reconnects on its own once the upgrade succeeds again.
  const reconnected = await waitForFrame(
    (frame) => frame.event === 'system.connection.established',
    reconnectCursor,
    150_000,
  );
  assertFrozenEnvelope(reconnected);

  // Server truth (recorded): `system.reconnection.started` is the
  // server-DETECTED reconnect marker riding the server's in-memory
  // disconnect tracker (MIG-051) — it cannot fire across the process
  // restart this row performs; the same-server reconnection marker is
  // evidenced by R1-W19-3. The durable backlog below lives in PostgreSQL
  // and survives the restart by design.
  const events = appFrames.slice(reconnectCursor).map((frame) => frame.event);
  expect(events).toContain('system.connection.established');

  // Durable backlog: the stored `message.failed` row(s) replay on the new
  // session, framed by the frozen replay markers in emission order. (The
  // queue's retry cycle also broadcasts LIVE `message.failed` frames — the
  // replayed row is identified INSIDE the replay marker segment.)
  const startedIdx = events.indexOf('system.backlog.replay.started');
  const completedIdx = events.indexOf('system.backlog.replay.completed');
  expect(startedIdx).toBeGreaterThan(-1);
  expect(completedIdx).toBeGreaterThan(startedIdx);
  const replaySegment = appFrames.slice(reconnectCursor).slice(startedIdx + 1, completedIdx);
  const replayed = replaySegment.filter(
    (frame) => frame.event === 'message.failed' && frame.data.messageId === sentMessageId,
  );
  expect(replayed.length).toBeGreaterThanOrEqual(1);

  // Liveness cleared: indicator gone, connected, lastConnectTime advanced.
  await expect(indicator).toBeHidden({ timeout: 15_000 });
  const postState = await withDevtools((api) => api.websocketState());
  expect(postState.connectionState).toBe('connected');
  expect(postState.lastConnectTime).toBeTruthy();
  expect(postState.lastConnectTime).not.toBe(preDropConnectTime);

  // connect$ → cache invalidation: both loaded families refetched, and a
  // message list the client pulls back after the drop carries the
  // server-side `failed` transition of the R1-MSG-1 row.
  await conversationsRefetch;
  await expect
    .poll(
      async () => {
        while (messageListResponses.length > 0) {
          const response = messageListResponses.shift() as import('@playwright/test').Response;
          if (!response.ok()) {
            continue;
          }
          try {
            const body = (await response.body()) as Buffer;
            const list = JSON.parse(body.toString('utf8')) as {
              messages?: Array<{ id: string; status: string }>;
            };
            if (
              list.messages?.some(
                (message) => message.id === sentMessageId && message.status === 'failed',
              )
            ) {
              return true;
            }
          } catch {
            // body unreadable (client gone) — keep polling the remainder
          }
        }
        return false;
      },
      { timeout: 60_000 },
    )
    .toBeTruthy();
  page.off('response', messageResponseCollector);
});

test('R1-W19-3: a same-server reconnection within the window is server-recognized (reconnection marker) and replays the durable backlog', async () => {
  test.setTimeout(120_000);
  // Fresh backlog row: a real REST send while the app session is connected
  // is stored for the user by the server's durable backlog (WS-BHV-009).
  const send = await page.context().request.post(
    `${API_BASE_URL}/conversations/${FIXTURES.conversationId}/messages`,
    {
      data: { body: 'R1-W19-3 backlog probe' },
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  expect(send.status()).toBe(201);
  const created = (await send.json()) as { data: { id: string } };

  // The reload closes the client socket cleanly (the server records the
  // disconnect time) and re-boots the app within the reconnect window —
  // the SAME server process recognizes the re-establishment and emits the
  // frozen `system.reconnection.started` marker before restoring the
  // user's durable backlog.
  const reconnectCursor = appFrames.length;
  const wsPromise = page.waitForEvent('websocket', {
    predicate: (ws) => ws.url().startsWith(`${WS_BASE_URL}?token=`),
  });
  await page.reload();
  await wsPromise;

  const established = await waitForFrame(
    (frame) => frame.event === 'system.connection.established',
    reconnectCursor,
    30_000,
  );
  assertFrozenEnvelope(established);

  const events = appFrames.slice(reconnectCursor).map((frame) => frame.event);
  expect(events).toContain('system.reconnection.started');
  const startedIdx = events.indexOf('system.backlog.replay.started');
  const completedIdx = events.indexOf('system.backlog.replay.completed');
  expect(startedIdx).toBeGreaterThan(-1);
  expect(completedIdx).toBeGreaterThan(startedIdx);
  const replaySegment = appFrames.slice(reconnectCursor).slice(startedIdx + 1, completedIdx);
  const replayed = replaySegment.filter(
    (frame) => frame.event === 'message.failed' && frame.data.messageId === created.data.id,
  );
  expect(replayed).toHaveLength(1);

  const state = await withDevtools((api) => api.client());
  expect(state.connectionState).toBe('connected');
});

test('R1-W19-2: manual retryNow reconnects immediately instead of waiting out the ladder rung', async () => {
  test.setTimeout(240_000);
  const { pidFile, restartCmd } = requireRunnerHandles();

  const cursor = appFrames.length;
  await stopService(pidFile);
  await expect
    .poll(
      () => sockets.some((socket) => socket.token === accessToken && socket.closed),
      { timeout: 30_000 },
    )
    .toBe(true);

  // Let the ladder burn to a long rung (attempt ≥4 ⇒ the 30s schedule), so
  // an immediate reconnect is observable against the pending rung.
  await expect
    .poll(() => withDevtools((api) => api.client().reconnectAttempt), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(4);

  await startService(restartCmd, pidFile);

  const retriedAt = Date.now();
  await withDevtools((api) => api.retryNow());
  await waitForFrame((frame) => frame.event === 'system.connection.established', cursor, 20_000);
  const reconnectElapsedMs = Date.now() - retriedAt;
  expect(reconnectElapsedMs).toBeLessThan(10_000); // the pending rung was 30s

  const state = await withDevtools((api) => api.client());
  expect(state.connectionState).toBe('connected');
  expect(state.isExhausted).toBe(false);
});
