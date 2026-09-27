package com.yacc.auth;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Identity configuration binding (MIG-030; ADR-025; ARCH-004 §4). Colocated
 * in the {@code auth} feature package; all secret material arrives from the
 * environment / K8s Secrets with no defaults — services validate eagerly and
 * fail startup (fail-closed) when required material is absent.
 *
 * @param token     stateless JWT access-token policy (signing key, TTLs)
 * @param bootstrap deterministic first-run Super Admin bootstrap inputs
 * @param recovery  founder-controlled recovery gate (env-gated restart flag)
 */
@ConfigurationProperties(prefix = "yacc.auth")
public record AuthProperties(Token token, Bootstrap bootstrap, Recovery recovery) {

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
}
