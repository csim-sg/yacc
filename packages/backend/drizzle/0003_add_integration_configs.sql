CREATE TABLE "integration_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" varchar(50) NOT NULL,
	"server" varchar(255) NOT NULL,
	"port" integer NOT NULL DEFAULT 6667,
	"username" varchar(255) NOT NULL,
	"password_encrypted" text,
	"has_password" boolean NOT NULL DEFAULT false,
	"password_updated_at" timestamp,
	"channels" text NOT NULL,
	"updated_by_id" text,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "integration_configs_platform_idx" ON "integration_configs" USING btree ("platform");
--> statement-breakpoint
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
