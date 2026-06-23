# Streamline Learning Flows and Simplify Correction Interaction

ADR-0021 established a context-first writing coach with per-suggestion accept/reject controls and inline correction editing, while keeping three learning flows (Write, Read, and manual Diff). In practice, this created unnecessary complexity: manual Diff was rarely used, accepting/rejecting suggestions added UX friction, and inline editing of corrections proved to have little pedagogical value.

We streamline the user experience by splitting the dashboard paste form into two clean flows (Write and Read) using Radix UI Tabs, simplifying the correction cards to be read-only, and removing character limits and editor toolbars entirely.

## Considered Options

1. **Keep full interactive controls (ADR-0021)** — retain inline editing, accept/reject toggles, and manual diff inputs. High complexity and UX friction.
2. **Simplify layout but keep state logic** — hide the controls in the UI but keep the backend complexity (e.g., storing rejection states and manual edits). Leads to dead code and technical debt.
3. **Consolidate flows and simplify interactions** — remove manual Diff input (decided dynamically), delete the accept/reject toggle buttons, delete inline editing on correction cards, remove editor toolbars, and drop the `/phrase-practice` route to unify all reviews under `/review`.

We chose option 3 to align with the core product loop: helping learners study from mistakes without managing complex editorial states.

## Consequences

- **Radix UI Tabs for Paste Form**: The dashboard paste form is divided into:
  - **✍️ Sửa bài viết của tôi (Write)**: Optimized for learner drafts.
  - **📖 Đọc hiểu tài liệu (Read)**: Optimized for analyzing clean documents.
- **Dynamic Mode Fallback**: Removed the manual "Tôi đã có bản sửa" toggle. If the draft text submitted in the Write tab contains no mistakes, the AI coach automatically falls back to Read mode (`understand_and_practice`) to generate sentence breakdowns and key phrases, preventing empty diff views.
- **Simplified Correction Cards**: Removed the "Đồng ý sửa" / "Giữ bản gốc" toggle button and the editing pencil button. Correction cards are now read-only, showing the comparative diff and pedagogical explanations.
- **Minimalist Editor Input**: Completely removed the toolbar (formatting buttons like bold and lists, and the highlight button) from the rich-text editor on the dashboard. The editor is now a clean text entry area.
- **Route Consolidation**: Deleted the `/phrase-practice` route. Clicking "Luyện tập cụm từ" in the history page now redirects directly to `/review?patternId=${id}`, unifying all spaced repetition reviews.
- **Character Limits Removed**: Removed the 100,000-character constraint indicator from the frontend UI and stripped validation checks from both frontend and backend queues.
