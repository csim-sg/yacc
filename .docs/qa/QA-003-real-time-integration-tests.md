# QA-003: Real-Time Integration Tests (WebSocket & BE-017-019, FE-013-015)

**Issue**: #197  
**Status**: Ready for Implementation  
**Scope**: WebSocket events, real-time message handling, reconnection scenarios  
**Framework**: Vitest (backend) + Playwright (frontend)  
**Target Coverage**: ≥90% for real-time paths

---

## WebSocket Event Tests

### Test Category 1: Connection Establishment

#### TC-RT-001: WebSocket connects on page load
```
Test: User loads conversation detail page
- Verify WebSocket handshake succeeds
- Verify connection status shows "connected"
- Verify ping/pong heartbeat starts (60 second interval)
Expected: Connection established within 500ms
```

#### TC-RT-002: WebSocket connects on demand
```
Test: User manually opens WebSocket in browser dev tools
- Call socket.connect()
- Verify connection state changes to connected
- Verify event listeners registered
Expected: Manual connection works
```

### Test Category 2: message.received Event

#### TC-RT-003: Receive new inbound message
```
Test: Remote user sends message to conversation
- Verify message.received event fires
- Verify message appended to timeline
- Verify sender name displays correctly
- Verify timestamp shows current time
- Verify unread count increments
- Verify notification generated
Expected: Message visible within 500ms
```

#### TC-RT-004: Multiple rapid messages
```
Test: 3 messages sent in quick succession
- Verify all 3 messages.received events fire
- Verify messages appended in order
- Verify unread count = 3
Expected: All messages queued and processed correctly
```

### Test Category 3: message.sent Event

#### TC-RT-005: Confirmation when message sent
```
Test: User sends message and event received
- User types message and clicks Send
- Verify message.sent event fires
- Verify message status shows "sent" not "pending"
- Verify send timestamp updates
Expected: Status changes immediately after confirmation
```

#### TC-RT-006: Message sent with attachment
```
Test: Send message with file attachment
- User uploads file and sends message
- Verify message.sent event includes attachment data
- Verify attachment URL displays
Expected: Attachments handled in real-time
```

### Test Category 4: message.failed Event

#### TC-RT-007: Failed message notification
```
Test: Backend reports message failed to send
- Message reaches max retries
- Verify message.failed event fires
- Verify message status shows "failed"
- Verify error message displays
- Verify Retry button appears
Expected: User notified of failure immediately
```

#### TC-RT-008: Network error handling
```
Test: Simulate network error during send
- Mock network failure during message send
- Verify message marked as "failed"
- Verify message.failed event fires
- Verify error persists after reconnect
Expected: Failed state persists correctly
```

---

## Reconnection Scenarios

### Test Category 5: Connection Loss & Recovery

#### TC-RT-009: WebSocket disconnects unexpectedly
```
Test: Close connection without normal close
- Close socket connection
- Verify connection status shows "disconnected"
- Verify exponential backoff starts
- Verify reconnection attempts at 1s, 2s, 4s, 8s, 16s
Expected: Automatic reconnection begins
```

#### TC-RT-010: Reconnect after 30 seconds
```
Test: Simulate 30 second disconnection
- Disconnect socket
- Wait 30 seconds
- Verify connection re-establishes
- Verify user prompted if needed
Expected: Reconnection successful within 45 seconds
```

#### TC-RT-011: Max reconnection attempts
```
Test: Disconnect and fail 5 reconnection attempts
- Disconnect socket
- Mock 5 failed reconnection attempts
- Verify last attempt made
- Verify error message displayed to user
- Allow manual retry
Expected: Graceful degradation after max retries
```

### Test Category 6: Message Backlog on Reconnect

#### TC-RT-012: Receive missed messages on reconnect
```
Test: Disconnect for 2 minutes, receive 3 messages, then reconnect
- Disconnect client
- Send 3 messages to conversation
- Reconnect client
- Verify all 3 missed messages delivered
- Verify messages inserted chronologically
Expected: Backlog from last 1 hour delivered
```

#### TC-RT-013: Backlog exceeds 1 hour window
```
Test: Message sent >1 hour ago should not be in backlog
- Disconnect client
- Wait > 1 hour (simulated)
- Send new message
- Reconnect
- Verify only recent message delivered (not old one)
Expected: 1-hour message retention enforced
```

#### TC-RT-014: Backlog with conversation updates
```
Test: During disconnect, conversation status and tags changed
- Disconnect client
- Update conversation status to "resolved"
- Add tag
- Reconnect
- Verify new state reflected
Expected: Backlog includes state changes
```

