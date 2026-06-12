# AGENTS.md

# English Context Coach — Coding Agent Guide

This document defines the product direction, coding priorities, and decision rules for any coding agent working on this repository.

The goal is not to build a weaker ChatGPT for English learning.

The goal is to build a Vietnamese-first learning system that helps users understand real English in context, practice from their own mistakes, remember repeated misunderstandings, and improve over time.

---

## 1. Product North Star

English Context Coach helps Vietnamese learners paste any English text from work, study, documentation, emails, messages, GitHub issues, PR comments, blogs, articles, or general reading.

The app should help users:

1. Understand the real meaning in context.
2. Avoid word-by-word translation.
3. Practice with exercises generated from the pasted text.
4. Receive Vietnamese feedback.
5. Save repeated mistakes as learning memory.
6. Review those mistakes later.
7. See that they are making fewer repeated mistakes over time.

The product loop is:

```txt
Paste text
→ Understand context
→ Practice
→ Get feedback
→ Save mistake
→ Review later
→ Improve over time
```

Every important feature should strengthen this loop.

---

## 2. What This App Is

This app is:

```txt
A context-first English learning coach for Vietnamese learners.
```

It is designed for real English that users encounter in work and study:

* Slack messages
* emails
* GitHub issues
* pull request comments
* API documentation
* technical blogs
* error messages
* academic materials
* course materials
* general English text

The app should explain English in a way that feels natural to Vietnamese learners.

---

## 3. What This App Is Not

This app is not:

```txt
A generic AI chatbot.
A simple translation app.
A grammar checker only.
A news/article-only app.
A Duolingo clone.
A weaker ChatGPT wrapper.
```

Avoid building generic chatbot features unless they directly support the learning loop.

Avoid features that only make the app broader but not deeper.

---

## 4. Strategic Differentiation

The app cannot compete with ChatGPT, Claude, or Gemini on model intelligence.

It must compete on:

1. Specialized workflow.
2. Vietnamese-native explanations.
3. Context-first understanding.
4. Literal-vs-natural meaning comparison.
5. Personalized error memory.
6. Review of repeated mistakes.
7. Progress over time.

The strongest product moat is:

```txt
Personal Error Memory + Review System
```

If a feature does not strengthen mistake memory or review, be careful before prioritizing it.

---

## 5. Five Guiding Questions for Every PR

Before starting any PR, answer these questions:

1. Does this PR help the user understand context better?
2. Does this PR help the user detect word-by-word translation traps?
3. Does this PR turn a wrong answer into reusable learning memory?
4. Does this PR make tomorrow's review more useful?
5. Does this PR help the user see that they are making fewer repeated mistakes?

If the answer is “no” to all five, the PR is probably not core and should be postponed.

If the answer is “yes” to at least one, explain which one in the PR description.

If the answer is “yes” to two or more, the PR is likely aligned with the product strategy.

---

## 6. Current Product Priority

Prioritize depth over breadth.

The current priority is not to add many new features.

The current priority is to make this loop reliable:

```txt
Submit answer
→ Grade answer
→ Explain mistake in Vietnamese
→ Save structured error
→ Detect repeated mistake
→ Create review item
→ Help user master it
```

Do not prioritize these before the loop above works well:

* browser extension
* payment
* social features
* leaderboard
* advanced gamification
* mobile native app
* news crawling
* complex RAG
* graph memory
* large UI redesigns
* generic chat mode

---

## 7. Core UX Principles

### 7.1 Context First

The app should answer:

```txt
What does this text really mean in this context?
```

Do not focus on grammar explanations unless grammar blocks understanding.

Good:

```txt
"push this back" means "dời lại / trì hoãn" in this work context.
```

Less useful:

```txt
Long generic explanation of phrasal verbs without explaining the actual sentence.
```

---

### 7.2 Literal vs Natural Meaning

The app should make word-by-word translation traps obvious.

For important phrases, prefer this structure:

```txt
Phrase:
take a look

Literal trap:
"lấy một cái nhìn"

Natural meaning:
"xem giúp / kiểm tra giúp"

Why Vietnamese learners may misunderstand:
Because "take" and "look" are often translated word by word, but the phrase functions as a polite work request.

Example:
Could you take a look when you get a chance?
= Khi nào rảnh bạn xem giúp mình nhé?
```

This pattern is a key product differentiator.

---

### 7.3 Vietnamese-Native Explanation

Explanations should feel written for Vietnamese learners.

Prefer:

```txt
Bạn đang dịch từ tiếng Việt "rất thích", nhưng tiếng Anh không nói "very like". Tự nhiên hơn là "really like".
```

