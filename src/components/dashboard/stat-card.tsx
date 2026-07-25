type StatCardProps = {
  label: string;
  value: string;
  note: string;
};

export function StatCard({ label, value, note }: StatCardProps) {
  return (
    <article className="rounded-2xl border border-[var(--color-border)] border-t-[3px] border-t-[var(--color-gold)] bg-[var(--color-surface)] p-5 shadow-[0_12px_34px_rgba(23,26,25,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-[var(--color-green)]">{label}</p>
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[var(--color-gold)]" />
      </div>
      <p className="mt-3 text-4xl font-bold tabular-nums text-[var(--color-ink)]">{value}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-[var(--color-muted)]">{note}</p>
    </article>
  );
}
