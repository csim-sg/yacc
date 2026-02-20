ALTER TABLE "integration_connection_profiles" ALTER COLUMN "created_by_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "irc_profile_id" integer;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_irc_profile_id_integration_connection_profiles_id_fk" FOREIGN KEY ("irc_profile_id") REFERENCES "public"."integration_connection_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_irc_profile_channel_idx" ON "conversations" USING btree ("irc_profile_id","external_thread_id");--> statement-breakpoint
CREATE INDEX "conversations_irc_profile_id_idx" ON "conversations" USING btree ("irc_profile_id");