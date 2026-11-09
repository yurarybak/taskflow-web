import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Flag, MoreHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Button,
  ConfirmDialog,
  Dialog,
  Input,
  Select,
} from "../../../components/ui";
import { RichTextEditor } from "../../../components/rich-text-editor";
import { api } from "../../../lib/api";
import { useClickOutside } from "../../../hooks/use-click-outside";
import { useDismiss } from "../../../hooks/use-dismiss";
import { useAuth } from "../../auth/auth-provider";
import { statuses } from "../task-filters";
import { keys } from "../../../lib/query-keys";
import { sanitizeRichText } from "../../../lib/sanitize";
import type { Label, Task, TaskStatus } from "../../../lib/types";
import {
  formatEstimate,
  formatEstimateLabel,
  isAbortError,
  parseEstimate,
  saveBlobFile,
  statusLabel,
  wait,
} from "../task-utils";
import { WatchersPopover } from "./watchers";
import { Checklist } from "./checklist";
import { Attachments } from "./attachments";
import { Comments } from "./comments";
import { History } from "./history";
import { TimeTrackingDialog, WorklogList } from "./worklogs";
import {
  CollapsibleTaskSection,
  DatePickerField,
  MilestoneDropdown,
  PriorityDropdown,
  TypeDropdown,
  UserDropdown,
} from "../task-fields";
import { TaskReminders } from "./reminders";

