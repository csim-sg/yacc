# INT-011..INT-014 Architecture Guide

**Purpose**: Provide concrete examples and architectural patterns for INT-011..INT-014 implementation  
**Audience**: Backend dev, Frontend dev, QA  
**Status**: ✅ Ready to use

---

## 🏗️ BACKEND ARCHITECTURE

### 1. Schema Changes (INT-011)

**Current State** (packages/common/src/db/schema.ts):
```typescript
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  channel: conversationChannelEnum('channel').notNull(),
  externalThreadId: text('external_thread_id'),
  externalUserId: text('external_user_id'),
  telegramChatId: bigint('telegram_chat_id'),
  // ... other fields
});
```

**Required Change**:
```typescript
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    channel: conversationChannelEnum('channel').notNull(),
    externalThreadId: text('external_thread_id'),
    externalUserId: text('external_user_id'),
    ircProfileId: uuid('irc_profile_id'), // ✨ NEW: Links to integration_configs
    telegramChatId: bigint('telegram_chat_id'),
    // ... other fields
  },
  (table) => ({
    // ✨ NEW: Unique constraints for profile-aware identity
    ircChannelUnique: uniqueIndex('ix_irc_channel_unique').on(
      table.ircProfileId,
      table.externalThreadId
    ),
    ircDMUnique: uniqueIndex('ix_irc_dm_unique').on(
      table.ircProfileId,
      table.externalUserId
    ),
    // ... existing indexes
  })
);
```

**Migration** (packages/backend/src/db/migrations/XXX_add_irc_profile_id.ts):
```typescript
import { sql } from 'drizzle-orm';

export async function up(db) {
  await db.schema.alterTable('conversations').addColumn(
    'irc_profile_id',
    sql`uuid`
  );

  await db.schema
    .createIndex('ix_irc_channel_unique')
    .on('conversations')
    .columns('irc_profile_id', 'external_thread_id')
    .unique();

  await db.schema
    .createIndex('ix_irc_dm_unique')
    .on('conversations')
    .columns('irc_profile_id', 'external_user_id')
    .unique();
}

export async function down(db) {
  await db.schema.dropIndex('ix_irc_dm_unique');
  await db.schema.dropIndex('ix_irc_channel_unique');
  await db.schema.alterTable('conversations').dropColumn('irc_profile_id');
}
```

---

### 2. IRC Ingestion Service (INT-011)

**Current Implementation** (irc-ingestion.service.ts):
```typescript
export class IRCIngestionService {
  private async upsertConversation(channel: string): Promise<string> {
    // Existing: upserts conversation per channel
    // ⚠️ Gap: Does not account for ircProfileId
  }

  async ingestMessage(dto: InboundIRCMessageDTO): Promise<IngestionResult> {
    // Existing: ingests message
    // ⚠️ Gap: Does not pass ircProfileId to upsert
  }
}
```

