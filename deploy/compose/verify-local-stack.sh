#!/usr/bin/env bash
# =============================================================================
# verify-local-stack.sh — YACC local Compose deployment verification (MIG-107
# #473; ADR-032). Proves the issue ACs in one run:
#
#   AC-1  compose config parses; stack boots (Flyway + Started YaccApplication
#         visible in backend logs) and reports healthy
#   AC-2  HTTPS through Traefik with the local self-signed cert; /health/live
#         + /health/ready 200 via the proxy; authenticated sign-in → forced
#         credential change → GET /api/conversations 200 via the proxy
#   AC-3  /ws upgrade succeeds for a valid token (101) and is refused for an
#         invalid one (401)
#   AC-4  backend runs uid 1000, read-only root FS, tmpfs-only writable paths,
#         memory limit/reservation + CPU limit set and verified via inspect
#   AC-5  full YACC_* env-name contract present in the rendered Compose
#         config, legacy names absent (TM-003 non-regression gate); SOPS
#         artifact encrypted to exactly the founder-supplied recipients; no
#         plaintext secret value committed
#   AC-6  this script + .docs/runbooks/compose-local.md cover operation; the
#         stack exposes no public listener (loopback-only binding audited)
#
# Honest semantics asserted along the way: healthcheck = visibility only,
# restart policy = process exit only, Traefik = NOT readiness-gated.
#
# Requirements: docker + compose plugin, curl, openssl, python3, sops (for
# the decryption step only if deploy/compose/secrets/local.env is absent).
#
# Secrets discipline: decrypted values are read from the git-ignored
# deploy/compose/secrets/local.env and are NEVER printed by this script.
# The file is treated strictly as DATA: a strict allowlist KEY=value parser
# reads it — the decrypted contents are NEVER sourced or evaled, so shell
# syntax / command substitutions inside values cannot execute. When the
# script itself decrypts (sops), the plaintext is written to a mode-0600
# mktemp file inside the secrets directory (umask 077; mode VERIFIED before
# any secret is written) and atomically renamed into place — the decrypted
# env file never exists with permissive permissions, and no post-write
# chmod on an already-readable file is relied on. The `docker compose
# config` render lands in a mktemp file (it contains decrypted values)
# removed on exit.
#
# Cleanup discipline: an EXIT trap (SIGINT/SIGTERM/SIGHUP funnel through it)
# removes this run's temp files and — once teardown is ARMED, immediately
# before `docker compose up` is attempted — tears down THIS run's stack with
# a project-scoped `docker compose down -v --remove-orphans`. The entire run
# executes under an ISOLATED unique Compose project
# (`yacc-local-verify-<run-id>`, via `-p` on every compose call), so the
# teardown can only match resources labeled/namespaced for that project: its
# containers, its network, and its own `<project>_postgres_data` volume. It
# cannot `down` an operator's existing `yacc-local` stack, any other Compose
# project, or any other volume — and there is no prune, no kill pattern, and
# no shared/fixed-project `down -v` anywhere in this script. Failures BEFORE
# `up` is attempted arm nothing and run no Compose teardown at all. After
# arming, teardown runs on any failure or interruption (partial startups
# included); `--keep` disarms it only when verification fully succeeded.
# Exit status and signal-derived exit codes are never masked.
#
# Usage:
#   ./verify-local-stack.sh [--keep] [--skip-build]
#     --keep        leave the stack running ONLY when verification fully
#                   succeeded (default: `docker compose down -v` — scoped to
#                   this run's project; the same teardown also runs on any
#                   failure or interrupt once `up` has been attempted). The
#                   kept stack lives under this run's unique project name;
#                   inspect/tear-down commands are printed at exit.
#     --skip-build  do not rebuild the backend image
# =============================================================================
set -euo pipefail

# Restrictive-by-default for EVERYTHING this script creates: plaintext
# secrets, TLS key material, rendered config, run temp files.
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# Every Compose invocation MUST carry --env-file: the compose file
# interpolates required secrets (${POSTGRES_USER:?...}), so even read-only
# commands (`ps`, `logs`, `config`) fail without it (verified: compose v5
# re-interpolates the model on every invocation, container state irrelevant).
# Baking it in here makes it impossible to omit on any call site below.
#
# Every invocation ALSO carries `-p "$VERIFY_PROJECT"`: the run executes in
# an isolated, unique Compose project instead of the compose file's shared
# `yacc-local` name. This is what makes the teardown provably scoped —
# containers/networks are labeled with this project and the postgres volume
# is namespaced `<project>_postgres_data` — so cleanup can never `down` an
# operator's existing `yacc-local` stack, its data volume, or anything else.
VERIFY_PROJECT="yacc-local-verify-$(date -u +%Y%m%d-%H%M%S)-$$-$RANDOM"
COMPOSE="docker compose -p $VERIFY_PROJECT -f deploy/compose/docker-compose.yml --env-file deploy/compose/secrets/local.env"
ENV_FILE="deploy/compose/secrets/local.env"
SOPS_FILE="deploy/compose/secrets/local.sops.env"
ORIGIN="https://localhost"
ORIGIN_HTTP="http://127.0.0.1"
BACKEND_WAIT_SECONDS=420
KEEP=0; SKIP_BUILD=0
[ "${1:-}" = "--keep" ] && KEEP=1
[ "${1:-}" = "--skip-build" ] && SKIP_BUILD=1
[ "${2:-}" = "--keep" ] && KEEP=1
[ "${2:-}" = "--skip-build" ] && SKIP_BUILD=1

