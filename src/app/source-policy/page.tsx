import Link from "next/link";

const rules = [
  "Quran, tafsir, and hadith text must come from retrieval sources, not model memory.",
  "Hadith grades are shown only when a retrieved source attributes them.",
  "Missing provenance, translation, or grade data remains visible to the user.",
  "The assistant does not issue fatwas or replace qualified scholarship.",
  "The model is pluggable and never becomes the source of sacred text or provenance.",
];

export default function SourcePolicy() {
  return (
    <main className="min-h-screen bg-[var(--color-sand)] text-[var(--color-ink)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Link className="text-sm font-black uppercase tracking-[0.2em] text-[var(--color-green)]" href="/">
          Quran Hadith AI
        </Link>
        <Link className="nav-link" href="/how-it-works">
          How it works
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--color-red)]">Source policy</p>
          <h1 className="mt-5 max-w-4xl text-balance text-5xl font-black leading-tight text-[var(--color-green)]">
            The model composes. Sources speak.
          </h1>
          <p className="mt-6 max-w-2xl text-lg font-bold leading-8 text-[var(--color-muted)]">
            The product is designed around a simple boundary: retrieved records provide the text, grades, and provenance;
            the answer layer can only organize what was retrieved.
          </p>
        </div>

        <aside className="rounded-[2rem] border border-[var(--color-green)] bg-[var(--color-green)] p-6 text-[var(--color-sand)]">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--color-gold)]">Current status</p>
          <h2 className="mt-4 text-3xl font-black">Mock-only shell</h2>
          <p className="mt-4 text-sm font-bold leading-7 text-white/72">
            This app does not yet connect to Tafsir MCP, Hadith MCP, or a model provider.
          </p>
        </aside>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid gap-3">
          {rules.map((rule, index) => (
            <article
              className="animate-rise rounded-[1.75rem] border border-[var(--color-green)]/16 bg-white/72 p-5"
              key={rule}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <span className="text-sm font-black text-[var(--color-red)]">{String(index + 1).padStart(2, "0")}</span>
              <p className="mt-3 text-lg font-black leading-8 text-[var(--color-green)]">{rule}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
