# Core Features & Data Specifications

This document outlines the requirements and data schemas for the core features of English Context Coach.

---

## 1. Paste Any English Text

The app must support generic pasted English text. Do not design around articles only.
Use generic product language:
```txt
text
source text
pasted text
lesson
key phrase
exercise
attempt
user error
MistakePattern
```
Avoid article-only naming in user-facing copy unless the content is actually an article.

---

## 2. Understand Section

Each lesson should ideally include:
*   Vietnamese summary
*   Natural Vietnamese translation
*   Context explanation
*   Key phrases
*   What to notice
*   Sentence breakdown if useful

The lesson should help the user understand the text even before practice.

---

## 3. Key Phrases

Key phrases focus on elements that Vietnamese learners may misunderstand (e.g. phrasal verbs, collocations, technical terms, business phrases, idioms, grammar patterns, tone/register cues).
Each key phrase should include:
*   `phrase`
*   `meaningVi` (general meaning in Vietnamese)
*   `meaningInContextVi` (meaning in context)
*   `literalTranslationVi` (literal translation trap, if any)
*   `naturalTranslationVi` (natural Vietnamese meaning)
*   `whyConfusingVi`
*   `exampleEn` / `exampleVi`
*   `category` / `difficulty`

---

## 4. Exercises & Practice

Supported exercise types:
*   `meaning_choice` (multiple choice on meaning)
*   `cloze_phrase` (fill in the blank)
*   `natural_translation` (translate English sentence into natural Vietnamese)
*   `focus_question` (open-ended question about whole-text meaning, tone, structure, or purpose)

Objective exercises should be graded without AI when possible. Open-ended exercises should be graded by AI with structured output.

---

## 5. Grading

Grading should focus on meaning and context, not exact matching. For translation tasks, grade by:
*   Meaning accuracy
*   Natural Vietnamese phrasing
*   Key phrase understanding
*   Context understanding
*   Literal translation risk (avoiding traps)

The app should accept multiple natural Vietnamese answers when they preserve the meaning.

---

## 6. Error Memory (Personal Error Memory)

A wrong answer should become structured learning memory when useful.
Expected fields:
*   `userId`
*   `errorType`
*   `targetItem`
*   `targetSkill`
*   `sourceSentence`
*   `userAnswer`
*   `correctAnswer`
*   `explanationVi`
*   `severity` / `confidence`
*   `repeatCount`
*   `firstSeenAt` / `lastSeenAt` / `nextReviewAt`
*   `masteryState` (`active`, `mastered`)

Only save errors when confidence is high enough. Do not pollute memory with uncertain or low-value feedback.

---

## 7. Repeated Mistake Detection

If the user makes a similar mistake again, the app should recognize it and state:
`"Bạn đã từng gặp lỗi này trước đây."`
Repeated mistakes increase priority for review.

---

## 8. Review System (Retention Engine)

Review is the retention engine. A MistakePattern should help the user practice an old mistake in a new context.
*   **Good review example**:
    *   *Old mistake*: Misunderstood `"run into trouble"`.
    *   *Context note*: Trong ngữ cảnh kỹ thuật, `"run into trouble"` nghĩa là `"gặp vấn đề / gặp khó khăn"`, không phải `"chạy vào rắc rối"`.
    *   *Practice prompt*: Translate: `"You may run into trouble with CPU-bound tasks."`

---

## 9. Progress Dashboard

Signals to display:
*   LearningStreak (consecutive active days)
*   Due reviews
*   Repeated mistake count
*   Mastered phrases
*   Top mistake patterns
*   Literal translation errors over time
*   Review success rate
*   Exercises and lessons completed

*   **North Star Metric**: *Repeated mistakes mastered per user per week.*

---

## 10. AI Output Rules

AI output should be structured and validated. Prefer strict JSON for:
*   Lesson generation
*   Exercise generation
*   Grading
*   Error extraction
*   Review generation

Always validate AI output before saving. If AI output is invalid, retry repair once if appropriate, fail gracefully, do not lose the user's pasted text, and do not save malformed learning data.

---

## 11. Definition of MVP Done

The MVP is done when this flow works completely:
```txt
User pastes text.
→ App explains meaning in Vietnamese.
→ App highlights confusing phrases.
→ App creates exercises.
→ User submits answers.
→ App grades answers.
→ App explains mistakes in Vietnamese.
→ App saves structured mistakes.
→ App creates MistakePatterns.
→ User reviews mistakes later.
→ Dashboard shows repeated mistake patterns or progress.
```