**Required Changes**:
```typescript
/**
 * DTO for inbound IRC message
 * ✨ Added ircProfileId
 */
export interface InboundIRCMessageDTO {
  ircProfileId: string; // ✨ NEW: UUID of IRC profile
  channel: string;
  nick: string;
  message: string;
  connectorNick: string;
}

export class IRCIngestionService {
  /**
   * Find or create a conversation for this IRC channel
   * ✨ Now profile-aware: UNIQUE(ircProfileId, externalThreadId)
   */
  private async upsertConversation(
    ircProfileId: string,
    channel: string
  ): Promise<string> {
    try {
      // 1. Try to find existing conversation
      const existing = await dbClient
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.channel, 'irc'),
            eq(conversations.externalThreadId, channel),
            eq(conversations.ircProfileId, ircProfileId) // ✨ Filter by profile
          )
        )
        .limit(1)
        .execute();

      if (existing.length > 0) {
        // Update updatedAt
        await dbClient
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, existing[0].id))
          .execute();
        return existing[0].id;
      }

      // 2. Try to insert new conversation
      const newConversation = await dbClient
        .insert(conversations)
        .values({
          channel: 'irc',
          externalThreadId: channel,
          ircProfileId, // ✨ Store profile ID
          status: 'open',
        })
        .returning({ id: conversations.id })
        .execute();

      return newConversation[0].id;
    } catch (error) {
      // Handle unique constraint violation (concurrent insert)
      if (error.code === '23505') {
        // Fetch the conversation created by concurrent request
        const concurrent = await dbClient
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.channel, 'irc'),
              eq(conversations.externalThreadId, channel),
              eq(conversations.ircProfileId, ircProfileId)
            )
          )
          .limit(1)
          .execute();
        return concurrent[0].id;
      }
      throw error;
    }
  }

  /**
   * Ingest inbound IRC message
   * ✨ Now accepts and uses ircProfileId
   */
  async ingestMessage(dto: InboundIRCMessageDTO): Promise<IngestionResult> {
    const { ircProfileId, channel, nick, message, connectorNick } = dto;

    try {
      // 1. Upsert conversation (profile-aware)
      const conversationId = await this.upsertConversation(
        ircProfileId, // ✨ Pass profile ID
        channel
      );

      // 2. Skip self-echo
      if (this.isSelfEcho(nick, connectorNick)) {
        logger.debug(
          {
            conversationId,
            nick,
            ircProfileId, // ✨ Log profile ID
          },
          'Skipping self-echo message'
        );
        return { success: true, conversationId };
      }

      // 3. Sanitize and insert message
      const sanitizedBody = this.sanitizeMessageBody(message);
      const messageId = await this.insertMessage(
        conversationId,
        nick,
        sanitizedBody
      );

      // 4. Auto-reopen resolved conversation
      await this.autoReopenIfResolved(conversationId);

      // 5. Emit WebSocket event
      if (isWebSocketGatewayAvailable()) {
        emitToConversation(conversationId, 'message.received', {
          conversationId,
          messageId,
          timestamp: new Date().toISOString(),
        });
      }

      return { success: true, conversationId, messageId };
    } catch (error) {
      logger.error(
        {
          ircProfileId,
          channel,
          error: error.message,
        },
        'Failed to ingest IRC message'
      );
      return {
        success: false,
        error: 'Ingestion failed',
      };
    }
  }
}

export const ircIngestionService = new IRCIngestionService();
```

---

### 3. IRC Connector (INT-011, INT-012)

**Current Implementation** (irc.connector.ts):
```typescript
export class IRCConnector extends BaseConnector<'irc', IRCConfig> {
  async sendMessage(
    channel: string,
    message: string
  ): Promise<SendMessageResponse> {
    // Existing: sends message via IRC
  }
}
```

**Required Changes**:
```typescript
export class IRCConnector extends BaseConnector<'irc', IRCConfig> {
  private ircProfileId: string = ''; // ✨ NEW: Store profile ID

  /**
   * Configure connector with IRC profile ID
   */
  setProfileId(profileId: string): void {
    this.ircProfileId = profileId;
    logger.debug(
      { ircProfileId: profileId, platform: 'irc' },
      'IRC connector profile ID set'
    );
  }

  /**
   * Handle inbound message
   * ✨ Now passes ircProfileId to ingestion
   */
  private async handleMessage(
    nick: string,
    channel: string,
    message: string
  ): Promise<void> {
    try {
      const result = await ircIngestionService.ingestMessage({
        ircProfileId: this.ircProfileId, // ✨ Pass profile ID
        channel,
        nick,
        message,
        connectorNick: this.config?.nick || '',
      });

      if (!result.success) {
        logger.warn(
          {
            ircProfileId: this.ircProfileId,
            channel,
            error: result.error,
          },
          'Message ingestion failed'
        );
        // Message moved to DLQ by ingestion service if applicable
      }
    } catch (error) {
      logger.error(
        {
          ircProfileId: this.ircProfileId,
          channel,
          correlationId: this.correlationId,
          error: error.message,
        },
        'Failed to handle inbound IRC message' // ✨ Correlation ID in logs
      );
      // Error handling already in place; DLQ via retry worker
    }
  }

  /**
   * Send message with error handling
   * ✨ Ensures error correlation + DLQ integration
   */
  async sendMessage(
    channel: string,
    message: string
  ): Promise<SendMessageResponse> {
    const correlationId = randomUUID();

    try {
      if (!this.client || !this.isConnected()) {
        logger.error(
          {
            ircProfileId: this.ircProfileId,
            channel,
            correlationId,
          },
          'Cannot send message: not connected'
        );
        return { success: false, error: 'Not connected' };
      }

      const sanitized = sanitizeMessage(message);
      this.client.say(channel, sanitized);

      logger.info(
        {
          ircProfileId: this.ircProfileId,
          channel,
          length: sanitized.length,
          correlationId,
        },
        'Message sent to IRC channel'
      );

      return { success: true };
    } catch (error) {
      logger.error(
        {
          ircProfileId: this.ircProfileId,
          channel,
          correlationId,
          error: error.message,
        },
        'Failed to send message to IRC' // ✨ Correlation ID + profile
      );
      return { success: false, error: error.message };
    }
  }
}
```

