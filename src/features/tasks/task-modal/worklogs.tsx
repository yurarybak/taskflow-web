import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Edit3, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  ConfirmDialog,
  Dialog,
  Empty,
  Field,
  Input,
  Skeleton,
  Textarea,
} from "../../../components/ui";
import { api } from "../../../lib/api";
import { nextPageParam, useLoadMore } from "../../../hooks/use-load-more";
import { keys } from "../../../lib/query-keys";
import { initials, personName } from "../../../lib/utils";
import type { Task, Worklog } from "../../../lib/types";
import { formatEstimateLabel, parseEstimate } from "../task-utils";

export function TimeTrackingDialog({
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
  onSaved: (
    timeSpentMinutes: number,
    remainingEstimateMinutes?: number,
  ) => void;
}) {
  const client = useQueryClient();
  const now = new Date();
  const [startedDate, setStartedDate] = useState(format(now, "yyyy-MM-dd"));
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
          ? (parsedRemaining.minutes ?? undefined)
          : undefined,
      });
    },
    onSuccess: () => {
      const spent = parsedTimeSpent.minutes ?? 0;
      const nextRemaining = remaining.trim()
        ? (parsedRemaining.minutes ?? undefined)
        : undefined;
      client.invalidateQueries({ queryKey: keys.worklogs(projectId, task.id) });
      client.invalidateQueries({ queryKey: keys.tasksAll(projectId) });
      client.invalidateQueries({ queryKey: keys.task(projectId, task.id) });
      onSaved(spent, nextRemaining);
      setTimeSpent("");
      setDescription("");
      onClose();
      toast.success("Work logged");
    },
  });
  const timeSpentError =
    timeSpent.trim() && parsedTimeSpent.error
      ? parsedTimeSpent.error
      : undefined;
  const remainingError =
    remaining.trim() && parsedRemaining.error
      ? parsedRemaining.error
      : undefined;
  return (
    <Dialog open={open} title="Time tracking" onClose={onClose}>
      <form
        className="time-tracking-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!parsedTimeSpent.minutes || timeSpentError || remainingError)
            return;
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
          error={
            !startedDate || !startedTime
              ? "Date started is required."
              : undefined
          }
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
    timeSpent.trim() && parsedTimeSpent.error
      ? parsedTimeSpent.error
      : undefined;
  const remainingError =
    remaining.trim() && parsedRemaining.error
      ? parsedRemaining.error
      : undefined;
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
          ? (parsedRemaining.minutes ?? undefined)
          : undefined,
      });
    },
    onSuccess: (updated) => {
      onSaved(
        updated,
        remaining.trim() ? (parsedRemaining.minutes ?? undefined) : undefined,
      );
      toast.success("Worklog updated");
    },
  });
  return (
    <Dialog open title="Edit worklog" onClose={onClose}>
      <form
        className="time-tracking-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!parsedTimeSpent.minutes || timeSpentError || remainingError)
            return;
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
          error={
            !startedDate || !startedTime
              ? "Date started is required."
              : undefined
          }
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
export function WorklogList({
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
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: keys.worklogs(projectId, task.id),
      initialPageParam: 1,
      queryFn: ({ pageParam }) =>
        api.worklogs(projectId, task.id, { page: pageParam, limit: 10 }),
      getNextPageParam: nextPageParam,
    });
  const refresh = () => {
    client.invalidateQueries({ queryKey: keys.worklogs(projectId, task.id) });
    client.invalidateQueries({ queryKey: keys.tasksAll(projectId) });
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
  });
  useLoadMore(loadMoreRef, {
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });
  const worklogs = [...(data?.pages.flatMap((page) => page.data) ?? [])].sort(
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
              src={
                worklog.authorId ? api.avatarUrl(worklog.authorId) : undefined
              }
            />
            <div>
              <header>
                <div>
                  <strong>
                    {worklog.author
                      ? personName(worklog.author)
                      : "Unknown user"}
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
        <div className="worklog-load-more" ref={loadMoreRef}>
          {isFetchingNextPage
            ? "Loading more worklogs..."
            : hasNextPage
              ? "Scroll to load more"
              : ""}
        </div>
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
