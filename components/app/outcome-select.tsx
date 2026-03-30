"use client";

import type { ReportOutcomeOption } from "@/lib/domain/types";
import { addReportOutcomeOptionAction, deleteReportOutcomeOptionAction } from "@/app/(app)/actions";
import { ManagedSelect } from "@/components/app/managed-select";

export type OutcomeSelectProps = {
  options: ReportOutcomeOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  manageable?: boolean;
  onMutation?: () => void | Promise<void>;
};

export function OutcomeSelect({
  options,
  value,
  onChange,
  disabled,
  id,
  name,
  className,
  manageable = true,
  onMutation,
}: OutcomeSelectProps) {
  async function handleAdd(label: string) {
    const fd = new FormData();
    fd.set("label", label);
    return addReportOutcomeOptionAction(fd);
  }

  async function handleDelete(opt: { id: string }) {
    const fd = new FormData();
    fd.set("optionId", opt.id);
    await deleteReportOutcomeOptionAction(fd);
  }

  return (
    <ManagedSelect
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      id={id}
      name={name}
      className={className}
      manageable={manageable}
      addDialogTitle="Neue Option (Entscheid vor Ort)"
      addDialogPlaceholder="z. B. Garantiefall gemeldet"
      onAdd={handleAdd}
      onDelete={handleDelete}
      onMutation={onMutation}
    />
  );
}
