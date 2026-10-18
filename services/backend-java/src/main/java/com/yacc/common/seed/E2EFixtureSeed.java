package com.yacc.common.seed;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.jdbc.DataSourceUnwrapper;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.zaxxer.hikari.HikariDataSource;

import com.yacc.repository.AccountRepository;
import com.yacc.repository.AuditLogRepository;
import com.yacc.repository.PasswordResetTokenRepository;
import com.yacc.repository.SessionRepository;
import com.yacc.repository.UserRepository;
import com.yacc.repository.VerificationRepository;
import com.yacc.repository.ConversationRepository;
import com.yacc.repository.ConversationTagRepository;
import com.yacc.repository.DeadLetterQueueEntryRepository;
import com.yacc.repository.IntegrationConfigRepository;
import com.yacc.repository.IntegrationConnectionProfileRepository;
import com.yacc.service.EncryptionService;
import com.yacc.repository.AttachmentRepository;
import com.yacc.repository.MessageRepository;
import com.yacc.repository.RawPayloadRepository;
import com.yacc.repository.NoteRepository;
import com.yacc.repository.NotificationRepository;
import com.yacc.repository.RoutingRuleExecutionRepository;
import com.yacc.repository.RoutingRuleRepository;
import com.yacc.repository.TagRepository;

/**
 * Profile- and opt-in-gated E2E fixture-seed entrypoint (PREREQ-ANG-003-S1;
 * SPEC-003 AD-5; ARCH-004 §1/§2/§4). Boots the Playwright suite's fixture
 * world ({@link DeterministicSeed}) through the existing JPA repositories
 * when — and only when — all three gates hold:
 *
 * <ol>
 *   <li>the explicit non-production {@code e2e} Spring profile is active
 *       (this bean is not registered in any other profile — inert by
 *       default in dev/production boots);</li>
 *   <li>the explicit opt-in property {@code yacc.e2e.seed-enabled=true} is
 *       set ({@link E2EFixtureSeedProperties});</li>
 *   <li>the <em>effective</em> datasource URL — the URL of the pool the
 *       service actually connects through (a Hikari override such as
 *       {@code spring.datasource.hikari.jdbc-url} wins over the generic
 *       {@code spring.datasource.url}) — parses as a loopback
 *       (non-production) PostgreSQL target.</li>
 * </ol>
 *
 * <p>Fail-closed: any unmet gate aborts startup with an explicit
 * {@link IllegalStateException} before a single fixture row is written —
 * no partial seeding, no silent skip. No privileged identity is ever
 * created (ADR-025; the Super Admin stays bootstrap-only via
 * {@code SuperAdminBootstrap}). No schema/migration/entity/contract surface
 * is touched (ADR-023/ADR-027; ARCH-004 §7). Constructor injection only
 * (ARCH-004 §2); the datasource guard reads the injected {@link DataSource}
 * pool and Spring Boot's typed {@link DataSourceProperties} fallback —
 * never {@code System.getenv()} or scattered {@code @Value}.</p>
 */