export function TaskModal({
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
  // Reset the estimate input when fresh task data arrives from the server.
  const [estimateSource, setEstimateSource] = useState(
    task.originalEstimateMinutes,
  );
  if (estimateSource !== task.originalEstimateMinutes) {
    setEstimateSource(task.originalEstimateMinutes);
    setOriginalEstimate(formatEstimate(task.originalEstimateMinutes));
  }
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
  const currentUser = useAuth().user ?? undefined;
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
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: keys.tasksAll(projectId) });
    void client.invalidateQueries({ queryKey: keys.task(projectId, task.id) });
  };
  const saveDescription = useMutation({
    mutationFn: () => api.updateTask(projectId, task.id, { description }),
    onSuccess: (updated) => {
      onUpdated(updated);
      setEditingDescription(false);
      invalidate();
      toast.success("Task updated");
    },
  });
  const saveTitle = useMutation({
    mutationFn: () => api.updateTask(projectId, task.id, { title }),
    onSuccess: (updated) => {
      onUpdated(updated);
      setEditingTitle(false);
      invalidate();
      toast.success("Task updated");
    },
  });
  const updateModalStatus = useMutation({
    mutationFn: (status: TaskStatus) =>
      api.updateTask(projectId, task.id, { status }),
    onSuccess: (updated) => {
      onUpdated(updated);
      invalidate();
      toast.success("Status updated");
    },
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
  });
  const updateAssignee = useMutation({
    mutationFn: (assigneeId: string | null) =>
      api.assign(projectId, task.id, assigneeId),
    onSuccess: (updated) => {
      onUpdated(updated);
      invalidate();
      toast.success("Assignee updated");
    },
  });
  const updateMilestone = useMutation({
    mutationFn: (milestoneId: string | null) =>
      api.setTaskMilestone(projectId, task.id, milestoneId),
    onSuccess: (updated) => {
      onUpdated(updated);
      invalidate();
      toast.success("Milestone updated");
    },
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
  });
  const cloneTask = useMutation({
    mutationFn: () => api.cloneTask(projectId, task.id),
    onSuccess: (cloned) => {
      onUpdated(cloned);
      invalidate();
      toast.success("Task cloned");
    },
  });
  const exportTaskCsv = useMutation({
    mutationFn: async () => {
      exportAbortRef.current?.abort();
      const controller = new AbortController();
      exportAbortRef.current = controller;
      const { signal } = controller;
      const created = await api.createTaskExport(projectId, {
        taskIds: [task.id],
      });
      let taskExport = created;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        signal.throwIfAborted();
        if (taskExport.status === "COMPLETED") {
          const { blob, fileName } = await api.downloadTaskExport(
            projectId,
            taskExport.id,
          );
          saveBlobFile(blob, fileName || taskExport.fileName || "task.csv");
          return;
        }
        if (
          taskExport.status === "FAILED" ||
          taskExport.status === "CANCELLED"
        ) {
          throw new Error(
            taskExport.error || "Task export could not be created",
          );
        }
        await wait(1000, signal);
        taskExport = await api.taskExport(projectId, taskExport.id);
      }
      throw new Error(
        "Task export is still running. Open Task exports to download it when ready.",
      );
    },
    onMutate: () => toast.info("Preparing task CSV..."),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: keys.taskExportsAll(projectId),
      });
      toast.success("Task CSV downloaded");
    },
    onError: (e) => {
      void client.invalidateQueries({
        queryKey: keys.taskExportsAll(projectId),
      });
      // Closing the modal aborts the polling; that is not an error to report.
      if (isAbortError(e)) return;
      toast.error(e.message);
    },
  });
  const exportAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => exportAbortRef.current?.abort(), []);
  const removeTask = useMutation({
    mutationFn: () => api.removeTask(projectId, task.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.tasksAll(projectId) });
      onClose();
      toast.success("Task deleted");
    },
  });
  // Drafts are copied from the latest task data when editing starts; outside
  // of editing the modal renders `task` directly.
  const startTitleEdit = () => {
    setTitle(task.title);
    setEditingTitle(true);
  };
  const startDescriptionEdit = () => {
    setDescription(task.description || "");
    setEditingDescription(true);
  };
  const cancelEdit = () => {
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
  // Clicking away discards the title draft (startTitleEdit makes a fresh one).
  useClickOutside(titleEditRef, () => setEditingTitle(false), editingTitle);
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
  useDismiss(actionsRef, () => setActionsOpen(false), actionsOpen);
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
                  onClick={() => {
                    setActionsOpen(false);
                    setTimeTrackingOpen(true);
                  }}
                >
                  Log work
                </button>
                <div className="task-action-divider" />
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
                <div className="task-action-divider" />
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
                  className="danger"
                  disabled={removeTask.isPending}
                  onClick={() => {
                    setActionsOpen(false);
                    setConfirmDeleteOpen(true);
                  }}
                >
                  Delete
                </button>
                <div className="task-action-divider" />
                <button
                  type="button"
                  disabled={exportTaskCsv.isPending}
                  onClick={() => {
                    setActionsOpen(false);
                    exportTaskCsv.mutate();
                  }}
                >
                  Export CSV
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
                aria-label="Task title"
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && title.trim()) {
                    event.preventDefault();
                    saveTitle.mutate();
                  } else if (event.key === "Escape") {
                    // Cancel the edit instead of closing the whole modal.
                    event.preventDefault();
                    cancelEdit();
                  }
                }}
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
            <button className="editable-title" onClick={startTitleEdit}>
              {task.title}
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
                    loading={saveDescription.isPending}
                    onClick={() => saveDescription.mutate()}
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
                onClick={startDescriptionEdit}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    startDescriptionEdit();
                  }
                }}
              >
                {task.description ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRichText(task.description),
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
                members={members}
              />
            )}
            {(activityTab === "all" || activityTab === "history") && (
              <History taskId={task.id} />
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
              <span
                className="modal-flag-icon"
                title="Flagged"
                aria-label="Flagged"
              >
                <Flag size={16} fill="currentColor" />
              </span>
            )}
          </div>
          <CollapsibleTaskSection title="Details">
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
                  className={
                    parsedOriginalEstimate.error ? "input-invalid" : ""
                  }
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
          </CollapsibleTaskSection>
          <TaskReminders task={task} />
          <CollapsibleTaskSection title="Labels">
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
          </CollapsibleTaskSection>
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
