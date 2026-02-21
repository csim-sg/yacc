**Status:** Accepted  
**Date:** 2026-02-21  
**Deciders:** Architecture Team  
**Technical Story:** FE-012B - WebSocket Observability

---

# GOV-030: WebSocket Observability & SLO Targets

## 1. Decision Summary

Implement comprehensive observability for WebSocket connections with 8 metrics, SLO tracking, and console-based metrics emission.

## 2. Governance Trigger

FE-012B requires defined SLO targets and metrics for WebSocket monitoring as per EA Principle #6 (Observability Is Mandatory).

## 3. SLO Definitions

### Connection Success Rate
- **Target**: ≥ 99.5%
- **Calculation**: successful_connections / total_connection_attempts
- **Measurement**: Per 24-hour window (rolling)
- **Alert**: Trigger warning if drops below 99%

### Event Delivery Latency (P95)
- **Target**: < 100ms (95th percentile)
- **Measurement**: Time from event emitted by server → handler execution complete on client
- **Includes**: Network latency + client processing
- **Excludes**: Server-side processing time

### Reconnection Success Rate
- **Target**: ≥ 95%
- **Calculation**: successful_reconnections / total_reconnection_attempts
- **Measurement**: Per 24-hour window
- **Alert**: Trigger warning if drops below 90%

### Backlog Replay Efficiency
- **Target**: < 5 seconds for 100 events
- **Measurement**: Time to replay all missed events after reconnect
- **Data Point**: backlog_size vs replay_duration
- **Alert**: Log warning if exceeds 5s

---

## 4. 8 Required Metrics

### 1. ws.connection.attempt (Counter)
- Incremented when connection attempt starts
- Tags: attempt_number, timestamp
- Purpose: Detect connection loops

### 2. ws.connection.success (Counter)
- Incremented on successful connection
- Tags: duration_ms, timestamp
- Purpose: Calculate success rate SLO

### 3. ws.connection.failure (Counter)
- Incremented on connection failure
- Tags: error_type, error_message, timestamp
- Purpose: Diagnose failure modes

### 4. ws.reconnection.attempt (Counter)
- Incremented when auto-reconnect triggered
- Tags: attempt_number, backoff_delay_ms, timestamp
- Purpose: Track reconnection efficiency

### 5. ws.event.received (Counter)
- Incremented for each WebSocket event
- Tags: event_type, payload_size_bytes, timestamp
- Purpose: Track event volume + sizes

### 6. ws.event.processed (Histogram/Gauge)
- Measure time from received → handler complete
- Tags: event_type, handler_count, duration_ms, timestamp
- Purpose: Calculate event latency SLO (P95)

### 7. ws.event.error (Counter)
- Incremented when handler throws
- Tags: event_type, error_type, error_message, timestamp
- Purpose: Surface handler bugs

### 8. ws.backlog.replay (Counter)
- Incremented when backlog replayed
- Tags: backlog_size, replay_duration_ms, timestamp
- Purpose: Track reconnection efficiency

---

## 5. Sampling Strategy
- High-frequency events (ws.event.received): Sample 1 in 100
- All other events: No sampling (emit all)
- Cardinality limit: Max 1000 unique (user_id, event_type) combinations
- Memory reset: Every 24 hours

---

## 6. Tooling (Phase 1)
- **Dev**: ConsoleMetricsSink (logs to console as JSON)
- **Prod Integration**: TBD (Datadog/New Relic/custom in Phase 2)

---

## 7. Compliance Assessment

| EA Principle | Compliance |
|--------------|------------|
| #6 Observability Is Mandatory | ✅ Full compliance - all metrics defined |
| #5 Zero Trust Service Communication | ✅ Metrics don't expose sensitive data |
| #1 API-First Integration | ✅ Metrics interface is pluggable |

## 8. Impact Assessment

### Files Created
- `packages/frontend/src/services/observability/MetricsSink.ts` - Interface
- `packages/frontend/src/services/observability/ConsoleMetricsSink.ts` - Implementation
- `packages/frontend/src/services/observability/NoOpMetricsSink.ts` - Testing
- `packages/frontend/src/services/observability/SLOMonitor.ts` - SLO tracking

### Files Modified
- `packages/frontend/src/services/websocket/WebSocketLogger.ts` - Metrics integration
- `packages/frontend/src/services/websocket/WebSocketClient.ts` - Metrics injection

### Test Coverage
- 130 tests passing
- Coverage includes all 8 metrics, SLO calculations, breach detection

## 9. Risk Acceptance / Waivers
No waivers required. Console-based metrics are sufficient for Phase 1.

## 10. Implementation Oversight
- Fullstack dev to implement metrics emission
- Architect to review PR for SLO target compliance
- QA to verify metrics appear in console during E2E tests

## 11. Traceability
- FE-012B - WebSocket Observability task
- GOV-005 - WebSocket Client Requirements (prerequisite)
- EA Principle #6 - Observability Is Mandatory

## 12. Sign-off
Approved by: Chris Sim (Solution Architect)
