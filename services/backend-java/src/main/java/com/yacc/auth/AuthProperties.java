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
 */
@ConfigurationProperties(prefix = "yacc.auth")
public record AuthProperties(Token token, Bootstrap bootstrap, Recovery recovery,
        Email email, PasswordReset passwordReset, EmailVerification emailVerification) {

    /**
     * Applies the KISS defaults when the optional MIG-031 sections are
     * absent from configuration (mirrors the {@link Token} TTL defaults).
     *
     * @param token             stateless JWT access-token policy
     * @param bootstrap         deterministic first-run bootstrap inputs
     * @param recovery          founder-controlled recovery gate
     * @param email             outbound email delivery policy
     * @param passwordReset     password-reset token policy
     * @param emailVerification email-verification token policy
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
}
