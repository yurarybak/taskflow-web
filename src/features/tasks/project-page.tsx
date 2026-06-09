import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  Blocks,
  Bug,
  CalendarDays,
  CheckSquare2,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Edit3,
  Eye,
  Flag,
  FileUp,
  GripVertical,
  List,
  Minus,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  SquareCheck,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Badge,
  Avatar,
  Button,
  ConfirmDialog,
  Dialog,
  Empty,
  Field,
  Input,
  Select,
  RichTextEditor,
  Skeleton,
  Textarea,
} from "../../components/ui";
import { api } from "../../lib/api";
import { keys } from "../../lib/query-keys";
import { initials, personName } from "../../lib/utils";
import type {
  Label,
  Member,
  Milestone,
  Task,
  ChecklistItem,
  TaskFilters,
  TaskPriority,
  TaskStatus,
  TaskWatcher,
  TaskType,
  User,
  Worklog,
  Role,
  SavedTaskFilter,
} from "../../lib/types";

const statuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
const priorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];
const types: TaskType[] = ["TASK", "BUG", "FEATURE", "IMPROVEMENT"];
const isStatus = (value: unknown): value is TaskStatus =>
  typeof value === "string" && statuses.includes(value as TaskStatus);
const isPriority = (value: unknown): value is TaskPriority =>
  typeof value === "string" && priorities.includes(value as TaskPriority);
const isType = (value: unknown): value is TaskType =>
  typeof value === "string" && types.includes(value as TaskType);
const stringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
const cleanTaskFilters = (filters: TaskFilters): TaskFilters => ({
  ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
  ...(filters.statuses?.length ? { statuses: filters.statuses } : {}),
  ...(filters.priorities?.length ? { priorities: filters.priorities } : {}),
  ...(filters.types?.length ? { types: filters.types } : {}),
  ...(filters.assigneeIds?.length ? { assigneeIds: filters.assigneeIds } : {}),
  ...(filters.unassigned ? { unassigned: true } : {}),
  ...(filters.milestoneIds?.length
    ? { milestoneIds: filters.milestoneIds }
    : {}),
  ...(filters.withoutMilestone ? { withoutMilestone: true } : {}),
});
const taskFiltersRecord = (filters: TaskFilters): Record<string, unknown> => ({
  ...filters,
});
const savedFilterStorageKey = (projectId: string) =>
  `taskflow.activeSavedFilter.${projectId}`;
const comparableFilters = (filters: TaskFilters) =>
  JSON.stringify({
    ...cleanTaskFilters(filters),
    statuses: [...(filters.statuses ?? [])].sort(),
    priorities: [...(filters.priorities ?? [])].sort(),
    types: [...(filters.types ?? [])].sort(),
    assigneeIds: [...(filters.assigneeIds ?? [])].sort(),
    milestoneIds: [...(filters.milestoneIds ?? [])].sort(),
  });
const normalizeSavedFilters = (value: Record<string, unknown>): TaskFilters => {
  const statusesValue = Array.isArray(value.statuses)
    ? value.statuses.filter(isStatus)
    : undefined;
  const prioritiesValue = Array.isArray(value.priorities)
    ? value.priorities.filter(isPriority)
    : undefined;
  const typesValue = Array.isArray(value.types)
    ? value.types.filter(isType)
    : undefined;
  return cleanTaskFilters({
    search: typeof value.search === "string" ? value.search : undefined,
    statuses: statusesValue,
    priorities: prioritiesValue,
    types: typesValue,
    assigneeIds: stringArray(value.assigneeIds),
    unassigned: value.unassigned === true,
    milestoneIds: stringArray(value.milestoneIds),
    withoutMilestone: value.withoutMilestone === true,
  });
};
const statusLabel = (status: TaskStatus) =>
  ({ TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done" })[status];
const ESTIMATE_MINUTES = {
  w: 5 * 8 * 60,
  d: 8 * 60,
  h: 60,
  m: 1,
} as const;
const estimateHelpText = "Use the format: 2w 4d 6h 45m";
const formatEstimate = (minutes?: number | null) => {
  if (!minutes) return "";
  const parts: string[] = [];
  let remaining = minutes;
  (Object.entries(ESTIMATE_MINUTES) as Array<
    [keyof typeof ESTIMATE_MINUTES, number]
  >).forEach(([unit, unitMinutes]) => {
    const value = Math.floor(remaining / unitMinutes);
    if (!value) return;
    parts.push(`${value}${unit}`);
    remaining %= unitMinutes;
  });
  return parts.join(" ");
};
const formatEstimateLabel = (minutes?: number | null) =>
  formatEstimate(minutes) || "0m";
const parseEstimate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return { minutes: null, error: undefined };
  let minutes = 0;
  let matched = "";
  const tokenPattern = /(\d+)\s*([wdhm])/gi;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(trimmed))) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase() as keyof typeof ESTIMATE_MINUTES;
    minutes += amount * ESTIMATE_MINUTES[unit];
    matched += match[0];
  }
  if (!matched || matched.replace(/\s/g, "") !== trimmed.replace(/\s/g, "")) {
    return { minutes: null, error: estimateHelpText };
  }
  return { minutes, error: undefined };
};
const humanizeConstant = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
const wasUpdated = (createdAt?: string, updatedAt?: string) =>
  !!createdAt &&
  !!updatedAt &&
  Math.abs(new Date(updatedAt).getTime() - new Date(createdAt).getTime()) >
    1000;
const sanitizeRichText = (value: string) =>
  value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
