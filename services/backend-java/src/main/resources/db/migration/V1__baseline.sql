-- V1 — clean schema baseline (SPEC-002 FR-03, MIG-020; ADR-027).
--
-- Full reset: re-expresses, in one monotonic baseline, the final state of the
-- POC's 19 pgTable schemas (packages/backend/src/schemas/*.schema.ts) as
-- evolved through the POC's Drizzle history 0000..0008 (see
-- packages/backend/drizzle/). The POC's duplicate `0005_*`/`0006_*` files are
-- resolved here: only the applied history survives — `0005_add_irc_profile_to_
-- conversations` (conversations.irc_profile_id integer FK) and
-- `0006_add_dlq_tracing_fields` (dead_letter_queue tracing columns, integer
-- FK); the orphan `0005_add_dlq_traceability_fields` (uuid FK, superseded) is
-- dropped without replacement. No legacy data migration (full reset).
--
-- Tables (19): users, account, session, verification, attachments, audit_logs,
-- conversations, conversation_tags, dead_letter_queue, integration_configs,
-- integration_connection_profiles, messages, notes, notifications,
-- password_reset_tokens, raw_payloads, routing_rules, routing_rule_executions,
-- tags.
--
-- Enumerated columns keep the POC's text timestamps and constraint/index
-- names verbatim so the ledger mapping (MIG-001/003) stays 1:1.

-- ---------------------------------------------------------------------------
-- PostgreSQL enums (7) — mapped to Java enums under ADR-030 model sub-layers:
-- auth.model.UserRole, auth.model.UserStatus, conversation.model.ChannelType,
-- conversation.model.ConversationStatus, conversation.model.ConversationPriority,
-- message.model.MessageStatus, message.model.MessageDirection.
-- ---------------------------------------------------------------------------
CREATE TYPE "channel_type" AS ENUM ('telegram', 'irc', 'whatsapp', 'wechat', 'meta', 'x', 'email', 'slack');
CREATE TYPE "conversation_priority" AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE "conversation_status" AS ENUM ('open', 'pending', 'resolved');
CREATE TYPE "message_direction" AS ENUM ('inbound', 'outbound');
CREATE TYPE "message_status" AS ENUM ('pending', 'sent', 'failed');
CREATE TYPE "user_role" AS ENUM ('super_admin', 'admin', 'manager', 'user');
CREATE TYPE "user_status" AS ENUM ('active', 'inactive', 'suspended');

-- ---------------------------------------------------------------------------
-- Tables (FK-dependency order)
-- ---------------------------------------------------------------------------

CREATE TABLE "users" (
    "id" text PRIMARY KEY,
    "email" varchar(255) NOT NULL,
    "name" varchar(255) NOT NULL,
    "password_hash" text NOT NULL,
    "role" "user_role" DEFAULT 'user' NOT NULL,
    "status" "user_status" DEFAULT 'active' NOT NULL,
    "email_verified" boolean DEFAULT false NOT NULL,
    "image" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "last_login_at" timestamp,
    "deleted_at" timestamp,
    CONSTRAINT "users_email_unique" UNIQUE ("email")
);

CREATE TABLE "account" (
    "id" text PRIMARY KEY,
    "user_id" text NOT NULL,
    "account_id" text NOT NULL,
    "provider_id" text NOT NULL,
    "access_token" text,
    "refresh_token" text,
    "expires_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "session" (
    "id" text PRIMARY KEY,
    "user_id" text NOT NULL,
    "expires_at" timestamp NOT NULL,
    "token" text NOT NULL,
    "ip_address" varchar(45),
    "user_agent" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "session_token_unique" UNIQUE ("token")
);

