import { Page, APIRequestContext } from '@playwright/test';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

/**
 * Make an authenticated API request using page context
 */
export async function apiRequest(page: Page, config: {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  endpoint: string;
  body?: unknown;
  headers?: Record<string, string>;
}): Promise<{ status: number; data: unknown; text: string }> {
  const { method = 'GET', endpoint, body, headers = {} } = config;

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  try {
    const response = await page.request[method.toLowerCase() as Lowercase<typeof method>](url, {
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      data: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    return {
      status: response.status(),
      data,
      text,
    };
  } catch (error) {
    throw new Error(`API request failed: ${endpoint} - ${error}`);
  }
}

/**
 * Create a tag via API
 */
export async function createTag(
  page: Page,
  options: {
    name: string;
    color?: string;
  }
): Promise<{ id: string; name: string; color: string }> {
  const response = await apiRequest(page, {
    method: 'POST',
    endpoint: '/tags',
    body: {
      name: options.name,
      color: options.color || '#000000',
    },
  });

  if (response.status !== 201 && response.status !== 200) {
    throw new Error(`Failed to create tag: ${response.status} - ${response.text}`);
  }

  const data = response.data as { id: string; name: string; color: string };
  return data;
}

/**
 * Get all tags via API
 */
export async function getTags(page: Page): Promise<Array<{ id: string; name: string; color: string }>> {
  const response = await apiRequest(page, {
    method: 'GET',
    endpoint: '/tags',
  });

  if (response.status !== 200) {
    throw new Error(`Failed to get tags: ${response.status}`);
  }

  const data = response.data as Array<{ id: string; name: string; color: string }>;
  return data;
}

/**
 * Apply a tag to a conversation via API
 */
export async function applyTag(
  page: Page,
  conversationId: string,
  tagId: string
): Promise<void> {
  const response = await apiRequest(page, {
    method: 'POST',
    endpoint: `/conversations/${conversationId}/tags`,
    body: { tagId },
  });

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`Failed to apply tag: ${response.status}`);
  }
}

/**
 * Remove a tag from a conversation via API
 */
export async function removeTag(
  page: Page,
  conversationId: string,
  tagId: string
): Promise<void> {
  const response = await apiRequest(page, {
    method: 'DELETE',
    endpoint: `/conversations/${conversationId}/tags/${tagId}`,
  });

  if (response.status !== 200 && response.status !== 204) {
    throw new Error(`Failed to remove tag: ${response.status}`);
  }
}

/**
 * Get conversations via API
 */
export async function getConversations(
  page: Page,
  filters?: Record<string, string>
): Promise<Array<any>> {
  let endpoint = '/conversations';
  if (filters && Object.keys(filters).length > 0) {
    const queryString = new URLSearchParams(filters).toString();
    endpoint += `?${queryString}`;
  }

  const response = await apiRequest(page, {
    method: 'GET',
    endpoint,
  });

  if (response.status !== 200) {
    throw new Error(`Failed to get conversations: ${response.status}`);
  }

  const data = response.data as any;
  return Array.isArray(data) ? data : data.conversations || [];
}

/**
 * Get a specific conversation via API
 */
export async function getConversation(page: Page, conversationId: string): Promise<any> {
  const response = await apiRequest(page, {
    method: 'GET',
    endpoint: `/conversations/${conversationId}`,
  });

  if (response.status !== 200) {
    throw new Error(`Failed to get conversation: ${response.status}`);
  }

  return response.data;
}

/**
 * Assign a conversation via API
 */
export async function assignConversation(
  page: Page,
  conversationId: string,
  userId: string
): Promise<void> {
  const response = await apiRequest(page, {
    method: 'POST',
    endpoint: `/conversations/${conversationId}/assign`,
    body: { userId },
  });

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`Failed to assign conversation: ${response.status}`);
  }
}

/**
 * Create a note via API
 */
export async function createNote(
  page: Page,
  conversationId: string,
  body: string
): Promise<{ id: string; body: string }> {
  const response = await apiRequest(page, {
    method: 'POST',
    endpoint: `/conversations/${conversationId}/notes`,
    body: { body },
  });

  if (response.status !== 201 && response.status !== 200) {
    throw new Error(`Failed to create note: ${response.status}`);
  }

  return response.data as { id: string; body: string };
}

/**
 * Get notifications via API
 */
export async function getNotifications(page: Page): Promise<Array<any>> {
  const response = await apiRequest(page, {
    method: 'GET',
    endpoint: '/notifications',
  });

  if (response.status !== 200) {
    throw new Error(`Failed to get notifications: ${response.status}`);
  }

  const data = response.data as any;
  return Array.isArray(data) ? data : data.notifications || [];
}

/**
 * Mark a notification as read via API
 */
export async function markNotificationRead(page: Page, notificationId: string): Promise<void> {
  const response = await apiRequest(page, {
    method: 'PATCH',
    endpoint: `/notifications/${notificationId}`,
    body: { isRead: true },
  });

  if (response.status !== 200) {
    throw new Error(`Failed to mark notification as read: ${response.status}`);
  }
}

/**
 * Get audit logs via API
 */
export async function getAuditLogs(
  page: Page,
  filters?: Record<string, string>
): Promise<Array<any>> {
  let endpoint = '/audit-logs';
  if (filters && Object.keys(filters).length > 0) {
    const queryString = new URLSearchParams(filters).toString();
    endpoint += `?${queryString}`;
  }

  const response = await apiRequest(page, {
    method: 'GET',
    endpoint,
  });

  if (response.status !== 200) {
    throw new Error(`Failed to get audit logs: ${response.status}`);
  }

  const data = response.data as any;
  return Array.isArray(data) ? data : data.logs || [];
}

/**
 * Get routing rules via API
 */
export async function getRoutingRules(page: Page): Promise<Array<any>> {
  const response = await apiRequest(page, {
    method: 'GET',
    endpoint: '/routing-rules',
  });

  if (response.status !== 200) {
    throw new Error(`Failed to get routing rules: ${response.status}`);
  }

  const data = response.data as any;
  return Array.isArray(data) ? data : data.rules || [];
}

/**
 * Create a routing rule via API
 */
export async function createRoutingRule(
  page: Page,
  options: {
    name: string;
    priority: number;
    status?: string;
    conditions: Record<string, unknown>;
    actions: Record<string, unknown>;
  }
): Promise<{ id: string }> {
  const response = await apiRequest(page, {
    method: 'POST',
    endpoint: '/routing-rules',
    body: {
      name: options.name,
      priority: options.priority,
      status: options.status || 'active',
      conditions: options.conditions,
      actions: options.actions,
    },
  });

  if (response.status !== 201 && response.status !== 200) {
    throw new Error(`Failed to create routing rule: ${response.status}`);
  }

  return response.data as { id: string };
}

/**
 * Perform bulk action via API
 */
export async function bulkAction(
  page: Page,
  options: {
    conversationIds: string[];
    action: 'assign' | 'tag' | 'priority' | 'status';
    value: unknown;
  }
): Promise<{ successCount: number; failureCount: number; failures?: Array<any> }> {
  const response = await apiRequest(page, {
    method: 'POST',
    endpoint: '/conversations/bulk',
    body: {
      conversationIds: options.conversationIds,
      [options.action]: options.value,
    },
  });

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`Failed to perform bulk action: ${response.status}`);
  }

  return response.data as any;
}