Avoid:

```txt
This is an intensifier error in English usage.
```

Use technical grammar terms only when necessary.

---

### 7.4 Practice Must Come From Real Input

The app should generate exercises from the user's pasted text.

Do not generate random textbook exercises unless they are directly tied to:

* the pasted text
* the user's mistake
* a repeated error pattern
* a review item

---

### 7.5 Feedback Must Be Actionable

When the user is wrong, feedback should include:

1. What was wrong.
2. Why it was wrong.
3. The natural/correct understanding.
4. The mistake type.
5. A small next practice item if useful.

Feedback should be concise by default.

Use “Explain more” for longer explanations.

---

## 8. Core Feature Expectations

### 8.1 Paste Any English Text

The app must support generic pasted English text.

Do not design around articles only.

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
review item
```

Avoid article-only naming in user-facing copy unless the content is actually an article.

---

### 8.2 Understand Section

Each lesson should ideally include:

* Vietnamese summary
* natural Vietnamese translation
* context explanation
* key phrases
* what to notice
* sentence breakdown if useful

The lesson should help the user understand the text even before practice.

---

### 8.3 Key Phrases

Key phrases should focus on things Vietnamese learners may misunderstand.

Examples:

* phrasal verbs
* collocations
* technical terms
* business phrases
* idioms
* grammar patterns
* sentence structures
* tone/register cues

Each key phrase should ideally include:

* phrase
* meaning in Vietnamese
* meaning in context
* literal translation trap
* natural Vietnamese meaning
* why it is confusing
* example
* category
* difficulty

---

### 8.4 Exercises

Useful exercise types:

* meaning choice
* cloze phrase
* natural translation
* phrase explanation
* rewrite in Vietnamese
* focus question
* sentence breakdown
* reference resolution
* tone check

Objective exercises should be graded without AI when possible.

Open-ended exercises should be graded by AI with structured output.

---

### 8.5 Grading

Grading should focus on meaning and context, not exact matching.

For translation tasks, grade by:

* meaning accuracy
* natural Vietnamese
* key phrase understanding
* context understanding
* literal translation risk

The app should accept multiple natural Vietnamese answers when they preserve the meaning.

---

### 8.6 Error Memory

A wrong answer should become structured learning memory when useful.

Expected fields:

```txt
userId
errorType
targetItem
targetSkill
sourceSentence
userAnswer
correctAnswer
explanationVi
severity
confidence
repeatCount
firstSeenAt
lastSeenAt
nextReviewAt
status
```

Only save errors when confidence is high enough.

Do not pollute memory with uncertain or low-value feedback.

---

### 8.7 Repeated Mistake Detection

If the user makes a similar mistake again, the app should recognize it.

The app should be able to say:

```txt
Bạn đã từng gặp lỗi này trước đây.
```

Repeated mistakes should increase priority for review.

---

### 8.8 Review System

Review is not optional.

Review is the retention engine.

A review item should help the user practice an old mistake in a new context.

Good review example:

```txt
Bạn từng hiểu sai "run into trouble".

Trong ngữ cảnh kỹ thuật, "run into trouble" nghĩa là "gặp vấn đề / gặp khó khăn", không phải "chạy vào rắc rối".

Translate:
You may run into trouble with CPU-bound tasks.
```

The review system should move errors through statuses such as:

```txt
active
reviewing
mastered
ignored
```

---

### 8.9 Progress

The app should help the user see improvement.

Useful progress signals:

* due reviews
* repeated mistake count
* mastered phrases
* top mistake patterns
* literal translation errors over time
* review success rate
* exercises completed
* lessons completed

The north star metric is:

```txt
Repeated mistakes mastered per user per week.
```

---

## 9. Input Modes

Users may paste imperfect or unexpected text.

The app should eventually support these modes:

```txt
understand_and_practice
fix_and_understand
naturalize_english
mixed_language_support
not_english
developer_error_explanation
unsupported
```

Examples:

```txt
Could you take a look when you get a chance?
→ understand_and_practice
```

```txt
Yesterday I go to office and my manager ask me check report.
→ fix_and_understand
```

```txt
I very like this solution but it maybe not good for performance.
→ naturalize_english
```

```txt
Anh giúp em check this API contract với, I think we need to push this back.
→ mixed_language_support
```

```txt
TypeError: Cannot read properties of undefined (reading 'map')
→ developer_error_explanation
```

```txt
Bonjour, je voudrais apprendre le français.
→ not_english
```

If input mode support is incomplete, avoid pretending all input is a normal English reading lesson.

---

## 10. AI Output Rules

AI output should be structured and validated.

Prefer strict JSON for:

* lesson generation
* exercise generation
* grading
* error extraction
* review generation

Always validate AI output before saving.

If AI output is invalid:

1. Retry repair once if appropriate.
2. Fail gracefully.
3. Do not lose the user's pasted text.
4. Do not save malformed learning data.

---

## 11. Feature Prioritization

### Highest Priority

Build and improve:

```txt
feedback loop
structured user errors
repeated mistake detection
review page
literal vs natural trap UI
Vietnamese-specific explanations
```

### Medium Priority

Build after the core loop works:

```txt
input mode detection
developer English mode
business English mode
error notebook improvements
progress dashboard
prompt versioning
basic eval examples
```

### Lower Priority

Postpone until real users validate the loop:

```txt
browser extension
RAG knowledge base
graph memory
payment
social sharing
leaderboard
advanced gamification
mobile native app
news crawling
```

---

## 12. PR Description Requirements

Every PR should include:

```txt
Product impact:
Which part of the learning loop does this improve?

