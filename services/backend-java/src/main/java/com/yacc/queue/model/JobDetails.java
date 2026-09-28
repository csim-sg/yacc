package com.yacc.queue.model;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Job detail payload (frozen BullMQ-shaped response, DB re-expression).
 *
 * @param id          opaque job id
 * @param name        job name
 * @param data        job payload (JSON string)
 * @param state       job state label
 * @param progress    progress percentage
 * @param attemptsMade attempts so far
 * @param opts        retry options subset
 * @param failedReason failure reason when failed
 * @param stacktrace  error stack lines
 * @param createdAt   creation timestamp
 * @param finishedAt  completion timestamp
 */
public record JobDetails(String id, String name, String data, String state, int progress,
        int attemptsMade, JobOptions opts, String failedReason, List<String> stacktrace,
        LocalDateTime createdAt, LocalDateTime finishedAt) {
}