TMPDIR_RUN="$(mktemp -d /tmp/opencode/yacc473-verify.XXXXXX)"
TEARDOWN_ARMED=0    # set to 1 immediately BEFORE `up` is attempted
TEARDOWN_DONE=0     # set to 1 after a teardown completed (trap must not repeat it)
PLAINTEXT_TMP=""    # set only during SOPS decryption (mode-0600 temp in secrets dir)

# Project-scoped teardown: every resource Compose manages for this run is
# labeled/namespaced with $VERIFY_PROJECT (via `-p` on $COMPOSE), so
# `down -v --remove-orphans` removes ONLY this run's containers + network and
# this run's own `<project>_postgres_data` volume. It cannot touch other
# projects (including the operator's `yacc-local` stack), other volumes, or
# images. No `docker system prune`, no kill patterns anywhere in this script.
teardown_stack() {
  $COMPOSE down -v --remove-orphans
}

cleanup() {
  rc=$?
  trap - EXIT INT TERM HUP
  if [ "$TEARDOWN_ARMED" -eq 1 ] && [ "$TEARDOWN_DONE" -eq 0 ]; then
    echo "  trap teardown (failure/interrupt): project-scoped down -v — removing ONLY this run's stack ($VERIFY_PROJECT: containers, network, own postgres volume)"
    teardown_stack >/dev/null 2>&1 || true
  fi
  if [ -n "$PLAINTEXT_TMP" ] && [ -e "$PLAINTEXT_TMP" ]; then
    shred -u "$PLAINTEXT_TMP" 2>/dev/null || rm -f "$PLAINTEXT_TMP"
  fi
  rm -rf "$TMPDIR_RUN"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

FAILURES=0
pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; FAILURES=$((FAILURES+1)); }

require() { command -v "$1" >/dev/null 2>&1; }

echo "==================================================================="
echo " YACC local Compose verification — origin $ORIGIN (loopback only)"
echo "==================================================================="

# ---------------------------------------------------------------- phase 1
echo "--- Phase 1: prerequisites"
ok=1
for tool in docker curl openssl python3; do
  if require "$tool"; then pass "tool present: $tool"; else fail "tool missing: $tool"; ok=0; fi
done
docker compose version >/dev/null 2>&1 && pass "docker compose plugin present" || { fail "docker compose plugin missing"; ok=0; }
docker info >/dev/null 2>&1 && pass "docker daemon reachable" || { fail "docker daemon not reachable"; ok=0; }
[ "$ok" -eq 1 ] || exit 1

# ---------------------------------------------------------------- phase 2
echo "--- Phase 2: decrypted secrets env (data-only handling — never sourced/evaled)"
# Operator-controlled path contract (reviewer finding: a symlink here made
# the verifier chmod/parse the symlink TARGET): $ENV_FILE is accepted only as
# a REGULAR file owned by the invoking user, checked BEFORE any stat/chmod/
# read/write. A symlink — or any non-regular path — is rejected outright and
# never followed; removal is left to the operator. The decrypt branch below
# is symlink-safe by construction: mktemp creates its temp with O_EXCL (no
# pre-existing path can be followed) and the final path comes into existence
# only via atomic rename, which replaces a symlink WITHOUT following it.
if [ -L "$ENV_FILE" ]; then
  fail "$ENV_FILE is a symbolic link — refusing (remove it; this path must be a regular mode-0600 file owned by uid $(id -u))"
  exit 1
fi
if [ -e "$ENV_FILE" ]; then
  if [ ! -f "$ENV_FILE" ]; then
    fail "$ENV_FILE exists but is not a regular file — refusing"
    exit 1
  fi
  env_owner="$(stat -c '%u' "$ENV_FILE")"
  if [ "$env_owner" != "$(id -u)" ]; then
    fail "$ENV_FILE is owned by uid $env_owner, not the invoking uid $(id -u) — refusing"
    exit 1
  fi
  pass "decrypted env present: $ENV_FILE (regular file, owner uid $(id -u), git-ignored)"
