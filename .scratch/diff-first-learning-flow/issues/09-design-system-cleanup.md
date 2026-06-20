Status: ready-for-agent

## Parent

[Diff-first Learning Flow PRD](.scratch/diff-first-learning-flow/PRD.md)

## What to build

Apply a unified design system across the entire app and clean up deprecated code:

**Design System**:

- Create a central `design-tokens.css` file with CSS custom properties: color palette (neutral base + indigo accent), typography (Inter from Google Fonts), spacing scale, border radius, shadows, and diff colors (red-50 `#FEE2E2`, green-50 `#DCFCE7`).
- Add dark mode support via CSS custom properties and a `prefers-color-scheme` media query (plus optional manual toggle).
- Apply design tokens to ALL existing components for visual consistency — not just new diff-mode components.

**Cleanup**:

- Remove 4 deprecated inputModes: `fix_and_understand`, `naturalize_english`, `mixed_language_support`, `developer_error_explanation`.
- Remove corresponding view components: `GrammarCorrectionView`, `DeveloperErrorView`, `MixedLanguageView`, and any related code.
- Remove any remaining ErrorRepairSession references.
- Verify old lessons (created before redesign) still render correctly in understand mode.

## Acceptance criteria

- [ ] `design-tokens.css` exists with all defined tokens (colors, typography, spacing, shadows)
- [ ] Inter font loaded from Google Fonts
- [ ] Dark mode works via CSS custom properties
- [ ] All existing components use design tokens (spot-check at least 5 major components)
- [ ] 4 deprecated inputModes removed from schema enum and codebase
- [ ] Deprecated view components removed (GrammarCorrectionView, DeveloperErrorView, MixedLanguageView)
- [ ] ErrorRepairSession references fully removed
- [ ] Old lessons without DraftText still render in understand mode
- [ ] `bun run lint && bun run typecheck && bun run test && bun run build` all pass

## Blocked by

- `08-dashboard-redesign-smart-cta-repeated-banner`