---

### 4. Connector Manager Integration (INT-011)

**Where ircProfileId comes from**:
```typescript
// In connectorManager (coordinates all connectors)

class ConnectorManager {
  private ircConnectors: Map<string, IRCConnector> = new Map();

  /**
   * Get or create IRC connector for a profile
   */
  getIRCConnector(ircProfileId: string): IRCConnector {
    if (!this.ircConnectors.has(ircProfileId)) {
      const connector = new IRCConnector();
      connector.setProfileId(ircProfileId); // ✨ Set profile ID here
      this.ircConnectors.set(ircProfileId, connector);
    }
    return this.ircConnectors.get(ircProfileId)!;
  }

  /**
   * When inbound message arrives from IRC
   */
  async handleInboundIRCMessage(
    ircProfileId: string,
    channel: string,
    nick: string,
    message: string
  ): Promise<void> {
    const connector = this.getIRCConnector(ircProfileId);
    const connectorNick = connector.getConfig()?.nick || '';

    await ircIngestionService.ingestMessage({
      ircProfileId, // ✨ Pass profile ID
      channel,
      nick,
      message,
      connectorNick,
    });
  }
}
```

---

## 🎨 FRONTEND ARCHITECTURE

### 1. Sidebar Component Structure

**New Hooks** (packages/frontend/src/hooks/useSidebarState.ts):
```typescript
/**
 * useSidebarState: Manage sidebar accordion state (localStorage)
 */
export function useSidebarState() {
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('sidebar:expandedProfiles');
    return saved ? new Set(JSON.parse(saved)) : new Set(['telegram']);
  });

  const toggleProfile = (profileId: string) => {
    const updated = new Set(expandedProfiles);
    if (updated.has(profileId)) {
      updated.delete(profileId);
    } else {
      updated.add(profileId);
    }
    setExpandedProfiles(updated);
    localStorage.setItem('sidebar:expandedProfiles', JSON.stringify([...updated]));
  };

  return { expandedProfiles, toggleProfile };
}
```

**New Hook** (packages/frontend/src/hooks/useProfileConversations.ts):
```typescript
/**
 * useProfileConversations: Fetch + group conversations by profile
 */
export function useProfileConversations() {
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.getConversations({ limit: 100 }),
  });

  // Group conversations by profile
  const grouped = useMemo(() => {
    if (!conversations) return null;

    return conversations.reduce(
      (acc, conv) => {
        if (conv.channel === 'telegram') {
          if (!acc.telegram) acc.telegram = [];
          acc.telegram.push(conv);
        } else if (conv.channel === 'irc' && conv.ircProfileId) {
          const profileId = conv.ircProfileId;
          if (!acc.irc) acc.irc = {};
          if (!acc.irc[profileId]) acc.irc[profileId] = [];
          acc.irc[profileId].push(conv);
        }
        return acc;
      },
      {} as {
        telegram?: Conversation[];
        irc?: Record<string, Conversation[]>;
      }
    );
  }, [conversations]);

  return { grouped, isLoading };
}
```

