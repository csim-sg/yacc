# Observability & SLO (Service Level Objectives)

**Date**: 2026-02-07 (instrumentation posture updated 2026-10-18 for the Java service, ADR-029)  
**Status**: MVP implementation (Java/Spring backend of record)  
**Scope**: Backend API endpoints, WebSocket channel, async retry worker

---

## 🎯 SLO Targets (MVP)

| Component | SLO | Metric | Target | Notes |
|-----------|-----|--------|--------|-------|
| **Inbox API** | Availability | Uptime | 99.5% | Single K3s cluster, no redundancy (Phase 2: multi-region) |
| **Inbox API** | Latency (p50) | Response time | <100ms | GET /conversations, GET /conversations/:id |
| **Inbox API** | Latency (p99) | Response time | <500ms | Maximum acceptable latency at 99th percentile |
| **Message Send** | Success rate | Success/Total | 95% | After 3 retries (DLQ captures failures) |
| **Message Retry** | Latency | Time to retry | 1m, 5m, 30m | Exponential backoff schedule (Quartz, ADR-028) |
| **WebSocket** | Availability | Uptime | 99.5% | Connection stability |
| **WebSocket** | Reconnection | Time to reconnect | <5s | Exponential backoff (1s → 60s max) |
| **Message Queue** | Processing latency | Time to process | <10s | From enqueue to delivery attempt |

---

## 📊 Metrics Instrumentation

### Structured Logging (SLF4J/logback JSON — ADR-029)

All API endpoints emit structured JSON logs with correlation ID. The logback production profile preserves the **Pino-era field shape** (flat top-level fields, MDC `correlationId` at top level) so existing log queries keep working — field-shape parity was an ADR-029 acceptance requirement. Sample line shape:

```json
{"level":"info","time":"2026-09-27T12:34:56.789Z","msg":"...","correlationId":"..."}
```

**Logged fields** (parity with the Pino baseline):
- `correlationId`: Request tracing ID (MDC, injected by the correlation filter)
- `durationMs`: Endpoint response time (ms)
- `error`: Exception message (on failure)
- `resultCount`: Number of results returned
- `total`: Total available resources

### Metrics Collection (Micrometer — live)

**Current approach**: Micrometer instruments the JVM/HTTP/DB layers; the frozen scrape path is **`/actuator/prometheus`** (ADR-029; management endpoints expose `health` + `prometheus`).

**Metrics tracked**:
1. **Response time (histogram)** — HTTP server requests (`http.server.requests`)
   - GET /conversations
   - GET /conversations/:id
   - POST /conversations/:id/messages
   - All auth endpoints

2. **Success/error rate (counter)**
   - HTTP status codes (200, 400, 401, 403, 404, 500)
   - Message delivery success/failure
   - Queue/retry processing success/failure

3. **Resource utilization (gauge)**
   - Active WebSocket sessions
   - Quartz job / retry depth
   - Database connection pool usage (HikariCP)

### Distributed Tracing (Phase 2)

**Current**: correlationId in logs (MDC) and wire envelopes.

**Future** (Phase 2):
- OpenTelemetry integration
- Jaeger backend
- Trace sampling (1% of requests)

---

## 📋 Endpoint SLOs

### GET /conversations
- **SLO**: p99 < 500ms
- **Metrics emitted**:
  - durationMs
  - resultCount
  - total
  - filters applied
- **Error rates tracked**: 400, 401, 403, 404, 500

### GET /conversations/:id
- **SLO**: p99 < 200ms (single resource fetch)
- **Metrics emitted**:
  - durationMs
  - conversationId
- **Error rates tracked**: 404 (not found), 500

### GET /conversations/:id/messages
- **SLO**: p99 < 300ms (paginated list)
- **Metrics emitted**:
  - durationMs
  - page
  - limit
  - messageCount
  - total
- **Error rates tracked**: 404, 500

