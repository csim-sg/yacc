package com.yacc.api.realtime;

import java.time.LocalDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * The {@code message.failed} envelope {@code data} payload (MIG-062 D3/D5;
 * frozen schema {@code .docs/migration/schemas/message-failed.schema.json},
 * ledger WS-EVT-005). All six members are required; {@code status} is the
 * schema's {@code failed} constant and {@code attempt} is bounded
 * {@code 1..3}.
 *
 * <p><b>Truthful attempt/retryAt derivation (founder Option A):</b>
 * {@code attempt} counts the failed delivery — the initial dispatch failure
 * is attempt 1; a failed redelivery of cycle attempt {@code N} is attempt
 * {@code N+1}. {@code retryAt} is always the actual next scheduled retry
 * fire time on the frozen ladder. {@code message.failed} is therefore the
 * <b>retry-pending</b> signal only: exactly attempts {@code 1..3}, each
 * with a truthful next {@code retryAt}. A <b>terminal</b> (exhausted)
 * failure is deliberately <b>not emitted</b>: no retry follows, so a
 * schema-valid truthful {@code retryAt} does not exist and inventing a wire
 * value is forbidden. The terminal outcome is signalled by the frozen
 * {@code queue.message.dlq} broadcast at the exhaustion transition
 * ({@code GatewayExchange.onCycleExhausted}, notified by the worker after
 * the durable terminal commit) plus the durable terminal DLQ row and the
 * REST-QUEUE-006 {@code failed} job state.</p>
 *
 * @param messageId      the persisted message id
 * @param conversationId the conversation id
 * @param status         the schema constant {@code failed}
 * @param error          human-readable delivery failure (never credentials)
 * @param retryAt        the actual next retry fire time on the frozen ladder
 * @param attempt        the failed delivery attempt number ({@code 1..3})
 */
public record MessageFailedPayload(
        @JsonProperty("messageId") UUID messageId,
        @JsonProperty("conversationId") UUID conversationId,
        @JsonProperty("status") String status,
        @JsonProperty("error") String error,
        @JsonProperty("retryAt") LocalDateTime retryAt,
        @JsonProperty("attempt") int attempt) {
}