**New Types** (packages/frontend/src/types/sidebar.types.ts):
```typescript
export interface ProfileSection {
  profileId: string;
  profileName: string;
  channel: 'telegram' | 'irc';
  isExpanded: boolean;
  conversations: ConversationItem[];
  unreadCount: number;
}

export interface ConversationItem {
  conversationId: string;
  name: string; // Channel name or user name
  isSelected: boolean;
  unreadCount: number;
  channel: 'telegram' | 'irc';
  type: 'channel' | 'dm';
}
```

### 2. Refactored Sidebar Component

**Before** (current flat list):
```typescript
export function Sidebar() {
  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.getConversations(),
  });

  return (
    <aside>
      {conversations?.map((conv) => (
        <ConversationLink key={conv.id} conversation={conv} />
      ))}
    </aside>
  );
}
```

**After** (profile-grouped with accordion):
```typescript
export function Sidebar() {
  const { grouped, isLoading } = useProfileConversations();
  const { expandedProfiles, toggleProfile } = useSidebarState();
  const navigate = useNavigate();

  if (isLoading) return <div>Loading...</div>;
  if (!grouped) return <div>No conversations</div>;

  return (
    <aside className="flex flex-col h-full bg-gray-100">
      {/* Telegram Section */}
      {grouped.telegram && (
        <ProfileSection
          profileId="telegram"
          profileName="Telegram"
          isExpanded={expandedProfiles.has('telegram')}
          onToggle={() => toggleProfile('telegram')}
          conversations={grouped.telegram.map((conv) => ({
            conversationId: conv.id,
            name: conv.name || `Conversation ${conv.id.slice(0, 8)}`,
            isSelected: false, // Implement from route
            unreadCount: 0, // Implement from state
            channel: 'telegram',
            type: 'channel',
          }))}
          onSelectConversation={(convId) => navigate(`/conversations/${convId}`)}
        />
      )}

      {/* IRC Profiles Section */}
      {grouped.irc &&
        Object.entries(grouped.irc).map(([profileId, conversations]) => (
          <ProfileSection
            key={profileId}
            profileId={profileId}
            profileName={`IRC Profile ${profileId.slice(0, 8)}`} // ✨ TODO: Get real name
            isExpanded={expandedProfiles.has(profileId)}
            onToggle={() => toggleProfile(profileId)}
            conversations={conversations.map((conv) => ({
              conversationId: conv.id,
              name:
                conv.externalThreadId ||
                conv.externalUserId ||
                `Conversation ${conv.id.slice(0, 8)}`,
              isSelected: false,
              unreadCount: 0,
              channel: 'irc',
              type: conv.externalThreadId ? 'channel' : 'dm',
            }))}
            onSelectConversation={(convId) => navigate(`/conversations/${convId}`)}
          />
        ))}
    </aside>
  );
}

/**
 * ProfileSection: Reusable accordion section for profile
 */
interface ProfileSectionProps {
  profileId: string;
  profileName: string;
  isExpanded: boolean;
  onToggle: () => void;
  conversations: ConversationItem[];
  onSelectConversation: (conversationId: string) => void;
}

function ProfileSection({
  profileId,
  profileName,
  isExpanded,
  onToggle,
  conversations,
  onSelectConversation,
}: ProfileSectionProps) {
  return (
    <div className="border-b">
      {/* Header / Accordion Toggle */}
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between hover:bg-gray-200"
      >
        <span className="font-semibold text-sm">{profileName}</span>
        <ChevronIcon isOpen={isExpanded} />
      </button>

      {/* Content / Conversation List */}
      {isExpanded && (
        <div className="pl-2">
          {conversations.map((conv) => (
            <button
              key={conv.conversationId}
              onClick={() => onSelectConversation(conv.conversationId)}
              className="w-full p-2 text-left text-sm hover:bg-gray-300 flex items-center justify-between"
            >
              <span className="truncate">
                {conv.type === 'channel' && '#'}
                {conv.type === 'dm' && '@'}
                {conv.name}
              </span>
              {conv.unreadCount > 0 && (
                <Badge count={conv.unreadCount} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 🧪 TESTING PATTERNS

### Backend Unit Test Pattern (INT-013)

```typescript
// packages/backend/src/services/__tests__/irc-ingestion.service.test.ts

