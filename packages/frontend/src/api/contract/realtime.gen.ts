/**
 * GENERATED contract types — single frontend contract source (MIG-041; ADR-023).
 * Source of truth: the frozen canonical contracts in `.docs/migration/`.
 * Do not edit by hand — regenerate with `pnpm --filter @yacc/frontend contract:gen`.
 */

export type paths = Record<string, never>;
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * conversation.updated payload
         * @description SPEC-002 MIG-002 capture @98db628. Baseline: ConversationUpdatedPayloadSchema in packages/backend/src/types/websocket.types.ts:18.
         */
        "conversation-updated": {
            /** Format: uuid */
            conversationId: string;
            /** @description Fields that changed */
            updatedFields: {
                [key: string]: unknown;
            };
            /** Format: uuid */
            changedBy: string;
            /** Format: date-time */
            changedAt: string;
        };
        /**
         * WebSocket event envelope
         * @description SPEC-002 MIG-002 capture @98db628. Envelope applied ONLY by wsGateway emit paths (websockets/gateway.ts:73,107,145,178): {event, data, timestamp}. Socket-controller emits bypass it (bare payloads). Preserved verbatim per ADR-026.
         */
        envelope: {
            /**
             * @description Event name (dot notation), e.g. message.sent, notification.received
             * @example message.sent
             * @example notification.received
             * @example message.retry.scheduled
             */
            event: string;
            /** @description Event payload; conforms to the event-specific schema */
            data: unknown;
            /**
             * Format: date-time
             * @description ISO 8601 timestamp set at emit time (new Date().toISOString())
             */
            timestamp: string;
        };
        /**
         * message.failed payload
         * @description SPEC-002 MIG-002 capture @98db628. Baseline: MessageFailedPayloadSchema in packages/backend/src/types/websocket.types.ts:43.
         */
        "message-failed": {
            /** Format: uuid */
            messageId: string;
            /** Format: uuid */
            conversationId: string;
            /** @constant */
            status: "failed";
            error: string;
            /** Format: date-time */
            retryAt: string;
            attempt: number;
        };
        /**
         * message.received payload
         * @description SPEC-002 MIG-002 capture @98db628. Baseline: MessageReceivedPayloadSchema in packages/backend/src/types/websocket.types.ts:29 (also matches connector.controller broadcast shape).
         */
        "message-received": {
            /** Format: uuid */
            messageId: string;
            /** Format: uuid */
            conversationId: string;
            /** @enum {string} */
            platform: "telegram" | "irc";
            /** @description Platform sender identifier (Telegram user ID or IRC nick) */
            senderId: string;
            senderName: string;
            body: string;
            /** Format: date-time */
            timestamp: string;
            attachments?: {
                /** Format: uri */
                url: string;
                type: string;
                name: string;
            }[];
        };
        /**
         * message.sent payload
         * @description SPEC-002 MIG-002 capture @98db628. Baseline: MessageSentPayloadSchema in packages/backend/src/types/websocket.types.ts:25.
         */
        "message-sent": {
            /** Format: uuid */
            messageId: string;
            /** Format: uuid */
            conversationId: string;
            /** @constant */
            status: "sent";
            /** Format: date-time */
            sentAt: string;
        };
        /**
         * notification payload
         * @description SPEC-002 MIG-002 capture @98db628. Baseline: NotificationPayload in packages/common/src/websocket/types/NotificationPayload.type.ts (contract type for notification.received/read/deleted).
         */
        notification: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            userId: string;
            /** @enum {string} */
            type: "assignment" | "mention" | "system";
            /** Format: uuid */
            conversationId: string;
            actorId: string;
            actorName: string;
            message: string;
            isRead: boolean;
            /** Format: date-time */
            createdAt: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        /**
         * presence.updated payload (canonical)
         * @description SPEC-002 MIG-003 canonicalization @98db628 (from MIG-002 capture). Canonical shape = PresenceUpdatedPayloadSchema (packages/backend/src/types/websocket.types.ts:101), emitted by 3 of the 4 baseline emit paths. MIG-003 resolution (contract-canonicalization.md §4.5): ALL outbound presence.updated emissions — including the websocket.server.ts disconnect broadcast, whose divergent {userId, isOnline, timestamp} variant is retired — use exactly this shape, inside the {event,data,timestamp} envelope. The @yacc/common PresencePayload consumer type (userName/lastSeenAt/typingIn/'away') is not wire truth; the frontend reconciles to this canonical shape in MIG-052.
         */
        "presence-updated": {
            /** Format: uuid */
            userId: string;
            /** @enum {string} */
            status: "online" | "offline";
            /** Format: date-time */
            lastSeen: string;
        };
        /**
         * reaction.added payload
         * @description SPEC-002 MIG-002 capture @98db628. Baseline: ReactionAddedPayloadSchema in packages/backend/src/types/websocket.types.ts:100.
         */
        "reaction-added": {
            /** Format: uuid */
            messageId: string;
            /** Format: uuid */
            conversationId: string;
            /** @description Emoji codepoint */
            emoji: string;
            /** Format: uuid */
            userId: string;
            name: string;
        };
        /**
         * reaction.removed payload
         * @description SPEC-002 MIG-002 capture @98db628. Baseline: ReactionRemovedPayloadSchema in packages/backend/src/types/websocket.types.ts:112.
         */
        "reaction-removed": {
            /** Format: uuid */
            messageId: string;
            /** Format: uuid */
            conversationId: string;
            emoji: string;
            /** Format: uuid */
            userId: string;
        };
        /**
         * system payload
         * @description SPEC-002 MIG-002 capture @98db628. Baseline: SystemPayload in packages/common/src/websocket/types/SystemPayload.type.ts (contract type for the 7 SystemEvents constants).
         */
        "system-payload": {
            /** @enum {string} */
            type: "heartbeat" | "connection_established" | "reconnection" | "error" | "backlog_replay";
            /** Format: date-time */
            timestamp: string;
            data?: {
                [key: string]: unknown;
            };
            /** @description Present when type is 'error' */
            error?: {
                code: string;
                message: string;
            };
        };
        /**
         * typing.started payload
         * @description SPEC-002 MIG-002 capture @98db628. Baseline: TypingStartedPayloadSchema in packages/backend/src/types/websocket.types.ts:56.
         */
        "typing-started": {
            /** Format: uuid */
            conversationId: string;
            /** Format: uuid */
            userId: string;
            name: string;
        };
        /**
         * typing.stopped payload
         * @description SPEC-002 MIG-002 capture @98db628. Baseline: TypingStoppedPayloadSchema in packages/backend/src/types/websocket.types.ts:68 (typing.timeout handler emits {conversationId, userId} — same fields).
         */
        "typing-stopped": {
            /** Format: uuid */
            conversationId: string;
            /** Format: uuid */
            userId: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
