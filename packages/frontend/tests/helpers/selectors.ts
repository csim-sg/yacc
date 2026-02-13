/**
 * Centralized test selector library
 * Ensure frontend components have corresponding data-testid attributes
 */

export const SELECTORS = {
  // Navigation & Layout
  navbar: '[data-testid="navbar"]',
  sidebar: '[data-testid="sidebar"]',
  userMenu: '[data-testid="user-menu"]',
  logoutButton: '[data-testid="logout-button"]',

  // Inbox
  inbox: {
    container: '[data-testid="inbox-container"]',
    conversationList: '[data-testid="conversation-list"]',
    conversationItem: '[data-testid="conversation-item"]',
    filterButton: '[data-testid="filter-button"]',
    searchInput: '[data-testid="search-input"]',
    bulkSelectCheckbox: '[data-testid="bulk-select-checkbox"]',
    bulkActionButton: '[data-testid="bulk-action-button"]',
    emptyState: '[data-testid="inbox-empty-state"]',
  },

  // Conversation Detail
  conversation: {
    container: '[data-testid="conversation-detail"]',
    title: '[data-testid="conversation-title"]',
    status: '[data-testid="conversation-status"]',
    messages: '[data-testid="message-list"]',
    messageItem: '[data-testid="message-item"]',
    compose: '[data-testid="message-compose"]',
    composeInput: '[data-testid="compose-input"]',
    sendButton: '[data-testid="send-button"]',
  },

  // Tags
  tags: {
    panel: '[data-testid="tags-panel"]',
    createButton: '[data-testid="create-tag-button"]',
    tagItem: '[data-testid="tag-item"]',
    applyButton: '[data-testid="apply-tag-button"]',
    removeButton: '[data-testid="remove-tag-button"]',
    colorPicker: '[data-testid="color-picker"]',
    nameInput: '[data-testid="tag-name-input"]',
    modal: '[data-testid="tag-modal"]',
  },

  // Notes
  notes: {
    panel: '[data-testid="notes-panel"]',
    createButton: '[data-testid="create-note-button"]',
    noteItem: '[data-testid="note-item"]',
    noteContent: '[data-testid="note-content"]',
    composeArea: '[data-testid="note-compose"]',
    composeInput: '[data-testid="note-input"]',
    submitButton: '[data-testid="note-submit"]',
    editButton: '[data-testid="note-edit"]',
    deleteButton: '[data-testid="note-delete"]',
    mentionHighlight: '[data-testid="mention-highlight"]',
  },

  // Assignments
  assignments: {
    panel: '[data-testid="assignments-panel"]',
    assignButton: '[data-testid="assign-button"]',
    assigneeSelect: '[data-testid="assignee-select"]',
    assigneeItem: '[data-testid="assignee-item"]',
    clearButton: '[data-testid="clear-assignment"]',
    unassignedBadge: '[data-testid="unassigned-badge"]',
  },

  // Notifications
  notifications: {
    center: '[data-testid="notification-center"]',
    badge: '[data-testid="notification-badge"]',
    list: '[data-testid="notification-list"]',
    item: '[data-testid="notification-item"]',
    unread: '[data-testid="notification-unread"]',
    readButton: '[data-testid="mark-read-button"]',
    dismissButton: '[data-testid="dismiss-button"]',
    markAllReadButton: '[data-testid="mark-all-read"]',
    emptyState: '[data-testid="notifications-empty"]',
  },

  // Routing Rules
  routingRules: {
    panel: '[data-testid="routing-rules-panel"]',
    list: '[data-testid="rules-list"]',
    createButton: '[data-testid="create-rule-button"]',
    ruleItem: '[data-testid="rule-item"]',
    ruleStatus: '[data-testid="rule-status"]',
    editButton: '[data-testid="rule-edit"]',
    deleteButton: '[data-testid="rule-delete"]',
    conditionsInput: '[data-testid="conditions-input"]',
    actionsInput: '[data-testid="actions-input"]',
    priorityInput: '[data-testid="priority-input"]',
    modal: '[data-testid="rule-modal"]',
    executionLogs: '[data-testid="execution-logs"]',
  },

  // Audit Logs
  auditLogs: {
    container: '[data-testid="audit-logs-container"]',
    table: '[data-testid="audit-logs-table"]',
    filterButton: '[data-testid="audit-filter-button"]',
    exportButton: '[data-testid="export-button"]',
    row: '[data-testid="audit-row"]',
    actorFilter: '[data-testid="actor-filter"]',
    actionFilter: '[data-testid="action-filter"]',
    dateRangeFilter: '[data-testid="date-range-filter"]',
    emptyState: '[data-testid="audit-empty"]',
  },

  // Bulk Actions
  bulkActions: {
    toolbar: '[data-testid="bulk-actions-toolbar"]',
    assignSelect: '[data-testid="bulk-assign-select"]',
    tagSelect: '[data-testid="bulk-tag-select"]',
    statusSelect: '[data-testid="bulk-status-select"]',
    applyButton: '[data-testid="bulk-apply-button"]',
    cancelButton: '[data-testid="bulk-cancel"]',
    summary: '[data-testid="bulk-summary"]',
    successCount: '[data-testid="success-count"]',
    failureCount: '[data-testid="failure-count"]',
    failuresList: '[data-testid="failures-list"]',
  },

  // Auth
  auth: {
    loginForm: '[data-testid="login-form"]',
    emailInput: '[data-testid="email-input"]',
    passwordInput: '[data-testid="password-input"]',
    submitButton: '[data-testid="login-submit"]',
    forgotPasswordLink: '[data-testid="forgot-password-link"]',
    errorMessage: '[data-testid="error-message"]',
  },

  // Admin Panel
  admin: {
    container: '[data-testid="admin-container"]',
    usersTab: '[data-testid="users-tab"]',
    usersList: '[data-testid="users-list"]',
    userItem: '[data-testid="user-item"]',
    integrationsTab: '[data-testid="integrations-tab"]',
    rulesTab: '[data-testid="rules-tab"]',
  },

  // Dialogs & Modals
  dialog: {
    overlay: '[data-testid="dialog-overlay"]',
    content: '[data-testid="dialog-content"]',
    closeButton: '[data-testid="dialog-close"]',
    confirmButton: '[data-testid="dialog-confirm"]',
    cancelButton: '[data-testid="dialog-cancel"]',
  },

  // Filters
  filters: {
    container: '[data-testid="filter-container"]',
    channelFilter: '[data-testid="channel-filter"]',
    statusFilter: '[data-testid="status-filter"]',
    tagFilter: '[data-testid="tag-filter"]',
    assigneeFilter: '[data-testid="assignee-filter"]',
    priorityFilter: '[data-testid="priority-filter"]',
    clearButton: '[data-testid="clear-filters"]',
  },

  // Loading & States
  loading: '[data-testid="loading-spinner"]',
  skeleton: '[data-testid="skeleton"]',
  error: '[data-testid="error-message"]',
  success: '[data-testid="success-message"]',
  empty: '[data-testid="empty-state"]',
} as const;

/**
 * Get selector by path (e.g., 'tags.createButton')
 */
export function getSelector(path: keyof typeof SELECTORS | string): string {
  const parts = path.toString().split('.');
  let current: any = SELECTORS;

  for (const part of parts) {
    if (part in current) {
      current = current[part];
    } else {
      throw new Error(`Selector not found: ${path}`);
    }
  }

  if (typeof current !== 'string') {
    throw new Error(`Invalid selector: ${path}`);
  }

  return current;
}