describe('IRCIngestionService', () => {
  let service: IRCIngestionService;
  let db: Database;

  beforeAll(async () => {
    db = await setupTestDatabase();
    service = new IRCIngestionService();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  describe('upsertConversation (profile-aware)', () => {
    it('should create unique conversations per profile + channel', async () => {
      // Arrange
      const profileId1 = randomUUID();
      const profileId2 = randomUUID();
      const channel = '#general';

      // Act
      const convId1 = await service.upsertConversation(profileId1, channel);
      const convId2 = await service.upsertConversation(profileId2, channel);

      // Assert
      expect(convId1).not.toBe(convId2); // ✨ Different conversations
      const conv1 = await db.query.conversations.findFirst({
        where: eq(conversations.id, convId1),
      });
      expect(conv1.ircProfileId).toBe(profileId1);
      expect(conv1.externalThreadId).toBe(channel);
    });

    it('should reuse same conversation for same profile + channel', async () => {
      // Arrange
      const profileId = randomUUID();
      const channel = '#general';

      // Act
      const convId1 = await service.upsertConversation(profileId, channel);
      const convId2 = await service.upsertConversation(profileId, channel);

      // Assert
      expect(convId1).toBe(convId2);
    });

    it('should enforce unique constraint', async () => {
      // Arrange
      const profileId = randomUUID();
      const channel = '#general';

      // Act
      await service.upsertConversation(profileId, channel);
      const attempt2 = service.upsertConversation(profileId, channel);

      // Assert: Should handle gracefully (no error)
      await expect(attempt2).resolves.toBeDefined();
    });
  });

  describe('ingestMessage', () => {
    it('should ingest message and create profile-aware conversation', async () => {
      // Arrange
      const ircProfileId = randomUUID();
      const dto: InboundIRCMessageDTO = {
        ircProfileId,
        channel: '#general',
        nick: 'testuser',
        message: 'Hello world',
        connectorNick: 'bot',
      };

      // Act
      const result = await service.ingestMessage(dto);

      // Assert
      expect(result.success).toBe(true);
      const conv = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.ircProfileId, ircProfileId),
          eq(conversations.externalThreadId, '#general')
        ),
      });
      expect(conv).toBeDefined();
    });

    it('should skip self-echo messages', async () => {
      // Arrange
      const ircProfileId = randomUUID();
      const dto: InboundIRCMessageDTO = {
        ircProfileId,
        channel: '#general',
        nick: 'bot', // Same as connectorNick
        message: 'Echo',
        connectorNick: 'bot',
      };

      // Act
      const result = await service.ingestMessage(dto);

      // Assert
      expect(result.success).toBe(true);
      const messages = await db.query.messages.findMany({
        where: eq(messages.conversationId, result.conversationId!),
      });
      expect(messages).toHaveLength(0); // No message stored
    });
  });
});
```

### Backend Integration Test Pattern (INT-014)

```typescript
// packages/backend/src/__tests__/irc-integration.test.ts

