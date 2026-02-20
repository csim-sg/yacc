# ADR-017: IRC Multi-Profile DB-First Architecture with Encrypted Credentials

**Date**: 2026-02-20
**Status**: Accepted  
**Authors**: Enterprise Architect  
**Approvers**: (Pending)  
**References**: INT-010, ADR-010 (Encryption), ADR-005 (Infrastructure Pattern)

## Summary

Implement IRC connection profile management with a **DB-first** architecture supporting 0..10 profiles per tenant with encrypted credentials at rest. This ADR captures architectural decisions for profile lifecycle, constraint enforcement, env gating, error taxonomy, and audit logging.

## Context

### Problem
YACC MVP requires managing multiple IRC server connections per tenant with:
1. Hard cap on profiles (prevent sprawl)
2. Encrypted credential storage (security)
3. At most one active profile per integration (simplicity)
4. Backward compatibility with env-var config (migration path)
5. Clear error handling for profile-not-found vs not-configured scenarios

### Current State
- ENV-only approach in Place (single IRC config via env vars)
- No database profile storage
- No encryption of credentials
- No multi-profile support

## Decisions

### 1. Hard Cap: 10 Profiles per Tenant

**Decision**: Enforce maximum 10 IRC profiles per tenant (MVP constraint).

**Rationale**:
- Prevents profile sprawl and database bloat
- Sufficient for MVP (typical use: 1-2 profiles per org)
- Cap can be increased post-MVP without schema changes
- Enforced at service layer (not DB constraint) for flexibility

**Implementation**:
- `ircProfile.service.ts`: Count existing profiles before create
- Return 409 `irc_profile_limit_exceeded` if cap exceeded
- Cap applies to both enabled and disabled profiles

---

### 2. Environment Variable Key

**Decision**: Use `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY` for encryption key (shared with other integrations post-MVP).

**Rationale**:
- Supports future multi-integration credentials (Telegram, WhatsApp, etc.)
- Consistent naming with ADR-010 (Encryption Strategy)
- Key length: minimum 32 bytes (AES-256)
- Rotation policy: TBD (post-MVP)

**Implementation**:
- `config/appConfig.ts`: Load from env, validate length
- `EncryptionService.initializeKey()`: Called at app startup
- Missing key → log warning, disable profile storage (fallback to env only)

---

### 3. DB-First with Env Fallback

**Decision**: Profiles from database take priority; env vars only used if zero DB profiles exist for tenant.

**Rationale**:
- Supports migration from env → DB without losing config
- Clear semantics: "if any DB profile exists, ignore env"
- Prevents confusion from parallel configs
- Single source of truth per state

**Gating Logic**:
```
CONNECT/CONFIG/TEST IRC PATH:
  1. Check if any DB profile exists for tenant + integration = 'irc'
  2. If YES (>0 profiles):
     - Find active profile: if found, use it
     - If >1 profile but none active → 409 `irc_profile_not_selected`
     - If 0 DB profiles → shouldn't reach this case
  3. If NO (zero profiles):
     - Use env vars (YACC_IRC_* from .env)
     - If env vars incomplete → 409 `irc_not_configured`

FALLBACK SEQUENCE:
  Active DB profile > Multiple non-active DB profiles > Env vars > Error
```

**Implementation**:
- `ircProfile.service.ts`: `getActiveIrcProfile(tenantId)` → DB query
- `irc.connector.ts`: Updated startup logic to check DB first
- `ircIntegration.controller.ts` (config/test endpoints): Check DB before env

---

### 4. Active Profile Semantics

**Decision**: At most one active profile per (tenant, integration); active implies enabled.

**Rationale**:
- Simplifies connector startup (fetch 1 profile, not 0-many)
- Prevents race conditions (no active-selection logic needed)
- Clear lifecycle: create disabled → test → activate (when ready)
- Deactivating doesn't delete (reversible)

**Constraints**:
- Database partial unique index on (tenant_id, integration_type, is_active) WHERE is_active = true
- CHECK constraint: `is_active = true` → `is_enabled = true`
- Cannot activate a disabled profile (409)
- Cannot deactivate; only disable (which clears active)

---

### 5. Delete-Active Rejection

**Decision**: Reject DELETE if profile is active with 409 `IRC_PROFILE_DELETE_ACTIVE_FORBIDDEN`.

**Rationale**:
- Prevents accidental loss of active config
- Forces explicit deactivate step (safer UX)
- Aligns with "active → enabled" constraint
- Delete only possible for disabled profiles

**Implementation**:
- Service: Check `isActive` before delete
- Return 409 if active
- UI: Disable delete button if profile is active (feedback before request)

---

### 6. Error Taxonomy

