# Observability & SLO (Service Level Objectives)

**Date**: 2026-02-07  
**Status**: Phase 1 MVP Implementation  
**Scope**: Backend API endpoints, WebSocket gateway, message queue

---

## 🎯 SLO Targets (MVP)

| Component | SLO | Metric | Target | Notes |
|-----------|-----|--------|--------|-------|
| **Inbox API** | Availability | Uptime | 99.5% | Single VPS, no redundancy (Phase 2: multi-region) |
| **Inbox API** | Latency (p50) | Response time | <100ms | GET /conversations, GET /conversations/:id |
| **Inbox API** | Latency (p99) | Response time | <500ms | Maximum acceptable latency at 99th percentile |
| **Message Send** | Success rate | Success/Total | 95% | After 3 retries (DLQ captures failures) |
| **Message Retry** | Latency | Time to retry | 1m, 5m, 30m | Exponential backoff schedule |
| **WebSocket** | Availability | Uptime | 99.5% | Connection stability |
| **WebSocket** | Reconnection | Time to reconnect | <5s | Exponential backoff (1s → 60s max) |
| **Message Queue** | Processing latency | Time to process | <10s | From enqueue to delivery attempt |

---

## 📊 Metrics Instrumentation

### Structured Logging (Pino)

All API endpoints emit structured logs with correlation ID:

```typescript
// Example: GET /conversations
logger.debug({
  correlationId,
  filters: normalizedQuery,
  resultCount: result.data.length,
  total: result.total,
  durationMs: Math.round(duration),
}, 'GET /conversations completed');
```

**Logged fields**:
- `correlationId`: Request tracing ID (injected by middleware)
- `durationMs`: Endpoint response time (ms)
- `error`: Exception message (on failure)
- `resultCount`: Number of results returned
- `total`: Total available resources

### Metrics Collection (Phase 1: Manual, Phase 2: Prometheus)

**Current approach**: Structured logs with timing information.

**Metrics to track**:
1. **Response time (histogram)**
   - GET /conversations
   - GET /conversations/:id
   - POST /conversations/:id/messages
   - All auth endpoints

2. **Success/error rate (counter)**
   - HTTP status codes (200, 400, 401, 403, 404, 500)
   - Message delivery success/failure
   - Queue processing success/failure

3. **Resource utilization (gauge)**
   - Active connections (WebSocket)
   - Queue depth (pending messages)
   - Database connection pool usage

### Distributed Tracing (Phase 2)

**Current**: Correlation ID in logs.

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

- [x] Structured logging with correlation ID
- [x] Request duration tracking (durationMs)
- [x] Error logging (exception message + type)
- [x] Success/failure metrics
- [ ] Prometheus metrics (Phase 2)
- [ ] Distributed tracing (Phase 2)
- [ ] Custom business metrics (e.g., message delivery success rate)

---

## 📈 Log Aggregation & Analysis

### Current Setup
- **Logger**: Pino (structured JSON logging)
- **Transport**: Console + file (local development)
- **Format**: JSON (machine-readable for log aggregation)

### Future (Phase 2+)
- **Log aggregation**: ELK Stack or Datadog
- **Metrics backend**: Prometheus + Grafana
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

## ✅ Phase 1 Implementation Status

- [x] Structured logging with correlation ID (Pino)
- [x] Request duration tracking (durationMs)
- [x] Error logging and categorization
- [x] SLO targets defined
- [x] Rate limiting configured (auth endpoints)
- [ ] Prometheus metrics (Phase 2)
- [ ] Grafana dashboards (Phase 2)
- [ ] Automated alerts (Phase 2)
- [ ] Distributed tracing (Phase 2)

---

## 📚 Related Documents

- `.docs/03-implementation-guide.md` - Architecture & logging strategy
- `packages/backend/src/infrastructure/logger.ts` - Pino configuration
- `packages/backend/src/middleware/requestLogging.middleware.ts` - HTTP request logging

---

**Last Updated**: 2026-02-07  
**Next Review**: 2026-02-28 (post-Phase 1 MVP)