@Component
@Profile("e2e")
public class E2EFixtureSeed implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(E2EFixtureSeed.class);

    /** Extracts the host component of a PostgreSQL JDBC URL. */
    private static final Pattern JDBC_HOST_PATTERN =
            Pattern.compile("^jdbc:postgresql://([^/:\\s]+)", Pattern.CASE_INSENSITIVE);

    private final UserRepository users;
    private final AccountRepository accounts;
    private final SessionRepository sessions;
    private final VerificationRepository verifications;
    private final PasswordResetTokenRepository passwordResetTokens;
    private final ConversationRepository conversations;
    private final ConversationTagRepository conversationTags;
    private final MessageRepository messages;
    private final AttachmentRepository attachments;
    private final RawPayloadRepository rawPayloads;
    private final NoteRepository notes;
    private final TagRepository tags;
    private final RoutingRuleRepository routingRules;
    private final RoutingRuleExecutionRepository routingRuleExecutions;
    private final NotificationRepository notifications;
    private final AuditLogRepository auditLogs;
    private final DeadLetterQueueEntryRepository deadLetterQueue;
    private final IntegrationConfigRepository integrationConfigs;
    private final IntegrationConnectionProfileRepository integrationProfiles;
    private final EncryptionService encryption;
    private final E2EFixtureSeedProperties properties;
    /** The actual connection pool the service writes through (guard target). */
    private final DataSource datasource;
    private final DataSourceProperties datasourceProperties;

    public E2EFixtureSeed(
            UserRepository users, AccountRepository accounts,
            SessionRepository sessions, VerificationRepository verifications,
            PasswordResetTokenRepository passwordResetTokens,
            ConversationRepository conversations, ConversationTagRepository conversationTags,
            MessageRepository messages, AttachmentRepository attachments,
            RawPayloadRepository rawPayloads, NoteRepository notes, TagRepository tags,
            RoutingRuleRepository routingRules, RoutingRuleExecutionRepository routingRuleExecutions,
            NotificationRepository notifications, AuditLogRepository auditLogs,
            DeadLetterQueueEntryRepository deadLetterQueue,
            IntegrationConfigRepository integrationConfigs,
            IntegrationConnectionProfileRepository integrationProfiles,
            EncryptionService encryption,
            E2EFixtureSeedProperties properties,
            DataSource datasource,
            DataSourceProperties datasourceProperties) {
        this.users = users;
        this.accounts = accounts;
        this.sessions = sessions;
        this.verifications = verifications;
        this.passwordResetTokens = passwordResetTokens;
        this.conversations = conversations;
        this.conversationTags = conversationTags;
        this.messages = messages;
        this.attachments = attachments;
        this.rawPayloads = rawPayloads;
        this.notes = notes;
        this.tags = tags;
        this.routingRules = routingRules;
        this.routingRuleExecutions = routingRuleExecutions;
        this.notifications = notifications;
        this.auditLogs = auditLogs;
        this.deadLetterQueue = deadLetterQueue;
        this.integrationConfigs = integrationConfigs;
        this.integrationProfiles = integrationProfiles;
        this.encryption = encryption;
        this.properties = properties;
        this.datasource = datasource;
        this.datasourceProperties = datasourceProperties;
    }

    /**
     * Runs the fixture seed after all three gates pass; aborts startup
     * (fail-closed, zero partial seed) when any gate is unmet.
     */
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!properties.seedEnabled()) {
            throw new IllegalStateException(
                    "E2E fixture seed is gated: the 'e2e' profile is active but the"
                            + " opt-in property " + E2EFixtureSeedProperties.OPT_IN_PROPERTY
                            + " is not true (fail-closed; PREREQ-ANG-003-S1)");
        }
        String url = effectiveJdbcUrl(datasource, datasourceProperties);
        if (!isLoopbackDatabase(url)) {
            throw new IllegalStateException(
                    "E2E fixture seed refused: the effective datasource URL (the actual"
                            + " pool target, including a Hikari jdbc-url override) is not a"
                            + " loopback (non-production) PostgreSQL instance"
                            + " (fail-closed; PREREQ-ANG-003-S1)");
        }
        new DeterministicSeed(users, accounts, sessions, verifications,
                passwordResetTokens, conversations, conversationTags, messages,
                attachments, rawPayloads, notes, tags, routingRules,
                routingRuleExecutions, notifications, auditLogs, deadLetterQueue,
                integrationConfigs, integrationProfiles, encryption).seed();
        LOG.info("E2E fixture seed applied (profile=e2e, opt-in property set,"
                + " effective datasource URL is loopback)");
    }

    /**
     * Resolves the JDBC URL of the datasource the service <em>actually</em>
     * connects through. When the pool is (or wraps) a Hikari pool, its own
     * URL is authoritative — {@code spring.datasource.hikari.jdbc-url}
     * overrides the generic {@code spring.datasource.url}, so validating
     * only the generic URL could let a remote production target through.
     * A Hikari pool without a URL (e.g. configured via a data-source class
     * name) yields {@code null} and therefore refuses below — fail closed.
     * Without any Hikari pool the typed {@link DataSourceProperties} URL is
     * the effective target.
     */
    static String effectiveJdbcUrl(DataSource datasource, DataSourceProperties properties) {
        if (datasource == null) {
            return properties.determineUrl();
        }
        HikariDataSource hikari = DataSourceUnwrapper.unwrap(datasource, HikariDataSource.class);
        return hikari != null ? hikari.getJdbcUrl() : properties.determineUrl();
    }

    /**
     * The non-production datasource guard: the effective JDBC URL must point
     * at a loopback host ({@code localhost} or a numeric {@code 127.0.0.0/8}
     * address). A production database is never loopback from the service
     * host, so any remote URL is refused (unparseable/absent URLs refuse
     * too). The loopback test is strictly numeric for IPv4 — a textual
     * {@code 127.} prefix is not enough, so a DNS hostname such as
     * {@code 127.production.example} is refused.
     *
     * @param jdbcUrl the effective JDBC URL of the connection pool
     * @return {@code true} only for a parseable loopback PostgreSQL URL
     */
    static boolean isLoopbackDatabase(String jdbcUrl) {
        if (jdbcUrl == null || jdbcUrl.isBlank()) {
            return false;
        }
        Matcher host = JDBC_HOST_PATTERN.matcher(jdbcUrl.trim());
        if (!host.find()) {
            return false;
        }
        String candidate = host.group(1);
        return "localhost".equalsIgnoreCase(candidate) || isLoopbackIpv4(candidate);
    }

    /**
     * Numeric-only {@code 127.0.0.0/8} test: exactly four decimal octets
     * (no leading zeros — that avoids octal-interpretation ambiguity across
     * JDBC parsers) with the first octet equal to 127. Anything else —
     * hostnames, partial addresses, out-of-range octets — is not a loopback
     * address and must fail closed.
     */
    private static boolean isLoopbackIpv4(String host) {
        String[] octets = host.split("\\.", -1);
        if (octets.length != 4 || !"127".equals(octets[0])) {
            return false;
        }
        for (String octet : octets) {
            if (!octet.matches("0|[1-9][0-9]{0,2}") || Integer.parseInt(octet) > 255) {
                return false;
            }
        }
        return true;
    }
}