describe('IRC Integration (E2E with mock server)', () => {
  let connector: IRCConnector;
  let mockServer: MockIRCServer;
  let db: Database;

  beforeAll(async () => {
    db = await setupTestDatabase();
    mockServer = new MockIRCServer();
    mockServer.start();
  });

  afterAll(async () => {
    mockServer.stop();
    await cleanupTestDatabase();
  });

  it('should map channels to profile-aware conversations', async () => {
    // Arrange
    const profileId = randomUUID();
    const config: IRCConfig = {
      server: 'localhost',
      port: mockServer.port,
      nick: 'testbot',
      channels: ['#general', '#random'],
    };
    connector = new IRCConnector();
    connector.setConfig(config);
    connector.setProfileId(profileId);

    // Act
    await connector.connect();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for join

    // Assert
    const conversations = await db.query.conversations.findMany({
      where: eq(conversations.ircProfileId, profileId),
    });
    expect(conversations).toHaveLength(2);
    expect(conversations.map((c) => c.externalThreadId).sort()).toEqual([
      '#general',
      '#random',
    ]);
  });

  it('should ingest inbound messages with profile scope', async () => {
    // Arrange
    const profileId = randomUUID();
    const config: IRCConfig = { /* ... */ };
    connector = new IRCConnector();
    connector.setConfig(config);
    connector.setProfileId(profileId);

    await connector.connect();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Act
    mockServer.sendMessage('#general', 'testuser', 'Hello from IRC');
    await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for ingestion

    // Assert
    const messages = await db.query.messages.findMany({
      where: eq(messages.body, 'Hello from IRC'),
    });
    expect(messages).toHaveLength(1);

    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, messages[0].conversationId),
    });
    expect(conversation.ircProfileId).toBe(profileId);
  });

  it('should move failed messages to DLQ', async () => {
    // Arrange
    const config: IRCConfig = { /* ... */ };
    const connector = new IRCConnector();
    connector.setConfig(config);
    connector.setProfileId(randomUUID());

    // Simulate connection error
    await connector.connect();
    mockServer.forceDisconnect();
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Act
    // Attempt to send message while disconnected
    const result = await connector.sendMessage(
      '#general',
      'This should fail'
    );

    // Assert
    expect(result.success).toBe(false);
    // Verify DLQ entry via retry worker (see integration test for DLQ)
  });
});

/**
 * Mock IRC Server (simplified)
 */
class MockIRCServer extends EventEmitter {
  private server: net.Server;
  private sockets: net.Socket[] = [];
  public port: number = 0;

  start() {
    this.server = net.createServer((socket) => {
      this.sockets.push(socket);
      socket.write(':mock.server 001 * :Welcome\r\n');
      socket.on('data', (data) => this.handleData(data, socket));
    });
    this.server.listen(0, 'localhost', () => {
      this.port = (this.server.address() as any).port;
    });
  }

  stop() {
    this.sockets.forEach((s) => s.destroy());
    this.server.close();
  }

  sendMessage(channel: string, nick: string, message: string) {
    const msg = `:${nick}!user@host PRIVMSG ${channel} :${message}\r\n`;
    this.sockets.forEach((s) => s.write(msg));
  }

  forceDisconnect() {
    this.sockets.forEach((s) => s.destroy());
    this.sockets = [];
  }

  private handleData(data: Buffer, socket: net.Socket) {
    const line = data.toString().trim();
    if (line.startsWith('JOIN')) {
      const channel = line.split(' ')[1];
      socket.write(`:bot!bot@localhost JOIN ${channel}\r\n`);
    }
  }
}
```

### Frontend E2E Test Pattern (FE-Sidebar)

```typescript
// packages/frontend/e2e/sidebar.spec.ts

