import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarDays,
  ChevronDown,
  Download,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Dialog,
  Empty,
  Input,
  Skeleton,
} from "../../components/ui";
import { api } from "../../lib/api";
import { useDismiss } from "../../hooks/use-dismiss";
import {
  cleanTaskExportFilters,
  exportFiltersFromTaskFilters,
  priorities,
  statuses,
  taskExportFilterCount,
  toggleValue,
  types,
} from "./task-filters";
import { keys } from "../../lib/query-keys";
import { initials, personName } from "../../lib/utils";
import type {
  Label,
  Member,
  Milestone,
  TaskExport,
  TaskExportFilters,
  TaskFilters,
} from "../../lib/types";
import { humanizeConstant, saveBlobFile, statusLabel } from "./task-utils";
import { PriorityIcon, TypeIcon } from "./task-fields";

export function TaskExportsDialog({
  projectId,
  members,
  milestones,
  labels,
  currentFilters,
  open,
  onClose,
}: {
  projectId: string;
  members?: Member[];
  milestones?: Milestone[];
  labels?: Label[];
  currentFilters: TaskFilters;
  open: boolean;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const exportFiltersRef = useRef<HTMLDivElement>(null);
  const currentBoardExportFilters = useMemo(
    () => exportFiltersFromTaskFilters(currentFilters),
    [currentFilters],
  );
  const [page, setPage] = useState(1);
  const [openExportFilter, setOpenExportFilter] = useState<
    | "statuses"
    | "priorities"
    | "types"
    | "assignees"
    | "milestones"
    | "labels"
    | null
  >(null);
  const [exportFilters, setExportFilters] = useState<TaskExportFilters>(
    currentBoardExportFilters,
  );
  const activeExportFilterCount = taskExportFilterCount(exportFilters);
  const currentBoardFilterCount = taskExportFilterCount(
    currentBoardExportFilters,
  );
  const { data, isLoading, error } = useQuery({
    queryKey: keys.taskExports(projectId, page),
    queryFn: () => api.taskExports(projectId, { page, limit: 10 }),
    enabled: open,
    refetchInterval: (query) => {
      if (!open) return false;
      const exports = query.state.data?.data ?? [];
      return exports.some(
        (item) => item.status === "PENDING" || item.status === "PROCESSING",
      )
        ? 3000
        : false;
    },
  });
  const invalidate = () =>
    client.invalidateQueries({ queryKey: keys.taskExportsAll(projectId) });
  useDismiss(
    exportFiltersRef,
    () => setOpenExportFilter(null),
    openExportFilter !== null,
  );
  const toggleExportArrayValue = (
    key:
      | "statuses"
      | "priorities"
      | "types"
      | "assigneeIds"
      | "labelIds"
      | "milestoneIds",
    value: string,
  ) => {
    const next = toggleValue<string>(exportFilters[key], value);
    setExportFilters({
      ...exportFilters,
      [key]: next,
      ...(key === "assigneeIds" && next ? { withoutAssignee: false } : {}),
      ...(key === "milestoneIds" && next ? { withoutMilestone: false } : {}),
    });
  };
  const createExport = useMutation({
    mutationFn: () =>
      api.createTaskExport(projectId, cleanTaskExportFilters(exportFilters)),
    onSuccess: () => {
      setPage(1);
      void invalidate();
      toast.success("Task export started");
    },
  });
  const removeExport = useMutation({
    mutationFn: (id: string) => api.removeTaskExport(projectId, id),
    onSuccess: () => {
      void invalidate();
      toast.success("Task export deleted");
    },
  });
  const cancelExport = useMutation({
    mutationFn: (id: string) => api.cancelTaskExport(projectId, id),
    onSuccess: () => {
      void invalidate();
      toast.success("Task export cancelled");
    },
  });
  const retryExport = useMutation({
    mutationFn: (id: string) => api.retryTaskExport(projectId, id),
    onSuccess: () => {
      void invalidate();
      toast.success("Task export restarted");
    },
  });
  const downloadExport = useMutation({
    mutationFn: async (taskExport: TaskExport) => {
      const { blob, fileName } = await api.downloadTaskExport(
        projectId,
        taskExport.id,
      );
      saveBlobFile(
        blob,
        fileName || taskExport.fileName || "taskflow-tasks.csv",
      );
    },
  });
  const exports = data?.data ?? [];
  const filterButtonLabel = (label: string, count: number) =>
    count ? `${label}: ${count}` : label;
  return (
    <Dialog open={open} title="Task exports" onClose={onClose} wide>
      <div className="task-exports-dialog">
        <div className="task-exports-intro">
          <p>
            Create a CSV export for this project. Use filters when you only need
            a specific slice of work.
          </p>
          <Button
            type="button"
            loading={createExport.isPending}
            onClick={() => createExport.mutate()}
          >
            <Download size={15} />
            {activeExportFilterCount
              ? `Create export (${activeExportFilterCount})`
              : "Create export"}
          </Button>
        </div>
        <section className="task-export-scope">
          <div className="task-export-scope-header">
            <div>
              <h3>Export scope</h3>
              <p>
                {activeExportFilterCount
                  ? `${activeExportFilterCount} filter${activeExportFilterCount > 1 ? "s" : ""} applied`
                  : "No filters selected. Export will include all non-archived tasks."}
              </p>
            </div>
            <div>
              <Button
                type="button"
                variant="secondary"
                disabled={!currentBoardFilterCount}
                onClick={() => setExportFilters(currentBoardExportFilters)}
              >
                Use current board filters
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!activeExportFilterCount}
                onClick={() => setExportFilters({})}
              >
                Clear
              </Button>
            </div>
          </div>
          <Input
            placeholder="Search exported tasks"
            value={exportFilters.search || ""}
            onChange={(event) =>
              setExportFilters({
                ...exportFilters,
                search: event.target.value || undefined,
              })
            }
          />
          <div className="task-export-filter-bar" ref={exportFiltersRef}>
            <div className="task-export-filter-popover">
              <button
                className={
                  (exportFilters.statuses?.length ?? 0) ? "active" : ""
                }
                type="button"
                onClick={() =>
                  setOpenExportFilter(
                    openExportFilter === "statuses" ? null : "statuses",
                  )
                }
              >
                {filterButtonLabel(
                  "Status",
                  exportFilters.statuses?.length ?? 0,
                )}
                <ChevronDown size={14} />
              </button>
              {openExportFilter === "statuses" && (
                <div className="task-export-filter-menu compact">
                  {statuses.map((status) => (
                    <label className="task-export-filter-option" key={status}>
                      <input
                        type="checkbox"
                        checked={(exportFilters.statuses ?? []).includes(
                          status,
                        )}
                        onChange={() =>
                          toggleExportArrayValue("statuses", status)
                        }
                      />
                      <span>{statusLabel(status)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="task-export-filter-popover">
              <button
                className={
                  (exportFilters.priorities?.length ?? 0) ? "active" : ""
                }
                type="button"
                onClick={() =>
                  setOpenExportFilter(
                    openExportFilter === "priorities" ? null : "priorities",
                  )
                }
              >
                {filterButtonLabel(
                  "Priority",
                  exportFilters.priorities?.length ?? 0,
                )}
                <ChevronDown size={14} />
              </button>
              {openExportFilter === "priorities" && (
                <div className="task-export-filter-menu compact">
                  {priorities.map((priority) => (
                    <label className="task-export-filter-option" key={priority}>
                      <input
                        type="checkbox"
                        checked={(exportFilters.priorities ?? []).includes(
                          priority,
                        )}
                        onChange={() =>
                          toggleExportArrayValue("priorities", priority)
                        }
                      />
                      <PriorityIcon priority={priority} />
                      <span>{humanizeConstant(priority)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="task-export-filter-popover">
              <button
                className={(exportFilters.types?.length ?? 0) ? "active" : ""}
                type="button"
                onClick={() =>
                  setOpenExportFilter(
                    openExportFilter === "types" ? null : "types",
                  )
                }
              >
                {filterButtonLabel("Type", exportFilters.types?.length ?? 0)}
                <ChevronDown size={14} />
              </button>
              {openExportFilter === "types" && (
                <div className="task-export-filter-menu compact">
                  {types.map((type) => (
                    <label className="task-export-filter-option" key={type}>
                      <input
                        type="checkbox"
                        checked={(exportFilters.types ?? []).includes(type)}
                        onChange={() => toggleExportArrayValue("types", type)}
                      />
                      <TypeIcon type={type} />
                      <span>{humanizeConstant(type)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="task-export-filter-popover">
              <button
                className={
                  (exportFilters.assigneeIds?.length ?? 0) ||
                  exportFilters.withoutAssignee
                    ? "active"
                    : ""
                }
                type="button"
                onClick={() =>
                  setOpenExportFilter(
                    openExportFilter === "assignees" ? null : "assignees",
                  )
                }
              >
                {filterButtonLabel(
                  "Assignee",
                  (exportFilters.assigneeIds?.length ?? 0) +
                    (exportFilters.withoutAssignee ? 1 : 0),
                )}
                <ChevronDown size={14} />
              </button>
              {openExportFilter === "assignees" && (
                <div className="task-export-filter-menu">
                  <label className="task-export-filter-option">
                    <input
                      type="checkbox"
                      checked={!!exportFilters.withoutAssignee}
                      onChange={(event) =>
                        setExportFilters({
                          ...exportFilters,
                          assigneeIds: event.target.checked
                            ? undefined
                            : exportFilters.assigneeIds,
                          withoutAssignee: event.target.checked || undefined,
                        })
                      }
                    />
                    <span>Unassigned</span>
                  </label>
                  {members?.map((member) => (
                    <label
                      className="task-export-filter-option"
                      key={member.id}
                    >
                      <input
                        type="checkbox"
                        checked={(exportFilters.assigneeIds ?? []).includes(
                          member.user.id,
                        )}
                        onChange={() =>
                          toggleExportArrayValue("assigneeIds", member.user.id)
                        }
                      />
                      <Avatar
                        label={initials(member.user)}
                        src={api.avatarUrl(member.user.id)}
                      />
                      <span>{personName(member.user)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="task-export-filter-popover">
              <button
                className={
                  (exportFilters.milestoneIds?.length ?? 0) ||
                  exportFilters.withoutMilestone
                    ? "active"
                    : ""
                }
                type="button"
                onClick={() =>
                  setOpenExportFilter(
                    openExportFilter === "milestones" ? null : "milestones",
                  )
                }
              >
                {filterButtonLabel(
                  "Milestone",
                  (exportFilters.milestoneIds?.length ?? 0) +
                    (exportFilters.withoutMilestone ? 1 : 0),
                )}
                <ChevronDown size={14} />
              </button>
              {openExportFilter === "milestones" && (
                <div className="task-export-filter-menu">
                  <label className="task-export-filter-option">
                    <input
                      type="checkbox"
                      checked={!!exportFilters.withoutMilestone}
                      onChange={(event) =>
                        setExportFilters({
                          ...exportFilters,
                          milestoneIds: event.target.checked
                            ? undefined
                            : exportFilters.milestoneIds,
                          withoutMilestone: event.target.checked || undefined,
                        })
                      }
                    />
                    <span>Without milestone</span>
                  </label>
                  {milestones?.map((milestone) => (
                    <label
                      className="task-export-filter-option"
                      key={milestone.id}
                    >
                      <input
                        type="checkbox"
                        checked={(exportFilters.milestoneIds ?? []).includes(
                          milestone.id,
                        )}
                        onChange={() =>
                          toggleExportArrayValue("milestoneIds", milestone.id)
                        }
                      />
                      <CalendarDays size={15} />
                      <span>{milestone.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="task-export-filter-popover">
              <button
                className={
                  (exportFilters.labelIds?.length ?? 0) ? "active" : ""
                }
                type="button"
                onClick={() =>
                  setOpenExportFilter(
                    openExportFilter === "labels" ? null : "labels",
                  )
                }
              >
                {filterButtonLabel(
                  "Labels",
                  exportFilters.labelIds?.length ?? 0,
                )}
                <ChevronDown size={14} />
              </button>
              {openExportFilter === "labels" && (
                <div className="task-export-filter-menu">
                  {labels?.length ? (
                    labels.map((label) => (
                      <label
                        className="task-export-filter-option"
                        key={label.id}
                      >
                        <input
                          type="checkbox"
                          checked={(exportFilters.labelIds ?? []).includes(
                            label.id,
                          )}
                          onChange={() =>
                            toggleExportArrayValue("labelIds", label.id)
                          }
                        />
                        <span
                          className="task-export-label-dot"
                          style={{ background: label.color }}
                        />
                        <span>{label.name}</span>
                      </label>
                    ))
                  ) : (
                    <p>No labels yet</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <label className="task-export-archive-toggle">
            <input
              type="checkbox"
              checked={!!exportFilters.includeArchived}
              onChange={(event) =>
                setExportFilters({
                  ...exportFilters,
                  includeArchived: event.target.checked || undefined,
                })
              }
            />
            Include archived tasks
          </label>
        </section>
        {isLoading ? (
          <Skeleton rows={3} />
        ) : error ? (
          <Empty title="Could not load exports" detail={error.message} />
        ) : exports.length ? (
          <div className="task-export-list">
            {exports.map((taskExport) => {
              const completed = taskExport.status === "COMPLETED";
              const failed = taskExport.status === "FAILED";
              const cancelled = taskExport.status === "CANCELLED";
              const cancellable =
                taskExport.status === "PENDING" ||
                taskExport.status === "PROCESSING";
              const retryable = failed || cancelled;
              const progress = Math.max(
                0,
                Math.min(100, taskExport.progress ?? (completed ? 100 : 0)),
              );
              return (
                <article className="task-export-row" key={taskExport.id}>
                  <div>
                    <strong>
                      {taskExport.fileName ||
                        `Task export ${taskExport.id.slice(0, 8)}`}
                    </strong>
                    <small>
                      Created{" "}
                      {format(new Date(taskExport.createdAt), "MMM d, HH:mm")}
                    </small>
                    {taskExport.completedAt && (
                      <small>
                        Completed{" "}
                        {format(
                          new Date(taskExport.completedAt),
                          "MMM d, HH:mm",
                        )}
                      </small>
                    )}
                    <div className="task-export-progress">
                      <span>
                        <span style={{ width: `${progress}%` }} />
                      </span>
                      <small>{progress}%</small>
                    </div>
                    {taskExport.error && <em>{taskExport.error}</em>}
                  </div>
                  <span
                    className={[
                      "task-export-status",
                      completed ? "completed" : "",
                      failed ? "failed" : "",
                      cancelled ? "cancelled" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {humanizeConstant(taskExport.status)}
                  </span>
                  <div className="task-export-actions">
                    {cancellable ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={cancelExport.isPending}
                        onClick={() => cancelExport.mutate(taskExport.id)}
                      >
                        <X size={14} />
                        Cancel
                      </Button>
                    ) : retryable ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={retryExport.isPending}
                        onClick={() => retryExport.mutate(taskExport.id)}
                      >
                        <RefreshCw size={14} />
                        Retry
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!completed || downloadExport.isPending}
                        onClick={() => downloadExport.mutate(taskExport)}
                      >
                        <Download size={14} />
                        Download
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label="Delete export"
                      disabled={removeExport.isPending}
                      onClick={() => removeExport.mutate(taskExport.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty
            title="No exports yet"
            detail="Create a CSV export when you need a local copy of all tasks."
          />
        )}
        {data && data.meta.totalPages > 1 && (
          <div className="task-export-pagination">
            <Button
              type="button"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </Button>
            <span>
              Page {data.meta.page} of {data.meta.totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={page >= data.meta.totalPages}
              onClick={() =>
                setPage((value) => Math.min(data.meta.totalPages, value + 1))
              }
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
