package com.yacc.api.message;

import java.util.UUID;

/**
 * The outbound-dispatch trigger event (MIG-062 D3; guardrail G8). Published
 * by {@link MessageService#send} after the frozen 201/PENDING persistence so
 * the connector gateway exchange can dispatch asynchronously after the
 * response path — exactly the baseline {@code message.service}
 * {@code dispatchToConnector} non-blocking hand-off, re-expressed as a
 * framework event so the message module never depends on the connector
 * module (the exchange listens; dependency direction stays connector
 * &rarr; message).
 *
 * @param messageId      the persisted message id (dispatch subject)
 * @param conversationId the target conversation id
 */
public record MessageCreatedEvent(UUID messageId, UUID conversationId) {
}
