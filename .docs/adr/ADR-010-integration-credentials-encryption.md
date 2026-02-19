# ADR-010: Integration Credentials Encryption Strategy

**Status**: ACCEPTED (INT-006, INT-007, INT-008)  
**Date**: 2026-02-19  
**Owners**: Enterprise Architect, Backend Lead  

---

## Context

YACC needs to securely store integration credentials (IRC server password, future Telegram/WhatsApp API keys) at rest in the database. Previously, credentials were stored only as environment variables (read-only, single-tenant MVP).

**Requirements**:
- Credentials encrypted at rest (AES-256-GCM authenticated encryption)
- Database is source of truth (primary); env fallback for backward compatibility
- Passwords never returned in API responses or logged
- Support multi-deployment where each environment has its own encryption key
- Audit trail tracks credential updates without exposing secrets

**Constraints**:
- Single-tenant MVP (per deployment)
- Encryption key stored in `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY` env var
- Password fields never exposed in responses/logs
- Metadata logged in audit trail instead of plaintext secrets

---

## Decision

### Encryption Strategy
- **Algorithm**: AES-256-GCM (authenticated encryption prevents tampering)
- **Key Source**: Environment variable `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY` (min 32 chars)
- **Storage Format**: `iv:encryptedData:authTag` (hex-encoded, separator colon)
- **Service**: `EncryptionService` (static methods, initialized at startup)