test.describe('Sidebar - IRC Profile Grouping', () => {
  test('should expand IRC profile and show channels', async ({ page }) => {
    // Arrange
    await page.goto('/inbox');
    await page.waitForSelector('[data-testid="sidebar"]');

    // Act
    const profileButton = page.locator(
      '[data-testid="sidebar-profile-btn-irc-profile-1"]'
    );
    await profileButton.click();

    // Assert
    await expect(
      page.locator('[data-testid="sidebar-conversation-#general"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="sidebar-conversation-#random"]')
    ).toBeVisible();
  });

  test('should navigate to conversation when clicked', async ({ page }) => {
    // Arrange
    await page.goto('/inbox');
    await page.locator('[data-testid="sidebar-profile-btn-irc-profile-1"]').click();

    // Act
    await page.locator('[data-testid="sidebar-conversation-#general"]').click();

    // Assert
    await expect(page).toHaveURL(/\/conversations\/.+/);
    await expect(page.locator('[data-testid="conversation-title"]')).toContainText(
      '#general'
    );
  });

  test('should persist accordion state in localStorage', async ({ page }) => {
    // Arrange
    await page.goto('/inbox');
    const profileButton = page.locator(
      '[data-testid="sidebar-profile-btn-irc-profile-1"]'
    );

    // Act
    await profileButton.click();
    await page.goto('/inbox'); // Refresh
    await page.waitForSelector('[data-testid="sidebar"]');

    // Assert
    const isExpanded = await page
      .locator('[data-testid="sidebar-profile-content-irc-profile-1"]')
      .isVisible();
    expect(isExpanded).toBe(true);
  });

  test('should show unread badges per profile', async ({ page }) => {
    // Arrange
    await page.goto('/inbox');

    // Act
    const badge = page.locator(
      '[data-testid="sidebar-profile-badge-irc-profile-1"]'
    );

    // Assert
    await expect(badge).toContainText(/\d+/); // Contains number
  });

  test('should work on mobile (collapse to icons)', async ({
    page,
    viewport,
  }) => {
    // Arrange
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone size
    await page.goto('/inbox');

    // Act
    const sidebar = page.locator('[data-testid="sidebar"]');

    // Assert
    await expect(sidebar).toHaveClass(/collapsed/);
    // Tap to expand
    await page.locator('[data-testid="sidebar-toggle"]').click();
    await expect(sidebar).not.toHaveClass(/collapsed/);
  });
});
```

---

## 📌 KEY ARCHITECTURAL DECISIONS

### 1. Profile Identity (INT-011)
- **Decision**: Store `ircProfileId` in conversation table, not derive from config
- **Rationale**: Supports multi-profile scenarios; clear audit trail; future profile switching
- **Trade-off**: Slight schema complexity ↔ Clean conversation identity per profile

### 2. Error Handling (INT-012)
- **Decision**: Verify existing error handling; defer rate limiting to Phase 2
- **Rationale**: MVP doesn't require rate limiting; IRC server handles upstream; time-box INT-012
- **Trade-off**: Simple MVP ↔ Future rate limiting feature

### 3. Mock IRC Server (INT-014)
- **Decision**: Use EventEmitter-based mock; no real TCP server
- **Rationale**: Faster, simpler, sufficient for testing core flows; real server can be Phase 2 upgrade
- **Trade-off**: Simple tests ↔ Realism of real IRC protocol

### 4. Sidebar State Management (FE-Sidebar)
- **Decision**: localStorage for accordion state; local grouping (no backend change)
- **Rationale**: Simple, no backend API changes needed; state persists across sessions
- **Trade-off**: Client-side state ↔ Server-side persistence (not needed for MVP)

---

## 🎯 SUCCESS CRITERIA

Each section has clear acceptance criteria:

### Backend
- [ ] Schema migration: `ircProfileId` + unique indexes functional
- [ ] Ingestion: Profile-aware conversation upsert working
- [ ] Unit tests: 90%+ coverage for connector
- [ ] Integration tests: Multi-profile scenarios passing
- [ ] Error handling: Correlation IDs propagated, DLQ functional

### Frontend
- [ ] Sidebar: Profile-grouped accordion rendering correctly
- [ ] Navigation: Click channel → conversation opens
- [ ] Mobile: Collapse/expand responsive behavior
- [ ] Real-time: Unread badges update via WebSocket
- [ ] E2E tests: All sidebar flows passing in Playwright

---

**Next**: Follow `PREP_INT_011_014_UPDATED.md` for sequential task execution.
