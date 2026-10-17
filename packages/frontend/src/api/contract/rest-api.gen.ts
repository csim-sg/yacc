/**
 * GENERATED contract types — single frontend contract source (MIG-041; ADR-023).
 * Source of truth: the frozen canonical contracts in `.docs/migration/`.
 * Do not edit by hand — regenerate with `pnpm --filter @yacc/frontend contract:gen`.
 */

export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Full health check with dependencies and SLOs (public, no auth)
         * @description @All('/') route — responds to any HTTP method. Checks PostgreSQL, Redis, R2 in parallel.
         */
        get: operations["getHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Liveness probe (public, no auth)
         * @description @All('/live') route — responds to any HTTP method. Process-alive check only.
         */
        get: operations["getHealthLive"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Readiness probe (public, no auth)
         * @description @All('/ready') route — responds to any HTTP method. 200 when all dependencies up, 503 otherwise.
         */
        get: operations["getHealthReady"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/forgot-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Request password reset (public; always 200 to prevent enumeration; rate limited) */
        post: operations["authForgotPassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/reset-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reset password with token (public; rate limited) */
        post: operations["authResetPassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/verify-email": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm an email address with the emailed token (public; MIG-031 deviation)
         * @description MIG-031 email-verification confirmation. The challenge is issued on
         *     self-registration (sign-up) as a single-use, expiring 256-bit email
         *     token; this endpoint consumes it (replay-safe by deletion), flips
         *     `email_verified`, and audit-logs the event. Baseline lived inside the
         *     BetterAuth wildcard (REST-AUTH-004); recorded per the MIG-031
         *     contract-change note in this file's header.
         */
        post: operations["authVerifyEmail"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/oidc/authorization/{registrationId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Start the OIDC relying-party login (public; config-gated MIG-032 deviation)
         * @description MIG-032 OIDC RP login entry. Builds the authorization-code request
         *     (state + PKCE-grade nonce binding) and redirects the browser to the
         *     configured IdP's authorization endpoint. The registration id names a
         *     config-driven client registration (`yacc.auth.oauth2.registrations.*`,
         *     no hard-coded IdP); an unknown id is denied outright. The redirect
         *     handed to the IdP carries
         *     `redirect_uri={baseUrl}/api/auth/oidc/callback/{registrationId}`.
         */
        get: operations["authOidcAuthorization"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/oidc/callback/{registrationId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * OIDC relying-party callback — code exchange, explicit linking, session issuance (public; config-gated MIG-032 deviation)
         * @description MIG-032 RP callback. Exchanges the authorization code (ID token
         *     validated for signature via the IdP JWKS, issuer, audience, timestamps,
         *     and the nonce binding), then resolves the YACC identity with explicit
         *     account linking: existing link → sign in; verified e-mail match →
         *     explicit `account` link row (audit `user.oidc.linked`); otherwise a
         *     new USER-role identity with an unusable local credential is
         *     provisioned and linked (audit `user.oidc.provisioned`). Status is
         *     enforced — inactive/suspended matches are denied and never linked.
         *     Success answers the canonical AuthSessionResponse (refresh grant +
         *     stateless RS256 access token); every failure denies with the frozen
         *     401 `{error}` body (anti-enumeration; reasons stay in the audit
         *     trail).
         */
        get: operations["authOidcCallback"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/sign-in/email": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Email/password sign-in (public; rate limited)
         * @description Canonical sign-in. Baseline delegated to BetterAuth; the Java target implements
         *     this endpoint via Spring Security (ADR-025). Response DTO canonicalized in MIG-003
         *     (ledger row REST-AUTH-003): `{user, accessToken, refreshToken}`; token
         *     claims/lifecycle are ADR-025/MIG-033 implementation detail.
         */
        post: operations["authSignInEmail"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/sign-up/email": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Self-registration (public; creates USER role only)
         * @description Canonical self-registration (SPEC-002 FR-04/AC-11). Replaces the baseline
         *     BetterAuth wildcard sub-path `sign-up/email` (ledger row REST-AUTH-004) with an
         *     explicit endpoint per ADR-025. The request accepts NO role field; the created user
         *     is always `role: user`. Privileged user/role management stays super_admin-only
         *     (`POST /api/users`).
         */
        post: operations["authSignUpEmail"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/sign-out": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign out (authenticated)
         * @description Canonical sign-out. Replaces the baseline BetterAuth wildcard sub-path `sign-out`
         *     (ledger row REST-AUTH-004). Invalidates the presented grant per ADR-025 token
         *     lifecycle; with stateless JWT access tokens this is an acknowledgment + refresh
         *     revocation.
         */
        post: operations["authSignOut"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/get-session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Current session user (authenticated)
         * @description Canonical session lookup. Replaces the baseline BetterAuth wildcard sub-path
         *     `get-session` (ledger row REST-AUTH-004). Returns the user resolved from the
         *     Bearer access token; there is no server-side session object in the canonical
         *     stateless model (ADR-025).
         */
        get: operations["authGetSession"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/refresh-token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Refresh access token (public; refresh-grant rotation)
         * @description Canonical token refresh. Replaces the baseline BetterAuth wildcard sub-path
         *     `refresh-token` (ledger row REST-AUTH-004). Implements the ADR-025 refresh grant
         *     (stateless JWT access + refresh default) with rotation.
         */
        post: operations["authRefreshToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/change-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Replace the credential (authenticated; MIG-030 contract-change finding)
         * @description Authenticated password change that clears the ADR-025 forced-password-change
         *     state of the bootstrap/recovery identity (MIG-030). The current credential is
         *     verified; every refresh grant of the identity is revoked on success. MIG-031's
         *     email-token reset/verification flows are separate and unchanged.
         */
        post: operations["authChangePassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List users (super_admin only) — BaseListResponse */
        get: operations["listUsers"];
        put?: never;
        /** Create user (super_admin only) */
        post: operations["createUser"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update user (super_admin only; self role/status change prevented) */
        put: operations["updateUser"];
        post?: never;
        /** Soft-delete user (super_admin only; self-deletion prevented) */
        delete: operations["deleteUser"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/users/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List role definitions (any authenticated user) */
        get: operations["listUserRoles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conversations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List conversations with filters — BaseListResponse (any authenticated user)
         * @description Path registered with trailing slash in controller (@Get('/')); routed as /api/conversations.
         */
        get: operations["listConversations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conversations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get conversation by ID (any authenticated user) */
        get: operations["getConversation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conversations/{id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update conversation status (admin/manager/super_admin; audit-logged) */
        patch: operations["updateConversationStatus"];
        trace?: never;
    };
    "/api/conversations/{id}/priority": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update conversation priority (manager/admin/super_admin; audit-logged) */
        patch: operations["updateConversationPriority"];
        trace?: never;
    };
    "/api/conversations/{id}/assign": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Assign conversation to user (admin/super_admin; audit-logged) */
        patch: operations["assignConversationByPatch"];
        trace?: never;
    };
    "/api/conversations/{conversationId}/assign": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Assign conversation via POST (manager+; in-code RBAC check) */
        post: operations["assignConversationByPost"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conversations/bulk": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Bulk assign/tag/status on up to 100 conversations (manager+; best-effort, partial success returned) */
        post: operations["bulkActionConversations"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conversations/{conversationId}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List messages in a conversation (any authenticated user) — custom shape (not BaseListResponse) */
        get: operations["getConversationMessages"];
        put?: never;
        /** Send a message (roles user/manager/admin/super_admin) */
        post: operations["sendConversationMessage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conversations/{conversationId}/messages/{messageId}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Manual retry of a failed message (all roles if assigned; exactly once per message) */
        post: operations["retryConversationMessage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conversations/{conversationId}/messages/{messageId}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get status of a specific message (any authenticated user) */
        get: operations["getConversationMessageStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conversations/{conversationId}/notes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List notes for a conversation — BaseListResponse (any authenticated user) */
        get: operations["listConversationNotes"];
        put?: never;
        /** Create note with mention parsing (any authenticated user) */
        post: operations["createConversationNote"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List all tags (any authenticated user) */
        get: operations["listTags"];
        put?: never;
        /** Create a tag (any authenticated user; GOV-021) */
        post: operations["createTag"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conversations/{id}/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Add tag to conversation (any authenticated user with conversation access; GOV-021) */
        post: operations["addTagToConversation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conversations/{id}/tags/{tagId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Remove tag from conversation (any authenticated user with conversation access; GOV-021) */
        delete: operations["removeTagFromConversation"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/routing-rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List routing rules (manager+) — BaseListResponse without pagination (total as limit) */
        get: operations["listRoutingRules"];
        put?: never;
        /** Create routing rule (admin+) */
        post: operations["createRoutingRule"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/routing-rules/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete routing rule (admin+) */
        delete: operations["deleteRoutingRule"];
        options?: never;
        head?: never;
        /** Update routing rule (admin+) */
        patch: operations["updateRoutingRule"];
        trace?: never;
    };
    "/api/routing-rules/{id}/executions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Query rule execution logs (manager+) */
        get: operations["getRoutingRuleExecutions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List current user's notifications — BaseListResponse (own notifications only) */
        get: operations["listNotifications"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/notifications/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Dismiss own notification */
        delete: operations["dismissNotification"];
        options?: never;
        head?: never;
        /** Mark own notification read/unread */
        patch: operations["markNotificationRead"];
        trace?: never;
    };
    "/api/notifications/mark-all-read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Mark all own notifications read */
        post: operations["markAllNotificationsRead"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conversations/{conversationId}/audit-logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Audit logs for one conversation (manager+) */
        get: operations["getConversationAuditLogs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audit-logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Query audit logs with filters — BaseListResponse (manager+) */
        get: operations["queryAuditLogs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audit-logs/conversations/{conversationId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Audit logs where entityId = conversationId — BaseListResponse (manager+) */
        get: operations["queryConversationAuditLogs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/audit-logs/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Export audit logs as CSV/JSON download (admin+) */
        post: operations["exportAuditLogs"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/dlq": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List DLQ entries (manager+) — custom shape */
        get: operations["listDlqEntries"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/dlq/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** DLQ statistics counts by failure reason etc. (manager+) */
        get: operations["getDlqStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/dlq/{id}/re-queue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Move DLQ entry back to retry queue (admin+) */
        post: operations["reQueueDlqEntry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/dlq/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Remove DLQ entry after ops review (super_admin only) */
        delete: operations["removeDlqEntry"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/queue/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Queue statistics (manager+) */
        get: operations["getQueueStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/queue/dlq": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Dead-letter queue entries with pagination (manager+) */
        get: operations["getQueueDlqEntries"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/queue/retry/{messageId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Retry a queued/failed message by ID (manager+) */
        post: operations["retryQueuedMessage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/queue/dlq/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Bulk retry DLQ entries by message IDs (manager+) */
        post: operations["bulkRetryDlq"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/queue/dlq/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** DLQ statistics (manager+) */
        get: operations["getQueueDlqStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/queue/job/{jobId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Job details by BullMQ job ID (manager+) */
        get: operations["getQueueJob"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/queue/dlq/clear/{messageId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Clear a DLQ entry (super_admin only) */
        post: operations["clearQueueDlqEntry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/queue/dlq/by-reason/{reason}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** DLQ entries filtered by failure reason (manager+) */
        get: operations["getQueueDlqByReason"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/integrations/irc/config": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Save IRC configuration (super_admin only; audit-logged) */
        post: operations["saveIrcConfig"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/integrations/irc/connect": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Manual connect using stored config (super_admin only; idempotent; body ignored)
         * @description 409 irc_not_configured when neither DB config nor env fallback exists.
         */
        post: operations["connectIrc"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/integrations/irc/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Test IRC connection without side effects (super_admin only; 10s hard timeout)
         * @description Body-first test; if body omitted entirely, uses stored config (DB else env → 409 if none).
         */
        post: operations["testIrcConnection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/integrations/irc/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** IRC connection status (admin+; works when unconfigured; no secrets exposed) */
        get: operations["getIrcStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/integrations/irc/profiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List IRC profiles (admin/manager/super_admin; in-code RBAC) */
        get: operations["listIrcProfiles"];
        put?: never;
        /** Create IRC profile (super_admin only; in-code RBAC) */
        post: operations["createIrcProfile"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/integrations/irc/profiles/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get IRC profile by numeric ID (admin/manager/super_admin) */
        get: operations["getIrcProfile"];
        /** Update IRC profile (super_admin only) */
        put: operations["updateIrcProfile"];
        post?: never;
        /** Delete IRC profile (super_admin only) */
        delete: operations["deleteIrcProfile"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/integrations/irc/profiles/{id}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Activate profile (single active profile policy; super_admin only) */
        post: operations["activateIrcProfile"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/integrations/irc/profiles/{id}/disable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Disable profile (super_admin only) */
        post: operations["disableIrcProfile"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/integrations/irc/profiles/{id}/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Test stored profile credentials without switching active profile (super_admin only) */
        post: operations["testIrcProfileConnection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description Baseline pagination envelope (@yacc/common BaseListResponse). page is 1-indexed in responses (controllers pass 0-indexed page internally). limit falls back to the BaseListRequest default set [15,25,35,45,55,100,150,200,0] when not matched. */
        BaseListResponse: {
            data: unknown[];
            /** @description 1-indexed page */
            page: number;
            limit: number;
            total: number;
        };
        /** @description Default routing-controllers error shape */
        ErrorResponse: {
            error: string;
        };
        /** @description IRC integration error shape */
        IntegrationErrorResponse: {
            /**
             * @example validation_error
             * @example encryption_key_missing
             * @example irc_not_configured
             * @example internal_error
             */
            code: string;
            message: string;
        };
        MessageResponse: {
            message: string;
        };
        SuccessMessageResponse: {
            success: boolean;
            message: string;
        };
        /** @description Sign-in / self-registration response. `user.role` is always lowercase; sign-up always creates `role: user`. Token claims/lifecycle are ADR-025/MIG-033 implementation detail. `mustChangePassword` is a MIG-030 contract-change finding (ADR-025 forced-password-change state). */
        AuthSessionResponse: {
            user: components["schemas"]["UserResponse"];
            /** @description Stateless JWT access token (ADR-025 default) */
            accessToken: string;
            /** @description Refresh token (rotated on refresh-grant use) */
            refreshToken: string;
            /** @description True while the bootstrap/recovery identity must replace its credential (MIG-030) */
            mustChangePassword: boolean;
        };
        AuthSignOutResponse: {
            /** @enum {boolean} */
            success: true;
        };
        /** @description Session lookup — the user resolved from the Bearer access token (no server-side session object; ADR-025 stateless default). `mustChangePassword` is a MIG-030 contract-change finding. */
        AuthSessionGetResponse: {
            user: components["schemas"]["UserResponse"];
            /** @description True while the bootstrap/recovery identity must replace its credential (MIG-030) */
            mustChangePassword: boolean;
        };
        /** @description Rotated token pair. */
        AuthRefreshResponse: {
            accessToken: string;
            refreshToken: string;
        };
        HealthFullResponse: {
            status: string;
            uptime: number;
            /** Format: date-time */
            timestamp: string;
            dependencies: {
                postgresql?: {
                    [key: string]: unknown;
                };
                redis?: {
                    [key: string]: unknown;
                };
                r2?: {
                    [key: string]: unknown;
                };
            };
            slo?: {
                [key: string]: unknown;
            };
        };
        HealthLiveResponse: {
            /** @example alive */
            status: string;
            /** Format: date-time */
            timestamp: string;
        };
        HealthReadyResponse: {
            /** @enum {string} */
            status: "ready" | "not_ready";
            /** Format: date-time */
            timestamp: string;
            dependencies: {
                postgresql?: boolean;
                redis?: boolean;
                r2?: boolean;
            };
        };
        ForgotPasswordBody: {
            /** Format: email */
            email: string;
        };
        ResetPasswordBody: {
            /** @description 64-char hex reset token */
            token: string;
        };
        VerifyEmailBody: {
            /** @description 64-char hex verification token (MIG-031 deviation) */
            token: string;
            password?: string;
        };
        /** @enum {string} */
        UserRole: "super_admin" | "admin" | "manager" | "user";
        /** @enum {string} */
        UserStatus: "active" | "inactive" | "suspended";
        /** @description Baseline shape packages/backend/src/types/users.types.ts UserResponse */
        UserResponse: {
            /** Format: uuid */
            id: string;
            /** Format: email */
            email: string;
            name: string;
            role: components["schemas"]["UserRole"];
            status: components["schemas"]["UserStatus"];
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            /** Format: date-time */
            deletedAt?: string | null;
        };
        CreateUserBody: {
            /** Format: email */
            email: string;
            password: string;
            name: string;
            role: components["schemas"]["UserRole"];
        };
        CreateUserResponse: {
            /** Format: uuid */
            id: string;
            /** Format: email */
            email: string;
            name: string;
            role: components["schemas"]["UserRole"];
            status: components["schemas"]["UserStatus"];
            /** Format: date-time */
            createdAt: string;
        };
        /** @description Partial update */
        UpdateUserBody: {
            /** Format: email */
            email?: string;
            name?: string;
            role?: components["schemas"]["UserRole"];
            status?: components["schemas"]["UserStatus"];
        };
        UpdateUserResponse: {
            /** Format: uuid */
            id: string;
            /** Format: email */
            email: string;
            name: string;
            role: components["schemas"]["UserRole"];
            status: components["schemas"]["UserStatus"];
        };
        /** @description Soft-deleted user representation (baseline DeleteUserResponse) */
        DeleteUserResponse: {
            /** Format: uuid */
            id?: string;
            /** Format: date-time */
            deletedAt?: string;
        };
        /** @description Conversation entity as returned by conversations service. Field-level canonical shape is reconciled in MIG-003; enums verified in baseline code (status open|pending|resolved, priority low|normal|high|urgent). */
        Conversation: {
            /** Format: uuid */
            id?: string;
            /** @enum {string} */
            status?: "open" | "pending" | "resolved";
            /** @enum {string} */
            priority?: "low" | "normal" | "high" | "urgent";
            assignedUserId?: string | null;
        } & {
            [key: string]: unknown;
        };
        AssignBody: {
            /** Format: uuid */
            assignedUserId?: string | null;
        };
        /** @description Baseline shape packages/backend/src/types/assignments.types.ts */
        AssignmentResponse: {
            id: string;
            /** Format: uuid */
            conversationId: string;
            previouslyAssignedUserId: string | null;
            newlyAssignedUserId: string;
            assignedAt: string;
        };
        BulkActionRequest: {
            conversationIds: string[];
            /** @enum {string} */
            action: "assign" | "tag" | "status";
            /** @description Action payload (assigneeId for assign; tagId for tag; status for status) */
            data: {
                [key: string]: unknown;
            };
        };
        BulkActionResponseData: {
            successCount: number;
            failureCount: number;
            failures: {
                id: string;
                reason: string;
            }[];
        };
        /** @description Baseline shape packages/backend/src/types/message.types.ts MessageResponseDTO */
        Message: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            conversationId: string;
            senderId: string | null;
            senderName: string;
            body: string;
            /** @enum {string} */
            status: "pending" | "sent" | "failed";
            /** @enum {string} */
            direction: "inbound" | "outbound";
            externalMessageId?: string;
            metadata: {
                [key: string]: unknown;
            } | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        /** @description Custom list shape used by GET messages (NOT BaseListResponse) */
        MessageListResponse: {
            messages: components["schemas"]["Message"][];
            total: number;
            /** @default 1 */
            page: number;
            /** @default 50 */
            limit: number;
        };
        /** @description Baseline packages/backend/src/types/message.types.ts SendMessageRequestSchema */
        SendMessageBody: {
            body: string;
            attachmentIds?: string[];
        };
        /** @description Baseline @yacc/common CreateNoteRequest (class-validator) */
        CreateNoteBody: {
            body: string;
            /** Format: uuid */
            replyToMessageId?: string;
            /** @default false */
            isInternal: boolean;
        };
        /** @description Note entity as returned by notes service; canonical shape reconciled in MIG-003. */
        Note: {
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            conversationId?: string;
            body?: string;
        } & {
            [key: string]: unknown;
        };
        /** @description Tag entity (id, name, color, createdById); canonical shape reconciled in MIG-003. */
        Tag: {
            id?: number;
            name?: string;
            color?: string;
        } & {
            [key: string]: unknown;
        };
        CreateTagBody: {
            name: string;
            color?: string;
        };
        /** @description Routing rule entity; condition/action JSON is lenient per ADR-021. Canonical shape reconciled in MIG-003. */
        RoutingRule: {
            /** Format: uuid */
            id?: string;
            name?: string;
            enabled?: boolean;
            priority?: number;
        } & {
            [key: string]: unknown;
        };
        /** @description Create/update body; re-expresses ADR-021 lenient JSON validation in the Java target. */
        RoutingRuleWrite: {
            [key: string]: unknown;
        };
        /** @description Notification entity as returned by notifications service (own-scope). Canonical shape reconciled in MIG-003. */
        Notification: {
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            userId?: string;
            type?: string;
            isRead?: boolean;
        } & {
            [key: string]: unknown;
        };
        /** @description Baseline shape @yacc/common types/AuditLog.type.ts */
        AuditLog: {
            /** Format: uuid */
            id: string;
            actorId: string | null;
            actorName?: string;
            action: string;
            entityType: string;
            entityId: string;
            metadata: {
                [key: string]: unknown;
            };
            ipAddress?: string;
            /** Format: date-time */
            createdAt: string;
        };
        /** @description DLQ entry (packages/backend/src/types/message-queue.types.ts DLQEntry); canonical shape reconciled in MIG-003. */
        DlqEntry: {
            /** Format: uuid */
            id?: string;
            failureReason?: string;
        } & {
            [key: string]: unknown;
        };
        /** @description Baseline IRCConfigRequest — server/port/username required, password optional, channels ≥1 each starting '#' */
        IrcConfigBody: {
            server: string;
            port: number;
            username: string;
            password?: string;
            channels: string[];
        };
        /** @description Baseline @yacc/common types/irc-integration.types.ts IRCConnectionStatusModel — status enum connected|retrying|disconnected|failed; includes attemptCount, lastConnectedAt, lastError, reconnectIncidentId. */
        IrcConnectionStatus: {
            /** @enum {string} */
            status: "connected" | "retrying" | "disconnected" | "failed";
            attemptCount?: number;
            /** Format: date-time */
            lastConnectedAt?: string | null;
            lastError?: string | null;
            /** Format: uuid */
            reconnectIncidentId?: string;
        } & {
            [key: string]: unknown;
        };
        /** @description Create/update IRC profile body (CreateIrcProfileRequest/UpdateIrcProfileRequest); canonical shape reconciled in MIG-003. */
        IrcProfileWrite: {
            name?: string;
            server?: string;
            port?: number;
            nick?: string;
            channels?: string[];
        } & {
            [key: string]: unknown;
        };
        /** @description IRC profile entity (numeric id, tenant-scoped); canonical shape reconciled in MIG-003. */
        IrcProfile: {
            id?: number;
            name?: string;
            isActive?: boolean;
        } & {
            [key: string]: unknown;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Dependency statuses + SLO calculations */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthFullResponse"];
                };
            };
            /** @description Health check itself failed (all dependencies reported down) */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthFullResponse"];
                };
            };
        };
    };
    getHealthLive: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Process alive */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthLiveResponse"];
                };
            };
        };
    };
    getHealthReady: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description All dependencies ready */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthReadyResponse"];
                };
            };
            /** @description One or more dependencies not ready */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthReadyResponse"];
                };
            };
        };
    };
    authForgotPassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ForgotPasswordBody"];
            };
        };
        responses: {
            /** @description Constant anti-enumeration message */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MessageResponse"];
                };
            };
            /** @description Rate limit exceeded (passwordResetRateLimiter) */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    authResetPassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ResetPasswordBody"];
            };
        };
        responses: {
            /** @description Password reset */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuccessMessageResponse"];
                };
            };
            /** @description Invalid or expired token (generic, anti-enumeration) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit exceeded (passwordResetRateLimiter) */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    authVerifyEmail: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VerifyEmailBody"];
            };
        };
        responses: {
            /** @description Email verified */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuccessMessageResponse"];
                };
            };
            /** @description Invalid or expired token (generic, anti-enumeration) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    authOidcAuthorization: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                registrationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Redirect to the configured IdP authorization endpoint */
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unknown registration id (Spring Security default deny — never starts a login) */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    authOidcCallback: {
        parameters: {
            query: {
                code: string;
                state: string;
            };
            header?: never;
            path: {
                registrationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /**
             * @description RP login complete; the canonical session contract for the linked
             *     identity (same shape as authSignInEmail).
             */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthSessionResponse"];
                };
            };
            /** @description Login denied (generic; anti-enumeration) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    authSignInEmail: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    email: string;
                    password: string;
                };
            };
        };
        responses: {
            /** @description Signed in — user object plus stateless JWT access/refresh tokens */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthSessionResponse"];
                };
            };
            /** @description Invalid credentials */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit exceeded (5 requests / 15 minutes) */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    authSignUpEmail: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    email: string;
                    password: string;
                    name: string;
                };
            };
        };
        responses: {
            /** @description Registered — user created with role `user` plus tokens */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthSessionResponse"];
                };
            };
            /** @description Validation error (e.g. email already registered — generic error) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    authSignOut: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Signed out */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthSignOutResponse"];
                };
            };
            /** @description Missing or invalid token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    authGetSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Current user */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthSessionGetResponse"];
                };
            };
            /** @description Missing, invalid, expired token, or inactive/suspended account */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    authRefreshToken: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    refreshToken: string;
                };
            };
        };
        responses: {
            /** @description Tokens rotated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthRefreshResponse"];
                };
            };
            /** @description Invalid, expired, or revoked refresh token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    authChangePassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    currentPassword: string;
                    newPassword: string;
                };
            };
        };
        responses: {
            /** @description Credential replaced; forced-change state cleared */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthSignOutResponse"];
                };
            };
            /** @description Validation error (e.g. password below minimum length) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Missing/invalid token or wrong current password */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listUsers: {
        parameters: {
            query?: {
                /** @description 1-indexed page */
                page?: number;
                /** @description Allowed values 20/50/100 only */
                limit?: 20 | 50 | 100;
                role?: components["schemas"]["UserRole"];
                status?: components["schemas"]["UserStatus"];
                search?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Paginated users */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BaseListResponse"] & {
                        data?: components["schemas"]["UserResponse"][];
                    };
                };
            };
            /** @description Invalid page/limit value */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not super_admin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateUserBody"];
            };
        };
        responses: {
            /** @description Created user */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreateUserResponse"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not super_admin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    updateUser: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateUserBody"];
            };
        };
        responses: {
            /** @description Updated user */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UpdateUserResponse"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not super_admin or self-modification attempt */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description User not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    deleteUser: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Soft-deleted user */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeleteUserResponse"];
                };
            };
            /** @description Not super_admin or self-deletion attempt */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description User not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listUserRoles: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Static role/permission definitions */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        roles: {
                            id: components["schemas"]["UserRole"];
                            label: string;
                            description: string;
                            permissions: string[];
                        }[];
                    };
                };
            };
        };
    };
    listConversations: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                channel?: string;
                status?: "open" | "pending" | "resolved";
                priority?: "low" | "normal" | "high" | "urgent";
                assignedUserId?: string;
                tagId?: string;
                search?: string;
                dateFrom?: string;
                dateTo?: string;
                /** @description Literal 'true' enables unread filter */
                unread?: "true" | "false";
                sortBy?: "lastActivity" | "created" | "priority";
                sortOrder?: "asc" | "desc";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Paginated conversations */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BaseListResponse"] & {
                        data?: components["schemas"]["Conversation"][];
                    };
                };
            };
            /** @description Invalid query values */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getConversation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Conversation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["Conversation"];
                    };
                };
            };
            /** @description Conversation not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    updateConversationStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    status: "open" | "pending" | "resolved";
                };
            };
        };
        responses: {
            /** @description Updated conversation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data?: components["schemas"]["Conversation"];
                    };
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Insufficient role */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    updateConversationPriority: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    priority: "low" | "normal" | "high" | "urgent";
                };
            };
        };
        responses: {
            /** @description Updated conversation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data?: components["schemas"]["Conversation"];
                    };
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Insufficient role */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    assignConversationByPatch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AssignBody"];
            };
        };
        responses: {
            /** @description Updated conversation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data?: components["schemas"]["Conversation"];
                    };
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Insufficient role */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    assignConversationByPost: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversationId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    assignedUserId: string;
                };
            };
        };
        responses: {
            /** @description Assignment result envelope */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data?: components["schemas"]["AssignmentResponse"];
                    };
                };
            };
            /** @description Validation / assignment failure */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Only manager+ can assign */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conversation or user not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    bulkActionConversations: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BulkActionRequest"];
            };
        };
        responses: {
            /** @description Best-effort result with per-item failures */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["BulkActionResponseData"];
                    };
                };
            };
            /** @description Invalid input */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Only manager+ can perform bulk actions */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getConversationMessages: {
        parameters: {
            query?: {
                /** @description Default 1 */
                page?: number;
                /** @description Default 50 */
                limit?: number;
            };
            header?: never;
            path: {
                conversationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Messages page */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MessageListResponse"];
                };
            };
            /** @description Invalid query parameters */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conversation not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    sendConversationMessage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversationId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SendMessageBody"];
            };
        };
        responses: {
            /** @description Created message */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data?: components["schemas"]["Message"];
                    };
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Role not allowed */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conversation not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    retryConversationMessage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversationId: string;
                messageId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Retry accepted / result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Retry not allowed (e.g. already retried) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conversation or message not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getConversationMessageStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversationId: string;
                messageId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Message status */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Conversation or message not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listConversationNotes: {
        parameters: {
            query?: {
                page?: string;
                /** @description Clamped 1..100 */
                pageSize?: string;
            };
            header?: never;
            path: {
                conversationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Paginated notes */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BaseListResponse"] & {
                        data?: components["schemas"]["Note"][];
                    };
                };
            };
            /** @description Invalid parameters */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conversation not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createConversationNote: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversationId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateNoteBody"];
            };
        };
        responses: {
            /** @description Created note */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data?: components["schemas"]["Note"];
                    };
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conversation not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listTags: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Tags envelope */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["Tag"][];
                    };
                };
            };
        };
    };
    createTag: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateTagBody"];
            };
        };
        responses: {
            /** @description Created tag */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data?: components["schemas"]["Tag"];
                    };
                };
            };
            /** @description Name/color validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    addTagToConversation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    tagId: number;
                };
            };
        };
        responses: {
            /** @description Tag linked */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data?: {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            /** @description Invalid tagId */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description No conversation access */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conversation or tag not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    removeTagFromConversation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                tagId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Tag unlinked */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data?: {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            /** @description Invalid tagId */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description No conversation access */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conversation or tag not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listRoutingRules: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description All rules */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BaseListResponse"] & {
                        data?: components["schemas"]["RoutingRule"][];
                    };
                };
            };
            /** @description Only manager+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createRoutingRule: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RoutingRuleWrite"];
            };
        };
        responses: {
            /** @description Created rule */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data?: components["schemas"]["RoutingRule"];
                    };
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Only admin+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    deleteRoutingRule: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted rule */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data?: components["schemas"]["RoutingRule"];
                    };
                };
            };
            /** @description Only admin+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rule not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    updateRoutingRule: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RoutingRuleWrite"];
            };
        };
        responses: {
            /** @description Updated rule */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data?: components["schemas"]["RoutingRule"];
                    };
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Only admin+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rule not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getRoutingRuleExecutions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Execution log entries */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Only manager+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rule not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listNotifications: {
        parameters: {
            query?: {
                page?: string;
                /** @description Clamped 1..100 */
                pageSize?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Paginated notifications */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BaseListResponse"] & {
                        data?: components["schemas"]["Notification"][];
                    };
                };
            };
            /** @description Invalid parameters */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    dismissNotification: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Dismissed (no body) */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Notification not found or not owned */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    markNotificationRead: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    isRead: boolean;
                };
            };
        };
        responses: {
            /** @description Updated notification */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data?: components["schemas"]["Notification"];
                    };
                };
            };
            /** @description isRead must be boolean / other validation */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Notification not found or not owned */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    markAllNotificationsRead: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Bulk mark result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    getConversationAuditLogs: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
            };
            header?: never;
            path: {
                conversationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Conversation audit page (custom shape, not BaseListResponse) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["AuditLog"][];
                        total: number;
                        page: number;
                        limit: number;
                        pages: number;
                    };
                };
            };
            /** @description Only manager+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    queryAuditLogs: {
        parameters: {
            query?: {
                actorId?: string;
                action?: string;
                entityType?: string;
                entityId?: string;
                /** @description ISO date string */
                dateFrom?: string;
                /** @description ISO date string */
                dateTo?: string;
                page?: string;
                /** @description Default 20 */
                limit?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Paginated audit logs */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BaseListResponse"] & {
                        data?: components["schemas"]["AuditLog"][];
                    };
                };
            };
            /** @description Invalid date filters */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Only manager+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    queryConversationAuditLogs: {
        parameters: {
            query?: {
                action?: string;
                entityType?: string;
                dateFrom?: string;
                dateTo?: string;
                page?: string;
                limit?: string;
            };
            header?: never;
            path: {
                conversationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Paginated audit logs */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BaseListResponse"] & {
                        data?: components["schemas"]["AuditLog"][];
                    };
                };
            };
            /** @description Invalid date filters */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Only manager+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    exportAuditLogs: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    format: "csv" | "json";
                    /** @description Same filter fields as GET /api/audit-logs */
                    filters?: {
                        actorId?: string;
                        action?: string;
                        entityType?: string;
                        entityId?: string;
                        dateFrom?: string;
                        dateTo?: string;
                    };
                };
            };
        };
        responses: {
            /** @description File download (Content-Disposition attachment; text/csv or application/json) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/csv": string;
                    "application/json": string;
                };
            };
            /** @description Invalid date filters */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Only admin+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listDlqEntries: {
        parameters: {
            query?: {
                /** @description Default 1 */
                page?: string;
                /** @description Default 25 */
                limit?: string;
                failureReason?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description DLQ page */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        entries: components["schemas"]["DlqEntry"][];
                        total: number;
                        page: number;
                        limit: number;
                    };
                };
            };
            /** @description Invalid pagination (page ≥1 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Only manager+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getDlqStats: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Stats object */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Only manager+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    reQueueDlqEntry: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Re-queued entry */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Only admin+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Entry not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    removeDlqEntry: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Removed entry */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Only super_admin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Entry not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getQueueStats: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description QueueStatistics fields + timestamp */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Only manager+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getQueueDlqEntries: {
        parameters: {
            query?: {
                page?: number;
                pageSize?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description DLQ entries + total */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Only manager+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    retryQueuedMessage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                messageId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Retry accepted */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Only manager+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Message not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    bulkRetryDlq: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    messageIds: string[];
                };
            };
        };
        responses: {
            /** @description Bulk retry result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description messageIds must be an array */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Only manager+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getQueueDlqStats: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description DLQ stats */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Only manager+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getQueueJob: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                jobId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Job details */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Only manager+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Job not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    clearQueueDlqEntry: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                messageId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Entry cleared */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Only super_admin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Entry not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getQueueDlqByReason: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                reason: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Filtered DLQ entries */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Only manager+ */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    saveIrcConfig: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IrcConfigBody"];
            };
        };
        responses: {
            /** @description Saved config (sanitized; hasPassword flag, never the secret) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            server?: string;
                            port?: number;
                            username?: string;
                            channels?: string[];
                            hasPassword?: boolean;
                            updatedAt?: string;
                        };
                    };
                };
            };
            /** @description validation_error or encryption_key_missing */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
            /** @description Only super_admin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
            /** @description internal_error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
        };
    };
    connectIrc: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Current connection status (status=retrying, attemptCount=0 on fresh connect) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["IrcConnectionStatus"];
                    };
                };
            };
            /** @description irc_not_configured */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
            /** @description internal_error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
        };
    };
    testIrcConnection: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["IrcConfigBody"];
            };
        };
        responses: {
            /** @description Sanitized test result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            success: boolean;
                            message: string;
                        };
                    };
                };
            };
            /** @description validation_error (partial body) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
            /** @description irc_not_configured */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
            /** @description internal_error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
        };
    };
    getIrcStatus: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Connection status */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["IrcConnectionStatus"];
                    };
                };
            };
            /** @description internal_error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
        };
    };
    listIrcProfiles: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Profiles array (raw array, not enveloped) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IrcProfile"][];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
            /** @description admin/manager/super_admin only */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
        };
    };
    createIrcProfile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IrcProfileWrite"];
            };
        };
        responses: {
            /** @description Created profile */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IrcProfile"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
            /** @description Only super_admin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
        };
    };
    getIrcProfile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Numeric profile ID */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Profile (raw object, not enveloped) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IrcProfile"];
                };
            };
            /** @description Invalid profile ID */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
            /** @description admin/manager/super_admin only */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
            /** @description Profile not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
        };
    };
    updateIrcProfile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IrcProfileWrite"];
            };
        };
        responses: {
            /** @description Updated profile */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IrcProfile"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
            /** @description Only super_admin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
            /** @description Profile not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
        };
    };
    deleteIrcProfile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted (no body) */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Only super_admin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
            /** @description Profile not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
        };
    };
    activateIrcProfile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Activated profile */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IrcProfile"];
                };
            };
            /** @description Only super_admin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
            /** @description Profile not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
        };
    };
    disableIrcProfile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Disabled profile */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IrcProfile"];
                };
            };
            /** @description Only super_admin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
            /** @description Profile not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
        };
    };
    testIrcProfileConnection: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Test result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Only super_admin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
            /** @description Profile not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationErrorResponse"];
                };
            };
        };
    };
}
