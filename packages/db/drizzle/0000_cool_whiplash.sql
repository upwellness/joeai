CREATE TYPE "public"."conversation_purpose" AS ENUM('sales_internal', 'customer_support', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."conversation_type" AS ENUM('group', 'room', 'user');--> statement-breakpoint
CREATE TYPE "public"."employee_role" AS ENUM('sale', 'manager', 'admin', 'accounting');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending', 'downloading', 'stored', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'image', 'video', 'audio', 'file', 'location', 'sticker', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."slip_status" AS ENUM('received', 'ocr_pending', 'ocr_done', 'ocr_failed', 'matched_auto', 'pending_review', 'matched_manual', 'rejected', 'unresolved');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_code" text NOT NULL,
	"full_name" text NOT NULL,
	"nickname" text,
	"email" text,
	"phone" text,
	"team" text,
	"role" "employee_role" DEFAULT 'sale' NOT NULL,
	"password_hash" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_employee_code_unique" UNIQUE("employee_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"phone" text,
	"email" text,
	"external_crm_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "line_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line_user_id" text NOT NULL,
	"current_display_name" text,
	"picture_url" text,
	"employee_id" uuid,
	"customer_id" uuid,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "line_identities_line_user_id_unique" UNIQUE("line_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line_source_id" text NOT NULL,
	"type" "conversation_type" NOT NULL,
	"purpose" "conversation_purpose" DEFAULT 'unknown' NOT NULL,
	"name" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_line_source_id_unique" UNIQUE("line_source_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line_message_id" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"line_identity_id" uuid,
	"direction" "message_direction" NOT NULL,
	"message_type" "message_type" NOT NULL,
	"text_content" text,
	"transcript" text,
	"reply_to_line_msg_id" text,
	"mentions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"line_timestamp" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "messages_line_message_id_unique" UNIQUE("line_message_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"media_type" "message_type" NOT NULL,
	"status" "media_status" DEFAULT 'pending' NOT NULL,
	"s3_bucket" text,
	"s3_key" text,
	"content_type" text,
	"size_bytes" bigint,
	"duration_ms" integer,
	"width" integer,
	"height" integer,
	"download_attempts" integer DEFAULT 0 NOT NULL,
	"download_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stored_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statement_upload_id" uuid NOT NULL,
	"bank" text NOT NULL,
	"account_number" text,
	"txn_datetime" timestamp with time zone NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"description" text,
	"reference_number" text,
	"channel" text,
	"raw_row" jsonb,
	"matched_slip_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "statement_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"bank" text NOT NULL,
	"account_number" text,
	"statement_date" date NOT NULL,
	"file_s3_key" text,
	"row_count" integer,
	"status" text DEFAULT 'parsed' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "slips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"media_attachment_id" uuid,
	"customer_id" uuid,
	"status" "slip_status" DEFAULT 'received' NOT NULL,
	"ocr_raw_text" text,
	"ocr_provider" text,
	"ocr_confidence" numeric(5, 2),
	"extracted_amount" numeric(15, 2),
	"extracted_datetime" timestamp with time zone,
	"extracted_ref" text,
	"extracted_bank_from" text,
	"extracted_bank_to" text,
	"extracted_account_to" text,
	"extracted_fields" jsonb,
	"matched_txn_id" uuid,
	"match_confidence" numeric(5, 2),
	"match_method" text,
	"matched_by" uuid,
	"matched_at" timestamp with time zone,
	"reply_sent_at" timestamp with time zone,
	"reply_template" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slips_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before_state" jsonb,
	"after_state" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line_user_id" text NOT NULL,
	"consent_type" text NOT NULL,
	"consent_version" text NOT NULL,
	"granted" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evidence_url" text,
	"metadata" jsonb
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "line_identities" ADD CONSTRAINT "line_identities_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "line_identities" ADD CONSTRAINT "line_identities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_line_identity_id_line_identities_id_fk" FOREIGN KEY ("line_identity_id") REFERENCES "public"."line_identities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_attachments" ADD CONSTRAINT "media_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_statement_upload_id_statement_uploads_id_fk" FOREIGN KEY ("statement_upload_id") REFERENCES "public"."statement_uploads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "statement_uploads" ADD CONSTRAINT "statement_uploads_uploaded_by_employees_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "slips" ADD CONSTRAINT "slips_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "slips" ADD CONSTRAINT "slips_media_attachment_id_media_attachments_id_fk" FOREIGN KEY ("media_attachment_id") REFERENCES "public"."media_attachments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "slips" ADD CONSTRAINT "slips_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "slips" ADD CONSTRAINT "slips_matched_txn_id_bank_transactions_id_fk" FOREIGN KEY ("matched_txn_id") REFERENCES "public"."bank_transactions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "slips" ADD CONSTRAINT "slips_matched_by_employees_id_fk" FOREIGN KEY ("matched_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_employees_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employees_email" ON "employees" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employees_active_role" ON "employees" USING btree ("active","role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customers_phone" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customers_external" ON "customers" USING btree ("external_crm_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_line_identities_employee" ON "line_identities" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_line_identities_customer" ON "line_identities" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_line_identities_last_seen" ON "line_identities" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversations_type" ON "conversations" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversations_purpose" ON "conversations" USING btree ("purpose");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_messages_conversation_time" ON "messages" USING btree ("conversation_id","line_timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_messages_identity_time" ON "messages" USING btree ("line_identity_id","line_timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_media_message" ON "media_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_media_status" ON "media_attachments" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bank_txn_match_lookup" ON "bank_transactions" USING btree ("txn_datetime","amount");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bank_txn_ref" ON "bank_transactions" USING btree ("reference_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_bank_txn_unique" ON "bank_transactions" USING btree ("bank","account_number","txn_datetime","amount","reference_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_statement_bank_date" ON "statement_uploads" USING btree ("bank","statement_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_slips_status" ON "slips" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_slips_customer" ON "slips" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_entity" ON "audit_log" USING btree ("entity_type","entity_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_actor" ON "audit_log" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_consent_user_type" ON "consents" USING btree ("line_user_id","consent_type","consent_version");