Guiding questions:
1. Context understanding: yes/no
2. Literal translation traps: yes/no
3. Wrong answer → memory: yes/no
4. Better review tomorrow: yes/no
5. Visible progress: yes/no

Manual test:
How can a human verify this feature in the app?
```

Example:

```txt
Product impact:
This PR improves wrong answer → memory and review.

Guiding questions:
1. Context understanding: no
2. Literal translation traps: yes
3. Wrong answer → memory: yes
4. Better review tomorrow: yes
5. Visible progress: partial

Manual test:
Submit a wrong answer for "take a look". Confirm that a user error is saved and appears in Review.
```

---

## 13. Manual Test Samples

Use these samples to check whether the app stays aligned with the product strategy.

### Work message

```txt
Could you take a look when you get a chance?
```

Expected:

```txt
take a look = xem giúp / kiểm tra giúp
tone = polite work request
not literal: lấy một cái nhìn
```

### Work scheduling

```txt
We need to push this back until the API contract is finalized.
```

Expected:

```txt
push this back = dời lại / trì hoãn
API contract = API spec/agreement, not legal contract
```

### Developer docs

```txt
This endpoint is deprecated and will be removed in a future release.
```

Expected:

```txt
deprecated = không khuyến khích dùng nữa, có thể bị bỏ sau này
practical meaning = do not use this endpoint for new code
```

### Developer error

```txt
TypeError: Cannot read properties of undefined (reading 'map')
```

Expected:

```txt
Explain the developer error in Vietnamese.
Do not treat it like a normal article.
```

### Vietlish

```txt
I very like this solution but it maybe not good for performance.
```

Expected:

```txt
Correct: I really like this solution, but it may not be good for performance.
Explain "very like" and "maybe/may be" issue.
```

### Grammar issue

```txt
Yesterday I go to office and my manager ask me check report.
```

Expected:

```txt
Correct the sentence.
Explain past tense and "ask someone to do something".
```

---

## 14. Definition of MVP Done

The MVP is not done just because the app can generate a lesson.

The MVP is done when this flow works:

```txt
User pastes text.
App explains meaning in Vietnamese.
App highlights confusing phrases.
App creates exercises.
User submits answers.
App grades answers.
App explains mistakes in Vietnamese.
App saves structured mistakes.
App creates review items.
User reviews mistakes later.
Dashboard shows repeated mistake patterns or progress.
```

A successful demo input:

```txt
We need to push this back until the API contract is finalized.
```

The app should:

1. Explain `push this back`.
2. Explain `API contract`.
3. Show natural Vietnamese meaning.
4. Create an exercise about `push this back`.
5. Grade a wrong answer.
6. Explain the literal translation mistake.
7. Save the mistake.
8. Create a review item.
9. Show it later in Review.

---

## 15. Final Product Principle

Every time the user misunderstands English, the app should turn that misunderstanding into personalized practice.

If a feature does not help with:

```txt
Understand
Practice
Feedback
Memory
Review
Progress
```

then it is probably not core yet.

Build depth before breadth.

---

## Agent skills

### Issue tracker

Issues and PRDs for this repo live as markdown files in `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage roles map to default label strings like `needs-triage` and `ready-for-agent`. See `docs/agents/triage-labels.md`.

### Domain docs

The repo uses a single-context layout with `CONTEXT.md` and `docs/adr/` at the root. See `docs/agents/domain.md`.
