# UX & Explanation Principles

This document defines the core user experience (UX) and explanation style guidelines for English Context Coach. All features, explanations, and generated content must adhere to these principles.

---

## 1. Context First

The app must always answer:
```txt
What does this text really mean in this context?
```

Do not focus on grammar explanations unless grammar directly blocks understanding.

*   **Good**: `"push this back"` means `"dời lại / trì hoãn"` in this work context.
*   **Less useful**: Long generic explanation of phrasal verbs without explaining the actual sentence.

---

## 2. Literal vs Natural Meaning

The app should make word-by-word translation traps obvious. For important phrases, prefer this structure:

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

This comparison pattern is a key product differentiator.

---

## 3. Vietnamese-Native Explanations

Explanations must feel written naturally for Vietnamese learners.
*   **Prefer**: `"Bạn đang dịch từ tiếng Việt 'rất thích', nhưng tiếng Anh không nói 'very like'. Tự nhiên hơn là 'really like'."`
*   **Avoid**: `"This is an intensifier error in English usage."`

Use technical grammar terms only when absolutely necessary.

---

## 4. Practice Must Come From Real Input

The app should generate exercises from the user's pasted text. Do not generate random textbook exercises unless they are directly tied to:
*   The pasted text.
*   The user's mistake.
*   A repeated error pattern.
*   A MistakePattern.

---

## 5. Feedback Must Be Actionable

When the user answers incorrectly, feedback should include:
1.  What was wrong.
2.  Why it was wrong.
3.  The natural/correct understanding.
4.  The mistake type.
5.  A small next practice item if useful.

Feedback should be concise by default. Use "Explain more" for longer, detailed explanations.
