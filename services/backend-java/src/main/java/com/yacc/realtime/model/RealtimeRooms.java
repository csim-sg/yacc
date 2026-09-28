package com.yacc.realtime.model;

/**
 * Room-name builders for the three frozen room namespaces (MIG-050;
 * ADR-026; baseline capture facts in {@code .docs/migration/asyncapi.yaml}
 * info.description): {@code user:{userId}}, {@code conversation:{conversationId}},
 * {@code connector:{platform}}.
 *
 * <p>Room names are the registry's membership keys; builders keep every
 * join/emit site on the exact captured namespace format.</p>
 */
public final class RealtimeRooms {

    private static final String USER_PREFIX = "user:";
    private static final String CONVERSATION_PREFIX = "conversation:";
    private static final String CONNECTOR_PREFIX = "connector:";

    private RealtimeRooms() {
        // Static builders only.
    }

    /** Personal room joined at connect — targeted updates per user. */
    public static String user(String userId) {
        return USER_PREFIX + userId;
    }

    /** Conversation room joined via {@code subscribe.conversation}. */
    public static String conversation(String conversationId) {
        return CONVERSATION_PREFIX + conversationId;
    }

    /** Connector monitoring room joined via {@code connector.subscribe}. */
    public static String connector(String platform) {
        return CONNECTOR_PREFIX + platform;
    }
}
