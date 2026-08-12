# Routes

Framework: Next.js 16 App Router. All routes share `src/app/layout.tsx`, which supplies the global fonts, Convex provider, i18n provider, and `src/app/globals.css`.

| URL | Page file | Shared layout | Summary |
| --- | --- | --- | --- |
| `/` | `src/app/page.tsx` | `src/app/layout.tsx`, `SiteHeader` | RTL-first Quran, tafsir, and hadith search with source filters, suggestions, retrieval progress, cited answer, source records, warnings, and pagination. |
| `/how-it-works` | `src/app/how-it-works/page.tsx` | `src/app/layout.tsx`, `SiteHeader` | Explains the source-first retrieval and answer pipeline. |
| `/source-policy` | `src/app/source-policy/page.tsx` | `src/app/layout.tsx`, `SiteHeader` | Documents sources, provenance, and safety boundaries. |
| `/dashboard` | `src/app/dashboard/page.tsx` | `src/app/layout.tsx`, `SiteHeader` | Authenticated retrieval analytics dashboard. |

Server/API routes:

| URL | Route file |
| --- | --- |
| `/api/search` | `src/app/api/search/route.ts` |
| `/api/health` | `src/app/api/health/route.ts` |
