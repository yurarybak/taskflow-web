import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarDays,
  CheckSquare2,
  Download,
  Flag,
  List,
  Plus,
} from "lucide-react";
import { type DragEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  Empty,
  Skeleton,
} from "../../components/ui";
import { api } from "../../lib/api";

import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { nextPageParam } from "../../hooks/use-load-more";
import { cleanTaskFilters, statuses } from "./task-filters";
import { errorMessage } from "../../lib/query-client";
import { keys } from "../../lib/query-keys";
import { initials, personName } from "../../lib/utils";
import type { Page, Task, TaskStatus } from "../../lib/types";
import {
  findAssignee,
  humanizeConstant,
  patchTaskInPages,
  statusLabel,
} from "./task-utils";
import { PriorityIcon, TypeIcon } from "./task-fields";
import { MilestonesTab } from "./milestones";
import { TaskForm } from "./task-form";
import { TaskExportsDialog } from "./task-exports-dialog";
import { TaskModal } from "./task-modal/task-modal";
import { TaskFiltersBar } from "./task-filters-bar";
import { useTaskFilters } from "./use-task-filters";

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
  const [create, setCreate] = useState(false);
  const [exportsOpen, setExportsOpen] = useState(false);
  const [projectTab, setProjectTab] = useState<"tasks" | "milestones">("tasks");
  const [view, setView] = useState<"list" | "board">("board");
  const taskFilters = useTaskFilters(projectId);
  const { filters } = taskFilters;
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
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
  const project = projects?.data.find((x) => x.id === projectId);
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
  // Drag-and-drop moves the card at once (optimistic update) and rolls back
  // if the API rejects the change.
  const statusMutationKey = ["update-task-status", projectId];
  const updateStatus = useMutation({
    mutationKey: statusMutationKey,
    mutationFn: ({ task, status }: { task: Task; status: TaskStatus }) =>
      api.updateTask(projectId, task.id, { status }),
    onMutate: async ({ task, status }) => {
      const listKey = keys.tasksAll(projectId);
      await client.cancelQueries({ queryKey: listKey });
      const snapshots = client.getQueriesData<InfiniteData<Page<Task>>>({
        queryKey: listKey,
      });
      client.setQueriesData<InfiniteData<Page<Task>>>(
        { queryKey: listKey },
        (current) => patchTaskInPages(current, task.id, { status }),
      );
      return { snapshots };
    },
    onError: (error, _variables, context) => {
      context?.snapshots.forEach(([queryKey, data]) =>
        client.setQueryData(queryKey, data),
      );
      toast.error(errorMessage(error));
    },
    onSettled: (_data, _error, { task }) => {
      // With several drags in flight, refetch only after the last one so an
      // early response does not overwrite a later optimistic move.
      if (client.isMutating({ mutationKey: statusMutationKey }) > 1) return;
      void client.invalidateQueries({ queryKey: keys.tasksAll(projectId) });
      void client.invalidateQueries({
        queryKey: keys.task(projectId, task.id),
      });
    },
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
      <div
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
      </div>
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
          <TaskFiltersBar
            projectId={projectId}
            filterState={taskFilters}
            members={members}
            milestones={milestones}
          >
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
          </TaskFiltersBar>
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
                onClick={() => void fetchNextPage()}
              >
                Load more tasks
              </Button>
            </div>
          )}
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