CREATE TABLE "verification" (
    "id" text PRIMARY KEY,
    "identifier" text NOT NULL,
    "value" text NOT NULL,
    "expires_at" timestamp NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "tags" (
    "id" serial PRIMARY KEY,
    "name" varchar(255) NOT NULL,
    "color" varchar(7) DEFAULT '#808080' NOT NULL,
    "created_by_id" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "integration_configs" (
    "id" serial PRIMARY KEY,
    "platform" varchar(50) NOT NULL,
    "server" varchar(255) NOT NULL,
    "port" integer DEFAULT 6667 NOT NULL,
    "username" varchar(255) NOT NULL,
    "password_encrypted" text,
    "has_password" boolean DEFAULT false NOT NULL,
    "password_updated_at" timestamp,
    "channels" text NOT NULL,
    "updated_by_id" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "integration_connection_profiles" (
    "id" serial PRIMARY KEY,
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

CREATE TABLE "conversations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "channel" "channel_type" NOT NULL,
    "external_thread_id" varchar(255) NOT NULL,
    "irc_profile_id" integer,
    "title" varchar(500),
    "status" "conversation_status" DEFAULT 'open' NOT NULL,
    "priority" "conversation_priority" DEFAULT 'normal' NOT NULL,
    "assigned_user_id" text,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "last_activity_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "conversation_tags" (
    "conversation_id" uuid NOT NULL,
    "tag_id" integer NOT NULL
);

CREATE TABLE "messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "conversation_id" uuid NOT NULL,
    "sender_id" text,
    "sender_name" varchar(255) NOT NULL,
    "body" text NOT NULL,
    "status" "message_status" DEFAULT 'pending' NOT NULL,
    "direction" "message_direction" NOT NULL,
    "external_message_id" varchar(255),
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "notes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "conversation_id" uuid NOT NULL,
    "author_id" text NOT NULL,
    "body" text NOT NULL,
    "mentions" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "notifications" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" text NOT NULL,
    "type" varchar(50) NOT NULL,
    "conversation_id" uuid,
    "actor_id" text,
    "message" text NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "password_reset_tokens" (
    "id" serial PRIMARY KEY,
    "user_id" text NOT NULL,
    "token" varchar(255) NOT NULL,
    "expires_at" timestamp NOT NULL,
    "used_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "password_reset_tokens_token_unique" UNIQUE ("token")
);

CREATE TABLE "raw_payloads" (
    "id" serial PRIMARY KEY,
    "message_id" uuid NOT NULL,
    "platform" varchar(50) NOT NULL,
    "payload" jsonb NOT NULL,
    "storage_key" varchar(500),
    "expires_at" timestamp DEFAULT NOW() + INTERVAL '7 days' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "routing_rules" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" varchar(255) NOT NULL,
    "description" text,
    "status" varchar(50) DEFAULT 'active' NOT NULL,
    "priority" integer DEFAULT 999 NOT NULL,
    "conditions" jsonb NOT NULL,
    "actions" jsonb NOT NULL,
    "created_by_id" text NOT NULL,
    "last_run_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "routing_rule_executions" (
    "id" serial PRIMARY KEY,
    "rule_id" uuid NOT NULL,
    "conversation_id" uuid NOT NULL,
    "matched_conditions" jsonb,
    "applied_actions" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "audit_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "actor_id" text,
    "action" varchar(255) NOT NULL,
    "entity_type" varchar(50) NOT NULL,
    "entity_id" uuid NOT NULL,
    "metadata" jsonb,
    "ip_address" varchar(45),
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "attachments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "message_id" uuid NOT NULL,
    "name" varchar(500) NOT NULL,
    "mime_type" varchar(100) NOT NULL,
    "size" integer NOT NULL,
    "storage_key" varchar(500) NOT NULL,
    "url" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "dead_letter_queue" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "message_id" uuid NOT NULL,
    "conversation_id" uuid NOT NULL,
    "payload" jsonb NOT NULL,
    "correlation_id" text,
    "irc_profile_id" integer,
    "external_thread_type" varchar(50),
    "external_thread_id" varchar(255),
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

-- ---------------------------------------------------------------------------
-- Foreign keys (POC constraint names verbatim)
-- ---------------------------------------------------------------------------
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE cascade;
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE set null;
ALTER TABLE "integration_connection_profiles" ADD CONSTRAINT "integration_connection_profiles_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE set null;
ALTER TABLE "integration_connection_profiles" ADD CONSTRAINT "integration_connection_profiles_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE set null;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE set null;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_irc_profile_id_integration_connection_profiles_id_fk" FOREIGN KEY ("irc_profile_id") REFERENCES "integration_connection_profiles"("id") ON DELETE set null;
ALTER TABLE "conversation_tags" ADD CONSTRAINT "conversation_tags_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade;
ALTER TABLE "conversation_tags" ADD CONSTRAINT "conversation_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE cascade;
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade;
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE set null;
ALTER TABLE "notes" ADD CONSTRAINT "notes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade;
ALTER TABLE "notes" ADD CONSTRAINT "notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE set null;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE set null;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE set null;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
ALTER TABLE "raw_payloads" ADD CONSTRAINT "raw_payloads_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE cascade;
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE cascade;
ALTER TABLE "routing_rule_executions" ADD CONSTRAINT "routing_rule_executions_rule_id_routing_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "routing_rules"("id") ON DELETE cascade;
ALTER TABLE "routing_rule_executions" ADD CONSTRAINT "routing_rule_executions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE set null;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE cascade;
ALTER TABLE "dead_letter_queue" ADD CONSTRAINT "dead_letter_queue_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE cascade;
ALTER TABLE "dead_letter_queue" ADD CONSTRAINT "dead_letter_queue_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade;
ALTER TABLE "dead_letter_queue" ADD CONSTRAINT "dead_letter_queue_irc_profile_id_integration_connection_profiles_id_fk" FOREIGN KEY ("irc_profile_id") REFERENCES "integration_connection_profiles"("id") ON DELETE set null;

-- ---------------------------------------------------------------------------
-- Indexes (final state of the POC history; names verbatim)
-- ---------------------------------------------------------------------------
CREATE INDEX "users_email_idx" ON "users" ("email");
CREATE INDEX "users_role_idx" ON "users" ("role");
CREATE INDEX "users_status_idx" ON "users" ("status");
CREATE INDEX "users_deleted_at_idx" ON "users" ("deleted_at");
CREATE INDEX "account_user_id_idx" ON "account" ("user_id");
CREATE UNIQUE INDEX "account_provider_account_idx" ON "account" ("provider_id", "account_id");
CREATE INDEX "session_user_id_idx" ON "session" ("user_id");
CREATE INDEX "session_token_idx" ON "session" ("token");
CREATE INDEX "session_expires_at_idx" ON "session" ("expires_at");
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");
CREATE INDEX "verification_expires_at_idx" ON "verification" ("expires_at");
CREATE UNIQUE INDEX "tags_name_created_by_idx" ON "tags" ("name", "created_by_id");
CREATE UNIQUE INDEX "integration_configs_platform_idx" ON "integration_configs" ("platform");
CREATE UNIQUE INDEX "integration_profiles_active_idx" ON "integration_connection_profiles" ("tenant_id", "integration_type", "is_active") WHERE "integration_connection_profiles"."is_active" = true;
CREATE INDEX "integration_profiles_tenant_integration_idx" ON "integration_connection_profiles" ("tenant_id", "integration_type");
CREATE INDEX "integration_profiles_active_idx_regular" ON "integration_connection_profiles" ("is_active");
CREATE INDEX "integration_profiles_created_by_idx" ON "integration_connection_profiles" ("created_by_id");
CREATE INDEX "conversations_channel_idx" ON "conversations" ("channel");
CREATE UNIQUE INDEX "conversations_irc_profile_channel_idx" ON "conversations" ("channel", "irc_profile_id", "external_thread_id") WHERE "conversations"."channel" = 'irc';
CREATE UNIQUE INDEX "conversations_external_thread_idx" ON "conversations" ("channel", "external_thread_id") WHERE "conversations"."channel" != 'irc';
CREATE INDEX "conversations_irc_profile_id_idx" ON "conversations" ("irc_profile_id");
CREATE INDEX "conversations_status_idx" ON "conversations" ("status");
CREATE INDEX "conversations_assigned_user_id_idx" ON "conversations" ("assigned_user_id");
CREATE INDEX "conversations_last_activity_at_idx" ON "conversations" ("last_activity_at");
CREATE UNIQUE INDEX "conversation_tags_pkey" ON "conversation_tags" ("conversation_id", "tag_id");
CREATE INDEX "messages_conversation_id_idx" ON "messages" ("conversation_id");
CREATE INDEX "messages_sender_id_idx" ON "messages" ("sender_id");
CREATE INDEX "messages_status_idx" ON "messages" ("status");
CREATE INDEX "messages_direction_idx" ON "messages" ("direction");
CREATE INDEX "messages_created_at_idx" ON "messages" ("created_at");
CREATE INDEX "notes_conversation_id_idx" ON "notes" ("conversation_id");
CREATE INDEX "notes_author_id_idx" ON "notes" ("author_id");
CREATE INDEX "notifications_user_id_idx" ON "notifications" ("user_id");
CREATE INDEX "notifications_is_read_idx" ON "notifications" ("is_read");
CREATE INDEX "notifications_created_at_idx" ON "notifications" ("created_at");
CREATE UNIQUE INDEX "notifications_dedup_idx" ON "notifications" ("user_id", "conversation_id", "type");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" ("user_id");
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens" ("token");
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens" ("expires_at");
CREATE INDEX "raw_payloads_message_id_idx" ON "raw_payloads" ("message_id");
CREATE INDEX "raw_payloads_expires_at_idx" ON "raw_payloads" ("expires_at");
CREATE INDEX "routing_rules_status_idx" ON "routing_rules" ("status");
CREATE INDEX "routing_rules_priority_idx" ON "routing_rules" ("priority");
CREATE INDEX "routing_rule_executions_rule_id_idx" ON "routing_rule_executions" ("rule_id");
CREATE INDEX "routing_rule_executions_conversation_id_idx" ON "routing_rule_executions" ("conversation_id");
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" ("actor_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" ("action");
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs" ("entity_type");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" ("created_at");
CREATE INDEX "attachments_message_id_idx" ON "attachments" ("message_id");
CREATE INDEX "dlq_message_id_idx" ON "dead_letter_queue" ("message_id");
CREATE INDEX "dlq_conversation_id_idx" ON "dead_letter_queue" ("conversation_id");
CREATE INDEX "dlq_moved_at_idx" ON "dead_letter_queue" ("moved_at");
CREATE INDEX "dlq_expires_at_idx" ON "dead_letter_queue" ("expires_at");
CREATE INDEX "dlq_failure_reason_idx" ON "dead_letter_queue" ("failure_reason");
CREATE INDEX "dlq_retry_attempt_idx" ON "dead_letter_queue" ("retry_attempt");
CREATE INDEX "dlq_correlation_id_idx" ON "dead_letter_queue" ("correlation_id");
CREATE INDEX "dlq_irc_profile_id_idx" ON "dead_letter_queue" ("irc_profile_id");
