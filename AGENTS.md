# AGENTS.md

# English Context Coach — Coding Agent Guide

This document defines the product direction, coding priorities, and decision rules for any coding agent working on this repository.

The goal is not to build a weaker ChatGPT for English learning.
The goal is to build a Vietnamese-first learning system that helps users understand real English in context, practice from their own mistakes, remember repeated misunderstandings, and improve over time.

---

## 1. Product North Star

English Context Coach helps Vietnamese learners paste any English text from work, study, documentation, emails, messages, GitHub issues, PR comments, blogs, articles, or general reading.

The app helps users:

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

```txt
A context-first English learning coach for Vietnamese learners.
```

Designed for real English encountered in work and study: Slack messages, emails, GitHub issues, PR comments, API documentation, technical blogs, error messages, academic materials, and general English text.

---

## 3. What This App Is Not

```txt
A generic AI chatbot.
A simple translation app.
A grammar checker only.
A news/article-only app.
A Duolingo clone.
A weaker ChatGPT wrapper.
```

Avoid building generic chatbot features unless they directly support the learning loop. Avoid features that make the app broader but not deeper.

---

## 4. Strategic Differentiation

The app competes on:

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

---

## 5. Five Guiding Questions for Every PR

Before starting any PR, answer these questions:

1. Does this PR help the user understand context better?
2. Does this PR help the user detect word-by-word translation traps?
3. Does this PR turn a wrong answer into reusable learning memory?
4. Does this PR make tomorrow's review more useful?
5. Does this PR help the user see that they are making fewer repeated mistakes?

If the answer is “no” to all five, the PR is probably not core and should be postponed. Explain in the PR description which ones are improved.

---

## 6. Current Product Priority

Prioritize depth over breadth. Make this loop reliable before adding new items:

```txt
Submit answer
→ Grade answer
→ Explain mistake in Vietnamese
→ Save structured error
→ Detect repeated mistake
→ Create MistakePattern
→ Help user master it
```

Do not prioritize: browser extension, payment, social features, leaderboard, advanced gamification, mobile native app, news crawling, complex RAG, graph memory, large UI redesigns, or generic chat mode.

---

## 7. Specifications Directory (Reference map)

Detailed technical specifications, requirements, layouts, and test cases have been separated into modular files.

> [!IMPORTANT]
> **Agent Directive**: When implementing features or fixing bugs related to any of the domains below, you **MUST** read and adhere to the detailed specification file linked.

- **UI/UX & Explanation style**: Refer to [ux-principles.md](docs/specs/ux-principles.md). Explains the Literal vs Natural trap rendering requirements and Vietnamese explanation guidelines.
- **Features, Exercises & Database schemas**: Refer to [core-features.md](docs/specs/core-features.md). Details Key Phrases, Exercises, AI Grading, Error Memory Schema, and the Spaced Repetition Review system.
- **Text Processing & Input Modes**: Refer to [input-modes.md](docs/specs/input-modes.md). Outlines classification rules and customized rendering layouts for Vietlish Grammar corrections and Developer Trace console layouts.
- **E2E Test Samples**: Refer to [test-samples.md](docs/specs/test-samples.md). Contains concrete text inputs and expected AI grading output to run manual or automated E2E test runs.

---

## 8. PR Description Requirements

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

---

## 9. Development Commands (Bun Preference)

This project uses **Bun** as its primary package manager, dependency resolver, and runtime. All future coding agents MUST prioritize running commands via Bun instead of npm:

- **Install dependencies**: `bun install`
- **Run dev server**: `bun run dev`
- **Run background worker**: `bun run worker`
- **Run linting**: `bun run lint`
- **Run type checking**: `bun run typecheck`
- **Run tests**: `bun run test` (Vitest). Do not use raw `bun test` as the release gate because this repo uses Vitest APIs.
- **Build production**: `bun run build`
- **Database migrations/push**:
  - Local sync during development: `bun run db:push`
  - **MANDATORY for schema changes**: If you edit `src/db/schema.ts`, you **MUST** generate the SQL migration file by running `bun run db:generate`.
  - Apply/Verify migrations: `bun run db:migrate` (if local DB was already updated with `db:push` and errors out, run `bun run docker:local:reset && bun run docker:local:up` to clear volumes, wait a few seconds, then verify with `bun run db:migrate`).

---

## 10. Code Verification Policy (Mandatory)

To ensure high-quality code at all times, every coding agent **MUST** run the following verification checks and confirm they pass before declaring a task complete or submitting a PR:

1.  **Linting**: Run `bun run lint` to verify there are no ESLint errors or style warnings.
2.  **Type Checking**: Run `bun run typecheck` to verify there are no TypeScript compiler errors.
3.  **Testing**: Run `bun run test` to verify all automated unit/integration tests pass.
4.  **Building**: Run `bun run build` to verify the Next.js production build succeeds without TypeScript or bundler errors.
5.  **Database Migrations**: If `src/db/schema.ts` is modified, verify that a migration file is generated (`bun run db:generate`) and applies successfully on a fresh database setup (`bun run db:migrate`).

---

## 11. Drizzle ORM Schema Guidelines (Deprecated Object API)

Drizzle ORM has deprecated the object-based syntax for the third argument of `pgTable` (the constraints/indexes callback).

> [!WARNING]
> The third parameter of `pgTable` is changing and will only accept an array of indexes/constraints instead of an object. Do not wrap the array items inside a key-value object.

- **Incorrect / Deprecated**:

  ```typescript
  export const users = pgTable(
    "users",
    {
      id: integer(),
    },
    (t) => ({
      idx: index("custom_name").on(t.id),
    })
  );

  // Also INCORRECT (causes AST parsing failure in drizzle-kit):
  (t) => [
    {
      idx: index("custom_name").on(t.id),
    },
  ];
  ```

- **Correct / New API**:
  ```typescript
  export const users = pgTable(
    "users",
    {
      id: integer(),
    },
    (t) => [index("custom_name").on(t.id)]
  );
  ```

---

## Agent skills

### Issue tracker

Issues and PRDs live as markdown files in `.scratch/`. See [issue-tracker.md](docs/agents/issue-tracker.md).

### Triage labels

Triage roles map to default label strings like `needs-triage` and `ready-for-agent`. See [triage-labels.md](docs/agents/triage-labels.md).

### Domain docs

The repo uses a single-context layout with `CONTEXT.md` and `docs/adr/` at the root. See [domain.md](docs/agents/domain.md).