else
  echo "  $ENV_FILE absent — attempting SOPS decryption (requires the private age identity — operator action)."
  if require sops; then
    # Restrictive-from-creation: a mode-0600 mktemp file INSIDE the secrets
    # directory (same filesystem → atomic rename), mode VERIFIED before any
    # plaintext is written. The final path comes into existence only via
    # rename of an already-0600 file — no window where the plaintext is
    # readable by other local users, no reliance on post-write chmod, and no
    # symlink-following anywhere on the create/decrypt/rename path.
    PLAINTEXT_TMP="$(mktemp "$SCRIPT_DIR/secrets/.local.env.XXXXXX")"
    mk_mode="$(stat -c '%a' "$PLAINTEXT_TMP")"
    if [ "$mk_mode" != "600" ]; then
      fail "mktemp created $PLAINTEXT_TMP with mode $mk_mode (expected 600) — aborting BEFORE any secret is written"
      rm -f "$PLAINTEXT_TMP"; PLAINTEXT_TMP=""
      exit 1
    fi
    if sops -d "$SOPS_FILE" > "$PLAINTEXT_TMP" 2>"$TMPDIR_RUN/sops.err" \
       && [ "$(stat -c '%a' "$PLAINTEXT_TMP")" = "600" ]; then
      mv -f "$PLAINTEXT_TMP" "$ENV_FILE"   # atomic rename: replaces any path at $ENV_FILE WITHOUT following it
      PLAINTEXT_TMP=""
      pass "decrypted via sops → $ENV_FILE (born 0600: mktemp + mode-verified + atomic rename; git-ignored)"
    else
      fail "SOPS decryption failed — nothing was written to $ENV_FILE; mode-0600 temp removed"
      rm -f "$PLAINTEXT_TMP"; PLAINTEXT_TMP=""
      exit 1
    fi
  else
    fail "no decrypted env and sops unavailable — decrypt $SOPS_FILE with your private identity (runbook §3.1: decrypt into a fresh mode-0600 temp file and atomically rename it into place; never commit/log the output)"
    exit 1
  fi
fi
# An operator-supplied existing file must not be group/world-readable either —
# enforced BEFORE any content is read (reviewer finding: legacy redirect could
# leave a 0644 file behind). Reached only for a validated regular file owned
# by the invoking user (guards above), so this chmod can never touch a
# symlink target or another user's file.
cur_mode="$(stat -c '%a' "$ENV_FILE")"
if [ "$cur_mode" != "600" ]; then
  echo "  $ENV_FILE had mode $cur_mode — chmod 600 applied before any read"
  chmod 600 "$ENV_FILE"
  cur_mode="$(stat -c '%a' "$ENV_FILE")"
fi
if [ "$cur_mode" = "600" ]; then pass "$ENV_FILE mode is 0600"; else fail "could not enforce 0600 on $ENV_FILE"; exit 1; fi

# --- BEGIN dotenv data parser (verbatim-extractable for negative controls) ---
# Strict DATA parser for the decrypted dotenv: KEY=value records only, keys
# restricted to the artifact's exact allowlist, duplicate/malformed/unknown
# keys rejected. Values are stored verbatim (one optional pair of matching
# surrounding quotes stripped) and NEVER executed — no source, no eval: a
# value like `$(reboot)` or backtick payloads is inert text.
declare -A SECRETS
ALLOWED_SECRET_KEYS="POSTGRES_USER POSTGRES_PASSWORD DATABASE_URL YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL RECOVERY_MODE RECOVERY_KEY YACC_RECOVERY_KEY_HASH YACC_AUTH_TOKEN_SIGNING_KEY YACC_INTEGRATION_ENCRYPTION_MASTER_KEY YACC_AUTH_EMAIL_SENDGRID_API_KEY"
parse_env_as_data() {
  local file="$1" line key value
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in ''|'#'*) continue ;; esac
    case "$line" in
      [A-Za-z_]*=*) : ;;
      *) fail "env data parser: line is not KEY=value — rejected ($file)"; return 1 ;;
    esac
    key="${line%%=*}"
    value="${line#*=}"
    case "$key" in
      *[!A-Za-z0-9_]*) fail "env data parser: invalid characters in key — rejected"; return 1 ;;
    esac
    case " $ALLOWED_SECRET_KEYS " in
      *" $key "*) : ;;
      *) fail "env data parser: key not in allowlist — rejected: $key"; return 1 ;;
    esac
    if [ -n "${SECRETS[$key]+set}" ]; then fail "env data parser: duplicate key — rejected: $key"; return 1; fi
    if [ "${#value}" -ge 2 ]; then
      v_first="${value:0:1}"; v_last="${value: -1}"
      if { [ "$v_first" = '"' ] && [ "$v_last" = '"' ]; } || { [ "$v_first" = "'" ] && [ "$v_last" = "'" ]; }; then
        value="${value:1:${#value}-2}"
      fi
    fi
    SECRETS["$key"]="$value"
  done < "$file"
}
# --- END dotenv data parser ---
parse_env_as_data "$ENV_FILE" || exit 1
pass "decrypted env parsed as strict DATA (allowlist only; no source/eval; values never printed)"

ok_vars=1
for varname in POSTGRES_USER POSTGRES_PASSWORD DATABASE_URL \
  YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL \
  RECOVERY_KEY YACC_RECOVERY_KEY_HASH \
  YACC_AUTH_TOKEN_SIGNING_KEY YACC_INTEGRATION_ENCRYPTION_MASTER_KEY; do
  [ -n "${SECRETS[$varname]-}" ] || { fail "required secret var empty/missing in $ENV_FILE: $varname"; ok_vars=0; }
