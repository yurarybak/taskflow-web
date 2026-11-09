import { useMutation } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Field, Input, Select, Textarea } from "../../components/ui";
import { useDismiss } from "../../hooks/use-dismiss";
import { api } from "../../lib/api";
import { keys } from "../../lib/query-keys";
import type {
  Label,
  TaskPriority,
  TaskTemplate,
  TaskType,
} from "../../lib/types";
import {
  humanizeConstant,
  taskTemplatePriorities,
  taskTemplateTypes,
  useInvalidate,
} from "./workspace-utils";

export function TaskTemplateForm({
  workspaceId,
  labels,
  initial,
  onClose,
}: {
  workspaceId: string;
  labels?: Label[];
  initial?: TaskTemplate;
  onClose: () => void;
}) {
  const invalidate = useInvalidate();
  const [name, setName] = useState(initial?.name || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [type, setType] = useState<TaskType>(initial?.type || "TASK");
  const [priority, setPriority] = useState<TaskPriority>(
    initial?.priority || "MEDIUM",
  );
  const [labelIds, setLabelIds] = useState(
    initial?.labels.map((label) => label.id) ?? [],
  );
  const [labelsOpen, setLabelsOpen] = useState(false);
  const labelPickerRef = useRef<HTMLDivElement>(null);
  const toggleLabel = (labelId: string) => {
    setLabelIds((current) =>
      current.includes(labelId)
        ? current.filter((id) => id !== labelId)
        : [...current, labelId],
    );
  };
  useDismiss(labelPickerRef, () => setLabelsOpen(false), labelsOpen);
  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        title: title.trim(),
        type,
        priority,
        labelIds,
      };
      const text = description.trim();
      // The API rejects an empty description: a new template omits it and
      // an edited one clears it with null.
      return initial
        ? api.updateTaskTemplate(workspaceId, initial.id, {
            ...body,
            description: text || null,
          })
        : api.createTaskTemplate(workspaceId, {
            ...body,
            description: text || undefined,
          });
    },
    onSuccess: () => {
      void invalidate(keys.taskTemplatesAll(workspaceId));
      toast.success(initial ? "Template updated" : "Template created");
      onClose();
    },
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim().length >= 2 && title.trim().length >= 2)
          mutation.mutate();
      }}
    >
      <Field label="Template name">
        <Input
          value={name}
          minLength={2}
          maxLength={120}
          required
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field label="Task title">
        <Input
          value={title}
          minLength={2}
          maxLength={120}
          required
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <Field label="Description">
        <Textarea
          value={description}
          maxLength={1000}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <div className="form-grid">
        <Field label="Type">
          <Select
            value={type}
            onChange={(event) => setType(event.target.value as TaskType)}
          >
            {taskTemplateTypes.map((value) => (
              <option value={value} key={value}>
                {humanizeConstant(value)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as TaskPriority)
            }
          >
            {taskTemplatePriorities.map((value) => (
              <option value={value} key={value}>
                {humanizeConstant(value)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="template-label-picker">
        <span>Labels</span>
        {!labels?.length ? (
          <p>No labels yet</p>
        ) : (
          <div className="template-label-dropdown" ref={labelPickerRef}>
            <button
              type="button"
              onClick={() => setLabelsOpen((open) => !open)}
            >
              {labelIds.length
                ? `${labelIds.length} label${labelIds.length > 1 ? "s" : ""}`
                : "Select labels"}
              <ChevronDown size={14} />
            </button>
            {labelsOpen && (
              <div className="template-label-menu">
                {labels.map((label) => (
                  <label key={label.id}>
                    <input
                      type="checkbox"
                      checked={labelIds.includes(label.id)}
                      onChange={() => toggleLabel(label.id)}
                    />
                    <span
                      className="swatch"
                      style={{ background: label.color }}
                    />
                    {label.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="dialog-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={mutation.isPending}>
          {initial ? "Save template" : "Create template"}
        </Button>
      </div>
    </form>
  );
}
