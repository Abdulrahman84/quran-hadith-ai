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
    <fieldset className="workflow-tabs animate-rise">
      <legend className="sr-only">{t("workflow.label")}</legend>
      <div className="workflow-tabs-row">
        {workflows.map((workflow) => (
          <label className="workflow-tab" data-active={value === workflow.id} key={workflow.id}>
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
