package com.yacc.realtime.model;

/**
 * The authenticated real-time session identity (MIG-050; ADR-026; WS-BHV-016).
 *
 * <p>Attached at handshake by the auth interceptor before session
 * establishment — the same attached surface as the baseline auth middleware
 * ({@code userId}/{@code email}/{@code role}/{@code name}, ledger WS-BHV-016).
 * {@code role} is the lowercase wire label (frozen contract vocabulary);
 * {@code sessionId} is the transport session id used as the registry key
 * within the (userId, conversationId) membership index (ADR-026).</p>
 *
 * @param sessionId transport session id (registry key)
 * @param userId    authenticated user id
 * @param email     authenticated email
 * @param role      lowercase wire role label (user/admin/manager/super_admin)
 * @param name      display name
 */
public record RealtimeSession(
        String sessionId,
        String userId,
        String email,
        String role,
        String name) {
}
