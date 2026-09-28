package com.yacc.queue.model;

/**
 * Job lookup envelope (POC parity: success flag + job + 404 body twin).
 *
 * @param success always true on the 200 path
 * @param job     job details
 */
public record JobResponse(boolean success, JobDetails job) {
}
