package com.yacc.audit.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.audit.model.AuditLog;
import com.yacc.audit.repository.AuditLogRepository;
import com.yacc.common.controller.BadRequestException;

/**
 * Audit-log queries and export (ledger rows REST-AUDIT-001,
 * REST-AUDITLOG-001..003; POC {@code auditLogsQuery.service} parity):
 * filterable manager+ queries, conversation-scoped views, and the CSV/JSON
 * file download with Content-Disposition parity.
 */
@Service
public class AuditLogsQueryService {

    private final AuditLogRepository logs;
    private final ObjectMapper mapper;

    public AuditLogsQueryService(AuditLogRepository logs, ObjectMapper mapper) {
        this.logs = logs;
        this.mapper = mapper;
    }

    /** Filtered audit-log page (BaseListResponse items). */
    @Transactional(readOnly = true)
    public AuditPage query(AuditFilters filters) {
        int page = Math.max(1, filters.page() == null ? 1 : filters.page());
        int limit = Math.min(100, Math.max(1, filters.limit() == null ? 20 : filters.limit()));
        LocalDateTime from = parseDate(filters.dateFrom(), "dateFrom");
        LocalDateTime to = endOfDay(parseDate(filters.dateTo(), "dateTo"));
        if (from != null && to != null && from.isAfter(to)) {
            throw new BadRequestException("dateFrom must be before or equal to dateTo.");
        }

        Specification<AuditLog> spec = buildSpec(filters, from, to);
        var result = logs.findAll(spec,
                PageRequest.of(page - 1, limit, Sort.by(Sort.Direction.DESC, "createdAt")));
        return new AuditPage(result.getContent(), result.getTotalElements(), page, limit);
    }

    /** Conversation-scoped query: entityId = conversationId (POC parity). */
    @Transactional(readOnly = true)
    public AuditPage queryConversation(java.util.UUID conversationId, AuditFilters filters) {
        return query(new AuditFilters(filters.actorId(), filters.action(), filters.entityType(),
                conversationId.toString(), filters.dateFrom(), filters.dateTo(),
                filters.page(), filters.limit()));
    }

    /** Exports ALL matching logs as CSV or JSON (POC page-walk parity). */
    @Transactional(readOnly = true)
    public Export export(AuditFilters filters, String format) {
        List<AuditLog> all = new ArrayList<>();
        int pageSize = 100;
        AuditPage first = query(new AuditFilters(filters.actorId(), filters.action(),
                filters.entityType(), filters.entityId(), filters.dateFrom(), filters.dateTo(),
                1, pageSize));
        all.addAll(first.items());
        for (int page = 2; page <= first.pages(); page++) {
            all.addAll(query(new AuditFilters(filters.actorId(), filters.action(),
                    filters.entityType(), filters.entityId(), filters.dateFrom(), filters.dateTo(),
                    page, pageSize)).items());
        }
        String safeFormat = "json".equalsIgnoreCase(format) ? "json" : "csv";
        String data;
        if ("json".equals(safeFormat)) {
            List<java.util.Map<String, Object>> rows = new ArrayList<>();
            for (AuditLog entry : all) {
                java.util.Map<String, Object> row = new java.util.LinkedHashMap<String, Object>();
                row.put("id", entry.getId());
                row.put("actorId", entry.getActorId());
                row.put("action", entry.getAction());
                row.put("entityType", entry.getEntityType());
                row.put("entityId", entry.getEntityId() == null ? null : entry.getEntityId().toString());
                row.put("metadata", entry.getMetadata());
                row.put("createdAt", entry.getCreatedAt());
                rows.add(row);
            }
            try {
                data = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(rows);
            } catch (com.fasterxml.jackson.core.JsonProcessingException failure) {
                throw new BadRequestException("Failed to export audit logs");
            }
        } else {
            data = toCsv(all);
        }
        return new Export(data, safeFormat);
    }

    private Specification<AuditLog> buildSpec(AuditFilters filters, LocalDateTime from,
            LocalDateTime to) {
        Specification<AuditLog> spec = (root, query, cb) -> cb.conjunction();
        if (filters.actorId() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("actorId"), filters.actorId()));
        }
        if (filters.action() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("action"), filters.action()));
        }
        if (filters.entityType() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("entityType"), filters.entityType()));
        }
        if (filters.entityId() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("entityId"),
                    parseUuid(filters.entityId())));
        }
        if (from != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), from));
        }
        if (to != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("createdAt"), to));
        }
        return spec;
    }

    private UUID parseUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException failure) {
            throw new BadRequestException("Invalid entityId: " + value);
        }
    }

    private LocalDateTime parseDate(String value, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeParseException firstFailure) {
            try {
                return LocalDate.parse(value).atStartOfDay();
            } catch (DateTimeParseException ignored) {
                throw new BadRequestException("Invalid " + field + " format. Expected ISO 8601 string.");
            }
        }
    }

    private LocalDateTime endOfDay(LocalDateTime value) {
        if (value == null) {
            return null;
        }
        return value.toLocalDate().atTime(23, 59, 59, 999_999_999);
    }

    /** CSV rendering with Excel formula-injection protection (POC parity). */
    private String toCsv(List<AuditLog> entries) {
        StringBuilder csv = new StringBuilder(
                "ID,Actor ID,Action,Entity Type,Entity ID,Created At,Metadata\n");
        for (AuditLog entry : entries) {
            csv.append(escape(entry.getId().toString())).append(',')
                    .append(escape(entry.getActorId())).append(',')
                    .append(escape(entry.getAction())).append(',')
                    .append(escape(entry.getEntityType())).append(',')
                    .append(escape(entry.getEntityId().toString())).append(',')
                    .append(escape(entry.getCreatedAt().toString())).append(',')
                    .append(escape(entry.getMetadata()))
                    .append('\n');
        }
        return csv.toString();
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }
        String safe = value;
        if (safe.matches("^[=+\\-@].*")) {
            return "\"'" + safe + "\"";
        }
        if (safe.contains(",") || safe.contains("\"") || safe.contains("\n")) {
            return '"' + safe.replace("\"", "\"\"") + '"';
        }
        return safe;
    }

    /** Query filters (frozen GET /api/audit-logs parameter set). */
    public record AuditFilters(String actorId, String action, String entityType, String entityId,
            String dateFrom, String dateTo, Integer page, Integer limit) {
    }

    /** One audit-log page.
     *
     * @param items page items
     * @param total matching logs
     * @param page 1-indexed page
     * @param limit page size
     */
    public record AuditPage(List<AuditLog> items, long total, int page, int limit) {

        /** Pages in the POC payload sense: ceil(total/limit), ≥1 when total>0. */
        public int pages() {
            return (int) Math.max(1, (total + limit() - 1) / limit());
        }
    }

    /**
     * Export outcome.
     *
     * @param data file body
     * @param format csv | json
     */
    public record Export(String data, String format) {

        /** Suggested download filename (frozen contract parity). */
        public String filename() {
            return "audit-logs-" + java.time.Instant.now() + "." + format();
        }
    }
}
