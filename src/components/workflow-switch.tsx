import type { TranslationKey } from "@/lib/i18n";

export type HomeWorkflow = "general" | "check";

type WorkflowSwitchProps = {
  value: HomeWorkflow;
  onChange: (value: HomeWorkflow) => void;
  t: (key: TranslationKey) => string;
};

const workflows: Array<{ id: HomeWorkflow; labelKey: TranslationKey }> = [
  { id: "general", labelKey: "workflow.general" },
  { id: "check", labelKey: "workflow.check" },
];

export function WorkflowSwitch({ value, onChange, t }: WorkflowSwitchProps) {
  return (
    <fieldset className="animate-rise mb-4 mt-5 w-full max-w-md">
      <legend className="sr-only">{t("workflow.label")}</legend>
      <div className="grid grid-cols-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-sm">
        {workflows.map((workflow) => (
          <label
            className={`cursor-pointer rounded-lg px-4 py-2.5 text-center text-sm font-bold transition ${
              value === workflow.id
                ? "bg-[var(--color-green)] text-white shadow-sm"
                : "text-[var(--color-muted)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-green)]"
            }`}
            key={workflow.id}
          >
            <input
              checked={value === workflow.id}
              className="sr-only"
              name="home-workflow"
              onChange={() => onChange(workflow.id)}
              type="radio"
              value={workflow.id}
            />
            {t(workflow.labelKey)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
