import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarDays,
  CheckSquare2,
  ChevronDown,
  Download,
  Edit3,
  Flag,
  List,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  Empty,
  Field,
  Input,
  Skeleton,
} from "../../components/ui";
import { api } from "../../lib/api";
import { useClickOutside } from "../../hooks/use-click-outside";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { nextPageParam } from "../../hooks/use-load-more";
import {
  cleanTaskFilters,
  comparableFilters,
  filtersFromParams,
  hasFilterParams,
  normalizeSavedFilters,
  paramsWithFilters,
  priorities,
  savedFilterIdFromParams,
  savedFilterStorageKey,
  statuses,
  taskFiltersRecord,
  toggleValue,
  types,
} from "./task-filters";
import { keys } from "../../lib/query-keys";
import { initials, personName } from "../../lib/utils";
import type {
  SavedTaskFilter,
  Task,
  TaskFilters,
  TaskStatus,
} from "../../lib/types";
import { findAssignee, humanizeConstant, statusLabel } from "./task-utils";
import { PriorityIcon, TypeIcon } from "./task-fields";
import { MilestonesTab } from "./milestones";
import { TaskForm } from "./task-form";
import { TaskExportsDialog } from "./task-exports-dialog";
import { TaskModal } from "./task-modal/task-modal";

