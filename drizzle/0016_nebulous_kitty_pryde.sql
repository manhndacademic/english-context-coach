CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid,
	"target_user_id" uuid,
	"target_resource_type" text NOT NULL,
	"target_resource_id" text,
	"action" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_digest_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"digest_date" text NOT NULL,
	"status" text NOT NULL,
	"due_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_ai_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text DEFAULT 'gemini' NOT NULL,
	"name" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_fingerprint" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"error_message" text,
	"rate_limited_at" timestamp,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_digest_logs" ADD CONSTRAINT "email_digest_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ai_api_keys" ADD CONSTRAINT "user_ai_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_digest_logs_user_date_unique" ON "email_digest_logs" USING btree ("user_id","digest_date");--> statement-breakpoint
CREATE INDEX "email_digest_logs_date_status_idx" ON "email_digest_logs" USING btree ("digest_date","status");--> statement-breakpoint
CREATE INDEX "user_ai_api_keys_user_status_idx" ON "user_ai_api_keys" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_ai_api_keys_user_fingerprint_unique" ON "user_ai_api_keys" USING btree ("user_id","key_fingerprint");