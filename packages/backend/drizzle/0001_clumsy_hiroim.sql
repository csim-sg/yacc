CREATE TABLE "dead_letter_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"failure_reason" text NOT NULL,
	"total_attempts" integer DEFAULT 3 NOT NULL,
	"last_error" text NOT NULL,
	"moved_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"retry_attempt" boolean DEFAULT false,
	"retried_at" timestamp,
	"retried_by" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dead_letter_queue" ADD CONSTRAINT "dead_letter_queue_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dead_letter_queue" ADD CONSTRAINT "dead_letter_queue_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dlq_message_id_idx" ON "dead_letter_queue" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "dlq_conversation_id_idx" ON "dead_letter_queue" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "dlq_moved_at_idx" ON "dead_letter_queue" USING btree ("moved_at");--> statement-breakpoint
CREATE INDEX "dlq_expires_at_idx" ON "dead_letter_queue" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "dlq_failure_reason_idx" ON "dead_letter_queue" USING btree ("failure_reason");--> statement-breakpoint
CREATE INDEX "dlq_retry_attempt_idx" ON "dead_letter_queue" USING btree ("retry_attempt");