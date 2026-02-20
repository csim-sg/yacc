-- Add traceability fields to dead_letter_queue table
-- These fields enable ops to investigate failed messages across integration contexts
-- (Telegram groups, IRC channels, etc.)

ALTER TABLE "dead_letter_queue" 
ADD COLUMN "correlation_id" text,
ADD COLUMN "irc_profile_id" uuid,
ADD COLUMN "external_thread_type" text,
ADD COLUMN "external_thread_id" text;

-- Create indexes for traceability queries
CREATE INDEX "dlq_correlation_id_idx" ON "dead_letter_queue" ("correlation_id");
CREATE INDEX "dlq_irc_profile_id_idx" ON "dead_letter_queue" ("irc_profile_id");

-- Add comment documenting the contract
COMMENT ON COLUMN "dead_letter_queue"."correlation_id" IS 'Request correlation ID for tracing async delivery across services';
COMMENT ON COLUMN "dead_letter_queue"."irc_profile_id" IS 'IRC profile ID for IRC-specific context (optional)';
COMMENT ON COLUMN "dead_letter_queue"."external_thread_type" IS 'External platform thread type (e.g., telegram_group, irc_channel)';
COMMENT ON COLUMN "dead_letter_queue"."external_thread_id" IS 'External platform conversation/thread ID';
COMMENT ON COLUMN "dead_letter_queue"."message_id" IS 'UUID FK to messages.id - enforced by schema, never accept job IDs or external IDs';
COMMENT ON COLUMN "dead_letter_queue"."metadata" IS 'Additional context: stores external/job IDs (e.g., jobId: "msg-...", platform: "telegram")';