| Code | HTTP | Scenario | Action |
|------|------|----------|--------|
| `irc_profile_limit_exceeded` | 409 | 11th profile create attempt | Enforce cap |
| `irc_profile_not_selected` | 409 | >1 DB profile, none active, but trying to connect | Choose active profile |
| `IRC_PROFILE_DELETE_ACTIVE_FORBIDDEN` | 409 | Delete while active | Disable first |
| `IRC_PROFILE_ACTIVATE_DISABLED_FORBIDDEN` | 409 | Activate disabled profile | Enable first |
| `irc_not_configured` | 409 | Zero DB + no env vars | Configure profile or env |
| `encryption_key_missing` | 400 | INTEGRATION_CREDENTIALS_ENCRYPTION_KEY not set during profile create | Set env var |
| `forbidden` | 403 | Non-Super Admin attempts CRUD | RBAC enforcement |

---

### 7. Audit Logging

**Decision**: Log all profile lifecycle events with metadata (no secrets).

**Events Logged**:
- `create`: Profile name, server, username, channels (not password)
- `update`: Changed fields (name, config, hasPassword flag, isEnabled)
- `activate`: Profile ID only
- `disable`: Cleared active flag status
- `delete`: Profile ID only
- `test`: Test result (pass/fail, not error details)

**Implementation**:
- `audit.service.ts`: `logAction()` with entityType = 'integration', entityId = `irc-profile-{id}`
- Non-awaited calls to avoid blocking API responses
- Metadata never includes passwords or encrypted credentials

---

## Implementation Details

### Database Schema
```sql
-- Partial unique index: one active per (tenant, integration)
UNIQUE INDEX integration_profiles_active_idx 
  ON integration_connection_profiles (tenant_id, integration_type, is_active)
  WHERE is_active = true;

-- CHECK constraint: active implies enabled
CHECK (is_active = false OR is_enabled = true);
```

### RBAC
| Role | Create | Update | Activate/Disable | Delete | Test | List | Get |
|------|--------|--------|-------------------|--------|------|------|-----|
| Super Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manager | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| User | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

### Encryption

- Algorithm: AES-256-GCM (authenticated encryption)
- Key derivation: first 32 bytes of `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY`
- Format: `iv:encryptedData:authTag` (hex-encoded), never exposed in API responses
- Decryption only in service layer (for connector startup)

---

### Transition Path

**Phase 1 (MVP)**: DB profiles + env fallback
1. Admin creates IRC profile via API
2. Connector prefers DB profile (if exists) over env vars
3. Env vars still supported for backward compatibility

**Phase 2+ (Post-MVP)**:
- Deprecate env vars for IRC
- Support other integrations (Telegram, WhatsApp) via same profile mechanism
- Add profile credential rotation (INTEGRATION_CREDENTIALS_ENCRYPTION_KEY changes)

---

## Alternatives Considered

### 1. Require DB Profile (No Env Fallback)
- **Rejected**: Breaks existing single-env deployments during migration
- **Preferred**: DB-first with fallback is safer

### 2. Multiple Active Profiles per Integration
- **Rejected**: Increases connector complexity (which profile to use?)
- **Preferred**: One active per integration is simpler

### 3. Soft Cap (Warning) Instead of Hard Cap
- **Rejected**: MVP needs clear limits to prevent sprawl
- **Preferred**: Hard cap with clear error message

### 4. Delete-Active Allowed
- **Rejected**: Too risky (accidental loss of active config)
- **Preferred**: Explicit disable-first step prevents mistakes

---

## Success Criteria

✅ Cap enforcement: 10 profiles max per tenant  
✅ Encryption: Credentials encrypted at rest, never in responses  
✅ DB-first: Profiles take precedence over env  
✅ RBAC: Super Admin only for CRUD, read-only for Admin+Manager  
✅ Audit trail: All operations logged with actor + metadata  
✅ Error handling: Clear 409/400/403 codes for each scenario  
✅ Backward compat: Env vars still work if zero DB profiles  
✅ Frontend UI: Admin panel for profile management  
✅ E2E tests: Playwright coverage for happy path + restrictions  

---

## Risks & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Encryption key loss | High | Document key backup/rotation process (post-MVP) |
| Active profile unclear | Medium | UI shows active indicator + status in list view |
| Env vars still used | Medium | Log warning if both DB + env exist (encourage migration) |
| Cap too low (post-MVP) | Low | Can increase via config (not schema-breaking) |

---

## Related ADRs

- **ADR-010**: Encryption Strategy for Credentials (AES-256-GCM)
- **ADR-005**: Infrastructure vs Config Pattern (EncryptionService as singleton)
- **ADR-014**: Middleware Registration Exception (auth via routing-controllers)

---

## Implementation Timeline

- **Week 1**: Backend schema, service, controller, tests
- **Week 2**: Frontend UI, E2E tests, env gating in connector
- **Week 3**: Audit logging integration, docs update

---

**Approval Chain**:
- [ ] Enterprise Architect
- [ ] Product Owner
- [ ] Backend Lead
- [ ] Frontend Lead
