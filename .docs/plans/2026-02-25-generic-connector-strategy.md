# Design: Generic Connector Strategy

## 1. Overview
This design introduces a generic, plugin-based architecture for external platform integrations (Connectors). It decouples platform-specific logic from the core system, enabling easier addition of new platforms (e.g., Discord, WhatsApp) and cleaner maintenance of existing ones (IRC, Telegram).

## 2. Problem Statement
Currently, connectors (like `IRCConnector`) are tightly coupled to the `ircIngestionService`. This means the connector implementation "knows" about business logic (database upserts, user creation). This violates the separation of concerns and makes it hard to test connectors in isolation or swap them out.

## 3. Goals
- **Decoupling**: Connectors should not import services. They should emit standardized events.
- **Generic Interface**: A single `IConnector` interface that all platforms implement.
- **Normalization**: Connectors transform platform-specific payloads into a `StandardizedMessage` format.
- **Capability Discovery**: Connectors declare their features (attachments, threads, etc.) via a `capabilities` object.
- **Configuration**: Connectors provide a Zod schema for their configuration, allowing dynamic UI generation.

## 4. Architecture

### 4.1. The Connector Interface (`IConnector`)
The core contract for all integrations.

```typescript
import { z } from 'zod';
import { EventEmitter } from 'events';

export interface ConnectorCapabilities {
  hasAttachments: boolean;
  hasThreads: boolean;
  hasChannelList: boolean;
  hasWebhooks: boolean;
}

export interface StandardizedMessage {
  id: string;              // Platform message ID
  platform: string;        // 'irc', 'telegram'
  conversation: {
    id: string;            // Channel/Chat ID
    name: string;          // Human readable name
    isPrivate: boolean;
    metadata?: Record<string, any>;
  };
  sender: {
    id: string;            // User ID
    name: string;
    isSelf: boolean;
    avatarUrl?: string;
  };
  content: string;
  attachments?: Array<{
    type: 'image' | 'video' | 'file';
    url: string;
    mimeType?: string;
    name?: string;
    size?: number;
  }>;
  replyToMessageId?: string;
  receivedAt: Date;
  raw: unknown;            // Original payload for debugging
}

export interface MessageOptions {
  replyToMessageId?: string;
  attachments?: Array<{
    url: string;
    mimeType: string;
    filename: string;
  }>;
}

export interface IConnector extends EventEmitter {
  // Metadata
  readonly platformName: string;
  readonly configSchema: z.ZodSchema;
  readonly capabilities: ConnectorCapabilities;

  // Lifecycle
  setConfig(config: unknown): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Actions
  sendMessage(
    conversationId: string, 
    content: string, 
    options?: MessageOptions
  ): Promise<Result>;

  // Webhook Support (Optional)
  handleWebhook?(
    payload: unknown, 
    headers?: Record<string, string | string[]>
  ): Promise<void>;

  // Events
  on(event: 'message', listener: (payload: StandardizedMessage) => void): this;
  on(event: 'status_change', listener: (status: ConnectorStatus) => void): this;
}
```

### 4.2. The Manager (`ConnectorManager`)
A service that manages the lifecycle of connectors.
- Loads connectors from a registry.
- Subscribes to `message` events from all active connectors.
- Routes outbound messages to the correct connector instance.
- Exposes a `handleWebhook(platform, payload)` method for the API layer.

### 4.3. Data Flow (Inbound)
1. **Platform** -> (Socket/Webhook) -> **Connector**
2. **Connector** normalizes data -> `StandardizedMessage`
3. **Connector** emits `message` event.
4. **ConnectorManager** receives event -> calls **IngestionService**.
5. **IngestionService** (Generic) handles DB upsert, user creation, etc.

### 4.4. Data Flow (Outbound)
1. **API/User** calls `sendMessage(conversationId, content)`.
2. **Service** resolves `conversationId` to `platform` and `externalId`.
3. **Service** calls `ConnectorManager.sendMessage(platform, externalId, content)`.
4. **ConnectorManager** finds connector instance -> calls `connector.sendMessage()`.
5. **Connector** transforms request to platform-specific API call.

## 5. Implementation Plan

### Phase 1: Core Infrastructure
1. Define `IConnector`, `StandardizedMessage`, `ConnectorCapabilities` interfaces in `packages/backend/src/connectors/types`.
2. Create `ConnectorManager` service.
3. Create `GenericIngestionService` (refactoring `ircIngestionService` logic to be generic).

### Phase 2: Refactor IRC Connector
1. Update `IRCConnector` to implement `IConnector`.
2. Remove `ircIngestionService` dependency.
3. Implement `StandardizedMessage` transformation.
4. Move `IRCConfig` validation to Zod schema.

### Phase 3: Webhook Support (for Telegram)
1. Add `handleWebhook` to `IConnector`.
2. Create `WebhookController` in `packages/backend/src/controllers`.
3. Route `POST /api/webhooks/:platform` to `ConnectorManager`.

## 6. Security Considerations
- **Webhooks**: Connectors must validate signatures (e.g., HMAC) inside `handleWebhook`.
- **Sanitization**: Connectors must sanitize input before normalization (e.g., stripping HTML if needed).
- **Secrets**: Configuration containing secrets (tokens) must be handled securely (env vars or encrypted DB storage).
