package com.yacc.dlq.model;

import java.util.List;

/**
 * DLQ list payload (frozen custom shape).
 *
 * @param entries page items
 * @param total   matching entries
 * @param page    1-indexed page
 * @param limit   page size
 */
public record DlqListResponse(List<DlqEntryResponse> entries, long total, int page,
        int limit) {
}
