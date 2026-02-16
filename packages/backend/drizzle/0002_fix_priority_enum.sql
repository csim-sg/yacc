ALTER TABLE "routing_rules" DROP CONSTRAINT "routing_rules_created_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "priority" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "priority" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."conversation_priority";--> statement-breakpoint
CREATE TYPE "public"."conversation_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "priority" SET DATA TYPE "public"."conversation_priority" USING 
  CASE 
    WHEN "priority" = 'medium' THEN 'normal'::"public"."conversation_priority"
    ELSE "priority"::"public"."conversation_priority"
  END;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "priority" SET DEFAULT 'normal'::"public"."conversation_priority";--> statement-breakpoint
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedup_idx" ON "notifications" USING btree ("user_id","conversation_id","type");