### POST /conversations/:id/messages
- **SLO**: p99 < 200ms (submit, not delivery)
- **Metrics emitted**:
  - durationMs
  - conversationId
  - userId
  - messageId
- **Error rates tracked**: 400, 404, 500

### POST /auth/sign-in/email
- **SLO**: p99 < 500ms
- **Metrics emitted**:
  - durationMs
  - success/failure
- **Rate limit**: 5 requests per 15 minutes per IP

### POST /auth/forgot-password
- **SLO**: p99 < 1000ms (includes email send)
- **Metrics emitted**:
  - durationMs
  - success (always 200 to prevent enumeration)
- **Rate limit**: 3 requests per 15 minutes per email

### POST /auth/reset-password
- **SLO**: p99 < 500ms
- **Metrics emitted**:
  - durationMs
  - success/failure
- **Error codes**: 400 (invalid token), 500 (internal error)

---

## 🔍 Observability Checklist (Per Endpoint)

- [x] Structured JSON logging with correlation ID (logback + MDC; ADR-029 field-shape parity)
- [x] Request duration tracking (durationMs)
- [x] Error logging (exception message + type)
- [x] Success/failure metrics
- [x] Prometheus metrics (`/actuator/prometheus`, ADR-029 frozen scrape path)
- [ ] Distributed tracing (Phase 2)
- [ ] Custom business metrics (e.g., message delivery success rate)

---

## 📈 Log Aggregation & Analysis

### Current Setup
- **Logger**: SLF4J + logback, structured JSON (`logback-spring.xml`, `production` profile)
- **Transport**: stdout console (collected by the kubelet); MDC carries `correlationId`
- **Format**: JSON (machine-readable for log aggregation; Pino-era field shape preserved)

### Future (Phase 2+)
- **Log aggregation**: ELK Stack or Datadog
- **Metrics backend**: Prometheus + Grafana (scraping `/actuator/prometheus`)
- **Alerts**: Critical errors, SLO breaches

### Log Query Examples

```bash
# Find slow requests (>500ms)
cat logs.json | jq 'select(.durationMs > 500)'

# Count errors by endpoint
cat logs.json | jq 'select(.error) | .msg' | sort | uniq -c

# Find requests with correlation ID
cat logs.json | jq "select(.correlationId == \"abc-123\")"
```

---

## 🚨 SLO Breach Scenarios

| Scenario | SLO | Threshold | Action |
|----------|-----|-----------|--------|
| **Inbox API p99 > 1000ms** | <500ms | 2 consecutive 5-min periods | Page on-call, investigate database/cache |
| **Message delivery < 90%** | >95% | 5+ messages in DLQ in 1 hour | Page on-call, check Telegram/IRC connectivity |
| **WebSocket reconnection > 10s** | <5s | Any reconnection >10s | Check network stability |
| **Availability < 99%** | >99.5% | 7+ minutes downtime per hour | Page on-call, check infrastructure |

---

## ✅ Implementation Status

- [x] Structured JSON logging with correlation ID (logback + MDC, ADR-029; Pino-era field shape preserved)
- [x] Request duration tracking (durationMs)
- [x] Error logging and categorization
- [x] SLO targets defined
- [x] Rate limiting on sensitive auth endpoints (e.g., password-reset rate limiter)
- [x] Micrometer metrics at `/actuator/prometheus` (ADR-029)
- [ ] Grafana dashboards (Phase 2)
- [ ] Automated alerts (Phase 2)
- [ ] Distributed tracing (Phase 2)

---

## 📚 Related Documents

- `.docs/adr/ADR-029-jvm-deployment-envelope-observability.md` — instrumentation authority (logging/metrics parity requirements)
- `services/backend-java/src/main/resources/logback-spring.xml` — structured JSON logging configuration
- `.docs/03-implementation-guide.md` - Architecture & logging strategy

---

**Last Updated**: 2026-10-18  
**Next Review**: with MIG-070 (#361) cutover rehearsal