done
# RECOVERY_MODE must be PRESENT but is legitimately EMPTY (recovery off) in the
# local baseline; the founder flips it to `once` deliberately at the console.
[ -n "${SECRETS[RECOVERY_MODE]+set}" ] || fail "RECOVERY_MODE not declared in $ENV_FILE (empty = recovery off)"
[ "$ok_vars" -eq 1 ] && pass "all required secret variables present in $ENV_FILE (values not printed)"
# Fail fast on a malformed signing key (base64 PKCS#8 DER) instead of a slow boot-fail loop.
if printf %s "${SECRETS[YACC_AUTH_TOKEN_SIGNING_KEY]-}" | base64 -d 2>/dev/null | openssl pkcs8 -inform DER -nocrypt -out /dev/null 2>/dev/null; then
  pass "token signing key decodes as PKCS#8 RSA private key (format check only — no output)"
else
  fail "YACC_AUTH_TOKEN_SIGNING_KEY is not base64 PKCS#8 — the JVM will fail-closed at boot (JwtTokenService)"
fi

# ---------------------------------------------------------------- phase 3
echo "--- Phase 3: SOPS artifact + .sops.yaml contract (no private key used)"
if require sops && [ "$(sops filestatus "$SOPS_FILE" 2>/dev/null | grep -o '"encrypted":true')" = '"encrypted":true' ]; then
  pass "$SOPS_FILE is SOPS-encrypted (filestatus)"
else
  fail "$SOPS_FILE is not a valid SOPS-encrypted file"
fi
REC_A="age1w9keuadjqmzrv4qfwef4qzu09q9wt7x5mvxer9jffn4jpq8twsfsc7ay4z"
REC_B="age12wafnvwvnnlz3dw07k84vmen4pxgz2cahyt6qg3cvsvs25l8guwssjrtvj"
rec_lines=$(grep -Ec '^sops_age__list_[0-9]+__map_recipient=age1' "$SOPS_FILE" || true)
[ "$rec_lines" -eq 2 ] && pass "exactly two age recipients in artifact metadata" || fail "expected 2 age recipients, found $rec_lines"
grep -q "^sops_age__list_[0-9]*__map_recipient=$REC_A$" "$SOPS_FILE" && pass "recipient A present" || fail "recipient A missing"
grep -q "^sops_age__list_[0-9]*__map_recipient=$REC_B$" "$SOPS_FILE" && pass "recipient B present" || fail "recipient B missing"

# Every secret-named line in the COMMITTED artifact must be encrypted (ENC[)
# or empty — never a plaintext value.
SECRET_NAMES="POSTGRES_USER POSTGRES_PASSWORD DATABASE_URL YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL RECOVERY_MODE RECOVERY_KEY YACC_RECOVERY_KEY_HASH YACC_AUTH_TOKEN_SIGNING_KEY YACC_INTEGRATION_ENCRYPTION_MASTER_KEY YACC_AUTH_EMAIL_SENDGRID_API_KEY"
artifact_ok=1
for name in $SECRET_NAMES; do
  if grep -Eq "^${name}=(ENC\[.*)?$" "$SOPS_FILE"; then :; else
    fail "committed artifact has a non-encrypted, non-empty value for ${name}"; artifact_ok=0
  fi
done
[ "$artifact_ok" -eq 1 ] && pass "all committed secret values are SOPS ciphertext or empty"

# .sops.yaml: creation rule scoped to the compose secrets path, exact recipients.
SOPS_YAML_SCOPED=$(grep -c 'path_regex: deploy/compose/secrets/' .sops.yaml || true)
[ "$SOPS_YAML_SCOPED" -ge 1 ] && pass ".sops.yaml creation rule is path-scoped (no repo-wide wildcard)" || fail ".sops.yaml creation rule not path-scoped"
grep -q "$REC_A" .sops.yaml && grep -q "$REC_B" .sops.yaml && pass ".sops.yaml carries exactly the founder-supplied recipients" || fail ".sops.yaml recipients wrong"
# The age: line must contain ONLY the two recipients (no third key smuggled in).
AGE_LINE_VALUES="$(tr -d ' \n' < .sops.yaml | grep -o 'age:>-[a-z0-9,]*' | sed 's/^age:>-//')"
STRAY="$(echo "$AGE_LINE_VALUES" | tr ',' '\n' | grep -vc "^$REC_A$\|^$REC_B$" || true)"
[ "$STRAY" -eq 0 ] && pass "no stray recipient in .sops.yaml age line" || fail "unexpected recipient in .sops.yaml"

# ---------------------------------------------------------------- phase 4
echo "--- Phase 4: compose config + env-name contract gate (TM-003 non-regression)"
RENDER="$TMPDIR_RUN/rendered.yml"
if $COMPOSE config > "$RENDER" 2>"$TMPDIR_RUN/config.err"; then
  pass "docker compose config parses and validates"
