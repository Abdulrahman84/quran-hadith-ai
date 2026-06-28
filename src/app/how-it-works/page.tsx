import Link from "next/link";

const steps = [
  {
    title: "Route the question",
    text: "The app decides whether a question needs Quran, tafsir, hadith, or a mixed retrieval path.",
  },
  {
    title: "Retrieve source records",
    text: "V1 calls the local Hadith MCP for text, references, grades, and provenance metadata.",
  },
  {
    title: "Build a citation pack",
    text: "Retrieved records become the only context allowed for answer drafting.",
  },
  {
    title: "Compose with limits",
    text: "Generation is intentionally off in v1. A later model layer can summarize only retrieved records with visible limits.",
  },
];

export default function HowItWorks() {
  return (
    <main className="min-h-screen bg-[var(--color-sand)] text-[var(--color-ink)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Link className="text-sm font-black uppercase tracking-[0.2em] text-[var(--color-green)]" href="/">
          Sanad AI
        </Link>
        <Link className="nav-link" href="/source-policy">
          Source policy
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--color-red)]">How it works</p>
        <h1 className="mt-5 max-w-4xl text-balance text-5xl font-black leading-tight text-[var(--color-green)]">
          A chat product with a source pipeline underneath.
        </h1>
        <p className="mt-6 max-w-2xl text-lg font-bold leading-8 text-[var(--color-muted)]">
          The interface should feel as simple as other AI assistants. The internal rule is stricter: every useful answer
          begins with retrieval and keeps its citations visible.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-3 px-5 pb-16 md:grid-cols-2">
        {steps.map((step, index) => (
          <article className="product-card animate-rise" key={step.title} style={{ animationDelay: `${index * 90}ms` }}>
            <span className="text-sm font-black text-[var(--color-red)]">{String(index + 1).padStart(2, "0")}</span>
            <h2 className="mt-5 text-2xl font-black text-[var(--color-green)]">{step.title}</h2>
            <p className="mt-4 text-sm font-bold leading-7 text-[var(--color-muted)]">{step.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
