import { db, schema } from "../db";
import { eq, inArray } from "drizzle-orm";

async function run() {
  const args = process.argv.slice(2);
  const isCopy = args.includes("--copy");
  const isCutover = args.includes("--cutover");

  if (!isCopy && !isCutover) {
    console.error("Vui lòng cung cấp tham số --copy hoặc --cutover.");
    console.error("Ví dụ:");
    console.error(
      "  bun run src/scripts/migrate-legacy-phrase-reviews.ts --copy"
    );
    console.error(
      "  bun run src/scripts/migrate-legacy-phrase-reviews.ts --cutover"
    );
    process.exit(1);
  }

  if (isCopy) {
    console.log("[Migration] Bắt đầu sao chép dữ liệu ôn tập cụm từ cũ...");

    // 1. Lấy tất cả các dòng ôn tập cụm từ từ bảng mistake_patterns
    const legacyPatterns = await db
      .select()
      .from(schema.mistakePatterns)
      .where(eq(schema.mistakePatterns.source, "phrase"));

    console.log(
      `[Migration] Tìm thấy ${legacyPatterns.length} mẫu lỗi dạng phrase cần di chuyển.`
    );

    if (legacyPatterns.length === 0) {
      console.log("[Migration] Không có dữ liệu cũ nào cần di chuyển.");
      return;
    }

    let copiedCount = 0;
    const legacyIds = legacyPatterns.map((p) => p.id);

    // 2. Sao chép từng dòng sang bảng phrase_practices
    for (const pattern of legacyPatterns) {
      const practiceValue = {
        id: pattern.id,
        userId: pattern.userId,
        source: "phrase" as const,
        keyPhraseId: pattern.keyPhraseId,
        conceptKey: pattern.conceptKey,
        normalizedPhrase: pattern.normalizedPhrase,
        senseKey: pattern.senseKey ?? pattern.conceptKey,
        category: pattern.category,
        meaningVi: pattern.meaningVi,
        safeReviewPromptVi: pattern.safeReviewPromptVi,
        reviewPromptEn: pattern.reviewPromptEn,
        reviewPromptVi: pattern.reviewPromptVi,
        reviewRubricVi: pattern.reviewRubricVi,
        reviewCorrectAnswer: pattern.reviewCorrectAnswer,
        reviewAcceptableAnswers: pattern.reviewAcceptableAnswers,
        reviewType: pattern.reviewType,
        reviewChoices: pattern.reviewChoices,
        reviewPromptStatus: pattern.reviewPromptStatus,
        reviewPromptAttempts: pattern.reviewPromptAttempts,
        reviewPromptError: pattern.reviewPromptError,
        reviewPromptLockedAt: pattern.reviewPromptLockedAt,
        reviewPromptLockedBy: pattern.reviewPromptLockedBy,
        intervalDays: pattern.intervalDays,
        easeFactor: pattern.easeFactor,
        repetitions: pattern.repetitions,
        masteryState: pattern.masteryState,
        dueAt: pattern.dueAt,
        lastReviewedAt: pattern.lastReviewedAt,
        isSensitive: pattern.isSensitive,
        createdAt: pattern.createdAt,
        updatedAt: pattern.updatedAt,
      };

      await db
        .insert(schema.phrasePractices)
        .values(practiceValue)
        .onConflictDoUpdate({
          target: [
            schema.phrasePractices.userId,
            schema.phrasePractices.conceptKey,
            schema.phrasePractices.senseKey,
          ],
          set: practiceValue,
        });

      copiedCount++;
    }

    console.log(
      `[Migration] Đã sao chép thành công ${copiedCount} cụm từ sang bảng phrase_practices.`
    );

    // 3. Sao chép lịch sử luyện tập (review_attempts -> phrase_practice_attempts)
    const reviewAttempts = await db
      .select()
      .from(schema.reviewAttempts)
      .where(inArray(schema.reviewAttempts.mistakePatternId, legacyIds));

    console.log(
      `[Migration] Tìm thấy ${reviewAttempts.length} lượt ôn tập lịch sử cần di chuyển.`
    );

    if (reviewAttempts.length > 0) {
      let attemptsCopied = 0;
      for (const attempt of reviewAttempts) {
        await db
          .insert(schema.phrasePracticeAttempts)
          .values({
            id: attempt.id,
            userId: attempt.userId,
            phrasePracticeId: attempt.mistakePatternId, // ID giống nhau vì ta đã bảo toàn ID
            answer: attempt.answer,
            score: attempt.score,
            isCorrect: attempt.isCorrect,
            feedbackVi: attempt.feedbackVi,
            createdAt: attempt.createdAt,
          })
          .onConflictDoNothing();

        attemptsCopied++;
      }
      console.log(
        `[Migration] Đã di chuyển thành công ${attemptsCopied} lượt ôn tập lịch sử.`
      );
    }

    console.log(
      "[Migration] HOÀN THÀNH giai đoạn SAO CHÉP. Hãy xác thực lại ứng dụng trước khi chạy --cutover."
    );
  }

  if (isCutover) {
    console.log("[Migration] Bắt đầu dọn dẹp các dòng cũ (cutover)...");

    // 1. Lấy tất cả các dòng ôn tập cụm từ cũ
    const legacyPatterns = await db
      .select({ id: schema.mistakePatterns.id })
      .from(schema.mistakePatterns)
      .where(eq(schema.mistakePatterns.source, "phrase"));

    const legacyIds = legacyPatterns.map((p) => p.id);

    if (legacyIds.length === 0) {
      console.log(
        "[Migration] Không tìm thấy dòng cụm từ cũ nào cần xóa trong mistake_patterns."
      );
      return;
    }

    // 2. Kiểm tra xem chúng đã được sao chép thành công sang phrase_practices chưa
    const copiedPractices = await db
      .select({ id: schema.phrasePractices.id })
      .from(schema.phrasePractices)
      .where(inArray(schema.phrasePractices.id, legacyIds));

    const copiedIds = new Set(copiedPractices.map((p) => p.id));
    const verifiedIds = legacyIds.filter((id) => copiedIds.has(id));

    console.log(
      `[Migration] Xác thực thành công: ${verifiedIds.length} / ${legacyIds.length} dòng đã tồn tại trong phrase_practices.`
    );

    if (verifiedIds.length === 0) {
      console.error(
        "[Migration] Lỗi: Chưa có dòng nào được sao chép sang phrase_practices. Vui lòng chạy --copy trước."
      );
      process.exit(1);
    }

    // 3. Xóa các bản ghi liên quan trong review_attempts
    const attemptsDeleted = await db
      .delete(schema.reviewAttempts)
      .where(inArray(schema.reviewAttempts.mistakePatternId, verifiedIds))
      .returning({ id: schema.reviewAttempts.id });

    console.log(
      `[Migration] Đã xóa ${attemptsDeleted.length} lượt ôn tập cũ trong bảng review_attempts.`
    );

    // 4. Xóa trong mistake_patterns
    const patternsDeleted = await db
      .delete(schema.mistakePatterns)
      .where(inArray(schema.mistakePatterns.id, verifiedIds))
      .returning({ id: schema.mistakePatterns.id });

    console.log(
      `[Migration] Đã xóa thành công ${patternsDeleted.length} cụm từ cũ trong bảng mistake_patterns.`
    );
    console.log("[Migration] HOÀN THÀNH giai đoạn DỌN DẸP CUTOVER thành công!");
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[Migration] Lỗi bất thường xảy ra:", err);
    process.exit(1);
  });