### Data Model
New table `integration_configs` persists encrypted credentials:
```sql
CREATE TABLE integration_configs (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) UNIQUE NOT NULL,  -- 'irc', 'telegram', etc.
  server VARCHAR(255) NOT NULL,
  port INT NOT NULL,
  username VARCHAR(255) NOT NULL,
  password_encrypted TEXT,               -- Format: iv:encryptedData:authTag
  has_password BOOLEAN DEFAULT false,    -- Flag without exposing password
  password_updated_at TIMESTAMP,
  channels TEXT NOT NULL,                -- JSON array as string
  updated_by_id TEXT REFERENCES users,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Configuration Source Priority
1. **Primary**: DB `integration_configs` table (encrypted)
2. **Fallback**: Environment variables (IRC_SERVER, IRC_USERNAME, IRC_PASSWORD, IRC_CHANNELS)
3. **None**: Return 409 irc_not_configured if neither exists

**Rationale**: 
- DB allows runtime configuration without env var changes
- Env fallback preserves backward compatibility with existing deployments
- Once DB config is saved, it takes precedence (explicit control)

### API Contract (INT-006, INT-007, INT-008)

#### INT-006: POST /api/integrations/irc/config
- **Input**: `{ server, port, username, password?, channels[] }`
- **Output**: `{ server, port, username, channels, hasPassword, updatedAt }`
- **Side Effects**: Saves to DB (no auto-connect)
- **Audit**: Logs `integration.irc.config_updated` with metadata (server, port, username, channels, passwordChanged) but NOT plaintext password

#### INT-007: POST /api/integrations/irc/connect
- **Input**: Ignored (uses stored config)
- **Output**: `IRCConnectionStatusModel`
- **Side Effects**: Triggers connection attempt (status='retrying', attemptCount=0)
- **Audit**: Logs `integration.irc.connect_requested` with source ('db'|'env') and reconnect flag

#### INT-008: POST /api/integrations/irc/test
- **Input**: Optional `{ server?, port?, username?, password? }` (body-first)
- **Output**: `{ success, message }` sanitized
- **Side Effects**: None (test uses temporary client)
- **Audit**: Logs `integration.irc.test_requested` and `integration.irc.test_result` with source and success flag

**Body-first strict mode**:
- If any of `server` / `port` / `username` is present in the request body, all three are required.
- Otherwise, an empty body `{}` uses stored config (DB first, then env fallback).

### Audit Logging
**Never audit plaintext passwords.** Metadata logged instead:
```json
{
  "action": "integration.irc.config_updated",
  "entityType": "integration",
  "entityId": "irc",
  "metadata": {
    "server": "irc.libera.chat",
    "port": 6697,
    "username": "botuser",
    "channels": ["#test", "#general"],
    "passwordChanged": true  // NOT the actual password
  }
}
```

### Error Codes
- **400 validation_error**: Invalid server/port/username/channels format; or INT-008 body-first missing required fields
- **400 encryption_key_missing**: INT-006 password provided but `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY` not set
- **403 forbidden**: Non-super_admin user attempts INT-006/007/008
- **409 irc_not_configured**: Neither DB nor env config exists for INT-007/008
- **500 internal_error**: Unexpected failures (DB/encryption/connector/test timeout)

### Key Initialization
`EncryptionService.initializeKey()` called at application startup:
- Reads `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY` env var
- Validates length (≥32 chars)
- Logs warning if not set (DB credential storage disabled)
- Throws error if key too short (fail-fast)

---

## Rationale

### AES-256-GCM Over Alternatives
- **RSA**: Overkill for single-key MVP; GCM provides authenticated encryption (prevents tampering)
- **Bcrypt**: Designed for password hashing, not data encryption (can't decrypt)
- **TDE (Transparent Data Encryption)**: DB-level, but doesn't protect credentials in transit/memory

### DB-First Over Env-Only
- ✅ Runtime configuration without redeployment
- ✅ Audit trail of config changes
- ✅ Future multi-tenant support (credentials per org)
- ✅ Rotation strategy (update DB, graceful migration)

### Fallback to Env
- ✅ Backward compatibility (existing deployments work unchanged)
- ✅ Stateless deployments (no DB dependency for config)
- ✅ Clear migration path (save DB config, env fallback disabled)

### hasPassword Flag
- ✅ Indicates if password was set without exposing it
- ✅ API responses don't expose plaintext
- ✅ Test endpoints can indicate "no auth needed" based on flag

---

## Migration Path (Post-MVP)

### Phase 1 (Now - MVP)
- Env-based credentials work as before
- DB credentials optional (if saved, takes precedence)
- Deployments can opt-in to DB storage via INT-006

### Phase 2 (Phase 2+ / Post-MVP)
- Migrate existing deployments to DB credentials
- Deprecate env fallback with notice period
- Remove env fallback in major version

### Phase 3 (Phase 3+)
- Multi-tenant support: credentials per organization
- Vault integration: move encryption key to Hashicorp Vault
- Rotation API: periodic credential updates without downtime

---

## Security Considerations

### Threats Mitigated
1. **Leaked .env files**: Credentials encrypted in DB, not readable by simple file exposure
2. **DB backups**: Encrypted data; restores without key can't read credentials
3. **Logs/audit trails**: Password never appears (only `hasPassword` flag and change tracking)
4. **Memory dumps**: Short-lived decryption (only in RAM during operations)
5. **Source code**: Key in env var, not hardcoded

### Threats NOT Fully Mitigated
- **Compromised encryption key**: Single point of failure (post-MVP: move to Vault)
- **Compromised DB + key**: Attacker can decrypt all credentials
- **Memory attacks**: Runtime decryption is still in-memory (use secure-string libraries post-MVP)

### Recommendations
1. Rotate `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY` quarterly (change in secrets manager + DB reencrypt)
2. Use separate keys for prod vs staging
3. Implement secret rotation API (INT-0XX, post-MVP)
4. Use Vault or AWS Secrets Manager (post-MVP, Phase 2+)

---

## Implementation Details

### EncryptionService (src/services/encryption.service.ts)
```typescript
class EncryptionService {
  static initializeKey(): void        // Called at startup
  static encrypt(plaintext: string): string | null
  static decrypt(encrypted: string): string
  static isEncryptionAvailable(): boolean
}
```

### IRCConfigService (src/services/ircConfig.service.ts)
```typescript
class IRCConfigService {
  async saveConfig(userId, request): IRCConfigResponseData
  async getStoredConfig(): ConfigObject | null
  async checkAndPrepareConnect(): ConfigObject | null
  async testConnection(request?): TestResult
}
```

### Database Schema (src/schemas/integrationConfig.schema.ts)
- Single row per platform (unique constraint on `platform`)
- Encrypted password with null-safe handling
- Timestamp tracking for password updates
- User audit trail (who updated config last)

---

## Test Coverage

- ✅ Encryption/decryption round-trip
- ✅ Validation: server/port/username/channels
- ✅ Password never in response
- ✅ RBAC: super_admin only
- ✅ 409 error when not configured
- ✅ Audit logging (no password leakage)
- ✅ Idempotent config save
- ✅ DB precedence over env
- ✅ Env fallback when DB empty

---

## Compliance

- ✅ **OWASP**: No hardcoded secrets (env var), no plaintext storage, authenticated encryption
- ✅ **NIST**: AES-256 approved algorithm, proper IV generation
- ✅ **Audit**: Every credential change logged with user/timestamp
- ✅ **Data Protection**: Passwords encrypted at rest, not transmitted in responses

---

## Rollout Plan

1. **Day 1**: Deploy EncryptionService + IntegrationConfig schema
2. **Day 1-7**: Existing deployments use env fallback (zero-impact)
3. **Day 7+**: Admin saves config via INT-006 → DB becomes source of truth
4. **Post-MVP**: Migrate remaining deployments + deprecate env fallback

---

## Related
- **ADR-009**: Integration Credentials Management (predecessor, focused on env-based)
- **ADR-005**: Infrastructure Folder Pattern (EncryptionService initialization)
- **INT-006**: IRC Config Endpoint
- **INT-007**: IRC Connect Endpoint
- **INT-008**: IRC Test Endpoint

---

## References
- [NIST SP 800-38D: GCM Mode](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)
- [OWASP: Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Node.js crypto.createCipheriv](https://nodejs.org/api/crypto.html#crypto_crypto_createcipheriv_algorithm_key_iv_options)
