# Extractable components

## SiteHeader

- Source: `src/components/site-header.tsx`
- Category: layout
- Description: Shared fixed RTL/LTR-aware top navigation with the Sanad logo, two informational routes, language switcher, and mobile menu.
- Extractable props: `activeItem` (string, default: `"home"`), `howItWorksHref` (string, default: `"/how-it-works"`), `sourcePolicyHref` (string, default: `"/source-policy"`)
- Hardcoded: Sanad logo asset, menu icon, localized labels, responsive behavior, all styles.

## LanguageSwitcher

- Source: `src/components/language-switcher.tsx`
- Category: basic
- Description: Arabic/English segmented language control with a compact native-select fallback.
- Extractable props: `language` (string, default: `"ar"`)
- Hardcoded: Arabic and English labels, visual treatment, language list.

## PolicySectionNav

- Source: `src/components/policy-section-nav.tsx`
- Category: layout
- Description: Horizontally scrollable anchor navigation for policy sections.
- Extractable props: `activeItem` (string, default: `"trust-flow"`)
- Hardcoded: section anchors, localized labels, ordinal numbers.

## ProvenanceCard

- Source: `src/components/provenance-card.tsx`
- Category: basic
- Description: Expandable source-provenance disclosure card.
- Extractable props: `isOpen` (boolean, default: `false`)
- Hardcoded: iconography, field labels, transitions, card styles.

## StatCard

- Source: `src/components/dashboard/stat-card.tsx`
- Category: basic
- Description: Analytics metric card with label, numeric value, and note.
- Extractable props: none; page content values are ordinary card content.
- Hardcoded: typography, spacing, colors, shadow.
