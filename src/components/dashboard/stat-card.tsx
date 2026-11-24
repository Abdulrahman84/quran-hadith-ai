type StatCardProps = {
  label: string;
  value: string;
  note: string;
};

export function StatCard({ label, value, note }: StatCardProps) {
  return (
    <article className="ledger-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-[var(--color-muted)]">{label}</p>
      </div>
      <p className="mt-3 text-4xl font-bold tabular-nums text-[var(--color-ink)]">{value}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-[var(--color-muted)]">{note}</p>
    </article>
  );
}
