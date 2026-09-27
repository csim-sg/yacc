package com.yacc.auth;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Identity configuration binding (MIG-030; ADR-025; ARCH-004 §4). Colocated
 * in the {@code auth} feature package; all secret material arrives from the
 * environment / K8s Secrets with no defaults — services validate eagerly and
 * fail startup (fail-closed) when required material is absent.
 *
 * @param token             stateless JWT access-token policy (signing key, TTLs)
 * @param bootstrap         deterministic first-run Super Admin bootstrap inputs
 * @param recovery          founder-controlled recovery gate (env-gated restart flag)
 * @param email             outbound email delivery policy (MIG-031; SMTP/SendGrid)
 * @param passwordReset     password-reset token policy (MIG-031; BE-003 parity)
 * @param emailVerification email-verification token policy (MIG-031)
 * @param oauth2            OIDC relying-party client registrations (MIG-032)
 */
@ConfigurationProperties(prefix = "yacc.auth")
public record AuthProperties(Token token, Bootstrap bootstrap, Recovery recovery,
        Email email, PasswordReset passwordReset, EmailVerification emailVerification,
        OAuth2 oauth2) {

    /**
     * Applies the KISS defaults when the optional MIG-031/MIG-032 sections are
     * absent from configuration (mirrors the {@link Token} TTL defaults).
     *
     * @param token             stateless JWT access-token policy
     * @param bootstrap         deterministic first-run bootstrap inputs
     * @param recovery         founder-controlled recovery gate
     * @param email             outbound email delivery policy
     * @param passwordReset     password-reset token policy
     * @param emailVerification email-verification token policy
     * @param oauth2            OIDC relying-party client registrations
     */
    public AuthProperties {
        if (email == null) {
            email = new Email(null, null, null, null, 0, null);
        }
        if (passwordReset == null) {
            passwordReset = new PasswordReset(null);
        }
        if (emailVerification == null) {
            emailVerification = new EmailVerification(null);
        }
        if (oauth2 == null) {
            oauth2 = new OAuth2(false, java.util.Map.of());
        }
    }

    /**
     * Token policy (ADR-025 stateless JWT access + refresh default).
     *
     * @param signingKey base64-encoded PKCS#8 RSA private key (>= 2048 bits);
     *                   the public key is derived from the CRT material. Env
     *                   {@code YACC_AUTH_TOKEN_SIGNING_KEY}.
     * @param accessTtl  access-token lifetime (default 30m)
     * @param refreshTtl refresh-grant lifetime (default 30d)
     */
    public record Token(String signingKey, Duration accessTtl, Duration refreshTtl) {

        public Token {
            if (accessTtl == null) {
                accessTtl = Duration.ofMinutes(30);
            }
            if (refreshTtl == null) {
                refreshTtl = Duration.ofDays(30);
            }
        }
    }

    /**
     * Deterministic first-run Super Admin bootstrap (ADR-025; SPEC AC-08).
     * Required only when the database has no SUPER_ADMIN — creation is
     * idempotent and the only path by which the first Super Admin exists.
     *
     * @param email            bootstrap Super Admin email
     *                         ({@code YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL})
     * @param initialCredential one-time initial credential, delivered from
     *                         env/secret and replaced at first login
     *                         ({@code YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL})
     */
    public record Bootstrap(String email, String initialCredential) {
    }

    /**
     * Founder-controlled recovery (ADR-025): env-gated restart flag, never a
     * public endpoint.
     *
     * @param mode    {@code once} arms recovery for this startup
     *                ({@code RECOVERY_MODE})
     * @param key     founder-presented recovery secret ({@code RECOVERY_KEY})
     * @param keyHash founder-pinned SHA-256 hex digest of the recovery secret
     *                ({@code YACC_RECOVERY_KEY_HASH}); the presented key
     *                matches only when its digest equals this pin
     */
    public record Recovery(String mode, String key, String keyHash) {

        /** The only accepted recovery mode (env-gated restart flag). */
        public static final String MODE_ONCE = "once";
    }

    /**
     * Outbound email delivery policy (MIG-031; SPEC-002 integration table:
     * verification/reset email over SMTP or SendGrid; send failure → retry
     * + audit). SMTP transport settings bind separately through Spring
     * Boot's {@code spring.mail.*} properties.
     *
     * @param from            From address for auth emails
     *                        ({@code YACC_AUTH_EMAIL_FROM})
     * @param provider        delivery provider: {@code smtp} (default) or
     *                        {@code sendgrid} ({@code YACC_AUTH_EMAIL_PROVIDER})
     * @param sendGridApiKey  SendGrid API key — required only when the
     *                        provider is {@code sendgrid}
     *                        ({@code YACC_AUTH_EMAIL_SENDGRID_API_KEY})
     * @param baseUrl         frontend base URL used in emailed action links
     *                        ({@code YACC_AUTH_EMAIL_BASE_URL})
     * @param maxSendAttempts total delivery attempts before the send is
     *                        abandoned and audit-logged (default 3)
     * @param retryBackoff    pause between attempts (default 500ms)
     */
    public record Email(String from, String provider, String sendGridApiKey,
            String baseUrl, int maxSendAttempts, Duration retryBackoff) {

        /** The SMTP provider selector (default). */
        public static final String PROVIDER_SMTP = "smtp";

        /** The SendGrid provider selector. */
        public static final String PROVIDER_SENDGRID = "sendgrid";

        public Email {
            if (provider == null || provider.isBlank()) {
                provider = PROVIDER_SMTP;
            }
            if (maxSendAttempts <= 0) {
                maxSendAttempts = 3;
            }
            if (retryBackoff == null || retryBackoff.isNegative()) {
                retryBackoff = Duration.ofMillis(500);
            }
        }
    }

    /**
     * Password-reset token policy (MIG-031; BE-003 parity: 256-bit tokens,
     * 60-minute expiry, single use).
     *
     * @param tokenTtl reset-token lifetime (default 60m)
     */
    public record PasswordReset(Duration tokenTtl) {

        public PasswordReset {
            if (tokenTtl == null) {
                tokenTtl = Duration.ofMinutes(60);
            }
        }
    }

    /**
     * Email-verification token policy (MIG-031; single-use, expiring).
     *
     * @param tokenTtl verification-token lifetime (default 60m)
     */
    public record EmailVerification(Duration tokenTtl) {

        public EmailVerification {
            if (tokenTtl == null) {
                tokenTtl = Duration.ofMinutes(60);
            }
        }
    }

    /**
     * OIDC relying-party client registrations (MIG-032; ADR-025 RP role;
     * ARCH-004 §4). Disabled by default — enabling without at least one
     * complete registration fails startup (fail-closed). No IdP is
     * hard-coded: the founder names the external IdP(s) at acceptance and
     * each is wired purely through configuration; secrets arrive only from
     * the environment / K8s Secrets and are never logged.
     *
     * @param enabled       turns the {@code oauth2Login} RP surface on
     *                      ({@code YACC_AUTH_OAUTH2_ENABLED})
     * @param registrations config-driven client registrations keyed by
     *                      registration id (the {@code providerId} stored on
     *                      the {@code account} link rows); each registration
     *                      becomes
     *                      {@code /api/auth/oidc/authorization/<id>} (login
     *                      entry) and
     *                      {@code /api/auth/oidc/callback/<id>} (RP callback)
     */
    public record OAuth2(boolean enabled, java.util.Map<String, Registration> registrations) {

        /** The single user-info attribute that identifies the IdP subject. */
        public static final String DEFAULT_USER_NAME_ATTRIBUTE = "sub";

        /** The default OIDC scopes (SPEC-002 FR-04: identity + email claims). */
        public static final java.util.List<String> DEFAULT_SCOPES =
                java.util.List.of("openid", "profile", "email");

        /**
         * One external IdP client registration (all endpoint material comes
         * from the IdP's documented configuration; no discovery call is made
         * at startup, keeping the service network-independent at boot).
         *
         * @param clientId           IdP-issued client id
         *                           ({@code YACC_AUTH_OAUTH2_REGISTRATIONS_<ID>_CLIENT_ID})
         * @param clientSecret       IdP-issued client secret (env/secret only)
         * @param issuerUri          expected ID-token {@code iss} value
         *                           (validated per OIDC core §3.1.3.7; optional)
         * @param authorizationUri   IdP authorization endpoint
         * @param tokenUri           IdP token endpoint (code exchange)
         * @param jwkSetUri          IdP JWKS endpoint (ID-token signature)
         * @param userInfoUri        IdP user-info endpoint (optional — claims
         *                           may come from the ID token alone)
         * @param userNameAttribute  IdP subject claim (default {@code sub})
         * @param scopes             requested scopes
         *                           (default openid,profile,email)
         */
        public record Registration(String clientId, String clientSecret,
                String issuerUri, String authorizationUri, String tokenUri,
                String jwkSetUri, String userInfoUri, String userNameAttribute,
                java.util.List<String> scopes) {
        }
    }
}