else
  fail "docker compose config failed: $(cat "$TMPDIR_RUN/config.err")"; exit 1
fi
REQUIRED_ENV_NAMES=(DATABASE_URL
  YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL
  YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL
  RECOVERY_MODE
  RECOVERY_KEY
  YACC_RECOVERY_KEY_HASH
  YACC_AUTH_TOKEN_SIGNING_KEY
  YACC_INTEGRATION_ENCRYPTION_MASTER_KEY
  YACC_AUTH_AS_ISSUER
  YACC_AUTH_EMAIL_PROVIDER
  YACC_AUTH_EMAIL_FROM
  YACC_AUTH_EMAIL_SENDGRID_API_KEY
  YACC_AUTH_EMAIL_BASE_URL
  YACC_REALTIME_WS_ALLOWED_ORIGINS)
LEGACY_ENV_NAMES=(BOOTSTRAP_SUPER_ADMIN_EMAIL BOOTSTRAP_SUPER_ADMIN_PASSWORD SENDGRID_API_KEY)
gate_failed=0
for name in "${REQUIRED_ENV_NAMES[@]}"; do
  if grep -Eq "^[[:space:]]*-? ${name}:" "$RENDER"; then :; else
    fail "rendered compose config missing required env name: $name"; gate_failed=1
  fi
done
for name in "${LEGACY_ENV_NAMES[@]}"; do
  if grep -Eq "^[[:space:]]*-? ${name}:" "$RENDER"; then
    fail "legacy mismatched env name present in rendered compose config: $name"; gate_failed=1
  fi
done
[ "$gate_failed" -eq 0 ] && pass "env-name contract: ${#REQUIRED_ENV_NAMES[@]} required present, no legacy names (TM-003 gate)"
grep -q "YACC_AUTH_AS_ISSUER: https://localhost" "$RENDER" && pass "AS issuer is the local origin (no placeholder domain)" || fail "AS issuer is not the local origin"
grep -qE 'YACC_REALTIME_WS_ALLOWED_ORIGINS:.*https://localhost' "$RENDER" && pass "WS allowed origins is the local origin" || fail "WS allowed origins wrong"
if grep -E '0\.0\.0\.0:' "$RENDER" | grep -q .; then fail "a non-loopback port binding found in compose config"; else pass "all published ports bound to loopback in config"; fi

# ---------------------------------------------------------------- phase 5
echo "--- Phase 5: local TLS certificate"
mkdir -p deploy/compose/tls
# Operator-controlled cert paths get the same symlink contract as local.env:
# openssl -keyout/-out follow symlinks and would truncate an unexpected
# target — reject before any write (reviewer finding class).
for tls_path in deploy/compose/tls/localhost.crt deploy/compose/tls/localhost.key; do
  if [ -L "$tls_path" ]; then
    fail "$tls_path is a symbolic link — refusing (remove it and let the script regenerate the certificate)"
    exit 1
  fi
done
if [ ! -f deploy/compose/tls/localhost.crt ] || [ ! -f deploy/compose/tls/localhost.key ]; then
  openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 825 \
    -keyout deploy/compose/tls/localhost.key -out deploy/compose/tls/localhost.crt \
    -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1
  chmod 600 deploy/compose/tls/localhost.key; chmod 644 deploy/compose/tls/localhost.crt
  pass "generated local self-signed certificate (CN=localhost, SAN DNS:localhost,IP:127.0.0.1) at deploy/compose/tls/ — git-ignored, no ACME attempted"
else
  pass "local self-signed certificate already present at deploy/compose/tls/"
fi

# ---------------------------------------------------------------- phase 6
echo "--- Phase 6: stack up (isolated project: $VERIFY_PROJECT)"
for port in 80 443; do
  if ss -ltn "( sport = :$port )" 2>/dev/null | grep -q '127.0.0.1'; then
    fail "127.0.0.1:$port already in use — stop the conflicting listener (e.g. a previously kept stack: 'docker compose ls' / 'docker ps') or override the mapping (runbook §ports)"
  else
    pass "host port 127.0.0.1:$port free"
  fi
done
BUILD_FLAG=""; [ "$SKIP_BUILD" -eq 0 ] && BUILD_FLAG="--build"
# Isolated per-run reset: nothing exists under this run's unique project yet,
# so this is a no-op reset (belt-and-braces against a name collision). It
# CANNOT delete unrelated resources: every resource Compose manages here is
# labeled/namespaced with $VERIFY_PROJECT. There is deliberately NO shared or
# fixed-project `down -v` in this script — nothing this script runs can
# destroy an operator's existing `yacc-local` stack or its data volume
# (reviewer finding).
$COMPOSE down -v --remove-orphans >/dev/null 2>&1 || true
# Arm the scoped teardown BEFORE `up`: from this point on, ANY exit path —
# `up` failing after a partial create, SIGINT/SIGTERM during startup, or a
# later check failure — tears down this run's (possibly partial) resources.
TEARDOWN_ARMED=1
if $COMPOSE up -d $BUILD_FLAG >"$TMPDIR_RUN/up.log" 2>&1; then
  pass "docker compose up -d $BUILD_FLAG (project $VERIFY_PROJECT)"
