package com.yacc.auth.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.yacc.auth.AuthProperties;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.repository.UserRepository;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;

/**
 * Deterministic first-run Super Admin bootstrap (MIG-030; ADR-025; SPEC
 * AC-08). On startup, when no SUPER_ADMIN principal exists (fresh
 * full-reset database), exactly one Super Admin is created from the
 * bootstrap configuration: {@code YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL} + the
 * one-time initial credential from env/secret. The identity is created
 * {@code active} with the forced-password-change flag set, and an audit
 * event is written. This is the only path by which the first Super Admin
 * comes into existence.
 *
 * <p>Idempotent: a startup with an existing SUPER_ADMIN is a no-op.
 * Deterministic: same inputs produce the same identity
 * ({@link SuperAdminProvisioner}). Fail-closed: a bootstrap-needing database
 * with missing or conflicting configuration refuses to start rather than
 * booting an unownable system.</p>
 */
@Component
public class SuperAdminBootstrap implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(SuperAdminBootstrap.class);

    private final UserRepository users;
    private final SuperAdminProvisioner provisioner;
    private final AuthProperties properties;
    private final AuditPersistence audit;

    public SuperAdminBootstrap(
            UserRepository users,
            SuperAdminProvisioner provisioner,
            AuthProperties properties,
            AuditPersistence audit) {
        this.users = users;
        this.provisioner = provisioner;
        this.properties = properties;
        this.audit = audit;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.existsByRole(UserRole.SUPER_ADMIN)) {
            LOG.info("Super Admin bootstrap skipped: a SUPER_ADMIN already exists (idempotent)");
            return;
        }
        AuthProperties.Bootstrap bootstrap = properties.bootstrap();
        if (bootstrap.email() == null || bootstrap.email().isBlank()
                || bootstrap.initialCredential() == null
                || bootstrap.initialCredential().isBlank()) {
            throw new IllegalStateException(
                    "No SUPER_ADMIN exists and bootstrap configuration is incomplete:"
                            + " set YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL and"
                            + " YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL"
                            + " (fail-closed; ADR-025)");
        }
        if (users.findByEmail(bootstrap.email()).isPresent()) {
            throw new IllegalStateException(
                    "Bootstrap email is already registered to a non-bootstrap identity;"
                            + " refusing to start (resolve the configuration conflict, ADR-025)");
        }
        User created = provisioner.provision(bootstrap.email(), bootstrap.initialCredential());
        audit.persist(new AuditRecord("bootstrap.super_admin.created", "user",
                created.getId(), created.getId(), null, java.time.Instant.now()));
        LOG.info("First-run Super Admin bootstrap created identity {};"
                + " forced password change on first login", created.getId());
    }
}
