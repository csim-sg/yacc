# Generic Connector Architecture Design

## 1. Overview
This design introduces a generic `IConnector` interface and a central `ConnectorManager` to decouple platform-specific logic from the core application. This allows YACC to support multiple platforms (IRC, Telegram, etc.) through a unified API and event system.

## 2. Architecture Components

### 2.1 The IConnector Interface
The contract that all platform integrations must implement.

```typescript
import { EventEmitter } from 'events';
import { z } from 'zod';

// Capability flags for UI adaptation
export interface ConnectorCapabilities {
  hasAttachments: boolean;
  hasThreads: boolean;      // Can reply to specific message ID
  hasChannelList: boolean;  // Can list/join channels dynamically
  hasWebhooks: boolean;     // Supports webhook ingestion
  maxMessageLength: number;
}

// Standardized Inbound Message (The Event Payload)
export interface StandardizedMessage {
  id: string;              // Platform message ID
  platform: string;        // 'irc', 'telegram'
  
  conversation: {
    id: string;            // Platform channel/chat ID
    name: string;          // Human readable name
    isPrivate: boolean;    // True if DM
    metadata?: Record<string, any>; // Extra context
  };
  
  sender: {
    id: string;            // Platform user ID
    name: string;          // Display name
    isSelf: boolean;       // True if sent by the connector itself
    avatarUrl?: string;
  };
  
  content: string;         // Text content
  attachments?: Array<{
    type: 'image' | 'video' | 'file';
    url: string;
    mimeType?: string;
    name?: string;
    size?: number;
  }>;
  
  replyToMessageId?: string;
  raw: unknown;            // Original raw event for debugging
  receivedAt: Date;
}

// Outbound Options
export interface MessageOptions {
  replyToMessageId?: string;
  attachments?: Array<{
    url: string;
    mimeType: string;
    filename: string;
  }>;
}

// The Interface
export interface IConnector extends EventEmitter {
  readonly platformName: string;
  readonly configSchema: z.ZodSchema; // For Admin UI
  readonly capabilities: ConnectorCapabilities;

  // Lifecycle
  setConfig(config: unknown): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Actions
  sendMessage(
    externalConversationId: string, 
    content: string, 
    options?: MessageOptions
  ): Promise<{ 
    success: boolean; 
    messageId?: string; 
    error?: string; 
  }>;

  // Webhook Support (Optional)
  handleWebhook?(
    payload: unknown, 
    headers?: Record<string, string | string[]>
  ): Promise<void>;

  // Events
  on(event: 'message', listener: (payload: StandardizedMessage) => void): this;
  on(event: 'status_change', listener: (status: string) => void): this;
}
```

### 2.2 The ConnectorManager Service
The central orchestrator that manages connector instances and routes traffic.

```typescript
export class ConnectorManager {
  private connectors: Map<string, IConnector> = new Map();

  // Registry of available connector classes
  private registry: Record<string, new () => IConnector> = {
    irc: IRCConnector,
    telegram: TelegramConnector,
  };

  /**
   * Initialize all enabled connectors from DB config
   */
  async initialize() {
    // 1. Load configs from DB
    // 2. Instantiate connectors
    // 3. Subscribe to events
    // 4. Connect
  }

  /**
   * Unified Send Method
   */
  async sendMessage(conversationId: string, content: string, options?: MessageOptions) {
    // 1. Get Conversation from DB
    // 2. Resolve Platform (e.g. 'irc')
    // 3. Get Connector instance
    // 4. Delegate to connector
  }

  /**
   * Handle Inbound Message Event
   */
  private async handleInboundMessage(payload: StandardizedMessage) {
    // 1. Normalize data
    // 2. Call GenericIngestionService (replaces ircIngestionService)
    // 3. Emit WebSocket event
  }
}
```

### 2.3 Refactoring Plan
1.  **Create Interface:** Define `IConnector` and `StandardizedMessage` in `@yacc/common` or `backend/types`.
2.  **Refactor BaseConnector:** Update `BaseConnector` to implement `IConnector`.
3.  **Update IRCConnector:**
    *   Implement `IConnector`.
    *   Remove `ircIngestionService` import.
    *   Update `on('message')` to emit `StandardizedMessage`.
4.  **Create ConnectorManager:** Implement the manager service.
5.  **Create GenericIngestionService:** A single service to handle DB upserts for *any* platform.
6.  **Update Controllers:** Switch to using `ConnectorManager` for all message sending.

## 3. Data Flow
**Inbound:**
`Platform` -> `Connector` (Normalizes) -> `ConnectorManager` (Event) -> `GenericIngestionService` -> `DB`

**Outbound:**
`API` -> `ConnectorManager` (Resolves Platform) -> `Connector` -> `Platform`

## 4. Benefits
*   **Decoupling:** Connectors don't know about DB or Services.
*   **Extensibility:** Adding a new platform just means implementing `IConnector`.
*   **Consistency:** All platforms share the same ingestion pipeline.
*   **Maintainability:** One place to fix ingestion logic (`GenericIngestionService`).
