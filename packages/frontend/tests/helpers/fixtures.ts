/**
 * Test fixture IDs and data
 * Must match backend seed-test-fixtures.ts
 */

export const FIXTURE_IDS = {
  users: {
    superAdmin: '00000000-0000-0000-0000-000000000001',
    admin: '00000000-0000-0000-0000-000000000002',
    manager: '00000000-0000-0000-0000-000000000003',
    user: '00000000-0000-0000-0000-000000000004',
  },
  conversations: {
    telegram: '00000000-0000-0000-0000-000000001001',
    irc: '00000000-0000-0000-0000-000000001002',
  },
  routingRules: {
    autoAssignVip: '00000000-0000-0000-0000-000002001',
    autoTagUrgent: '00000000-0000-0000-0000-000002002',
    disabledRule: '00000000-0000-0000-0000-000002003',
  },
  bulkConversations: {
    startId: 3000,
    count: 105,
  },
  tags: {
    vip: 'VIP',
    urgent: 'Urgent',
    followUp: 'Follow-Up',
  },
} as const;

/**
 * Generate bulk conversation IDs for testing max 100 limit
 */
export function getBulkConversationIds(count: number = 100): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = `00000000-0000-0000-0000-${String(FIXTURE_IDS.bulkConversations.startId + i).padStart(12, '0')}`;
    ids.push(id);
  }
  return ids;
}

/**
 * Get a specific bulk conversation ID by index
 */
export function getBulkConversationId(index: number): string {
  return `00000000-0000-0000-0000-${String(FIXTURE_IDS.bulkConversations.startId + index).padStart(12, '0')}`;
}

/**
 * Fixture data for testing
 */
export const FIXTURE_DATA = {
  conversations: {
    telegram: {
      id: FIXTURE_IDS.conversations.telegram,
      channel: 'telegram',
      externalThreadId: 'tg-mock-101',
      title: 'Mock Support Thread',
      status: 'resolved',
      priority: 'medium',
      assignedUserId: FIXTURE_IDS.users.superAdmin,
    },
    irc: {
      id: FIXTURE_IDS.conversations.irc,
      channel: 'irc',
      externalThreadId: 'irc-#support',
      title: 'IRC #support',
      status: 'open',
      priority: 'low',
      assignedUserId: null,
    },
  },
  routingRules: [
    {
      id: FIXTURE_IDS.routingRules.autoAssignVip,
      name: 'Auto-assign VIP to admin',
      priority: 1,
      status: 'active',
    },
    {
      id: FIXTURE_IDS.routingRules.autoTagUrgent,
      name: 'Auto-tag urgent keywords',
      priority: 2,
      status: 'active',
    },
    {
      id: FIXTURE_IDS.routingRules.disabledRule,
      name: 'Disabled rule for testing',
      priority: 3,
      status: 'disabled',
    },
  ],
} as const;

/**
 * Wait time constants for async operations
 */
export const WAIT_TIMES = {
  short: 1000,        // 1 second for UI updates
  medium: 3000,       // 3 seconds for API calls
  long: 5000,         // 5 seconds for complex operations
  veryLong: 10000,    // 10 seconds for setup/teardown
} as const;
