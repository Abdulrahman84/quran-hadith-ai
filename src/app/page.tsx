const sources = [
  ["Quran and tafsir", "Tafsir MCP", "Verse text, tafsir passages, editions, and citation metadata."],
  ["Sunnah", "Hadith MCP", "Hadith text, collection references, source-attributed grades, and provenance notes."],
  ["Answer layer", "Retrieval-grounded model", "Drafts responses only from retrieved source records and exposes gaps."]
];

const principles = [
  ["Citations first", "Every answer starts from retrieved records, not model memory."],
  ["Visible uncertainty", "Missing grades, translation gaps, and source notes stay visible to the reader."],
  ["No fatwa mode", "The product does not issue rulings or replace qualified scholarship."],
  ["Pluggable model", "The language model is replaceable and never becomes the source of sacred text."]
];

const flow = [
  "User asks a Quran or hadith question.",
  "The app routes retrieval to Tafsir MCP, Hadith MCP, or both.",
  "A grounded answer draft is assembled with citations attached.",
  "The UI shows cited passages, provenance, and any limits before the answer."
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f4ec] text-[#172322]">
      <header className="border-b border-[#243b37]/15 bg-[#fbfaf5]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <strong className="block text-base font-black">Source-Grounded Islamic AI</strong>
            <span className="text-sm text-[#172322]/60">Quran, tafsir, and Sunnah retrieval product</span>
          </div>
          <a className="border border-[#243b37]/20 px-3 py-1.5 text-sm font-bold" href="#architecture">
            Architecture
          </a>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="border-y border-[#243b37]/20 py-10">
          <p className="mb-4 text-xs font-black uppercase text-[#76512f]">Product app / separate repository</p>
          <h1 className="max-w-3xl text-4xl font-black leading-tight md:text-6xl">
            Cited answers from retrieval, not religious text from memory.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#172322]/72">
            This app will orchestrate source MCPs, retrieve Quran, tafsir, and hadith records, then use a pluggable model
            only to compose answers grounded in those records.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="border border-[#172322] bg-[#172322] px-4 py-2.5 text-sm font-black text-[#fbfaf5]" href="#flow">
              Read the flow
            </a>
            <a className="border border-[#172322]/25 px-4 py-2.5 text-sm font-black" href="#principles">
              Source policy
            </a>
          </div>
        </div>

        <aside className="self-start border border-[#243b37]/20 bg-[#fffdf8]">
          <div className="border-b border-[#243b37]/15 p-5">
            <p className="text-sm font-black uppercase text-[#76512f]">v0 scaffold</p>
            <h2 className="mt-3 text-2xl font-black">Product boundary</h2>
            <p className="mt-3 text-sm leading-7 text-[#172322]/70">
              The model may summarize retrieved records. It must not invent Quran text, hadith text, grades, or scholarly
              rulings.
            </p>
          </div>
          <dl className="grid gap-px bg-[#243b37]/15">
            {[
              ["Status", "App shell"],
              ["Runtime", "Next.js"],
              ["Default", "Citation-first"],
              ["Sources", "MCP-backed"]
            ].map(([label, value]) => (
              <div className="grid grid-cols-[110px_1fr] bg-[#fffdf8] px-4 py-3" key={label}>
                <dt className="font-black text-[#315f55]">{label}</dt>
                <dd className="text-sm text-[#172322]/70">{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <section id="architecture" className="border-t border-[#243b37]/15">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 lg:grid-cols-[320px_1fr]">
          <div>
            <p className="mb-3 text-xs font-black uppercase text-[#76512f]">Architecture</p>
            <h2 className="text-3xl font-black leading-tight">Three layers, separate responsibilities.</h2>
            <p className="mt-5 leading-8 text-[#172322]/68">
              The product app coordinates source servers and answer drafting. Each layer remains replaceable and auditable.
            </p>
          </div>
          <div className="overflow-hidden border border-[#243b37]/15 bg-[#fffdf8]">
            {sources.map(([domain, layer, text]) => (
              <div className="grid gap-2 border-b border-[#243b37]/12 p-4 last:border-b-0 md:grid-cols-[170px_190px_1fr]" key={domain}>
                <strong className="text-[#315f55]">{domain}</strong>
                <code className="text-sm font-black text-[#7e4b32]">{layer}</code>
                <p className="m-0 text-sm leading-7 text-[#172322]/72">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="flow" className="border-t border-[#243b37]/15 bg-[#fbfaf5]">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 lg:grid-cols-[320px_1fr]">
          <div>
            <p className="mb-3 text-xs font-black uppercase text-[#76512f]">Flow</p>
            <h2 className="text-3xl font-black leading-tight">The answer is downstream from retrieval.</h2>
          </div>
          <ol className="grid gap-px overflow-hidden border border-[#243b37]/15 bg-[#243b37]/15">
            {flow.map((step, index) => (
              <li className="grid gap-3 bg-[#fffdf8] p-4 md:grid-cols-[60px_1fr]" key={step}>
                <span className="font-black text-[#315f55]">{String(index + 1).padStart(2, "0")}</span>
                <span className="leading-7 text-[#172322]/72">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="principles" className="border-t border-[#243b37]/15">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 lg:grid-cols-[320px_1fr]">
          <div>
            <p className="mb-3 text-xs font-black uppercase text-[#76512f]">Source policy</p>
            <h2 className="text-3xl font-black leading-tight">A product rulebook before product features.</h2>
          </div>
          <div className="grid gap-px overflow-hidden border border-[#243b37]/15 bg-[#243b37]/15 md:grid-cols-2">
            {principles.map(([title, text]) => (
              <article className="bg-[#fffdf8] p-5" key={title}>
                <strong className="text-lg font-black text-[#315f55]">{title}</strong>
                <p className="mt-3 text-sm leading-7 text-[#172322]/72">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
