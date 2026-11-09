import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Field,
  Input,
  Select,
  Textarea,
} from "../../components/ui";
import { api } from "../../lib/api";
import { statuses } from "./task-filters";
import { keys } from "../../lib/query-keys";
import type {
  Task,
  TaskPriority,
  TaskStatus,
  TaskTemplate,
  TaskType,
} from "../../lib/types";
import { formatEstimate, humanizeConstant, parseEstimate } from "./task-utils";
import {
  DatePickerField,
  MilestoneDropdown,
  PriorityDropdown,
  TypeDropdown,
  UserDropdown,
} from "./task-fields";

export function TaskForm({
  workspaceId,
  projectId,
  initial,
  onClose,
}: {
  workspaceId?: string;
  projectId: string;
  initial?: Task;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const isCreating = !initial;
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [status, setStatus] = useState<TaskStatus>(initial?.status || "TODO");
  const [priority, setPriority] = useState<TaskPriority>(
    initial?.priority || "MEDIUM",
  );
  const [type, setType] = useState<TaskType>(initial?.type || "TASK");
  const [milestoneId, setMilestoneId] = useState(
    initial?.milestoneId || initial?.milestone?.id || "",
  );
  const [startDate, setStartDate] = useState(
    initial?.startDate?.slice(0, 10) || "",
  );
  const [dueDate, setDueDate] = useState(initial?.dueDate?.slice(0, 10) || "");
  const [originalEstimate, setOriginalEstimate] = useState(
    formatEstimate(initial?.originalEstimateMinutes),
  );
  const [templateId, setTemplateId] = useState("");
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateAssigneeId, setTemplateAssigneeId] = useState<string | null>(
    null,
  );
  const [templateDueDate, setTemplateDueDate] = useState("");
  const parsedOriginalEstimate = parseEstimate(originalEstimate);
  const { data: milestones } = useQuery({
    queryKey: keys.milestones(projectId),
    queryFn: () => api.milestones(projectId),
  });
  const { data: templatesPage } = useQuery({
    queryKey: keys.taskTemplates(workspaceId || "", { page: 1, limit: 100 }),
    queryFn: () =>
      api.taskTemplates(workspaceId || "", { page: 1, limit: 100 }),
    enabled: isCreating && !!workspaceId,
  });
  const { data: templateMembers } = useQuery({
    queryKey: keys.members(workspaceId || ""),
    queryFn: () => api.members(workspaceId || ""),
    enabled: isCreating && !!workspaceId && !!templateId,
  });
  const templates = templatesPage?.data ?? [];
  const selectedTemplate = templates.find((item) => item.id === templateId);
  const usingTemplate = isCreating && !!selectedTemplate;
  const selectTemplate = (nextId: string) => {
    setTemplateId(nextId);
    const nextTemplate = templates.find((item) => item.id === nextId);
    setTemplateTitle(nextTemplate?.title || "");
    setTemplateAssigneeId(null);
    setTemplateDueDate("");
  };
  const mutation = useMutation({
    mutationFn: async () => {
      if (usingTemplate) {
        return api.createTaskFromTemplate(projectId, {
          templateId: selectedTemplate.id,
          title: templateTitle.trim() || undefined,
          assigneeId: templateAssigneeId || undefined,
          dueDate: templateDueDate
            ? new Date(templateDueDate).toISOString()
            : undefined,
        });
      }
      const body = {
        title,
        // The API rejects an empty description: a new task omits it and an
        // edited task clears it with null.
        description: description.trim()
          ? description
          : initial
            ? null
            : undefined,
        status,
        priority,
        type,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        originalEstimateMinutes: originalEstimate.trim()
          ? parsedOriginalEstimate.minutes
          : initial
            ? null
            : undefined,
      };
      if (initial) {
        const updated = await api.updateTask(projectId, initial.id, body);
        const currentMilestoneId =
          initial.milestoneId || initial.milestone?.id || "";
        if (milestoneId !== currentMilestoneId) {
          return api.setTaskMilestone(
            projectId,
            initial.id,
            milestoneId || null,
          );
        }
        return updated;
      }
      return api.createTask(projectId, {
        ...body,
        milestoneId: milestoneId || null,
      });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.tasksAll(projectId) });
      toast.success(initial ? "Task updated" : "Task created");
      onClose();
    },
  });
  const renderTemplatePreview = (template: TaskTemplate) => (
    <div className="task-template-preview">
      <div className="task-template-preview-heading">
        <div>
          <strong>{template.name}</strong>
          <span>{template.title}</span>
        </div>
        <div className="task-template-preview-badges">
          <Badge>{humanizeConstant(template.type)}</Badge>
          <Badge>{humanizeConstant(template.priority)}</Badge>
        </div>
      </div>
      {template.description && <p>{template.description}</p>}
      {!!template.labels.length && (
        <div className="task-template-preview-labels">
          {template.labels.map((label) => (
            <span
              key={label.id}
              style={{ borderColor: label.color, color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <form
      className="task-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!usingTemplate && parsedOriginalEstimate.error) return;
        mutation.mutate();
      }}
    >
      {isCreating && !!workspaceId && (
        <Field label="Template">
          <Select
            value={templateId}
            disabled={mutation.isPending}
            onChange={(event) => selectTemplate(event.target.value)}
          >
            <option value="">Blank task</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {usingTemplate ? (
        <>
          {renderTemplatePreview(selectedTemplate)}
          <Field label="Task title">
            <Input
              value={templateTitle}
              onChange={(event) => setTemplateTitle(event.target.value)}
              minLength={2}
              maxLength={120}
              placeholder={selectedTemplate.title}
            />
          </Field>
          <Field label="Assignee">
            <UserDropdown
              value={templateAssigneeId}
              members={templateMembers}
              allowUnassigned
              disabled={mutation.isPending}
              onChange={setTemplateAssigneeId}
            />
          </Field>
          <Field label="Due date">
            <DatePickerField
              ariaLabel="Due date"
              value={templateDueDate}
              disabled={mutation.isPending}
              onChange={setTemplateDueDate}
            />
          </Field>
          <p className="task-template-create-note">
            Description, type, priority and labels will be copied from the
            selected template.
          </p>
        </>
      ) : (
        <>
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              minLength={2}
              required
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="form-grid">
            <Field label="Status">
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                {statuses.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Select>
            </Field>
            <Field label="Priority">
              <PriorityDropdown
                value={priority}
                disabled={mutation.isPending}
                onChange={setPriority}
              />
            </Field>
            <Field label="Type">
              <TypeDropdown
                value={type}
                disabled={mutation.isPending}
                onChange={setType}
              />
            </Field>
          </div>
          <div className="date-field-grid">
            <Field label="Start date">
              <DatePickerField
                ariaLabel="Start date"
                value={startDate}
                onChange={setStartDate}
              />
            </Field>
            <Field label="Due date">
              <DatePickerField
                ariaLabel="Due date"
                value={dueDate}
                onChange={setDueDate}
              />
            </Field>
          </div>
          <Field label="Milestone">
            <MilestoneDropdown
              value={milestoneId || null}
              milestones={milestones}
              disabled={mutation.isPending}
              onChange={(value) => setMilestoneId(value || "")}
            />
          </Field>
          <Field label="Original estimate" error={parsedOriginalEstimate.error}>
            <Input
              className={parsedOriginalEstimate.error ? "input-invalid" : ""}
              placeholder="2w 4d 6h 45m"
              value={originalEstimate}
              onChange={(event) => setOriginalEstimate(event.target.value)}
            />
          </Field>
        </>
      )}
      <div className="dialog-actions">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          loading={mutation.isPending}
          disabled={!usingTemplate && !!parsedOriginalEstimate.error}
        >
          Save task
        </Button>
      </div>
    </form>
  );
}
