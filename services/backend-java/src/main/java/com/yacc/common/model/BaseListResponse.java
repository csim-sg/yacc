package com.yacc.common.model;

import java.util.List;

/**
 * The frozen list envelope (ledger row REST-XSRV-001; OpenAPI component
 * {@code BaseListResponse}): {@code {data, page, limit, total}} with
 * 1-indexed {@code page}.
 *
 * @param <T> page item type
 * @param data page items
 * @param page 1-indexed page number (as returned on the wire)
 * @param limit effective page size
 * @param total total matching items across all pages
 */
public record BaseListResponse<T>(List<T> data, int page, int limit, long total) {

    public static <T> BaseListResponse<T> of(List<T> data, int oneIndexedPage, int limit, long total) {
        return new BaseListResponse<>(data, oneIndexedPage, limit, total);
    }
}
