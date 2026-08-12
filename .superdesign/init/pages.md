# Page dependency trees

## `/` — Home

Entry: `src/app/page.tsx`

Dependencies:

- `src/app/page.tsx`
  - `src/components/i18n-provider.tsx`
    - `src/lib/i18n.ts`
  - `src/components/site-header.tsx`
    - `src/components/i18n-provider.tsx`
    - `src/components/language-switcher.tsx`
      - `src/components/i18n-provider.tsx`
      - `src/lib/i18n.ts`
  - `src/lib/i18n.ts`
  - `src/lib/retrieval/hadith-collections.ts`
  - `src/lib/retrieval/source-display.ts`
    - `src/lib/retrieval/types.ts`
  - `src/lib/retrieval/tafsir-sources.ts`
  - `src/lib/retrieval/types.ts`
  - `public/brand/sanad-logo.png`
  - `public/assets/sanad-ai-loader.svg`
- `src/app/layout.tsx`
  - `src/components/convex-client-provider.tsx`
  - `src/components/i18n-provider.tsx`
  - `src/app/globals.css`

Actual desktop render branch: `src/app/page.tsx:302:671`. The initial state centers the eyebrow, H1, search shell, suggestion chips, and trust explainer. After submit it compacts the search shell and renders source trail plus result panels.

## `/how-it-works`

Entry: `src/app/how-it-works/page.tsx`

Dependencies:

- `src/app/how-it-works/page.tsx`
  - `src/components/i18n-provider.tsx`
  - `src/components/site-header.tsx`
    - `src/components/language-switcher.tsx`
  - `src/lib/i18n.ts`
- `src/app/layout.tsx`
  - `src/app/globals.css`

## `/source-policy`

Entry: `src/app/source-policy/page.tsx`

Dependencies:

- `src/app/source-policy/page.tsx`
  - `src/components/i18n-provider.tsx`
  - `src/components/policy-section-nav.tsx`
  - `src/components/provenance-card.tsx`
  - `src/components/site-header.tsx`
    - `src/components/language-switcher.tsx`
  - `src/lib/i18n.ts`
- `src/app/layout.tsx`
  - `src/app/globals.css`

## `/dashboard`

Entry: `src/app/dashboard/page.tsx`

Dependencies:

- `src/app/dashboard/page.tsx`
  - `src/components/site-header.tsx`
  - `src/components/dashboard/dashboard-shell.tsx`
    - `src/components/i18n-provider.tsx`
    - `src/components/dashboard/activity-chart.tsx`
    - `src/components/dashboard/admin-sign-in.tsx`
    - `src/components/dashboard/question-results.tsx`
    - `src/components/dashboard/source-mix.tsx`
    - `src/components/dashboard/stats-grid.tsx`
      - `src/components/dashboard/stat-card.tsx`
    - `src/components/dashboard/types.ts`
- `src/app/layout.tsx`
  - `src/app/globals.css`
