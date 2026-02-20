ALTER TABLE "dead_letter_queue" ADD COLUMN "correlation_id" text;--> statement-breakpoint
ALTER TABLE "dead_letter_queue" ADD COLUMN "irc_profile_id" integer;--> statement-breakpoint
ALTER TABLE "dead_letter_queue" ADD COLUMN "external_thread_type" varchar(50);--> statement-breakpoint
ALTER TABLE "dead_letter_queue" ADD COLUMN "external_thread_id" varchar(255);--> statement-breakpoint
ALTER TABLE "dead_letter_queue" ADD CONSTRAINT "dead_letter_queue_irc_profile_id_integration_connection_profiles_id_fk" FOREIGN KEY ("irc_profile_id") REFERENCES "public"."integration_connection_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dlq_correlation_id_idx" ON "dead_letter_queue" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "dlq_irc_profile_id_idx" ON "dead_letter_queue" USING btree ("irc_profile_id");