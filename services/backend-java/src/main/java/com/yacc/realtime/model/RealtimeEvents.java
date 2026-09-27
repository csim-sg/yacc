package com.yacc.realtime.model;

/**
 * The frozen real-time wire event names (MIG-050; ADR-023/ADR-026).
 *
 * <p>Exactly the 23 canonical constants frozen by MIG-003
 * ({@code .docs/migration/asyncapi.yaml} §4.2 — the union of the 20 contract
 * constants and the 3 backend-only runtime constants). Wire name = contract
 * name; no runtime mapping layer exists. The source of truth is the frozen
 * AsyncAPI document — never edit a literal here without a recorded
 * contract-change decision against {@code contract-canonicalization.md}.</p>
 *
 * <p>Constants are declared in one place so every emit/subscription site
 * compiles against the frozen surface; the ledger dispositions (which events
 * are wired by which milestone) are unchanged by this class.</p>
 */
public final class RealtimeEvents {

    // --- Conversation (contract constants) ---
    public static final String CONVERSATION_UPDATED = "conversation.updated";
    public static final String CONVERSATION_REOPENED = "conversation.reopened";

    // --- Message (contract constants) ---
    public static final String MESSAGE_RECEIVED = "message.received";
    public static final String MESSAGE_SENT = "message.sent";
    public static final String MESSAGE_FAILED = "message.failed";

    // --- Notification (contract constants; deleted/read/dismissed are
    // retained-no-emitter dispositions — the target emits nothing for them) ---
    public static final String NOTIFICATION_RECEIVED = "notification.received";
    public static final String NOTIFICATION_DELETED = "notification.deleted";
    public static final String NOTIFICATION_READ = "notification.read";
    public static final String NOTIFICATION_DISMISSED = "notification.dismissed";

    // --- Presence (contract constants) ---
    public static final String PRESENCE_UPDATED = "presence.updated";
    public static final String TYPING_STARTED = "typing.started";
    public static final String TYPING_STOPPED = "typing.stopped";
    public static final String USER_ONLINE = "user.online";
    public static final String USER_OFFLINE = "user.offline";

    // --- System (contract constants; raw baseline literals retired by
    // MIG-003 §4.3: connection.established → SYSTEM_CONNECTION_ESTABLISHED,
    // error → SYSTEM_ERROR) ---
    public static final String SYSTEM_CONNECTION_ESTABLISHED = "system.connection.established";
    public static final String SYSTEM_RECONNECTION_STARTED = "system.reconnection.started";
    public static final String SYSTEM_RECONNECTION_FAILED = "system.reconnection.failed";
    public static final String SYSTEM_HEARTBEAT = "system.heartbeat";
    public static final String SYSTEM_ERROR = "system.error";
    public static final String SYSTEM_BACKLOG_REPLAY_STARTED = "system.backlog.replay.started";
    public static final String SYSTEM_BACKLOG_REPLAY_COMPLETED = "system.backlog.replay.completed";

    // --- Backend-only runtime constants (frozen into the canonical set) ---
    public static final String MESSAGE_RETRY_SCHEDULED = "message.retry.scheduled";
    public static final String QUEUE_MESSAGE_DLQ = "queue.message.dlq";

    // --- Baseline raw room-subscription acknowledgement literals (frozen
    // channels of the AsyncAPI document; ack payloads per their schemas) ---
    public static final String CONVERSATION_SUBSCRIBED = "conversation.subscribed";
    public static final String CONVERSATION_UNSUBSCRIBED = "conversation.unsubscribed";
    public static final String CONNECTOR_SUBSCRIBED = "connector.subscribed";
    public static final String CONNECTOR_UNSUBSCRIBED = "connector.unsubscribed";

    // --- Inbound (client → server) room-subscription channel names ---
    public static final String SUBSCRIBE_CONVERSATION = "subscribe.conversation";
    public static final String UNSUBSCRIBE_CONVERSATION = "unsubscribe.conversation";
    public static final String CONNECTOR_SUBSCRIBE = "connector.subscribe";
    public static final String CONNECTOR_UNSUBSCRIBE = "connector.unsubscribe";

    private RealtimeEvents() {
        // Constants only.
    }
}
