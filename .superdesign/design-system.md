# Sanad AI — Design System

## Product

Sanad AI is a bilingual, citation-first research assistant for Quran, tafsir, and hadith. It serves people who need a fast answer but must be able to audit the underlying text, reference, and hadith grade. The home page is a focused verification workspace, not a generic marketing landing page.

Primary jobs:

- Ask a natural-language question in Arabic or English.
- Narrow retrieval by tafsir source and hadith collection.
- Understand that answers are composed only from retrieved records.
- Review citations, source types, references, metadata, warnings, and missing data.

## Visual direction

Theme: **Illuminated manuscript meets modern research instrument**.

The interface should feel calm, precise, scholarly, and contemporary. Use warmth and material depth associated with paper and archival reading, paired with the rigor of a modern search product. Avoid mosque silhouettes, crescents, ornamental overload, glossy SaaS gradients, neon color, and generic “AI sparkle” imagery.

## Color tokens

- `ink-950`: `#102923` — primary dark ink, key surfaces, strong text
- `ink-800`: `#1D4038` — secondary dark green
- `emerald-700`: `#256A57` — interactive brand color
- `emerald-100`: `#DDEBE4` — selected and supporting backgrounds
- `parchment-50`: `#F8F5ED` — page background
- `paper-0`: `#FFFDF8` — elevated surface
- `sand-100`: `#EEE7D8` — secondary surfaces
- `sand-300`: `#D8CCB7` — borders
- `brass-500`: `#B58A3B` — restrained accent and evidence highlights
- `brass-100`: `#F1E5C8` — subtle accent background
- `muted-600`: `#66706B` — secondary text
- `danger-700`: `#9A3F37` — errors only

No gradients except extremely subtle radial page lighting or a restrained 1px accent line. Never use purple, pink, cyan, or unrelated colors.

## Typography

- UI and Arabic: IBM Plex Sans Arabic, weights 400/500/600/700.
- Mono metadata: Geist Mono.
- Do not introduce a display serif. The Arabic headline may use generous line-height and weight rather than a decorative font.
- H1: 48–68px desktop, 34–42px mobile, bold, compact measure.
- Body: 15–17px; Arabic body line-height 1.8–2.0.
- Labels: 12–13px, semibold. Use uppercase tracking only for English/Latin labels.

## Layout

- Desktop content width: 1180–1240px.
- Header height: 72–80px, sticky/fixed with an opaque paper surface and a precise bottom rule.
- Home hero: two-column editorial composition on desktop. Main search workspace gets roughly 65%; trust/source context gets roughly 35%. Collapse to one column on mobile.
- Keep the search input visibly dominant and usable immediately above the fold.
- Use an 8px spacing system with common gaps of 8, 12, 16, 24, 32, 48, 64.

## Components

- Header: real Sanad logo, visible desktop navigation, compact language segmented control, one restrained trust badge such as “Source-first”.
- Search workspace: 18–24px radius outer card, paper background, fine sand border, soft shadow. Large query field, clear primary action, source filters below as labeled controls.
- Buttons: 10–12px radius, 44–52px height. Primary uses `ink-950` or `emerald-700` with white text. No pill buttons for primary actions.
- Chips: compact 999px or 10px radius; paper/sand treatment; brass only for hover or highlighted evidence.
- Trust panel: explain the retrieval route with a concise Quran → Tafsir → Hadith sequence and one source-first statement. It must support, not compete with, the search.
- Results: preserve all current filters, answer states, source cards, provenance details, warnings, and pagination.

## Header behavior

- Desktop: logo at the logical start; navigation and language controls at the logical end. Respect RTL and LTR.
- Mobile: logo remains prominent; a 44px menu trigger opens a paper-surface menu. Keep language switching accessible.
- Use a subtle current-page state and avoid multiple bordered button-like nav links.

## Motion

- Entrance: 280–420ms opacity + 8–12px rise.
- Hover: 160–220ms color, border, and 1–2px translation.
- Respect `prefers-reduced-motion`.
- No perpetual decorative animation; loading/status motion is allowed.

## Accessibility and content constraints

- WCAG AA contrast.
- Minimum 44px interactive targets.
- Strong focus-visible ring using emerald plus paper offset.
- Maintain semantic landmark structure and labels.
- Preserve bilingual direction switching.
- Reuse `public/brand/sanad-logo.png` exactly.
- Keep all current home-page functions and content available: question input, search, suggestions, hadith book and tafsir source filters, retrieval state, answer, source filters/cards, warnings, and pagination.

## Active theme variant — Syrian Civic Modern

This variant overrides the base visual palette for the next exploration while preserving all product, layout, accessibility, typography, and content rules above.

### Intent

Create an original Sanad identity inspired by the new Syrian visual language: confident, warm, contemporary, unifying, and able to connect heritage with digital progress. It must not resemble an official government service or reproduce state-owned symbols.

### Variant palette

- `syrian-green-800`: `#0B5D3E` — dominant brand and primary action
- `syrian-green-600`: `#18845A` — interactive highlight
- `civic-black`: `#171A19` — strong text and evidence surfaces
- `warm-white`: `#FBFAF5` — primary canvas and paper
- `limestone`: `#E8E0D2` — borders and quiet fields
- `sandstone-gold`: `#C69A4B` — prominent secondary brand color
- `luminous-gold`: `#D6B264` — highlights on dark surfaces
- `star-red`: `#C63B45` — use only as a tiny 1–3% accent, never for large surfaces
- `muted-olive`: `#657068` — secondary text

### Creative signature

- Use an abstract **evidence thread**: one fine line that links three small nodes representing Quran, tafsir, and hadith. It may bend or pulse gently through the interface, but must remain subordinate to content.
- Use a **three-point rhythm** in dividers, loading states, or compact status marks. Use dots, not literal five-pointed stars.
- Introduce one restrained geometric pattern derived from Syrian stone inlay or woven structure: large-scale, sparse, and low contrast. Avoid ornate arabesque decoration.
- Combine civic confidence with human warmth: broad whitespace, decisive green blocks, very fine black rules, and occasional sandstone-gold details.
- A tiny red node may identify the active evidence step or focus point. Red must never become a primary button or large background.
- Gold should occupy roughly 10–15% of the visible composition. Use it for a defining console edge, evidence-thread nodes and connectors, selected or verified details, section rules, and key icons—not merely one tiny badge.
- On civic-black surfaces, use luminous gold for high-contrast evidence labels and connection details. On warm-white surfaces, use sandstone gold for borders and quiet fills.

### Header and console

- Header: warm-white surface, real current Sanad logo, civic-black text, a fine green-and-gold rule, and one three-node evidence detail with gold as the verified node. Do not use a flag band.
- Search console: warm-white or very pale limestone body with a distinctive gold top/inline edge; query area spacious and calm; primary action in Syrian green; evidence footer may use civic black with luminous-gold details and warm-white text if contrast remains AA.
- Suggested questions: lightweight bordered buttons with a small leading evidence node, not cards or recent-history rows.
- Results should inherit the same evidence-thread logic so citations visibly connect answer and records.

### Prohibited

- No golden eagle, state emblem, official seal, literal flag, horizontal tricolor band, or copied national-identity logo.
- No literal stars as decoration.
- No claim or implication that Sanad AI is an official Syrian government product.
- No patriotic slogans or unrelated national copy.
