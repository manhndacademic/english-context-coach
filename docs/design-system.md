# Design System Guidelines

This document outlines the design tokens, components, and layout structures for the **English Context Coach** codebase to ensure visual consistency and developer efficiency.

---

## 1. Design Tokens

### Color Palette

Use theme variables via Tailwind CSS class names (e.g., `bg-accent`, `text-muted`) instead of arbitrary colors or raw hex values.

| Token               | Light Value            | Dark Value              | Intended Usage                                |
| ------------------- | ---------------------- | ----------------------- | --------------------------------------------- |
| `bg-background`     | `hsl(210, 20%, 98%)`   | `hsl(224, 71%, 4%)`     | Page background                               |
| `bg-surface`        | `hsl(0, 0%, 100%)`     | `hsl(222, 47%, 11%)`    | Card/Panel background                         |
| `bg-surface-strong` | `#f1f5f9`              | `#1e293b`               | Form inputs, neutral tags, section headers    |
| `bg-surface-active` | `rgba(5,150,105,0.06)` | `rgba(16,185,129,0.08)` | Selected states and active highlights         |
| `text-text`         | `#0f172a`              | `#f8fafc`               | Primary typography                            |
| `text-muted`        | `#64748b`              | `#94a3b8`               | Subtext, captions, and secondary descriptions |
| `bg-accent`         | `#059669`              | `#10b981`               | Brand color (emerald green / mint green)      |
| `bg-accent-hover`   | `#047857`              | `#34d399`               | Hover states for primary actions              |
| `bg-accent-strong`  | `#064e3b`              | `#a7f3d0`               | Strongly highlighted text or markers          |
| `bg-accent-light`   | `#ecfdf5`              | `rgba(16,185,129,0.15)` | Info blocks, success background highlights    |
| `bg-danger`         | `#e11d48`              | `#f43f5e`               | Destructive buttons, error borders            |
| `bg-danger-light`   | `#fff1f2`              | `rgba(244,63,94,0.1)`   | Error notification banners                    |
| `bg-warning`        | `#d97706`              | `#f59e0b`               | Review reminders, medium-importance alerts    |
| `bg-warning-light`  | `#fffbeb`              | `rgba(245,158,11,0.1)`  | Review banner background highlights           |
| `bg-success`        | `#16a34a`              | `#10b981`               | Correct answer states                         |
| `bg-success-light`  | `#f0fdf4`              | `rgba(16,185,129,0.15)` | Correct feedback panel background             |

### Typography Scale

- **xs**: `0.75rem` (12px) — labels, status badges, captions
- **sm**: `0.875rem` (14px) — body copy, form fields, descriptions
- **base**: `1.0rem` (16px) — default readable paragraph copy
- **lg**: `1.125rem` (18px) — small card subheadings
- **xl**: `1.25rem` (20px) — card section titles (`h2`)
- **2xl**: `1.5rem` (24px) — page headings (`h1` on mobile)
- **3xl**: `1.875rem` (30px) — page headings (`h1` on tablet/desktop)
- **4xl**: `2.25rem` (36px) — landing hero titles

### Spacing Scale

Rely on the 8px grid (Tailwind utility spacing):

- **gap-dense-gap / gap-2** (8px): Inside small modules, adjacent buttons
- **gap-item-gap / gap-4** (16px): Content stack inside a card, list item elements
- **gap-layout-gap / gap-6** (24px): Card layout structure, form blocks
- **gap-section-gap / gap-8** (32px): Page sections

---

## 2. Component Inventory

To prevent duplicating complex markup strings, use these components found in `src/components/ui/`:

### 1. Button

Use the standard `<Button>` component for all clickable triggers.

```tsx
import { Button } from "@/components/ui/button";

// Default button
<Button>Click me</Button>

// Destructive button
<Button variant="danger">Delete</Button>

// Wrap next/link with button styles (asChild)
<Button asChild>
  <Link href="/dashboard">Return Home</Link>
</Button>
```

### 2. Badge

Used for tags, categorizations, and small status pills.

```tsx
import { Badge } from "@/components/ui/badge";

<Badge>Muted Label</Badge>
<Badge variant="success">Completed</Badge>
<Badge variant="warning">Due</Badge>
```

### 3. SectionCard

A container for grouping widgets, panels, and sections.

```tsx
import { SectionCard } from "@/components/ui/section-card";

<SectionCard>
  <SectionCard.Header
    title="Key Phrases"
    description="Identified words in this text"
    icon={<Sparkles />}
  />
  <SectionCard.Body>{children}</SectionCard.Body>
  <SectionCard.Footer>
    <span>Footer Note</span>
    <Button size="sm">Save</Button>
  </SectionCard.Footer>
</SectionCard>;
```

### 4. StatCard

Displays summary counters on dashboard or history pages.

```tsx
import { StatCard } from "@/components/ui/stat-card";

<StatCard label="Completed Lessons" value={24} />
<StatCard label="Reviews Due" value={dueCount} valueVariant={dueCount > 0 ? "warning" : "default"} />
```

### 5. PageHeader

The standardized header for page-level navigation and breadcrumbs.

```tsx
import { PageHeader } from "@/components/ui/page-header";

<PageHeader
  title="Lịch sử học tập"
  description="Xem lại tiến trình của bạn"
  backHref="/dashboard"
  backLabel="Quay về Trang chủ"
/>;
```

### 6. PageLayout

Combines `AppHeader` and the canonical page margins to prevent copy-pasting wrappers.

```tsx
import { PageLayout } from "@/components/ui/page-layout";

export default function SettingsPage() {
  const user = await requireUser();
  return (
    <PageLayout user={user}>
      <div>My Page Content</div>
    </PageLayout>
  );
}
```

---

## 3. Best Practices (Do / Don't)

- **DO** wrap Next.js `<Link>` elements inside `<Button asChild>` if they are intended to visually represent a button.
- **DON'T** manually write `bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md` layout strings. Wrap sections inside `<SectionCard>` instead.
- **DON'T** use raw hex colors like `dark:text-[#ff8585]` or off-palette values like `text-emerald-600` inside your components. Use `dark:text-danger` and `text-accent`.
- **DO** use `<PageLayout>` for all authenticated dashboard pages to guarantee uniform layout margins.
- **DO** use the typography scaling reference to size headings (`text-2xl` for headers, `text-xl` for section titles).
