DROP INDEX IF EXISTS "conversations_external_thread_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "conversations_irc_profile_channel_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_external_thread_idx" ON "conversations" USING btree ("channel","external_thread_id") WHERE "conversations"."channel" != 'irc';--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_irc_profile_channel_idx" ON "conversations" USING btree ("channel","irc_profile_id","external_thread_id") WHERE "conversations"."channel" = 'irc';