---

## Event Data Validation

### Test Category 7: Event Payload Structure

#### TC-RT-015: message.received event structure
```
Verify event includes:
- type: "message.received"
- conversationId: valid UUID
- message: {
    id: UUID,
    conversationId: UUID,
    senderName: string,
    body: string,
    status: "sent",
    direction: "inbound",
    createdAt: ISO8601,
    updatedAt: ISO8601
  }
```

#### TC-RT-016: message.sent event structure
```
Verify event includes:
- type: "message.sent"
- conversationId: UUID
- message: [complete message object with status="sent"]
- sentAt: ISO8601 timestamp
```

#### TC-RT-017: message.failed event structure
```
Verify event includes:
- type: "message.failed"
- conversationId: UUID
- message: [message object with status="failed"]
- error: string (error description)
- failedAt: ISO8601
- retryCount: number
```

---

## Load & Stress Tests

### Test Category 8: High-Volume Real-Time

#### TC-RT-018: 100 messages per second
```
Test: Send 100 messages rapidly
- Send 100 messages in 1 second
- Verify all received via WebSocket
- Verify browser doesn't crash
- Verify message order preserved
Expected: System handles burst without data loss
```

#### TC-RT-019: Multiple concurrent conversations
```
Test: Monitor 5 conversations simultaneously
- Open 5 conversation WebSockets
- Send messages to each
- Verify correct message routing
- Verify no message cross-contamination
Expected: Isolation between conversations maintained
```

---

## Browser & Device Tests

### Test Category 9: Cross-Browser Real-Time

#### TC-RT-020: Chrome WebSocket
```
Test: Real-time works in Chrome browser
- Test all scenarios in Chrome latest
Expected: 100% scenarios pass
```

#### TC-RT-021: Firefox WebSocket
```
Test: Real-time works in Firefox browser
- Test all scenarios in Firefox latest
Expected: 100% scenarios pass
```

#### TC-RT-022: Mobile Safari
```
Test: Real-time works on iOS Safari
- Test on iOS 16+ Safari
- Verify background reconnect works
- Verify app inactive state handled
Expected: Works on mobile with known limitations
```

#### TC-RT-023: Mobile Chrome
```
Test: Real-time works on Android Chrome
- Test on Android 12+ Chrome
- Verify network switch handling (WiFi ↔ LTE)
Expected: Resilient to network changes
```

---

## Error Scenarios

### Test Category 10: Edge Cases

#### TC-RT-024: Malformed event data
```
Test: Server sends invalid event structure
- Mock malformed event
- Verify error logged
- Verify UI doesn't crash
- Verify recovery occurs
Expected: Graceful handling of invalid data
```

#### TC-RT-025: Duplicate event
```
Test: Same event arrives twice
- Send event, then resend
- Verify duplicate handled (idempotency)
- Verify message not duplicated in UI
Expected: Deduplication works
```

#### TC-RT-026: Out-of-order events
```
Test: Events arrive out of order
- Send message A
- Send message B
- Events arrive: B then A
- Verify correct chronological order
Expected: Events reordered correctly
```

---

## Performance Metrics

All real-time operations should meet these targets:

| Metric | Target | Pass Criteria |
|--------|--------|--------------|
| Message latency (send to receive) | <500ms | <750ms |
| Event processing | <100ms | <200ms |
| Reconnection time | <3s | <5s |
| Message burst (100 msg/s) | No data loss | 100% delivery |
| Memory usage (1hr continuous) | <100MB | <150MB |

---

## Execution Guide

```bash
# Run all real-time tests
pnpm --filter @yacc/backend test qa-003

# Run only connection tests
pnpm --filter @yacc/backend test qa-003-001

# Run with real WebSocket (integration)
pnpm --filter @yacc/backend test qa-003 --integration

# Run load tests
pnpm --filter @yacc/backend test qa-003-018 --timeout=30000

# Run E2E real-time tests (Playwright)
pnpm --filter @yacc/frontend test e2e/real-time.spec.ts
```

---

## Success Criteria

✅ All WebSocket events tested  
✅ All reconnection scenarios pass  
✅ Message backlog delivery verified  
✅ Cross-browser compatibility confirmed  
✅ Performance targets met  
✅ Error handling robust  
✅ No data loss under load  

---

## Notes

- Tests should use mock WebSocket server for deterministic results
- Real backend testing should run separately with staging environment
- Performance metrics measured with browser DevTools
- Mobile tests require real devices or emulators
- Stress tests should run with monitoring (CPU, memory, network)
