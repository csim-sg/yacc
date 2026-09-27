# MIG-012 — YACC Java/Spring backend runtime envelope (SPEC-002 TR-08; ADR-029).
#
# Multi-stage build:
#   1. build    — Temurin 21 JDK + Gradle wrapper; produces the boot jar.
#                 (The Gradle toolchain in build.gradle.kts pins Temurin 21,
#                 which this stage satisfies, so no extra JDK download.)
#   2. runtime  — Temurin 21 JRE only; non-root uid/gid 1000 (ADR-029).
#
# Runtime envelope contract (enforced by deploy/helm/yacc-backend in K8s):
#   - non-root (uid 1000, no capabilities)
#   - read-only root filesystem: java.io.tmpdir, heap dumps and logs are
#     pointed at emptyDir-mounted paths baked in as defaults below
#   - single HTTP port 8080 (Spring server.port; probes on /health/*)

# ---------------------------------------------------------------------------
# Build stage
# ---------------------------------------------------------------------------
FROM eclipse-temurin:21-jdk-noble AS build
WORKDIR /workspace

# Layer-cache the build scripts before the source tree.
COPY gradlew ./
COPY gradle ./gradle
COPY build.gradle.kts settings.gradle.kts ./
COPY src ./src

RUN ./gradlew --no-daemon bootJar

# ---------------------------------------------------------------------------
# Runtime stage
# ---------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-noble AS runtime

# Non-root runtime identity (ADR-029: runAsUser 1000). The Temurin Noble base
# ships an `ubuntu` user (uid 1000, sudo group) — it is replaced by a dedicated
# `yacc` identity at the same uid so the Helm runAsUser: 1000 contract holds
# with no login shell and no sudo group. The writable emptyDir targets exist
# so baked-in defaults work under a read-only root filesystem as well.
RUN groupdel ubuntu 2>/dev/null || true \
    && userdel --remove ubuntu 2>/dev/null || true \
    && groupadd --gid 1000 yacc \
    && useradd --uid 1000 --gid 1000 --no-create-home --shell /usr/sbin/nologin yacc \
    && mkdir -p /app /app/heap-dumps /app/logs /tmp/yacc \
    && chown -R 1000:1000 /app /tmp/yacc

WORKDIR /app
COPY --from=build --chown=1000:1000 /workspace/build/libs/yacc-backend-*.jar app.jar

# Container defaults (ADR-029). Helm may override via JAVA_TOOL_OPTIONS.
# - Heap sized as a percentage of the container limit (>=1Gi request / 2Gi limit).
# - Heap dumps land on the emptyDir-backed /app/heap-dumps, never the read-only root FS.
# - java.io.tmpdir on the emptyDir-backed /tmp.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError -XX:HeapDumpPath=/app/heap-dumps -Djava.io.tmpdir=/tmp"

USER 1000
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