else
  fail "docker compose up failed: $(tail -5 "$TMPDIR_RUN/up.log")"
  exit 1   # trap teardown is ARMED — removes this run's partial resources
fi

BACKEND_CID="$($COMPOSE ps -q backend)"
echo "  waiting up to ${BACKEND_WAIT_SECONDS}s for backend health (Java boot + Flyway)…"
elapsed=0; healthy=0
while [ "$elapsed" -lt "$BACKEND_WAIT_SECONDS" ]; do
  st="$(docker inspect -f '{{.State.Health.Status}}' "$BACKEND_CID" 2>/dev/null || echo unknown)"
  [ "$st" = "healthy" ] && { healthy=1; break; }
  [ "$st" = "unhealthy" ] && { echo "  backend went unhealthy during boot — logs:"; $COMPOSE logs --tail 40 backend; break; }
  sleep 5; elapsed=$((elapsed+5))
done
if [ "$healthy" -eq 1 ]; then pass "backend container reports healthy (healthcheck on /health/ready — visibility signal)"; else fail "backend did not become healthy within ${BACKEND_WAIT_SECONDS}s"; $COMPOSE logs --tail 60 backend; fi
# Capture the backend log ONCE and grep the file: `docker compose logs` is a
# streaming writer, and piping it into `grep -q` under `set -o pipefail` is
# racy — an early grep exit can SIGPIPE the producer (reproduced: exit 255),
# turning a matching log into a spurious FAIL. A file capture is
# deterministic. A failed capture yields an empty file → honest FAILs below.
BACKEND_LOG="$TMPDIR_RUN/backend.log"
$COMPOSE logs backend > "$BACKEND_LOG" 2>/dev/null || true
grep -q "Started YaccApplication" "$BACKEND_LOG" && pass "backend log: Started YaccApplication" || fail "backend log lacks Started YaccApplication"
grep -Eiq "flyway" "$BACKEND_LOG" && pass "backend log: Flyway migration activity" || fail "backend log lacks Flyway evidence"

PG_CID="$($COMPOSE ps -q postgres)"; TRAEFIK_CID="$($COMPOSE ps -q traefik)"
[ "$(docker inspect -f '{{.State.Health.Status}}' "$PG_CID")" = "healthy" ] && pass "postgres healthy" || fail "postgres not healthy"
[ "$(docker inspect -f '{{.State.Health.Status}}' "$TRAEFIK_CID")" = "healthy" ] && pass "traefik healthy (ping)" || fail "traefik not healthy"

# ---------------------------------------------------------------- phase 7
echo "--- Phase 7: HTTPS through Traefik (curl -k REQUIRED: local self-signed cert — stated, not hidden)"
loc_code="$(curl -sk -o /dev/null -w '%{http_code} %{redirect_url}' "$ORIGIN_HTTP/health/live")"
echo "$loc_code" | grep -qE '^30[12378] https://(localhost|127\.0\.0\.1)' && pass "HTTP :80 redirects to HTTPS ($loc_code)" || fail "no HTTP→HTTPS redirect: $loc_code"
CERT_SUBJECT="$(echo | openssl s_client -connect localhost:443 -servername localhost 2>/dev/null | openssl x509 -noout -subject 2>/dev/null)"
echo "$CERT_SUBJECT" | grep -Eq "CN *= *localhost" && pass "TLS cert served is the local cert ($CERT_SUBJECT)" || fail "unexpected TLS cert: $CERT_SUBJECT"
live="$(curl -sk -o "$TMPDIR_RUN/live.json" -w '%{http_code}' "$ORIGIN/health/live")"
ready="$(curl -sk -o "$TMPDIR_RUN/ready.json" -w '%{http_code}' "$ORIGIN/health/ready")"
[ "$live" = "200" ] && pass "/health/live via Traefik HTTPS → 200" || fail "/health/live → $live"
[ "$ready" = "200" ] && pass "/health/ready via Traefik HTTPS → 200 (application readiness, not a dependency proof)" || fail "/health/ready → $ready"

# ---------------------------------------------------------------- phase 8
echo "--- Phase 8: authenticated REST through the proxy (values redacted)"
if [ "$ok_vars" -eq 0 ]; then fail "authenticated phases skipped — required secret variables missing"; exit 1; fi
signin_code="$(curl -sk -o "$TMPDIR_RUN/signin1.json" -w '%{http_code}' "$ORIGIN/api/auth/sign-in/email" \
  -H 'Content-Type: application/json' \
  --data "{\"email\":\"${SECRETS[YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL]}\",\"password\":\"${SECRETS[YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL]}\"}")"