function DatePickerField({
  value,
  disabled,
  ariaLabel,
  invalid,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  ariaLabel: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = value
    ? format(new Date(`${value}T00:00:00`), "MMM d, yyyy")
    : "None";
  return (
    <button
      className={[
        "date-picker-field",
        value ? "" : "empty",
        invalid ? "invalid" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.showPicker?.()}
    >
      <span>{label}</span>
      <input
        ref={inputRef}
        type="date"
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </button>
  );
}
function TaskForm({
  projectId,
  initial,
  onClose,
}: {
  projectId: string;
  initial?: Task;
  onClose: () => void;
}) {
  const client = useQueryClient();
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
  const parsedOriginalEstimate = parseEstimate(originalEstimate);
  const { data: milestones } = useQuery({
    queryKey: keys.milestones(projectId),
    queryFn: () => api.milestones(projectId),
  });
  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        title,
        description,
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
          return api.setTaskMilestone(projectId, initial.id, milestoneId || null);
        }
        return updated;
      }
      return api.createTask(projectId, {
        ...body,
        milestoneId: milestoneId || null,
      });
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["tasks", projectId] });
      toast.success(initial ? "Task updated" : "Task created");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (parsedOriginalEstimate.error) return;
        mutation.mutate();
      }}
    >
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
      <div className="dialog-actions">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={mutation.isPending} disabled={!!parsedOriginalEstimate.error}>
          Save task
        </Button>
      </div>
    </form>
  );
}
function Comments({
  taskId,
  currentUser,
  currentRole,
}: {
  taskId: string;
  currentUser?: User;
  currentRole?: Role;
}) {
  const client = useQueryClient();
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: keys.comments(taskId),
    queryFn: () => api.comments(taskId),
  });
  const add = useMutation({
    mutationFn: () => api.createComment(taskId, content),
    onSuccess: () => {
      setContent("");
      client.invalidateQueries({ queryKey: keys.comments(taskId) });
      client.invalidateQueries({ queryKey: keys.activity(taskId) });
    },
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: keys.comments(taskId) });
  const update = useMutation({
    mutationFn: () =>
      api.updateComment(taskId, editingId || "", editingContent),
    onSuccess: () => {
      setEditingId(null);
      setEditingContent("");
      refresh();
      toast.success("Comment updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (commentId: string) => api.removeComment(taskId, commentId),
    onSuccess: () => {
      setDeleteCommentId(null);
      refresh();
      client.invalidateQueries({ queryKey: keys.activity(taskId) });
      toast.success("Comment deleted");
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <section>
      <form
        className="comment-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (content.trim()) add.mutate();
        }}
      >
        <div className="comment-composer-row">
          <Avatar
            label={initials(currentUser)}
            src={currentUser ? api.avatarUrl(currentUser.id) : undefined}
          />
          <div className="comment-composer-body">
            <Textarea
              placeholder="Add a comment..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {content.trim() && (
              <div className="inline-actions">
                <Button loading={add.isPending}>Comment</Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setContent("")}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </form>
      {isLoading ? (
        <Skeleton rows={2} />
      ) : (
        data?.map((comment) => {
          const canEdit = currentUser?.id === comment.authorId;
          const canDelete =
            canEdit || currentRole === "OWNER" || currentRole === "ADMIN";
          const isEditing = editingId === comment.id;
          const edited = wasUpdated(comment.createdAt, comment.updatedAt);
          const timestamp = edited ? comment.updatedAt : comment.createdAt;
          return (
            <article className="comment" key={comment.id}>
              <div className="comment-heading">
                <Avatar
                  label={initials(comment.author)}
                  src={api.avatarUrl(comment.author.id)}
                />
                <div>
                  <strong>{personName(comment.author)}</strong>
                  <small>
                    {formatDistanceToNow(new Date(timestamp), {
                      addSuffix: true,
                    })}
                    {edited && " (edited)"}
                  </small>
                </div>
              </div>
              {isEditing ? (
                <div className="comment-edit-form">
                  <Textarea
                    value={editingContent}
                    onChange={(event) => setEditingContent(event.target.value)}
                    autoFocus
                  />
                  <div className="inline-actions">
                    <Button
                      loading={update.isPending}
                      onClick={() => editingContent.trim() && update.mutate()}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setEditingId(null);
                        setEditingContent("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p>{comment.content}</p>
              )}
              {!isEditing && (canEdit || canDelete) && (
                <div className="comment-actions">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditingContent(comment.content);
                      }}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeleteCommentId(comment.id)}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })
      )}
      <ConfirmDialog
        open={!!deleteCommentId}
        title="Delete comment?"
        description="This comment will be permanently deleted. This action cannot be undone."
        confirmText="Delete comment"
        loading={remove.isPending}
        onClose={() => setDeleteCommentId(null)}
        onConfirm={() => deleteCommentId && remove.mutate(deleteCommentId)}
      />
    </section>
  );
}
function Checklist({ taskId }: { taskId: string }) {
  const client = useQueryClient();
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<{
    id: string;
    placement: "before" | "after";
  } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: keys.checklist(taskId),
    queryFn: () => api.checklistItems(taskId),
  });
  const items = [...(data ?? [])].sort((a, b) => a.position - b.position);
  const completed = items.filter((item) => item.isCompleted).length;
  const total = items.length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const refresh = () =>
    client.invalidateQueries({ queryKey: keys.checklist(taskId) });
  const add = useMutation({
    mutationFn: () =>
      api.createChecklistItem(taskId, {
        title: title.trim(),
        position: total,
      }),
    onSuccess: () => {
      setTitle("");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: () =>
      api.updateChecklistItem(taskId, editingId || "", {
        title: editingTitle.trim(),
      }),
    onSuccess: () => {
      setEditingId(null);
      setEditingTitle("");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.removeChecklistItem(taskId, id),
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (item: ChecklistItem) =>
      api.toggleChecklistItem(taskId, item.id, !item.isCompleted),
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });
  const reorder = useMutation({
    mutationFn: async ({
      sourceId,
      targetId,
      placement,
    }: {
      sourceId: string;
      targetId: string;
      placement: "before" | "after";
    }) => {
      if (sourceId === targetId) return;
      const sourceIndex = items.findIndex((item) => item.id === sourceId);
      const targetIndex = items.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return;
      const next = [...items];
      const [moved] = next.splice(sourceIndex, 1);
      const targetIndexAfterRemoval = next.findIndex(
        (item) => item.id === targetId,
      );
      const insertIndex =
        placement === "after" ? targetIndexAfterRemoval + 1 : targetIndexAfterRemoval;
      next.splice(insertIndex, 0, moved);
      await Promise.all(
        next.map((item, position) =>
          item.position === position
            ? Promise.resolve(item)
            : api.updateChecklistItem(taskId, item.id, { position }),
        ),
      );
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });
  const previewDrop = (
    event: DragEvent<HTMLElement>,
    targetId: string,
  ) => {
    event.preventDefault();
    if (draggedItemId === targetId) {
      setDropPreview(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const placement =
      event.clientY > rect.top + rect.height / 2 ? "after" : "before";
    setDropPreview({ id: targetId, placement });
  };
  return (
    <section className="checklist-section">
      <div className="checklist-heading">
        <h3>
          <CheckSquare2 size={15} /> Checklist
        </h3>
        <span>
          {completed}/{total} completed
        </span>
      </div>
      <div className="checklist-progress" aria-label={`${progress}% completed`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <form
        className="checklist-add-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim().length >= 2) add.mutate();
        }}
      >
        <Input
          placeholder="Add checklist item..."
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Button
          type="submit"
          variant="secondary"
          loading={add.isPending}
          disabled={title.trim().length < 2}
        >
          <Plus size={14} /> Add
        </Button>
      </form>
      {isLoading ? (
        <Skeleton rows={2} />
      ) : (
        <div className="checklist-list">
          {!items.length ? (
            <p className="checklist-empty">No checklist items yet.</p>
          ) : (
            items.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <article
                  className={
                    [
                      "checklist-item",
                      item.isCompleted ? "completed" : "",
                      draggedItemId === item.id ? "dragging" : "",
                      dropPreview?.id === item.id
                        ? `drop-${dropPreview.placement}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")
                  }
                  key={item.id}
                  onDragOver={(event) => previewDrop(event, item.id)}
                  onDragLeave={() => {
                    if (dropPreview?.id === item.id) setDropPreview(null);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceId =
                      event.dataTransfer.getData("text/plain") || draggedItemId;
                    const placement = dropPreview?.placement || "before";
                    setDraggedItemId(null);
                    setDropPreview(null);
                    if (sourceId)
                      reorder.mutate({ sourceId, targetId: item.id, placement });
                  }}
                >
                  <span
                    className="checklist-drag-handle"
                    draggable={!isEditing}
                    aria-label="Drag checklist item"
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", item.id);
                      setDraggedItemId(item.id);
                    }}
                    onDragEnd={() => {
                      setDraggedItemId(null);
                      setDropPreview(null);
                    }}
                  >
                    <GripVertical size={14} />
                  </span>
                  <input
                    type="checkbox"
                    checked={item.isCompleted}
                    disabled={toggle.isPending || reorder.isPending}
                    onChange={() => toggle.mutate(item)}
                  />
                  {isEditing ? (
                    <form
                      className="checklist-edit-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (editingTitle.trim().length >= 2) update.mutate();
                      }}
                    >
                      <Input
                        value={editingTitle}
                        maxLength={200}
                        autoFocus
                        onChange={(event) =>
                          setEditingTitle(event.target.value)
                        }
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        aria-label="Save checklist item"
                        loading={update.isPending}
                        disabled={editingTitle.trim().length < 2}
                      >
                        <Check size={15} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label="Cancel checklist item edit"
                        onClick={() => {
                          setEditingId(null);
                          setEditingTitle("");
                        }}
                      >
                        <X size={15} />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <span className="checklist-item-title">{item.title}</span>
                      <div className="checklist-item-actions">
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label="Edit checklist item"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditingTitle(item.title);
                          }}
                        >
                          <Edit3 size={13} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label="Delete checklist item"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(item.id)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
function History({
  activity,
}: {
  activity?: Awaited<ReturnType<typeof api.activity>>;
}) {
  if (!activity?.length)
    return (
      <Empty title="No history yet" detail="Task changes will appear here." />
    );
  return (
    <div className="history-list">
      {activity.map((entry) => (
        <article className="comment history-entry" key={entry.id}>
          <div className="comment-heading">
            <Avatar
              label={initials(entry.actor)}
              src={api.avatarUrl(entry.actor.id)}
            />
            <div>
              <strong>{personName(entry.actor)}</strong>
              <small>
                {formatDistanceToNow(new Date(entry.createdAt), {
                  addSuffix: true,
                })}
              </small>
            </div>
          </div>
          <p>{entry.type.toLowerCase().replaceAll("_", " ")}</p>
        </article>
      ))}
    </div>
  );
}
function TimeTrackingDialog({
  open,
  projectId,
  task,
  onClose,
  onSaved,
}: {
  open: boolean;
  projectId: string;
  task: Task;
  onClose: () => void;
  onSaved: (timeSpentMinutes: number, remainingEstimateMinutes?: number) => void;
}) {
  const client = useQueryClient();
  const now = new Date();
  const [startedDate, setStartedDate] = useState(
    format(now, "yyyy-MM-dd"),
  );
  const [startedTime, setStartedTime] = useState(format(now, "HH:mm"));
  const [timeSpent, setTimeSpent] = useState("");
  const [remaining, setRemaining] = useState(
    formatEstimateLabel(task.remainingEstimateMinutes),
  );
  const [description, setDescription] = useState("");
  const parsedTimeSpent = parseEstimate(timeSpent);
  const parsedRemaining = parseEstimate(remaining);
  const logged = task.timeSpentMinutes ?? 0;
  const remainingMinutes = task.remainingEstimateMinutes ?? 0;
  const original = task.originalEstimateMinutes ?? logged + remainingMinutes;
  const totalForProgress = Math.max(original, logged + remainingMinutes, 1);
  const loggedPercent = Math.min(100, (logged / totalForProgress) * 100);
  const remainingPercent = Math.min(
    100 - loggedPercent,
    (remainingMinutes / totalForProgress) * 100,
  );
  const create = useMutation({
    mutationFn: () => {
      if (!parsedTimeSpent.minutes) throw new Error("Time spent is required");
      if (!startedDate || !startedTime)
        throw new Error("Date started is required");
      return api.createWorklog(projectId, task.id, {
        timeSpentMinutes: parsedTimeSpent.minutes,
        description: description.trim() || undefined,
        startedAt: new Date(`${startedDate}T${startedTime}:00`).toISOString(),
        remainingEstimateMinutes: remaining.trim()
          ? parsedRemaining.minutes ?? undefined
          : undefined,
      });
    },
    onSuccess: () => {
      const spent = parsedTimeSpent.minutes ?? 0;
      const nextRemaining = remaining.trim()
        ? parsedRemaining.minutes ?? undefined
        : undefined;
      client.invalidateQueries({ queryKey: keys.worklogs(projectId, task.id) });
      client.invalidateQueries({ queryKey: ["tasks", projectId] });
      client.invalidateQueries({ queryKey: keys.task(projectId, task.id) });
      onSaved(spent, nextRemaining);
      setTimeSpent("");
      setDescription("");
      onClose();
      toast.success("Work logged");
    },
    onError: (e) => toast.error(e.message),
  });
  const timeSpentError =
    timeSpent.trim() && parsedTimeSpent.error ? parsedTimeSpent.error : undefined;
  const remainingError =
    remaining.trim() && parsedRemaining.error ? parsedRemaining.error : undefined;
  return (
    <Dialog open={open} title="Time tracking" onClose={onClose}>
      <form
        className="time-tracking-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!parsedTimeSpent.minutes || timeSpentError || remainingError) return;
          create.mutate();
        }}
      >
        <div className="time-progress" aria-label="Time tracking progress">
          <span style={{ width: `${loggedPercent}%` }} />
          <span style={{ width: `${remainingPercent}%` }} />
        </div>
        <p className="time-progress-label">
          {formatEstimateLabel(logged)} logged
        </p>
        <p className="time-original">
          The original estimate for this work item was{" "}
          <strong>{formatEstimateLabel(task.originalEstimateMinutes)}</strong>.
        </p>
        <div className="date-field-grid">
          <Field label="Time spent" error={timeSpentError}>
            <Input
              className={timeSpentError ? "input-invalid" : ""}
              value={timeSpent}
              autoFocus
              placeholder="2h 30m"
              onChange={(event) => setTimeSpent(event.target.value)}
            />
          </Field>
          <Field label="Time remaining" error={remainingError}>
            <Input
              className={remainingError ? "input-invalid" : ""}
              value={remaining}
              placeholder="0m"
              onChange={(event) => setRemaining(event.target.value)}
            />
          </Field>
        </div>
        <div className="estimate-help">
          <p>Use the format: 2w 4d 6h 45m</p>
          <ul>
            <li>w = weeks</li>
            <li>d = days</li>
            <li>h = hours</li>
            <li>m = minutes</li>
          </ul>
        </div>
        <Field
          label="Date started*"
          error={!startedDate || !startedTime ? "Date started is required." : undefined}
        >
          <div className="date-time-picker-grid">
            <Input
              type="date"
              value={startedDate}
              onChange={(event) => setStartedDate(event.target.value)}
            />
            <Input
              type="time"
              value={startedTime}
              onChange={(event) => setStartedTime(event.target.value)}
            />
          </div>
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            maxLength={500}
            placeholder="What did you work on?"
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={
              !parsedTimeSpent.minutes ||
              !startedDate ||
              !startedTime ||
              !!timeSpentError ||
              !!remainingError
            }
          >
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
function WorklogEditDialog({
  projectId,
  task,
  worklog,
  onClose,
  onSaved,
}: {
  projectId: string;
  task: Task;
  worklog: Worklog;
  onClose: () => void;
  onSaved: (worklog: Worklog, remainingEstimateMinutes?: number) => void;
}) {
  const startedAt = new Date(worklog.startedAt);
  const [timeSpent, setTimeSpent] = useState(
    formatEstimateLabel(worklog.timeSpentMinutes),
  );
  const [remaining, setRemaining] = useState(
    formatEstimateLabel(task.remainingEstimateMinutes),
  );
  const [startedDate, setStartedDate] = useState(
    format(startedAt, "yyyy-MM-dd"),
  );
  const [startedTime, setStartedTime] = useState(format(startedAt, "HH:mm"));
  const [description, setDescription] = useState(worklog.description || "");
  const parsedTimeSpent = parseEstimate(timeSpent);
  const parsedRemaining = parseEstimate(remaining);
  const timeSpentError =
    timeSpent.trim() && parsedTimeSpent.error ? parsedTimeSpent.error : undefined;
  const remainingError =
    remaining.trim() && parsedRemaining.error ? parsedRemaining.error : undefined;
  const update = useMutation({
    mutationFn: () => {
      if (!parsedTimeSpent.minutes) throw new Error("Time spent is required");
      if (!startedDate || !startedTime)
        throw new Error("Date started is required");
      return api.updateWorklog(projectId, task.id, worklog.id, {
        timeSpentMinutes: parsedTimeSpent.minutes,
        description: description.trim(),
        startedAt: new Date(`${startedDate}T${startedTime}:00`).toISOString(),
        remainingEstimateMinutes: remaining.trim()
          ? parsedRemaining.minutes ?? undefined
          : undefined,
      });
    },
    onSuccess: (updated) => {
      onSaved(
        updated,
        remaining.trim() ? parsedRemaining.minutes ?? undefined : undefined,
      );
      toast.success("Worklog updated");
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open title="Edit worklog" onClose={onClose}>
      <form
        className="time-tracking-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!parsedTimeSpent.minutes || timeSpentError || remainingError) return;
          update.mutate();
        }}
      >
        <div className="date-field-grid">
          <Field label="Time spent" error={timeSpentError}>
            <Input
              className={timeSpentError ? "input-invalid" : ""}
              value={timeSpent}
              autoFocus
              placeholder="2h 30m"
              onChange={(event) => setTimeSpent(event.target.value)}
            />
          </Field>
          <Field label="Time remaining" error={remainingError}>
            <Input
              className={remainingError ? "input-invalid" : ""}
              value={remaining}
              placeholder="0m"
              onChange={(event) => setRemaining(event.target.value)}
            />
          </Field>
        </div>
        <div className="estimate-help">
          <p>Use the format: 2w 4d 6h 45m</p>
          <ul>
            <li>w = weeks</li>
            <li>d = days</li>
            <li>h = hours</li>
            <li>m = minutes</li>
          </ul>
        </div>
        <Field
          label="Date started*"
          error={!startedDate || !startedTime ? "Date started is required." : undefined}
        >
          <div className="date-time-picker-grid">
            <Input
              type="date"
              value={startedDate}
              onChange={(event) => setStartedDate(event.target.value)}
            />
            <Input
              type="time"
              value={startedTime}
              onChange={(event) => setStartedTime(event.target.value)}
            />
          </div>
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            maxLength={500}
            placeholder="What did you work on?"
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={update.isPending}
            disabled={
              !parsedTimeSpent.minutes ||
              !startedDate ||
              !startedTime ||
              !!timeSpentError ||
              !!remainingError
            }
          >
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
function WorklogList({
  projectId,
  task,
  onTaskUpdated,
}: {
  projectId: string;
  task: Task;
  onTaskUpdated: (task: Task) => void;
}) {
  const client = useQueryClient();
  const [editWorklog, setEditWorklog] = useState<Worklog>();
  const [deleteWorklog, setDeleteWorklog] = useState<Worklog>();
  const { data, isLoading } = useQuery({
    queryKey: keys.worklogs(projectId, task.id),
    queryFn: () => api.worklogs(projectId, task.id),
  });
  const refresh = () => {
    client.invalidateQueries({ queryKey: keys.worklogs(projectId, task.id) });
    client.invalidateQueries({ queryKey: ["tasks", projectId] });
    client.invalidateQueries({ queryKey: keys.task(projectId, task.id) });
  };
  const remove = useMutation({
    mutationFn: () => {
      if (!deleteWorklog) throw new Error("No worklog selected");
      return api.removeWorklog(projectId, task.id, deleteWorklog.id);
    },
    onSuccess: () => {
      if (deleteWorklog) {
        onTaskUpdated({
          ...task,
          timeSpentMinutes: Math.max(
            0,
            (task.timeSpentMinutes ?? 0) - deleteWorklog.timeSpentMinutes,
          ),
        });
      }
      setDeleteWorklog(undefined);
      refresh();
      toast.success("Worklog deleted");
    },
    onError: (e) => toast.error(e.message),
  });
  const worklogs = [...(data ?? [])].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
  if (isLoading) return <Skeleton rows={2} />;
  if (!worklogs.length)
    return (
      <div className="worklog-empty">
        <Empty
          title="No work logged"
          detail="Log work from the Time tracking section in task details."
        />
      </div>
    );
  return (
    <>
      <div className="worklog-list">
        {worklogs.map((worklog: Worklog) => (
          <article className="worklog-entry" key={worklog.id}>
            <Avatar
              label={worklog.author ? initials(worklog.author) : "?"}
              src={worklog.authorId ? api.avatarUrl(worklog.authorId) : undefined}
            />
            <div>
              <header>
                <div>
                  <strong>
                    {worklog.author ? personName(worklog.author) : "Unknown user"}
                  </strong>
                  <small>
                    {formatDistanceToNow(new Date(worklog.startedAt), {
                      addSuffix: true,
                    })}
                  </small>
                </div>
              </header>
              <p>
                Logged{" "}
                <strong>{formatEstimateLabel(worklog.timeSpentMinutes)}</strong>
              </p>
              {worklog.description && <p>{worklog.description}</p>}
              <div className="comment-actions">
                <button type="button" onClick={() => setEditWorklog(worklog)}>
                  <Edit3 size={13} /> Edit
                </button>
                <button type="button" onClick={() => setDeleteWorklog(worklog)}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {editWorklog && (
        <WorklogEditDialog
          projectId={projectId}
          task={task}
          worklog={editWorklog}
          onClose={() => setEditWorklog(undefined)}
          onSaved={(updated, remaining) => {
            onTaskUpdated({
              ...task,
              timeSpentMinutes:
                (task.timeSpentMinutes ?? 0) -
                editWorklog.timeSpentMinutes +
                updated.timeSpentMinutes,
              remainingEstimateMinutes:
                remaining ?? task.remainingEstimateMinutes ?? null,
            });
            setEditWorklog(undefined);
            refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleteWorklog}
        title="Delete worklog?"
        description="This worklog will be permanently deleted. This action cannot be undone."
        confirmText="Delete worklog"
        loading={remove.isPending}
        onClose={() => setDeleteWorklog(undefined)}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
function Attachments({ taskId }: { taskId: string }) {
  const client = useQueryClient();
  const { data } = useQuery({
    queryKey: keys.attachments(taskId),
    queryFn: () => api.attachments(taskId),
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: keys.attachments(taskId) });
  const remove = useMutation({
    mutationFn: (id: string) => api.removeAttachment(taskId, id),
    onSuccess: refresh,
  });
  const upload = useMutation({
    mutationFn: (file: File) => api.uploadAttachment(taskId, file),
    onSuccess: refresh,
  });
  return (
    <section>
      <h3>
        <Paperclip size={15} /> Attachments
      </h3>
      <div className="attachment-list">
        {data?.map((file) => (
          <div className="attachment" key={file.id}>
            <a href={api.attachmentUrl(taskId, file.id)}>
              <Download size={14} /> {file.originalName}
            </a>
            <small>{Math.ceil(file.size / 1024)} KB</small>
            <Button
              variant="ghost"
              onClick={() =>
                confirm("Delete this attachment?") && remove.mutate(file.id)
              }
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>
      <label className="upload">
        <FileUp size={15} /> Upload file
        <input
          type="file"
          onChange={(e) =>
            e.target.files?.[0] && upload.mutate(e.target.files[0])
          }
        />
      </label>
    </section>
  );
}
function PriorityIcon({ priority }: { priority: TaskPriority }) {
  if (priority === "HIGH")
    return <ChevronUp className="priority-icon priority-icon-high" size={15} />;
  if (priority === "LOW")
    return (
      <ChevronDown className="priority-icon priority-icon-low" size={15} />
    );
  return <Minus className="priority-icon priority-icon-medium" size={15} />;
}
function PriorityDropdown({
  value,
  disabled,
  onChange,
}: {
  value: TaskPriority;
  disabled?: boolean;
  onChange: (priority: TaskPriority) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick, true);
  }, []);
  return (
    <div className="priority-dropdown" ref={ref}>
      <button
        className="priority-dropdown-button"
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <PriorityIcon priority={value} />
          {humanizeConstant(value)}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="priority-dropdown-menu">
          {priorities.map((priority) => (
            <button
              className={priority === value ? "active" : ""}
              type="button"
              key={priority}
              onClick={() => {
                setOpen(false);
                if (priority !== value) onChange(priority);
              }}
            >
              <PriorityIcon priority={priority} />
              {humanizeConstant(priority)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function TypeIcon({ type }: { type: TaskType }) {
  if (type === "BUG")
    return <Bug className="type-icon type-icon-bug" size={15} />;
  if (type === "FEATURE")
    return <Zap className="type-icon type-icon-feature" size={15} />;
  if (type === "IMPROVEMENT")
    return <Blocks className="type-icon type-icon-improvement" size={15} />;
  return <SquareCheck className="type-icon type-icon-task" size={15} />;
}
function TypeDropdown({
  value,
  disabled,
  onChange,
}: {
  value: TaskType;
  disabled?: boolean;
  onChange: (type: TaskType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick, true);
  }, []);
  return (
    <div className="type-dropdown" ref={ref}>
      <button
        className="type-dropdown-button"
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <TypeIcon type={value} />
          {humanizeConstant(value)}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="type-dropdown-menu">
          {types.map((type) => (
            <button
              className={type === value ? "active" : ""}
              type="button"
              key={type}
              onClick={() => {
                setOpen(false);
                if (type !== value) onChange(type);
              }}
            >
              <TypeIcon type={type} />
              {humanizeConstant(type)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function UserDropdown({
  value,
  members,
  disabled,
  allowUnassigned = false,
  onChange,
}: {
  value?: string | null;
  members?: Member[];
  disabled?: boolean;
  allowUnassigned?: boolean;
  onChange: (userId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = findUserById(members, value);
  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick, true);
  }, []);
  return (
    <div className="user-dropdown" ref={ref}>
      <button
        className={
          value ? "user-dropdown-button" : "user-dropdown-button empty"
        }
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        {value ? (
          <span className="user-dropdown-selected">
            <Avatar
              label={selected ? initials(selected) : "?"}
              src={api.avatarUrl(value)}
            />
            <span>{selected ? personName(selected) : value}</span>
          </span>
        ) : (
          <span className="user-dropdown-selected">Unassigned</span>
        )}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="user-dropdown-menu">
          {allowUnassigned && (
            <button
              className={!value ? "active" : ""}
              type="button"
              onClick={() => {
                setOpen(false);
                if (value) onChange(null);
              }}
            >
              <span className="user-dropdown-empty-avatar">-</span>
              <span>Unassigned</span>
            </button>
          )}
          {members?.map((member) => (
            <button
              className={member.user.id === value ? "active" : ""}
              type="button"
              key={member.id}
              onClick={() => {
                setOpen(false);
                if (member.user.id !== value) onChange(member.user.id);
              }}
            >
              <Avatar
                label={initials(member.user)}
                src={api.avatarUrl(member.user.id)}
              />
              <span>{personName(member.user)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function findMilestoneById(
  milestones: Milestone[] | undefined,
  milestoneId?: string | null,
) {
  return milestones?.find((milestone) => milestone.id === milestoneId);
}
function MilestoneDropdown({
  value,
  milestones,
  disabled,
  onChange,
}: {
  value?: string | null;
  milestones?: Milestone[];
  disabled?: boolean;
  onChange: (milestoneId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = findMilestoneById(milestones, value);
  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick, true);
  }, []);
  return (
    <div className="user-dropdown milestone-dropdown" ref={ref}>
      <button
        className={
          value ? "user-dropdown-button" : "user-dropdown-button empty"
        }
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="user-dropdown-selected milestone-dropdown-selected">
          <CalendarDays size={15} />
          <span>{selected?.name || (value ? value : "None")}</span>
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="user-dropdown-menu">
          <button
            className={!value ? "active" : ""}
            type="button"
            onClick={() => {
              setOpen(false);
              if (value) onChange(null);
            }}
          >
            <CalendarDays size={15} />
            <span>None</span>
          </button>
          {milestones?.length ? (
            milestones.map((milestone) => (
              <button
                className={milestone.id === value ? "active" : ""}
                type="button"
                key={milestone.id}
                onClick={() => {
                  setOpen(false);
                  if (milestone.id !== value) onChange(milestone.id);
                }}
              >
                <CalendarDays size={15} />
                <span>{milestone.name}</span>
              </button>
            ))
          ) : (
            <div className="user-dropdown-empty-option">No milestones yet</div>
          )}
        </div>
      )}
    </div>
  );
}
const watcherUserId = (watcher: TaskWatcher) =>
  watcher.user?.id || watcher.userId || watcher.id || "";
const watcherUser = (watcher: TaskWatcher): User => ({
  id: watcherUserId(watcher),
  email: watcher.user?.email || watcher.email || "",
  firstName: watcher.user?.firstName || watcher.firstName,
  lastName: watcher.user?.lastName || watcher.lastName,
});
function WatchersPopover({
  taskId,
  currentUser,
  members,
}: {
  taskId: string;
  currentUser?: User;
  members?: Member[];
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useQuery({
    queryKey: keys.watchers(taskId),
    queryFn: () => api.watchers(taskId),
  });
  const watchers = data ?? [];
  const watcherIds = new Set(watchers.map(watcherUserId).filter(Boolean));
  const isWatching = !!currentUser?.id && watcherIds.has(currentUser.id);
  const availableMembers =
    members?.filter((member) => !watcherIds.has(member.user.id)) ?? [];
  const refresh = () =>
    client.invalidateQueries({ queryKey: keys.watchers(taskId) });
  const watchMe = useMutation({
    mutationFn: () => api.watchMe(taskId),
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });
  const unwatchMe = useMutation({
    mutationFn: () => api.unwatchMe(taskId),
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });
  const addWatcher = useMutation({
    mutationFn: (userId: string) => api.addWatcher(taskId, userId),
    onSuccess: () => {
      setAdding(false);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const removeWatcher = useMutation({
    mutationFn: (userId: string) => api.removeWatcher(taskId, userId),
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });
  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick, true);
  }, []);
  return (
    <div className="watchers-menu" ref={ref}>
      <Button
        className="watchers-trigger"
        variant="ghost"
        aria-label="Task watchers"
        onClick={() => setOpen((current) => !current)}
      >
        <Eye size={17} />
        {!!watchers.length && <span>{watchers.length}</span>}
      </Button>
      {open && (
        <div className="watchers-popover">
          <button
            type="button"
            className="watchers-primary-action"
            disabled={watchMe.isPending || unwatchMe.isPending}
            onClick={() => (isWatching ? unwatchMe.mutate() : watchMe.mutate())}
          >
            <Eye size={15} />
            <span>{isWatching ? "Stop watching" : "Start watching"}</span>
          </button>
          <div className="watchers-content">
            <h4>Watching this task</h4>
            {!watchers.length ? (
              <p>No watchers yet.</p>
            ) : (
              watchers.map((watcher) => {
                const user = watcherUser(watcher);
                return (
                  <div className="watcher-row" key={user.id}>
                    <Avatar label={initials(user)} src={api.avatarUrl(user.id)} />
                    <span>{personName(user)}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${personName(user)} from watchers`}
                      disabled={removeWatcher.isPending}
                      onClick={() => removeWatcher.mutate(user.id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <div className="watchers-add">
            <button type="button" onClick={() => setAdding((value) => !value)}>
              <Plus size={15} />
              Add watchers
            </button>
            {adding && (
              <div className="watchers-add-list">
                {!availableMembers.length ? (
                  <p>No members to add.</p>
                ) : (
                  availableMembers.map((member) => (
                    <button
                      type="button"
                      key={member.id}
                      disabled={addWatcher.isPending}
                      onClick={() => addWatcher.mutate(member.user.id)}
                    >
                      <Avatar
                        label={initials(member.user)}
                        src={api.avatarUrl(member.user.id)}
                      />
                      <span>{personName(member.user)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function TaskModal({
  workspaceId,
  projectId,
  task,
  onClose,
  onUpdated,
}: {
  workspaceId: string;
  projectId: string;
  task: Task;
  onClose: () => void;
  onUpdated: (task: Task) => void;
}) {
  const client = useQueryClient();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [originalEstimate, setOriginalEstimate] = useState(
    formatEstimate(task.originalEstimateMinutes),
  );
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [activityTab, setActivityTab] = useState<
    "all" | "comments" | "history" | "worklog"
  >("comments");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [timeTrackingOpen, setTimeTrackingOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const titleEditRef = useRef<HTMLDivElement>(null);
  const parsedOriginalEstimate = parseEstimate(originalEstimate);
  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
  });
  const { data: labels } = useQuery({
    queryKey: keys.labels(workspaceId),
    queryFn: () => api.labels(workspaceId),
  });
  const { data: members } = useQuery({
    queryKey: keys.members(workspaceId),
    queryFn: () => api.members(workspaceId),
  });
  const { data: milestones } = useQuery({
    queryKey: keys.milestones(projectId),
    queryFn: () => api.milestones(projectId),
  });
  const { data: activity } = useQuery({
    queryKey: keys.activity(task.id),
    queryFn: () => api.activity(task.id),
  });
  const invalidate = () => {
    client.invalidateQueries({ queryKey: ["tasks", projectId] });
    client.invalidateQueries({ queryKey: keys.task(projectId, task.id) });
  };
  const saveTask = useMutation({
    mutationFn: () =>
      api.updateTask(projectId, task.id, {
        title,
        description,
      }),
    onSuccess: (updated) => {
      onUpdated(updated);
      setEditingTitle(false);
      setEditingDescription(false);
      invalidate();
      toast.success("Task updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const saveTitle = useMutation({
    mutationFn: () => api.updateTask(projectId, task.id, { title }),
    onSuccess: (updated) => {
      onUpdated(updated);
      setEditingTitle(false);
      invalidate();
      toast.success("Task updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateModalStatus = useMutation({
    mutationFn: (status: TaskStatus) =>
      api.updateTask(projectId, task.id, { status }),
    onSuccess: (updated) => {
      onUpdated(updated);
      invalidate();
      toast.success("Status updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateModalField = useMutation({
    mutationFn: (
      patch: Partial<
        Pick<
          Task,
          | "priority"
          | "type"
          | "startDate"
          | "dueDate"
          | "creatorId"
          | "originalEstimateMinutes"
        >
      >,
    ) => api.updateTask(projectId, task.id, patch),
    onSuccess: (updated) => {
      onUpdated(updated);
      setOriginalEstimate(formatEstimate(updated.originalEstimateMinutes));
      invalidate();
      toast.success("Task updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateAssignee = useMutation({
    mutationFn: (assigneeId: string | null) =>
      api.assign(projectId, task.id, assigneeId),
    onSuccess: (updated) => {
      onUpdated(updated);
      invalidate();
      toast.success("Assignee updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMilestone = useMutation({
    mutationFn: (milestoneId: string | null) =>
      api.setTaskMilestone(projectId, task.id, milestoneId),
    onSuccess: (updated) => {
      onUpdated(updated);
      invalidate();
      toast.success("Milestone updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleArchive = useMutation({
    mutationFn: () =>
      task.archivedAt
        ? api.unarchiveTask(projectId, task.id)
        : api.archiveTask(projectId, task.id),
    onSuccess: (updated) => {
      onUpdated(updated);
      invalidate();
      toast.success(updated.archivedAt ? "Task archived" : "Task unarchived");
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleFlag = useMutation({
    mutationFn: () =>
      task.flaggedAt
        ? api.unflagTask(projectId, task.id)
        : api.flagTask(projectId, task.id),
    onSuccess: (updated) => {
      onUpdated(updated);
      invalidate();
      toast.success(updated.flaggedAt ? "Flag added" : "Flag removed");
    },
    onError: (e) => toast.error(e.message),
  });
  const cloneTask = useMutation({
    mutationFn: () => api.cloneTask(projectId, task.id),
    onSuccess: (cloned) => {
      onUpdated(cloned);
      invalidate();
      toast.success("Task cloned");
    },
    onError: (e) => toast.error(e.message),
  });
  const removeTask = useMutation({
    mutationFn: () => api.removeTask(projectId, task.id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["tasks", projectId] });
      onClose();
      toast.success("Task deleted");
    },
    onError: (e) => toast.error(e.message),
  });
  const cancelEdit = () => {
    setTitle(task.title);
    setDescription(task.description || "");
    setEditingTitle(false);
    setEditingDescription(false);
  };
  const saveOriginalEstimate = () => {
    if (parsedOriginalEstimate.error) return;
    const nextValue = originalEstimate.trim()
      ? parsedOriginalEstimate.minutes
      : null;
    if (nextValue === (task.originalEstimateMinutes ?? null)) return;
    updateModalField.mutate({ originalEstimateMinutes: nextValue });
  };
  useEffect(() => {
    if (!editingTitle) return;
    const closeTitleEditOnOutsideClick = (event: PointerEvent) => {
      if (
        titleEditRef.current &&
        !titleEditRef.current.contains(event.target as Node)
      ) {
        setTitle(task.title);
        setEditingTitle(false);
      }
    };
    document.addEventListener(
      "pointerdown",
      closeTitleEditOnOutsideClick,
      true,
    );
    return () =>
      document.removeEventListener(
        "pointerdown",
        closeTitleEditOnOutsideClick,
        true,
      );
  }, [editingTitle, task.title]);
  const toggle = useMutation({
    mutationFn: (label: Label) =>
      (task.labels ?? []).some((x) => x.id === label.id)
        ? api.detachLabel(projectId, task.id, label.id)
        : api.attachLabel(projectId, task.id, label.id),
    onSuccess: invalidate,
  });
  const currentMember = members?.find(
    (member) =>
      member.userId === currentUser?.id || member.user.id === currentUser?.id,
  );
  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        actionsRef.current &&
        !actionsRef.current.contains(event.target as Node)
      ) {
        setActionsOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick, true);
  }, []);
  return (
    <Dialog
      open
      title="Task details"
      onClose={onClose}
      wide
      actions={
        <>
          <WatchersPopover
            taskId={task.id}
            currentUser={currentUser}
            members={members}
          />
          <div className="task-modal-actions-menu" ref={actionsRef}>
            <Button
              variant="ghost"
              aria-label="Task actions"
              onClick={() => setActionsOpen((open) => !open)}
            >
              <MoreHorizontal size={17} />
            </Button>
            {actionsOpen && (
              <div className="task-modal-actions-popover">
                <button
                  type="button"
                  disabled={cloneTask.isPending}
                  onClick={() => {
                    setActionsOpen(false);
                    cloneTask.mutate();
                  }}
                >
                  Clone
                </button>
                <button
                  type="button"
                  disabled={toggleArchive.isPending}
                  onClick={() => {
                    setActionsOpen(false);
                    toggleArchive.mutate();
                  }}
                >
                  {task.archivedAt ? "Unarchive" : "Archive"}
                </button>
                <button
                  type="button"
                  disabled={toggleFlag.isPending}
                  onClick={() => {
                    setActionsOpen(false);
                    toggleFlag.mutate();
                  }}
                >
                  {task.flaggedAt ? "Remove flag" : "Add flag"}
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={removeTask.isPending}
                  onClick={() => {
                    setActionsOpen(false);
                    setConfirmDeleteOpen(true);
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </>
      }
    >
      <div className="task-modal">
        <main className="task-modal-main">
          {editingTitle ? (
            <div className="title-edit-block" ref={titleEditRef}>
              <Input
                className="task-title-input"
                value={title}
                autoFocus
                onChange={(event) => setTitle(event.target.value)}
              />
              <div className="title-edit-actions">
                <Button
                  variant="ghost"
                  aria-label="Save title"
                  loading={saveTitle.isPending}
                  onClick={() => title.trim() && saveTitle.mutate()}
                >
                  <Check size={16} />
                </Button>
                <Button
                  variant="ghost"
                  aria-label="Cancel title edit"
                  onClick={cancelEdit}
                >
                  <X size={16} />
                </Button>
              </div>
            </div>
          ) : (
            <button
              className="editable-title"
              onClick={() => setEditingTitle(true)}
            >
              {title}
            </button>
          )}
          <section>
            <h3>Description</h3>
            {editingDescription ? (
              <>
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Add a description..."
                />
                <div className="inline-actions">
                  <Button
                    loading={saveTask.isPending}
                    onClick={() => saveTask.mutate()}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <div
                role="button"
                tabIndex={0}
                className="editable-description"
                onClick={() => setEditingDescription(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    setEditingDescription(true);
                  }
                }}
              >
                {description ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRichText(description),
                    }}
                  />
                ) : (
                  "Add a description..."
                )}
              </div>
            )}
          </section>
          <Checklist taskId={task.id} />
          <Attachments taskId={task.id} />
          <section>
            <h3>Activity</h3>
            <div
              className="activity-tabs"
              role="tablist"
              aria-label="Task activity"
            >
              <button
                className={activityTab === "all" ? "active" : ""}
                onClick={() => setActivityTab("all")}
              >
                All
              </button>
              <button
                className={activityTab === "comments" ? "active" : ""}
                onClick={() => setActivityTab("comments")}
              >
                Comments
              </button>
              <button
                className={activityTab === "history" ? "active" : ""}
                onClick={() => setActivityTab("history")}
              >
                History
              </button>
              <button
                className={activityTab === "worklog" ? "active" : ""}
                onClick={() => setActivityTab("worklog")}
              >
                Work log
              </button>
            </div>
            {(activityTab === "all" || activityTab === "comments") && (
              <Comments
                taskId={task.id}
                currentUser={currentUser}
                currentRole={currentMember?.role}
              />
            )}
            {(activityTab === "all" || activityTab === "history") && (
              <History activity={activity} />
            )}
            {activityTab === "worklog" && (
              <WorklogList
                projectId={projectId}
                task={task}
                onTaskUpdated={onUpdated}
              />
            )}
          </section>
        </main>
        <aside className="task-modal-side">
          <div className="status-control-row">
            <Select
              className={`status-select status-select-${task.status.toLowerCase()}`}
              value={task.status}
              disabled={updateModalStatus.isPending}
              onChange={(event) =>
                updateModalStatus.mutate(event.target.value as TaskStatus)
              }
            >
              {statuses.map((status) => (
                <option value={status} key={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </Select>
            {task.flaggedAt && (
              <span className="modal-flag-icon" title="Flagged" aria-label="Flagged">
                <Flag size={16} fill="currentColor" />
              </span>
            )}
          </div>
          <section className="task-details-panel">
            <h3>Details</h3>
            <div className="detail-person-row">
              <span>Assignee</span>
              <div className="assignee-detail">
                <UserDropdown
                  value={task.assigneeId}
                  members={members}
                  allowUnassigned
                  disabled={updateAssignee.isPending}
                  onChange={(userId) => updateAssignee.mutate(userId)}
                />
                {currentUser?.id && task.assigneeId !== currentUser.id && (
                  <button
                    type="button"
                    className="link-button"
                    disabled={updateAssignee.isPending}
                    onClick={() => updateAssignee.mutate(currentUser.id)}
                  >
                    Assign to me
                  </button>
                )}
              </div>
            </div>
            <div className="detail-person-row">
              <span>Reporter</span>
              <UserDropdown
                value={task.creatorId}
                members={members}
                disabled={updateModalField.isPending}
                onChange={(userId) => {
                  if (!userId) return;
                  updateModalField.mutate({ creatorId: userId });
                }}
              />
            </div>
            <div className="detail-person-row">
              <span>Milestone</span>
              <MilestoneDropdown
                value={task.milestoneId || task.milestone?.id || null}
                milestones={milestones}
                disabled={updateMilestone.isPending}
                onChange={(milestoneId) => updateMilestone.mutate(milestoneId)}
              />
            </div>
            <div className="detail-person-row">
              <span>Priority</span>
              <PriorityDropdown
                value={task.priority}
                disabled={updateModalField.isPending}
                onChange={(priority) =>
                  updateModalField.mutate({
                    priority,
                  })
                }
              />
            </div>
            <div className="detail-person-row">
              <span>Type</span>
              <TypeDropdown
                value={task.type}
                disabled={updateModalField.isPending}
                onChange={(type) =>
                  updateModalField.mutate({
                    type,
                  })
                }
              />
            </div>
            <div className="detail-person-row">
              <span>Start date</span>
              <DatePickerField
                ariaLabel="Start date"
                value={task.startDate?.slice(0, 10) || ""}
                disabled={updateModalField.isPending}
                onChange={(value) => {
                  if (!value) return;
                  updateModalField.mutate({
                    startDate: new Date(value).toISOString(),
                  });
                }}
              />
            </div>
            <div className="detail-person-row">
              <span>Due date</span>
              <DatePickerField
                ariaLabel="Due date"
                value={task.dueDate?.slice(0, 10) || ""}
                disabled={updateModalField.isPending}
                onChange={(value) => {
                  if (!value) return;
                  updateModalField.mutate({
                    dueDate: new Date(value).toISOString(),
                  });
                }}
              />
            </div>
            <div className="detail-person-row">
              <span>Original estimate</span>
              <div className="estimate-field">
                <Input
                  className={parsedOriginalEstimate.error ? "input-invalid" : ""}
                  placeholder="2w 4d 6h 45m"
                  value={originalEstimate}
                  disabled={updateModalField.isPending}
                  onChange={(event) => setOriginalEstimate(event.target.value)}
                  onBlur={saveOriginalEstimate}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    saveOriginalEstimate();
                  }}
                />
                {parsedOriginalEstimate.error && (
                  <small>{parsedOriginalEstimate.error}</small>
                )}
              </div>
            </div>
            <div className="detail-person-row">
              <span>Time tracking</span>
              <button
                type="button"
                className="time-tracking-summary"
                onClick={() => setTimeTrackingOpen(true)}
              >
                <span className="time-tracking-bar">
                  <span
                    style={{
                      width: `${Math.min(
                        100,
                        ((task.timeSpentMinutes ?? 0) /
                          Math.max(
                            task.originalEstimateMinutes ??
                              (task.timeSpentMinutes ?? 0) +
                                (task.remainingEstimateMinutes ?? 0),
                            1,
                          )) *
                          100,
                      )}%`,
                    }}
                  />
                </span>
                <span>
                  <Clock size={14} />
                  {formatEstimateLabel(task.timeSpentMinutes)} logged
                </span>
                <small>
                  {formatEstimateLabel(task.remainingEstimateMinutes)} remaining
                </small>
              </button>
            </div>
          </section>
          <section className="task-details-panel">
            <h3>Labels</h3>
            <div className="label-cloud">
              {labels?.map((label) => (
                <button
                  className={
                    (task.labels ?? []).some((x) => x.id === label.id)
                      ? "label selected"
                      : "label"
                  }
                  key={label.id}
                  onClick={() => toggle.mutate(label)}
                >
                  <span style={{ background: label.color }} />
                  {label.name}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete task?"
        description={`Are you sure you want to delete "${task.title}"? This action cannot be undone.`}
        confirmText="Delete"
        loading={removeTask.isPending}
        onConfirm={() => removeTask.mutate()}
        onClose={() => setConfirmDeleteOpen(false)}
      />
      <TimeTrackingDialog
        open={timeTrackingOpen}
        projectId={projectId}
        task={task}
        onClose={() => setTimeTrackingOpen(false)}
        onSaved={(spent, remaining) =>
          onUpdated({
            ...task,
            timeSpentMinutes: (task.timeSpentMinutes ?? 0) + spent,
            remainingEstimateMinutes:
              remaining ?? task.remainingEstimateMinutes ?? null,
          })
        }
      />
    </Dialog>
  );
}
const findUserById = (members: Member[] | undefined, userId?: string | null) =>
  members?.find(
    (member) => member.userId === userId || member.user.id === userId,
  )?.user;
const findAssignee = (members: Member[] | undefined, task: Task) =>
  findUserById(members, task.assigneeId);
function MilestoneForm({
  projectId,
  initial,
  onClose,
}: {
  projectId: string;
  initial?: Milestone;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [startDate, setStartDate] = useState(
    initial?.startDate?.slice(0, 10) || "",
  );
  const [dueDate, setDueDate] = useState(initial?.dueDate?.slice(0, 10) || "");
  const hasDateRangeError =
    !!startDate && !!dueDate && new Date(startDate) > new Date(dueDate);
  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      };
      return initial
        ? api.updateMilestone(projectId, initial.id, body)
        : api.createMilestone(projectId, body);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.milestones(projectId) });
      toast.success(initial ? "Milestone updated" : "Milestone created");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (hasDateRangeError) return;
        if (name.trim().length >= 2) mutation.mutate();
      }}
    >
      <Field label="Name">
        <Input
          value={name}
          minLength={2}
          required
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field label="Description">
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <div className="date-field-grid">
        <Field
          label="Start date"
          error={
            hasDateRangeError
              ? "Start date cannot be later than due date."
              : undefined
          }
        >
          <DatePickerField
            ariaLabel="Milestone start date"
            value={startDate}
            invalid={hasDateRangeError}
            onChange={setStartDate}
          />
        </Field>
        <Field
          label="Due date"
          error={
            hasDateRangeError
              ? "Due date cannot be earlier than start date."
              : undefined
          }
        >
          <DatePickerField
            ariaLabel="Milestone due date"
            value={dueDate}
            invalid={hasDateRangeError}
            onChange={setDueDate}
          />
        </Field>
      </div>
      <div className="dialog-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={mutation.isPending} disabled={hasDateRangeError}>
          {initial ? "Save milestone" : "Create milestone"}
        </Button>
      </div>
    </form>
  );
}
function MilestonesTab({ projectId }: { projectId: string }) {
  const client = useQueryClient();
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<Milestone | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: keys.milestones(projectId),
    queryFn: () => api.milestones(projectId),
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: keys.milestones(projectId) });
  const remove = useMutation({
    mutationFn: (id: string) => api.removeMilestone(projectId, id),
    onSuccess: () => {
      setDeleteId(null);
      refresh();
      toast.success("Milestone deleted");
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleComplete = useMutation({
    mutationFn: (milestone: Milestone) =>
      milestone.completedAt
        ? api.reopenMilestone(projectId, milestone.id)
        : api.completeMilestone(projectId, milestone.id),
    onSuccess: (updated) => {
      refresh();
      toast.success(
        updated.completedAt ? "Milestone completed" : "Milestone reopened",
      );
    },
    onError: (e) => toast.error(e.message),
  });
  const milestones = [...(data ?? [])].sort((a, b) => {
    if (a.completedAt && !b.completedAt) return 1;
    if (!a.completedAt && b.completedAt) return -1;
    return (
      new Date(a.dueDate || a.createdAt).getTime() -
      new Date(b.dueDate || b.createdAt).getTime()
    );
  });
  return (
    <>
      <div className="milestones-toolbar">
        <div>
          <h2>Milestones</h2>
          <p>Plan larger project goals and track delivery windows.</p>
        </div>
        <Button onClick={() => setCreate(true)}>
          <Plus size={15} /> New milestone
        </Button>
      </div>
      {isLoading ? (
        <Skeleton rows={3} />
      ) : error ? (
        <Empty title="Could not load milestones" detail={error.message} />
      ) : !milestones.length ? (
        <Empty
          title="No milestones yet"
          detail="Create a milestone to group future task work."
          action={
            <Button onClick={() => setCreate(true)}>
              <Plus size={15} /> New milestone
            </Button>
          }
        />
      ) : (
        <div className="milestone-grid">
          {milestones.map((milestone) => {
            const completed = !!milestone.completedAt;
            return (
              <article
                className={
                  completed ? "milestone-card completed" : "milestone-card"
                }
                key={milestone.id}
              >
                <header>
                  <div>
                    <Badge tone={completed ? "done" : "in_progress"}>
                      {completed ? "Completed" : "Open"}
                    </Badge>
                    <h3>{milestone.name}</h3>
                  </div>
                  <div className="row-actions">
                    <Button
                      variant="ghost"
                      aria-label={`Edit ${milestone.name}`}
                      onClick={() => setEdit(milestone)}
                    >
                      <Edit3 size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`Delete ${milestone.name}`}
                      onClick={() => setDeleteId(milestone.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </header>
                <p>{milestone.description || "No description yet."}</p>
                <div className="milestone-dates">
                  <span>
                    Start{" "}
                    <strong>
                      {milestone.startDate
                        ? format(new Date(milestone.startDate), "MMM d, yyyy")
                        : "None"}
                    </strong>
                  </span>
                  <span>
                    Due{" "}
                    <strong>
                      {milestone.dueDate
                        ? format(new Date(milestone.dueDate), "MMM d, yyyy")
                        : "None"}
                    </strong>
                  </span>
                </div>
                <div className="milestone-progress">
                  <div>
                    <span style={{ width: "0%" }} />
                  </div>
                  <small>0 tasks linked yet</small>
                </div>
                <Button
                  variant={completed ? "secondary" : "primary"}
                  loading={toggleComplete.isPending}
                  onClick={() => toggleComplete.mutate(milestone)}
                >
                  {completed ? "Reopen milestone" : "Complete milestone"}
                </Button>
              </article>
            );
          })}
        </div>
      )}
      <Dialog
        open={create}
        title="New milestone"
        onClose={() => setCreate(false)}
      >
        <MilestoneForm projectId={projectId} onClose={() => setCreate(false)} />
      </Dialog>
      <Dialog
        open={!!edit}
        title="Edit milestone"
        onClose={() => setEdit(undefined)}
      >
        {edit && (
          <MilestoneForm
            projectId={projectId}
            initial={edit}
            onClose={() => setEdit(undefined)}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={!!deleteId}
        title="Delete milestone?"
        description={`Are you sure you want to delete "${
          milestones.find((item) => item.id === deleteId)?.name || "this milestone"
        }"? This action cannot be undone.`}
        confirmText="Delete milestone"
        loading={remove.isPending}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
      />
    </>
  );
}
export function ProjectPage() {
  const { workspaceId = "", projectId = "" } = useParams();
  const client = useQueryClient();
  const filtersRef = useRef<HTMLDivElement>(null);
  const restoredSavedFilterProjectRef = useRef<string | null>(null);
  const [create, setCreate] = useState(false);
  const [projectTab, setProjectTab] = useState<"tasks" | "milestones">(
    "tasks",
  );
  const [view, setView] = useState<"list" | "board">("board");
  const [filters, setFilters] = useState<TaskFilters>({});
  const [selected, setSelected] = useState<Task>();
  const [saveFilterOpen, setSaveFilterOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState("");
  const [activeSavedFilterId, setActiveSavedFilterId] = useState<string | null>(
    null,
  );
  const [editFilter, setEditFilter] = useState<SavedTaskFilter>();
  const [editFilterName, setEditFilterName] = useState("");
  const [editFilterUsesCurrent, setEditFilterUsesCurrent] = useState(false);
  const [deleteFilter, setDeleteFilter] = useState<SavedTaskFilter>();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const [openFilter, setOpenFilter] = useState<
    | "saved"
    | "statuses"
    | "priorities"
    | "types"
    | "assignees"
    | "milestones"
    | null
  >(null);
  const { data: workspace } = useQuery({
    queryKey: keys.workspace(workspaceId),
    queryFn: () => api.workspace(workspaceId),
  });
  const { data: projects } = useQuery({
    queryKey: keys.projects(workspaceId),
    queryFn: () => api.projects(workspaceId),
  });
  const { data: members } = useQuery({
    queryKey: keys.members(workspaceId),
    queryFn: () => api.members(workspaceId),
  });
  const { data: milestones } = useQuery({
    queryKey: keys.milestones(projectId),
    queryFn: () => api.milestones(projectId),
  });
  const { data: savedFilters } = useQuery({
    queryKey: keys.savedFilters(projectId),
    queryFn: () => api.savedFilters(projectId),
  });
  const project = projects?.data.find((x) => x.id === projectId);
  const selectedStatuses = filters.statuses ?? [];
  const selectedPriorities = filters.priorities ?? [];
  const selectedTypes = filters.types ?? [];
  const selectedAssigneeIds = filters.assigneeIds ?? [];
  const selectedMilestoneIds = filters.milestoneIds ?? [];
  const currentSavedFilters = cleanTaskFilters(filters);
  const hasActiveFilters = Object.keys(currentSavedFilters).length > 0;
  const activeSavedFilter = savedFilters?.find(
    (savedFilter) => savedFilter.id === activeSavedFilterId,
  );
  const activeSavedFilterModified =
    !!activeSavedFilter &&
    comparableFilters(filters) !==
      comparableFilters(normalizeSavedFilters(activeSavedFilter.filters));
  const invalidateSavedFilters = () =>
    client.invalidateQueries({ queryKey: keys.savedFilters(projectId) });
  useEffect(() => {
    if (!projectId || !savedFilters) return;
    if (restoredSavedFilterProjectRef.current === projectId) return;
    restoredSavedFilterProjectRef.current = projectId;
    const savedFilterId = localStorage.getItem(savedFilterStorageKey(projectId));
    if (!savedFilterId) {
      queueMicrotask(() => setActiveSavedFilterId(null));
      return;
    }
    const savedFilter = savedFilters.find((item) => item.id === savedFilterId);
    if (!savedFilter) {
      localStorage.removeItem(savedFilterStorageKey(projectId));
      queueMicrotask(() => setActiveSavedFilterId(null));
      return;
    }
    queueMicrotask(() => {
      setActiveSavedFilterId(savedFilter.id);
      setFilters(normalizeSavedFilters(savedFilter.filters));
    });
  }, [projectId, savedFilters]);
  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        filtersRef.current &&
        !filtersRef.current.contains(event.target as Node)
      ) {
        setOpenFilter(null);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick, true);
  }, []);
  const toggleStatusFilter = (status: TaskStatus) => {
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((value) => value !== status)
      : [...selectedStatuses, status];
    setFilters({ ...filters, statuses: next.length ? next : undefined });
  };
  const togglePriorityFilter = (priority: TaskPriority) => {
    const next = selectedPriorities.includes(priority)
      ? selectedPriorities.filter((value) => value !== priority)
      : [...selectedPriorities, priority];
    setFilters({ ...filters, priorities: next.length ? next : undefined });
  };
  const toggleTypeFilter = (type: TaskType) => {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((value) => value !== type)
      : [...selectedTypes, type];
    setFilters({ ...filters, types: next.length ? next : undefined });
  };
  const toggleAssigneeFilter = (userId: string) => {
    const next = selectedAssigneeIds.includes(userId)
      ? selectedAssigneeIds.filter((id) => id !== userId)
      : [...selectedAssigneeIds, userId];
    setFilters({
      ...filters,
      assigneeIds: next.length ? next : undefined,
      unassigned: next.length ? false : filters.unassigned,
    });
  };
  const toggleMilestoneFilter = (milestoneId: string) => {
    const next = selectedMilestoneIds.includes(milestoneId)
      ? selectedMilestoneIds.filter((id) => id !== milestoneId)
      : [...selectedMilestoneIds, milestoneId];
    setFilters({
      ...filters,
      milestoneIds: next.length ? next : undefined,
      withoutMilestone: next.length ? false : filters.withoutMilestone,
    });
  };
  const createSavedFilter = useMutation({
    mutationFn: () =>
      api.createSavedFilter(projectId, {
        name: saveFilterName.trim(),
        filters: taskFiltersRecord(currentSavedFilters),
      }),
    onSuccess: (savedFilter) => {
      invalidateSavedFilters();
      setActiveSavedFilterId(savedFilter.id);
      localStorage.setItem(savedFilterStorageKey(projectId), savedFilter.id);
      setSaveFilterOpen(false);
      setSaveFilterName("");
      toast.success("Filter saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateSavedFilter = useMutation({
    mutationFn: () => {
      if (!editFilter) throw new Error("No filter selected");
      return api.updateSavedFilter(projectId, editFilter.id, {
        name: editFilterName.trim(),
        ...(editFilterUsesCurrent
          ? { filters: taskFiltersRecord(currentSavedFilters) }
          : {}),
      });
    },
    onSuccess: (savedFilter) => {
      invalidateSavedFilters();
      if (activeSavedFilterId === savedFilter.id) {
        setActiveSavedFilterId(savedFilter.id);
        localStorage.setItem(savedFilterStorageKey(projectId), savedFilter.id);
      }
      setEditFilter(undefined);
      setEditFilterName("");
      setEditFilterUsesCurrent(false);
      toast.success("Saved filter updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const removeSavedFilter = useMutation({
    mutationFn: () => {
      if (!deleteFilter) throw new Error("No filter selected");
      return api.removeSavedFilter(projectId, deleteFilter.id);
    },
    onSuccess: () => {
      invalidateSavedFilters();
      if (deleteFilter?.id === activeSavedFilterId) {
        setActiveSavedFilterId(null);
        localStorage.removeItem(savedFilterStorageKey(projectId));
      }
      setDeleteFilter(undefined);
      toast.success("Saved filter deleted");
    },
    onError: (e) => toast.error(e.message),
  });
  const { data, isLoading, error } = useQuery({
    queryKey: keys.tasks(projectId, filters),
    queryFn: () => api.tasks(projectId, filters),
  });
  const updateStatus = useMutation({
    mutationFn: ({ task, status }: { task: Task; status: TaskStatus }) =>
      api.updateTask(projectId, task.id, { status }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["tasks", projectId] }),
    onError: (e) => toast.error(e.message),
  });
  const handleDrop = (event: DragEvent<HTMLElement>, status: TaskStatus) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    const task = data?.data.find((candidate) => candidate.id === taskId);
    setDraggedTaskId(null);
    setDropTarget(null);
    if (!task || task.status === status) return;
    updateStatus.mutate({ task, status });
  };
  const taskRow = (task: Task, draggable = false) => {
    const assignee = findAssignee(members, task);
    return (
    <article
      className={[
        "task-row",
        draggedTaskId === task.id ? "dragging" : "",
        task.flaggedAt ? "flagged" : "",
      ].filter(Boolean).join(" ")}
      key={task.id}
        draggable={draggable}
        onDragStart={(event) => {
          if (!draggable) return;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", task.id);
          setDraggedTaskId(task.id);
        }}
        onDragEnd={() => {
          setDraggedTaskId(null);
          setDropTarget(null);
        }}
        onClick={() => setSelected(task)}
    >
      <div>
        <span className="task-card-icon-row">
          <span
            className="task-card-icon"
            title={`Type: ${humanizeConstant(task.type)}`}
            aria-label={`Type: ${humanizeConstant(task.type)}`}
          >
            <TypeIcon type={task.type} />
          </span>
          {task.flaggedAt && (
            <span
              className="task-flag-icon"
              title="Flagged"
              aria-label="Flagged"
            >
              <Flag size={15} fill="currentColor" />
            </span>
          )}
        </span>
        <strong>{task.title}</strong>
      </div>
        <div className="task-row-meta">
          <span
            className="task-card-icon"
            title={`Priority: ${humanizeConstant(task.priority)}`}
            aria-label={`Priority: ${humanizeConstant(task.priority)}`}
          >
            <PriorityIcon priority={task.priority} />
          </span>
          {task.dueDate && (
            <small>{format(new Date(task.dueDate), "MMM d")}</small>
          )}
          {task.assigneeId ? (
            <span className="task-assignee" title={personName(assignee)}>
              <Avatar
                label={assignee ? initials(assignee) : "?"}
                src={api.avatarUrl(task.assigneeId)}
              />
            </span>
          ) : (
            <span className="task-assignee unassigned" title="Unassigned">
              -
            </span>
          )}
      </div>
    </article>
    );
  };
  return (
    <>
      <header className="page-header">
        <div>
          <p className="breadcrumbs">
            <Link to="/">Workspaces</Link> /{" "}
            <Link to={`/workspaces/${workspaceId}`}>
              {workspace?.name || "Workspace"}
            </Link>{" "}
            / {project?.name || "Project"}
          </p>
          <h1>{project?.name || "Project tasks"}</h1>
          <p>
            {project?.description || "Track tasks and keep momentum visible."}
          </p>
        </div>
        {projectTab === "tasks" && (
          <Button onClick={() => setCreate(true)}>
            <Plus size={16} /> New task
          </Button>
        )}
      </header>
      <nav className="tabs project-tabs">
        <button
          className={projectTab === "tasks" ? "active" : ""}
          onClick={() => setProjectTab("tasks")}
        >
          <CheckSquare2 size={15} /> Tasks
        </button>
        <button
          className={projectTab === "milestones" ? "active" : ""}
          onClick={() => setProjectTab("milestones")}
        >
          <CalendarDays size={15} /> Milestones
        </button>
      </nav>
      {projectTab === "milestones" ? (
        <MilestonesTab projectId={projectId} />
      ) : (
        <>
      <div className="toolbar task-filters" ref={filtersRef}>
        <div className="search task-search">
          <Search size={15} />
          <Input
            placeholder="Search tasks"
            value={filters.search || ""}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <div className="task-filter-popover saved-filter-popover">
          <button
            className="task-filter-button"
            type="button"
            onClick={() => setOpenFilter(openFilter === "saved" ? null : "saved")}
          >
            Saved filters
            <ChevronDown size={14} />
          </button>
          {openFilter === "saved" && (
            <div className="task-filter-menu saved-filter-menu">
              {!savedFilters?.length ? (
                <p>No saved filters yet</p>
              ) : (
                savedFilters.map((savedFilter) => (
                  <div className="saved-filter-row" key={savedFilter.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setFilters(normalizeSavedFilters(savedFilter.filters));
                        setActiveSavedFilterId(savedFilter.id);
                        localStorage.setItem(
                          savedFilterStorageKey(projectId),
                          savedFilter.id,
                        );
                        setOpenFilter(null);
                      }}
                    >
                      {savedFilter.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`Edit ${savedFilter.name}`}
                      onClick={() => {
                        setEditFilter(savedFilter);
                        setEditFilterName(savedFilter.name);
                        setEditFilterUsesCurrent(false);
                        setOpenFilter(null);
                      }}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${savedFilter.name}`}
                      onClick={() => {
                        setDeleteFilter(savedFilter);
                        setOpenFilter(null);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
              <div className="saved-filter-footer">
                <Button
                  variant="secondary"
                  disabled={!hasActiveFilters}
                  onClick={() => {
                    setSaveFilterName("");
                    setSaveFilterOpen(true);
                    setOpenFilter(null);
                  }}
                >
                  <Plus size={15} /> Save current filter
                </Button>
              </div>
            </div>
          )}
        </div>
        {activeSavedFilter && (
          <div
            className={
              activeSavedFilterModified
                ? "active-saved-filter modified"
                : "active-saved-filter"
            }
          >
            <span>
              View: <strong>{activeSavedFilter.name}</strong>
              {activeSavedFilterModified ? " (modified)" : ""}
            </span>
            <button
              type="button"
              aria-label="Clear active saved filter"
              onClick={() => {
                setActiveSavedFilterId(null);
                setFilters({});
                localStorage.removeItem(savedFilterStorageKey(projectId));
              }}
            >
              <X size={13} />
            </button>
          </div>
        )}
        <div className="task-filter-popover">
          <button
            className={
              selectedStatuses.length
                ? "task-filter-button active"
                : "task-filter-button"
            }
            type="button"
            onClick={() =>
              setOpenFilter(openFilter === "statuses" ? null : "statuses")
            }
          >
            {selectedStatuses.length
              ? `${selectedStatuses.length} status${selectedStatuses.length > 1 ? "es" : ""}`
              : "Statuses"}
            <ChevronDown size={14} />
          </button>
          {openFilter === "statuses" && (
            <div className="task-filter-menu compact">
              {statuses.map((status) => (
                <label className="task-filter-option" key={status}>
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(status)}
                    onChange={() => toggleStatusFilter(status)}
                  />
                  <span>{statusLabel(status)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="task-filter-popover">
          <button
            className={
              selectedPriorities.length
                ? "task-filter-button active"
                : "task-filter-button"
            }
            type="button"
            onClick={() =>
              setOpenFilter(openFilter === "priorities" ? null : "priorities")
            }
          >
            {selectedPriorities.length
              ? `${selectedPriorities.length} priorit${selectedPriorities.length > 1 ? "ies" : "y"}`
              : "Priorities"}
            <ChevronDown size={14} />
          </button>
          {openFilter === "priorities" && (
            <div className="task-filter-menu compact">
              {priorities.map((priority) => (
                <label className="task-filter-option" key={priority}>
                  <input
                    type="checkbox"
                    checked={selectedPriorities.includes(priority)}
                    onChange={() => togglePriorityFilter(priority)}
                  />
                  <PriorityIcon priority={priority} />
                  <span>{humanizeConstant(priority)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="task-filter-popover">
          <button
            className={
              selectedTypes.length
                ? "task-filter-button active"
                : "task-filter-button"
            }
            type="button"
            onClick={() =>
              setOpenFilter(openFilter === "types" ? null : "types")
            }
          >
            {selectedTypes.length
              ? `${selectedTypes.length} type${selectedTypes.length > 1 ? "s" : ""}`
              : "Types"}
            <ChevronDown size={14} />
          </button>
          {openFilter === "types" && (
            <div className="task-filter-menu compact">
              {types.map((type) => (
                <label className="task-filter-option" key={type}>
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(type)}
                    onChange={() => toggleTypeFilter(type)}
                  />
                  <TypeIcon type={type} />
                  <span>{humanizeConstant(type)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="task-filter-popover assignee-filter">
          <button
            className={
              selectedAssigneeIds.length || filters.unassigned
                ? "task-filter-button active"
                : "task-filter-button"
            }
            type="button"
            onClick={() =>
              setOpenFilter(openFilter === "assignees" ? null : "assignees")
            }
          >
            <Users size={15} />
            {filters.unassigned
              ? "Unassigned"
              : selectedAssigneeIds.length
              ? `${selectedAssigneeIds.length} assignee${selectedAssigneeIds.length > 1 ? "s" : ""}`
              : "Assignees"}
            <ChevronDown size={14} />
          </button>
          {openFilter === "assignees" && (
            <div className="task-filter-menu assignee-filter-menu">
              <label className="task-filter-option assignee-filter-option">
                <input
                  type="checkbox"
                  checked={!!filters.unassigned}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      assigneeIds: event.target.checked
                        ? undefined
                        : filters.assigneeIds,
                      unassigned: event.target.checked,
                    })
                  }
                />
                <span className="assignee-filter-empty-avatar">-</span>
                <span>
                  <strong>Unassigned</strong>
                </span>
              </label>
              {!members?.length ? (
                <p>No members yet</p>
              ) : (
                members.map((member) => {
                  const checked = selectedAssigneeIds.includes(member.user.id);
                  return (
                    <label
                      className="task-filter-option assignee-filter-option"
                      key={member.id}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAssigneeFilter(member.user.id)}
                      />
                      <Avatar
                        label={initials(member.user)}
                        src={api.avatarUrl(member.user.id)}
                      />
                      <span>
                        <strong>{personName(member.user)}</strong>
                        <small>{member.user.email}</small>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          )}
        </div>
        <div className="task-filter-popover milestone-filter">
          <button
            className={
              selectedMilestoneIds.length || filters.withoutMilestone
                ? "task-filter-button active"
                : "task-filter-button"
            }
            type="button"
            onClick={() =>
              setOpenFilter(openFilter === "milestones" ? null : "milestones")
            }
          >
            <CalendarDays size={15} />
            {filters.withoutMilestone
              ? "Without milestone"
              : selectedMilestoneIds.length
                ? `${selectedMilestoneIds.length} milestone${selectedMilestoneIds.length > 1 ? "s" : ""}`
                : "Milestones"}
            <ChevronDown size={14} />
          </button>
          {openFilter === "milestones" && (
            <div className="task-filter-menu milestone-filter-menu">
              <label className="task-filter-option">
                <input
                  type="checkbox"
                  checked={!!filters.withoutMilestone}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      milestoneIds: event.target.checked
                        ? undefined
                        : filters.milestoneIds,
                      withoutMilestone: event.target.checked,
                    })
                  }
                />
                <CalendarDays size={15} />
                <span>Without milestone</span>
              </label>
              {!milestones?.length ? (
                <p>No milestones yet</p>
              ) : (
                milestones.map((milestone) => (
                  <label className="task-filter-option" key={milestone.id}>
                    <input
                      type="checkbox"
                      checked={selectedMilestoneIds.includes(milestone.id)}
                      onChange={() => toggleMilestoneFilter(milestone.id)}
                    />
                    <CalendarDays size={15} />
                    <span>{milestone.name}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>
        <div className="view-switch">
          <Button
            variant={view === "board" ? "secondary" : "ghost"}
            onClick={() => setView("board")}
          >
            <CheckSquare2 size={15} />
          </Button>
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            onClick={() => setView("list")}
          >
            <List size={15} />
          </Button>
        </div>
      </div>
      {isLoading ? (
        <Skeleton />
      ) : error ? (
        <Empty title="Could not load tasks" detail={error.message} />
      ) : !data?.data.length ? (
        <Empty
          title="No matching tasks"
          detail="Create a task or adjust your filters."
        />
      ) : view === "board" ? (
        <div className="board">
          {statuses.map((status) => (
            <section
              className={
                dropTarget === status
                  ? "board-column drag-over"
                  : "board-column"
              }
              key={status}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTarget(status);
              }}
              onDragLeave={(event) => {
                if (
                  !event.currentTarget.contains(event.relatedTarget as Node)
                ) {
                  setDropTarget(null);
                }
              }}
              onDrop={(event) => handleDrop(event, status)}
            >
              <header>
                <strong>{statusLabel(status)}</strong>
                <Badge>
                  {data.data.filter((x) => x.status === status).length}
                </Badge>
              </header>
              {data.data
                .filter((x) => x.status === status)
                .map((task) => (
                  <div
                    className="task-card-wrap"
                    key={task.id}
                    aria-label={`Drag ${task.title} to another status`}
                  >
                    {taskRow(task, true)}
                  </div>
                ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="task-list">
          {data.data.map((task) => taskRow(task))}
        </div>
      )}
      <Dialog
        open={saveFilterOpen}
        title="Save current filter"
        onClose={() => setSaveFilterOpen(false)}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (saveFilterName.trim().length >= 2) createSavedFilter.mutate();
          }}
        >
          <Field label="Name">
            <Input
              value={saveFilterName}
              minLength={2}
              maxLength={80}
              autoFocus
              required
              onChange={(event) => setSaveFilterName(event.target.value)}
            />
          </Field>
          <div className="dialog-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSaveFilterOpen(false)}
            >
              Cancel
            </Button>
            <Button
              loading={createSavedFilter.isPending}
              disabled={!hasActiveFilters || saveFilterName.trim().length < 2}
            >
              Save filter
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={!!editFilter}
        title="Edit saved filter"
        onClose={() => setEditFilter(undefined)}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (editFilterName.trim().length >= 2) updateSavedFilter.mutate();
          }}
        >
          <Field label="Name">
            <Input
              value={editFilterName}
              minLength={2}
              maxLength={80}
              autoFocus
              required
              onChange={(event) => setEditFilterName(event.target.value)}
            />
          </Field>
          <label className="saved-filter-current-check">
            <input
              type="checkbox"
              checked={editFilterUsesCurrent}
              disabled={!hasActiveFilters}
              onChange={(event) =>
                setEditFilterUsesCurrent(event.target.checked)
              }
            />
            Replace saved filters with current board filters
          </label>
          <div className="dialog-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditFilter(undefined)}
            >
              Cancel
            </Button>
            <Button
              loading={updateSavedFilter.isPending}
              disabled={editFilterName.trim().length < 2}
            >
              Save changes
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        open={!!deleteFilter}
        title="Delete saved filter?"
        description={`Are you sure you want to delete "${
          deleteFilter?.name || "this filter"
        }"?`}
        confirmText="Delete filter"
        loading={removeSavedFilter.isPending}
        onClose={() => setDeleteFilter(undefined)}
        onConfirm={() => removeSavedFilter.mutate()}
      />
      <Dialog open={create} title="New task" onClose={() => setCreate(false)}>
        <TaskForm projectId={projectId} onClose={() => setCreate(false)} />
      </Dialog>
      {selected && (
        <TaskModal
          key={selected.id}
          workspaceId={workspaceId}
          projectId={projectId}
          task={selected}
          onUpdated={setSelected}
          onClose={() => setSelected(undefined)}
        />
      )}
        </>
      )}
    </>
  );
}
