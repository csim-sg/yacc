CREATE TABLE "integration_connection_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL,
	"integration_type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"encrypted_credentials" text NOT NULL,
	"config" text NOT NULL,
	"created_by_id" text,
	"updated_by_id" text,
	"last_tested_at" timestamp,
	"last_test_passed" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "icp_active_implies_enabled" CHECK ("is_active" = false OR "is_enabled" = true)
);
--> statement-breakpoint
ALTER TABLE "integration_connection_profiles" ADD CONSTRAINT "integration_connection_profiles_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connection_profiles" ADD CONSTRAINT "integration_connection_profiles_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_profiles_active_idx" ON "integration_connection_profiles" USING btree ("tenant_id","integration_type","is_active") WHERE "integration_connection_profiles"."is_active" = true;--> statement-breakpoint
CREATE INDEX "integration_profiles_tenant_integration_idx" ON "integration_connection_profiles" USING btree ("tenant_id","integration_type");--> statement-breakpoint
CREATE INDEX "integration_profiles_active_idx_regular" ON "integration_connection_profiles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "integration_profiles_created_by_idx" ON "integration_connection_profiles" USING btree ("created_by_id");