[ "$signin_code" = "200" ] && pass "POST /api/auth/sign-in/email → 200 (bootstrap Super Admin)" || { fail "sign-in → $signin_code"; cat "$TMPDIR_RUN/signin1.json"; exit 1; }
TOKEN1="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("accessToken",""))' < "$TMPDIR_RUN/signin1.json")"
[ -n "$TOKEN1" ] || { fail "no accessToken in sign-in response"; exit 1; }
NEWPASS="$(openssl rand -base64 18)"
chg_code="$(curl -sk -o "$TMPDIR_RUN/chg.json" -w '%{http_code}' "$ORIGIN/api/auth/change-password" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN1" \
  --data "{\"currentPassword\":\"${SECRETS[YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL]}\",\"newPassword\":\"$NEWPASS\"}")"
[ "$chg_code" = "200" ] && pass "forced-password-change branch: POST /api/auth/change-password → 200" || fail "change-password → $chg_code"
signin2_code="$(curl -sk -o "$TMPDIR_RUN/signin2.json" -w '%{http_code}' "$ORIGIN/api/auth/sign-in/email" \
  -H 'Content-Type: application/json' \
  --data "{\"email\":\"${SECRETS[YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL]}\",\"password\":\"$NEWPASS\"}")"
[ "$signin2_code" = "200" ] && pass "re-sign-in with replaced credential → 200" || fail "re-sign-in → $signin2_code"
TOKEN2="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("accessToken",""))' < "$TMPDIR_RUN/signin2.json")"
conv_code="$(curl -sk -o "$TMPDIR_RUN/conv.json" -w '%{http_code}' "$ORIGIN/api/conversations" -H "Authorization: Bearer $TOKEN2")"
[ "$conv_code" = "200" ] && pass "GET /api/conversations via Traefik HTTPS + bearer token + DB-backed → 200 (data-path proof)" || { fail "GET /api/conversations → $conv_code"; cat "$TMPDIR_RUN/conv.json"; }

# ---------------------------------------------------------------- phase 9
echo "--- Phase 9: /ws upgrade through Traefik (101 valid / refused invalid)"
ws_result="$(python3 - "$TOKEN2" <<'PYEOF'
import socket, ssl, sys
token = sys.argv[1]
def probe(tok):
    ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
    s = ctx.wrap_socket(socket.create_connection(("localhost", 443), timeout=15))
    req = ("GET /ws?token=" + tok + " HTTP/1.1\r\nHost: localhost\r\n"
           "Upgrade: websocket\r\nConnection: Upgrade\r\n"
           "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n"
           "Origin: https://localhost\r\n\r\n")
    s.sendall(req.encode())
    first = s.recv(4096).decode(errors="replace").splitlines()[0]
    s.close()
    return first
print("VALID:" + probe(token))
print("INVALID:" + probe("not-a-valid-token"))
PYEOF
)"
echo "$ws_result" | grep -q "VALID:HTTP/1.1 101" && pass "/ws upgrade with valid token → 101 Switching Protocols" || fail "valid-token /ws upgrade failed: $(echo "$ws_result" | grep VALID)"
echo "$ws_result" | grep -Eq "INVALID:HTTP/1\.1 40[13]" && pass "/ws upgrade with invalid token → refused ($(echo "$ws_result" | grep INVALID | awk '{print $2, $3}'))" || fail "invalid-token /ws not refused: $(echo "$ws_result" | grep INVALID)"

# ---------------------------------------------------------------- phase 10
echo "--- Phase 10: runtime envelope (ADR-029 in container terms)"
[ "$(docker exec "$BACKEND_CID" id -u)" = "1000" ] && pass "backend runs as uid 1000 (non-root)" || fail "backend uid != 1000"
if docker exec "$BACKEND_CID" touch /nope 2>/dev/null; then fail "root FS is writable (touch /nope succeeded)"; else pass "read-only root FS (touch / fails)"; fi
docker exec "$BACKEND_CID" touch /app/heap-dumps/.w && docker exec "$BACKEND_CID" rm -f /app/heap-dumps/.w && pass "tmpfs /app/heap-dumps writable by uid 1000" || fail "heap-dumps tmpfs not writable"
INSPECT="$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}} {{.HostConfig.Memory}} {{.HostConfig.MemoryReservation}} {{.HostConfig.NanoCpus}} {{.HostConfig.CapDrop}}' "$BACKEND_CID")"
echo "$INSPECT" | grep -q "^true 2147483648 1073741824 1000000000" && pass "inspected: ReadonlyRootfs=true, Memory=2GiB cap, Reservation=1GiB, CPU=1.0 core" || fail "envelope mismatch: $INSPECT"
echo "$INSPECT" | grep -q "ALL" && pass "all Linux capabilities dropped" || fail "capabilities not dropped: $INSPECT"
echo "  enforcement note: Memory=2GiB is a hard cgroup RAM cap (breach → OOM kill); MemoryReservation=1GiB is ADVISORY in plain Compose (no scheduler admission — not a K8s request equivalent); CPU cap enforced via CFS quota."

