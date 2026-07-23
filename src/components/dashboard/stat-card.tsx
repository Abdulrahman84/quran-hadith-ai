type StatCardProps = {
  label: string;
  value: string;
  note: string;
};

export function StatCard({ label, value, note }: StatCardProps) {
  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_12px_34px_rgba(22,58,95,0.06)]">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-green-soft)]">{label}</p>
      <p className="mt-3 text-4xl font-bold tabular-nums text-[var(--color-green)]">{value}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-[var(--color-muted)]">{note}</p>
    </article>
  );
}
