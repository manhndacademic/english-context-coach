CREATE UNIQUE INDEX IF NOT EXISTS "user_errors_attempt_unique" ON "user_errors" USING btree ("attempt_id");--> statement-breakpoint
UPDATE "mistake_concepts"
SET "title_vi" = 'Ôn lại một điểm nghĩa trong ngữ cảnh',
    "explanation_vi" = 'Luyện lại cách hiểu ý thay vì dựa vào chi tiết riêng của nguồn gốc.',
    "safe_review_seed" = jsonb_build_object(
      'meaningVi', 'Ôn lại nghĩa tự nhiên trong ngữ cảnh.',
      'explanationVi', 'Luyện lại cách hiểu ý thay vì dựa vào chi tiết riêng của nguồn gốc.',
      'category', "category",
      'errorType', "error_type"::text
    ),
    "updated_at" = now()
WHERE "safe_review_seed"::text ~* '([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?://|[A-Z]{2,}-[0-9]+|project [A-Z0-9_-]{3,}|client [A-Z0-9_-]{3,}|customer [A-Z0-9_-]{3,}|ticket [A-Z0-9_-]{3,}|issue [A-Z0-9_-]{3,})'
   OR "title_vi" ~* '([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?://|[A-Z]{2,}-[0-9]+|project [A-Z0-9_-]{3,}|client [A-Z0-9_-]{3,}|customer [A-Z0-9_-]{3,}|ticket [A-Z0-9_-]{3,}|issue [A-Z0-9_-]{3,})'
   OR "explanation_vi" ~* '([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?://|[A-Z]{2,}-[0-9]+|project [A-Z0-9_-]{3,}|client [A-Z0-9_-]{3,}|customer [A-Z0-9_-]{3,}|ticket [A-Z0-9_-]{3,}|issue [A-Z0-9_-]{3,})';--> statement-breakpoint
UPDATE "mistake_patterns"
SET "safe_review_prompt_vi" = 'Ôn lại điểm nghĩa này theo cách tự nhiên trong ngữ cảnh.',
    "updated_at" = now()
WHERE "safe_review_prompt_vi" ~* '([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?://|[A-Z]{2,}-[0-9]+|project [A-Z0-9_-]{3,}|client [A-Z0-9_-]{3,}|customer [A-Z0-9_-]{3,}|ticket [A-Z0-9_-]{3,}|issue [A-Z0-9_-]{3,})';--> statement-breakpoint
UPDATE "mistake_patterns"
SET "occurrence_count" = evidence_counts.remaining_count,
    "updated_at" = now()
FROM (
  SELECT "mistake_pattern_id", count(*)::integer AS remaining_count
  FROM "mistake_evidence"
  GROUP BY "mistake_pattern_id"
) evidence_counts
WHERE "mistake_patterns"."id" = evidence_counts."mistake_pattern_id";