# ---------------------------------------------------------------- phase 11
echo "--- Phase 11: public-surface audit (no non-loopback binding, minimal exposure)"
audit_ok=1
for svc in backend postgres traefik; do
  cid="$($COMPOSE ps -q "$svc")"
  ports_json="$(docker inspect -f '{{json .NetworkSettings.Ports}}' "$cid")"
  published="$(echo "$ports_json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(sum(len(v) for v in d.values() if v))')"
  if [ "$svc" = "traefik" ]; then
    ips="$(echo "$ports_json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(" ".join(b["HostIp"] for v in d.values() if v for b in v))')"
    bad="$(echo "$ips" | tr ' ' '\n' | grep -vc '^127\.0\.0\.1$' || true)"
    [ "$bad" -eq 0 ] && pass "traefik: only 127.0.0.1 host bindings ($ips)" || fail "traefik has a non-loopback binding: $ips"
  else
    [ "$published" -eq 0 ] && pass "$svc publishes NO host ports (compose network only)" || fail "$svc publishes $published port(s)"
  fi
done

# ---------------------------------------------------------------- phase 12
echo "--- Phase 12: repository secrets discipline"
if git grep -nIE '^(POSTGRES_PASSWORD|YACC_AUTH_TOKEN_SIGNING_KEY|YACC_INTEGRATION_ENCRYPTION_MASTER_KEY|YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL|RECOVERY_KEY|YACC_RECOVERY_KEY_HASH|YACC_AUTH_EMAIL_SENDGRID_API_KEY|YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL)=' -- ':!*.sops.env' ':!*.gitignore' | grep -qvE '=$|=ENC\['; then
  fail "a committed non-sops file carries a plaintext secret value"
  git grep -nIE '^(POSTGRES_PASSWORD|YACC_AUTH_TOKEN_SIGNING_KEY|YACC_INTEGRATION_ENCRYPTION_MASTER_KEY|YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL|RECOVERY_KEY|YACC_RECOVERY_KEY_HASH|YACC_AUTH_EMAIL_SENDGRID_API_KEY|YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL)=' -- ':!*.sops.env' | grep -vE '=$|=ENC\[' || true
else
  pass "no committed plaintext secret value (name-bearing lines are empty or ENC[ ciphertext)"
fi
grep -qE '^deploy/compose/secrets/\*\.env$' .gitignore && pass "decrypted env path is git-ignored" || fail "gitignore lacks the decrypted env rule"
git check-ignore "$ENV_FILE" >/dev/null && pass "local.env confirmed ignored by git" || fail "local.env NOT ignored"
# Issue-listed scan (reported for the record; reviewed — matches are names, not values):
echo "  issue scan reference — git grep -nI \"PASSWORD\\|API_KEY\\|_KEY=\" matches (names only): $(git grep -lnI 'PASSWORD\|API_KEY\|_KEY=' -- . | wc -l) files, $(git grep -nI 'PASSWORD\|API_KEY\|_KEY=' -- . | wc -l) lines (no values; see phase-3/12 assertions)"

# ---------------------------------------------------------------- phase 13
echo "--- Phase 13: whitespace hygiene"
if [ -z "$(git diff --check)" ]; then pass "git diff --check clean"; else fail "git diff --check reported issues"; git diff --check; fi

# ---------------------------------------------------------------- cleanup
# --keep disarms the teardown ONLY after fully successful verification (the
# reviewer's contract: a kept stack must be a verified stack). Any failure
# check (FAILURES > 0) or pre-success exit still tears this run's stack down.
if [ "$KEEP" -eq 1 ] && [ "$FAILURES" -eq 0 ]; then
  TEARDOWN_ARMED=0   # deliberate disarm: verification succeeded — leave THIS run's stack running
  echo "--- stack LEFT RUNNING (--keep) under isolated project '$VERIFY_PROJECT':"
  echo "    inspect:  docker compose -p $VERIFY_PROJECT -f deploy/compose/docker-compose.yml --env-file $ENV_FILE ps"
  echo "    teardown: docker compose -p $VERIFY_PROJECT -f deploy/compose/docker-compose.yml --env-file $ENV_FILE down -v"
else
  if teardown_stack >/dev/null 2>&1; then
    TEARDOWN_ARMED=0; TEARDOWN_DONE=1   # normal-path teardown done — the EXIT trap will not repeat it
    pass "teardown: docker compose down -v (project-scoped to '$VERIFY_PROJECT': only this run's containers/network + its own postgres volume; the operator's 'yacc-local' stack, other projects and volumes untouched)"
  else
    fail "teardown: docker compose down -v reported failure (this run's stack '$VERIFY_PROJECT' may still be running — inspect 'docker compose -p $VERIFY_PROJECT ps')"
  fi
fi

echo "==================================================================="
if [ "$FAILURES" -eq 0 ]; then
  echo " RESULT: ALL CHECKS PASSED"
else
  echo " RESULT: $FAILURES check(s) FAILED"
fi
echo " Honest semantics: healthcheck=visibility only · restart=process exit only ·"
echo " Traefik NOT readiness-gated · unhealthy-but-running recovery is manual ·"
echo " local/loopback target only — no public surface, no DNS, no ACME."
echo "==================================================================="
exit "$FAILURES"
