-- V3 (MIG-030; ADR-025): forced-password-change flag for the deterministic
-- first-run Super Admin bootstrap. The bootstrap identity is created with
-- must_change_password = true; sign-in still authenticates it, protected
-- non-auth API surface stays denied (403), and the flag clears only when the
-- credential is replaced. Regular identities (self-registration, privileged
-- provisioning) default to false. Flyway-only schema change (ARCH-004 §7).
ALTER TABLE "users"
    ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;