// The API rejects page sizes above 100.
const TASKS_PAGE_SIZE = 100;
export function ProjectPage() {
  const { projectId = "" } = useParams();
  // A new key per project resets all page state when switching projects.
  return <ProjectBoard key={projectId} />;
}
function ProjectBoard() {
  const { workspaceId = "", projectId = "" } = useParams();
  const client = useQueryClient();
  const filtersRef = useRef<HTMLDivElement>(null);
  const [create, setCreate] = useState(false);
  const [exportsOpen, setExportsOpen] = useState(false);
  const [projectTab, setProjectTab] = useState<"tasks" | "milestones">("tasks");
  const [view, setView] = useState<"list" | "board">("board");
  // Filters and the active saved filter live in the URL, so a filtered view
  // can be shared and survives a reload.
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = filtersFromParams(searchParams);
  const activeSavedFilterId = savedFilterIdFromParams(searchParams);
  const setFilters = (
    next: TaskFilters,
    savedFilterId: string | null = activeSavedFilterId,
  ) =>
    setSearchParams(
      (current) => paramsWithFilters(current, next, savedFilterId),
      { replace: true },
    );
  const applySavedFilter = (savedFilter: SavedTaskFilter | null) => {
    setFilters(
      savedFilter ? normalizeSavedFilters(savedFilter.filters) : {},
      savedFilter?.id ?? null,
    );
    if (savedFilter)
      localStorage.setItem(savedFilterStorageKey(projectId), savedFilter.id);
    else localStorage.removeItem(savedFilterStorageKey(projectId));
  };
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [saveFilterOpen, setSaveFilterOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState("");
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
  const { data: labels } = useQuery({
    queryKey: keys.labels(workspaceId),
    queryFn: () => api.labels(workspaceId),
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
  // Opening a project without filters in the URL restores the saved filter
  // that was last active there (remembered in localStorage). Runs once, after
  // the saved filters have loaded; it syncs the URL, not React state.
  const restoredSavedFilterRef = useRef(false);
  useEffect(() => {
    if (!savedFilters || restoredSavedFilterRef.current) return;
    restoredSavedFilterRef.current = true;
    if (hasFilterParams(searchParams)) return;
    const storedId = localStorage.getItem(savedFilterStorageKey(projectId));
    if (!storedId) return;
    const savedFilter = savedFilters.find((item) => item.id === storedId);
    if (!savedFilter) {
      localStorage.removeItem(savedFilterStorageKey(projectId));
      return;
    }
    setSearchParams(
      (current) =>
        paramsWithFilters(
          current,
          normalizeSavedFilters(savedFilter.filters),
          savedFilter.id,
        ),
      { replace: true },
    );
  }, [savedFilters, searchParams, setSearchParams, projectId]);
  useClickOutside(filtersRef, () => {
    setOpenFilter(null);
  });
  type ListFilterKey =
    | "statuses"
    | "priorities"
    | "types"
    | "assigneeIds"
    | "milestoneIds";
  const toggleFilterValue = (key: ListFilterKey, value: string) => {
    const next = toggleValue<string>(filters[key], value);
    setFilters({
      ...filters,
      [key]: next,
      // Picking assignees/milestones replaces the "without" option.
      ...(key === "assigneeIds" && next ? { unassigned: false } : {}),
      ...(key === "milestoneIds" && next ? { withoutMilestone: false } : {}),
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
      setFilters(filters, savedFilter.id);
      localStorage.setItem(savedFilterStorageKey(projectId), savedFilter.id);
      setSaveFilterOpen(false);
      setSaveFilterName("");
      toast.success("Filter saved");
    },
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
    onSuccess: () => {
      invalidateSavedFilters();
      setEditFilter(undefined);
      setEditFilterName("");
      setEditFilterUsesCurrent(false);
      toast.success("Saved filter updated");
    },
  });
  const removeSavedFilter = useMutation({
    mutationFn: () => {
      if (!deleteFilter) throw new Error("No filter selected");
      return api.removeSavedFilter(projectId, deleteFilter.id);
    },
    onSuccess: () => {
      invalidateSavedFilters();
      if (deleteFilter?.id === activeSavedFilterId) {
        setFilters(filters, null);
        localStorage.removeItem(savedFilterStorageKey(projectId));
      }
      setDeleteFilter(undefined);
      toast.success("Saved filter deleted");
    },
  });
  // Typing in the search box only refetches once the user pauses.
  const debouncedSearch = useDebouncedValue(filters.search ?? "");
  const queryFilters = cleanTaskFilters({
    ...filters,
    search: debouncedSearch,
  });
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: keys.tasks(projectId, queryFilters),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.tasks(projectId, queryFilters, {
        page: pageParam,
        limit: TASKS_PAGE_SIZE,
      }),
    getNextPageParam: nextPageParam,
  });
  const tasks = data?.pages.flatMap((page) => page.data) ?? [];
  const totalTasks = data?.pages.at(-1)?.meta.total ?? tasks.length;
  // The open task is read from the query cache, so invalidating keys.task
  // refreshes the modal. The list item is shown while the details load.
  const { data: selectedTask } = useQuery({
    queryKey: keys.task(projectId, selectedTaskId ?? ""),
    queryFn: () => api.task(projectId, selectedTaskId as string),
    enabled: !!selectedTaskId,
    placeholderData: () => tasks.find((task) => task.id === selectedTaskId),
  });
  const showUpdatedTask = (task: Task) => {
    client.setQueryData(keys.task(projectId, task.id), task);
    setSelectedTaskId(task.id);
  };
  const updateStatus = useMutation({
    mutationFn: ({ task, status }: { task: Task; status: TaskStatus }) =>
      api.updateTask(projectId, task.id, { status }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: keys.tasksAll(projectId) }),
  });
  const handleDrop = (event: DragEvent<HTMLElement>, status: TaskStatus) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    const task = tasks.find((candidate) => candidate.id === taskId);
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
        ]
          .filter(Boolean)
          .join(" ")}
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
        role="button"
        tabIndex={0}
        onClick={() => setSelectedTaskId(task.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedTaskId(task.id);
          }
        }}
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
          <div className="page-header-actions">
            <Button variant="secondary" onClick={() => setExportsOpen(true)}>
              <Download size={16} /> Export tasks
            </Button>
            <Button onClick={() => setCreate(true)}>
              <Plus size={16} /> New task
            </Button>
          </div>
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
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
              />
            </div>
            <div className="task-filter-popover saved-filter-popover">
              <button
                className="task-filter-button"
                type="button"
                onClick={() =>
                  setOpenFilter(openFilter === "saved" ? null : "saved")
                }
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
                            applySavedFilter(savedFilter);
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
                  onClick={() => applySavedFilter(null)}
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
                        onChange={() => toggleFilterValue("statuses", status)}
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
                  setOpenFilter(
                    openFilter === "priorities" ? null : "priorities",
                  )
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
                        onChange={() =>
                          toggleFilterValue("priorities", priority)
                        }
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
                        onChange={() => toggleFilterValue("types", type)}
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
                      const checked = selectedAssigneeIds.includes(
                        member.user.id,
                      );
                      return (
                        <label
                          className="task-filter-option assignee-filter-option"
                          key={member.id}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleFilterValue("assigneeIds", member.user.id)
                            }
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
                  setOpenFilter(
                    openFilter === "milestones" ? null : "milestones",
                  )
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
                          onChange={() =>
                            toggleFilterValue("milestoneIds", milestone.id)
                          }
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
          ) : !tasks.length ? (
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
                      {tasks.filter((x) => x.status === status).length}
                    </Badge>
                  </header>
                  {tasks
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
              {tasks.map((task) => taskRow(task))}
            </div>
          )}
          {hasNextPage && (
            <div className="tasks-load-more">
              <span>
                Showing {tasks.length} of {totalTasks} tasks
              </span>
              <Button
                type="button"
                variant="secondary"
                loading={isFetchingNextPage}
                onClick={() => fetchNextPage()}
              >
                Load more tasks
              </Button>
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
                if (saveFilterName.trim().length >= 2)
                  createSavedFilter.mutate();
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
                  disabled={
                    !hasActiveFilters || saveFilterName.trim().length < 2
                  }
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
                if (editFilterName.trim().length >= 2)
                  updateSavedFilter.mutate();
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
          <Dialog
            open={create}
            title="New task"
            onClose={() => setCreate(false)}
          >
            <TaskForm
              workspaceId={workspaceId}
              projectId={projectId}
              onClose={() => setCreate(false)}
            />
          </Dialog>
          {exportsOpen && (
            <TaskExportsDialog
              projectId={projectId}
              members={members}
              milestones={milestones}
              labels={labels}
              currentFilters={filters}
              open
              onClose={() => setExportsOpen(false)}
            />
          )}
          {selectedTask && (
            <TaskModal
              key={selectedTask.id}
              workspaceId={workspaceId}
              projectId={projectId}
              task={selectedTask}
              onUpdated={showUpdatedTask}
              onClose={() => setSelectedTaskId(undefined)}
            />
          )}
        </>
      )}
    </>
  );
}
