import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  Edit3,
  FileText,
  FolderKanban,
  MoreHorizontal,
  Plus,
  Search,
  Tags,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  ConfirmDialog,
  Dialog,
  Empty,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
} from "../../components/ui";
import { api } from "../../lib/api";
import { keys } from "../../lib/query-keys";
import { initials, personName } from "../../lib/utils";
import type {
  Label,
  Member,
  Project,
  Role,
  SortOrder,
  TaskPriority,
  TaskTemplate,
  TaskTemplateFilters,
  TaskTemplateSortBy,
  TaskType,
  Workspace,
} from "../../lib/types";

const taskTemplateTypes: TaskType[] = ["TASK", "BUG", "FEATURE", "IMPROVEMENT"];
const taskTemplatePriorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];
const taskTemplateSortOptions: {
  value: TaskTemplateSortBy;
  label: string;
}[] = [
  { value: "createdAt", label: "Created" },
  { value: "name", label: "Name" },
  { value: "usageCount", label: "Usage" },
  { value: "lastUsedAt", label: "Last used" },
];
const sortOrderOptions: { value: SortOrder; label: string }[] = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
];
const humanizeConstant = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());

const useInvalidate = () => {
  const client = useQueryClient();
  return (...key: readonly unknown[]) =>
    client.invalidateQueries({ queryKey: key });
};
function WorkspaceForm({
  initial,
  onClose,
}: {
  initial?: Workspace;
  onClose: () => void;
}) {
  const invalidate = useInvalidate();
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const mutation = useMutation({
    mutationFn: () =>
      initial
        ? api.updateWorkspace(initial.id, { name, description })
        : api.createWorkspace({ name, description }),
    onSuccess: () => {
      invalidate(...keys.workspaces);
      toast.success(initial ? "Workspace updated" : "Workspace created");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <Field label="Workspace name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
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
      <div className="dialog-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={mutation.isPending}>Save workspace</Button>
      </div>
    </form>
  );
}
export function WorkspacesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: keys.workspaces,
    queryFn: api.workspaces,
  });
  const [create, setCreate] = useState(false);
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Workspaces</h1>
          <p>Organize projects and keep your team's work moving.</p>
        </div>
        <Button onClick={() => setCreate(true)}>
          <Plus size={16} /> New workspace
        </Button>
      </header>
      {isLoading ? (
        <Skeleton />
      ) : error ? (
        <Empty title="Could not load workspaces" detail={error.message} />
      ) : !data?.data.length ? (
        <Empty
          title="Create your first workspace"
          detail="Workspaces keep projects, people and labels organized."
          action={
            <Button onClick={() => setCreate(true)}>
              <Plus size={16} /> New workspace
            </Button>
          }
        />
      ) : (
        <div className="workspace-grid">
          {data.data.map((workspace) => (
            <Link
              className="workspace-card"
              to={`/workspaces/${workspace.id}`}
              key={workspace.id}
            >
              <div className="workspace-icon">{workspace.name[0]}</div>
              <div>
                <h3>{workspace.name}</h3>
                <p>{workspace.description || "No description yet"}</p>
                <small>
                  Updated{" "}
                  {formatDistanceToNow(new Date(workspace.updatedAt), {
                    addSuffix: true,
                  })}
                </small>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Dialog
        open={create}
        title="New workspace"
        onClose={() => setCreate(false)}
      >
        <WorkspaceForm onClose={() => setCreate(false)} />
      </Dialog>
    </>
  );
}
function ProjectForm({
  workspaceId,
  initial,
  onClose,
}: {
  workspaceId: string;
  initial?: Project;
  onClose: () => void;
}) {
  const invalidate = useInvalidate();
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const mutation = useMutation({
    mutationFn: () =>
      initial
        ? api.updateProject(workspaceId, initial.id, { name, description })
        : api.createProject(workspaceId, { name, description }),
    onSuccess: () => {
      invalidate("projects", workspaceId);
      toast.success(initial ? "Project updated" : "Project created");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <Field label="Project name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
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
      <div className="dialog-actions">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={mutation.isPending}>Save project</Button>
      </div>
    </form>
  );
}
function ProjectsTab({ workspaceId }: { workspaceId: string }) {
  const invalidate = useInvalidate();
  const [search, setSearch] = useState("");
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<Project>();
  const { data, isLoading } = useQuery({
    queryKey: keys.projects(workspaceId, search),
    queryFn: () => api.projects(workspaceId, search),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.removeProject(workspaceId, id),
    onSuccess: () => {
      invalidate("projects", workspaceId);
      toast.success("Project deleted");
    },
  });
  return (
    <>
      <div className="toolbar template-toolbar">
        <div className="search">
          <Search size={15} />
          <Input
            placeholder="Search projects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setCreate(true)}>
          <Plus size={15} /> New project
        </Button>
      </div>
      {isLoading ? (
        <Skeleton />
      ) : !data?.data.length ? (
        <Empty
          title="No projects yet"
          detail="Create a project to start planning tasks."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((project) => (
                <tr key={project.id}>
                  <td>
                    <Link
                      className="project-link"
                      to={`/workspaces/${workspaceId}/projects/${project.id}`}
                    >
                      <FolderKanban size={16} />
                      <span>
                        <strong>{project.name}</strong>
                        <small>{project.description || "No description"}</small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    {formatDistanceToNow(new Date(project.updatedAt), {
                      addSuffix: true,
                    })}
                  </td>
                  <td>
                    <div className="row-actions">
                      <Button
                        variant="ghost"
                        aria-label={`Edit ${project.name}`}
                        onClick={() => setEdit(project)}
                      >
                        <Edit3 size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Delete ${project.name}`}
                        onClick={() =>
                          confirm("Delete this project and its tasks?") &&
                          remove.mutate(project.id)
                        }
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog
        open={create}
        title="New project"
        onClose={() => setCreate(false)}
      >
        <ProjectForm
          workspaceId={workspaceId}
          onClose={() => setCreate(false)}
        />
      </Dialog>
      <Dialog
        open={!!edit}
        title="Edit project"
        onClose={() => setEdit(undefined)}
      >
        {edit && (
          <ProjectForm
            workspaceId={workspaceId}
            initial={edit}
            onClose={() => setEdit(undefined)}
          />
        )}
      </Dialog>
    </>
  );
}
function MembersTab({ workspaceId }: { workspaceId: string }) {
  const invalidate = useInvalidate();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const { data, isLoading } = useQuery({
    queryKey: keys.members(workspaceId),
    queryFn: () => api.members(workspaceId),
  });
  const refresh = () => invalidate(...keys.members(workspaceId));
  const add = useMutation({
    mutationFn: () => api.addMember(workspaceId, { email, role }),
    onSuccess: () => {
      setEmail("");
      refresh();
      toast.success("Member added");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.removeMember(workspaceId, id),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.updateMember(workspaceId, id, role),
    onSuccess: refresh,
  });
  return (
    <>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Input
          placeholder="Teammate email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option>MEMBER</option>
          <option>ADMIN</option>
        </Select>
        <Button loading={add.isPending}>
          <Plus size={15} /> Add member
        </Button>
      </form>
      {isLoading ? (
        <Skeleton />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data?.map((member: Member) => (
                <tr key={member.id}>
                  <td>
                    <div className="member-cell">
                      <Avatar
                        label={initials(member.user)}
                        src={api.avatarUrl(member.user.id)}
                      />
                      <span>
                        <strong>{personName(member.user)}</strong>
                        <small>{member.user.email}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <Select
                      aria-label={`Role for ${member.user.email}`}
                      value={member.role}
                      disabled={member.role === "OWNER"}
                      onChange={(e) =>
                        update.mutate({ id: member.id, role: e.target.value })
                      }
                    >
                      <option>OWNER</option>
                      <option>ADMIN</option>
                      <option>MEMBER</option>
                    </Select>
                  </td>
                  <td>
                    {member.role !== "OWNER" && (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          confirm("Remove this member?") &&
                          remove.mutate(member.id)
                        }
                      >
                        <Trash2 size={15} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
function LabelsTab({ workspaceId }: { workspaceId: string }) {
  const invalidate = useInvalidate();
  const { data, isLoading } = useQuery({
    queryKey: keys.labels(workspaceId),
    queryFn: () => api.labels(workspaceId),
  });
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2563EB");
  const refresh = () => invalidate(...keys.labels(workspaceId));
  const add = useMutation({
    mutationFn: () => api.createLabel(workspaceId, { name, color }),
    onSuccess: () => {
      setName("");
      refresh();
      toast.success("Label created");
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.removeLabel(workspaceId, id),
    onSuccess: refresh,
  });
  return (
    <>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Input
          placeholder="Label name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          className="color-picker"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <Button>
          <Plus size={15} /> Add label
        </Button>
      </form>
      {isLoading ? (
        <Skeleton />
      ) : (
        <div className="label-list">
          {data?.map((label: Label) => (
            <div className="label-row" key={label.id}>
              <span className="swatch" style={{ background: label.color }} />
              <strong>{label.name}</strong>
              <code>{label.color}</code>
              <Button
                variant="ghost"
                onClick={() =>
                  confirm("Delete this label?") && remove.mutate(label.id)
                }
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
function TaskTemplateForm({
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
  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        labelPickerRef.current &&
        !labelPickerRef.current.contains(event.target as Node)
      ) {
        setLabelsOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick, true);
  }, []);
  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        priority,
        labelIds,
      };
      return initial
        ? api.updateTaskTemplate(workspaceId, initial.id, body)
        : api.createTaskTemplate(workspaceId, body);
    },
    onSuccess: () => {
      invalidate("task-templates", workspaceId);
      toast.success(initial ? "Template updated" : "Template created");
      onClose();
    },
    onError: (e) => toast.error(e.message),
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
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
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
            <button type="button" onClick={() => setLabelsOpen((open) => !open)}>
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
function TaskTemplatesTab({ workspaceId }: { workspaceId: string }) {
  const invalidate = useInvalidate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<TaskTemplateSortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [openTemplateFilter, setOpenTemplateFilter] = useState<
    "sortBy" | "sortOrder" | null
  >(null);
  const templateFiltersRef = useRef<HTMLDivElement>(null);
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<TaskTemplate>();
  const [deleteTemplate, setDeleteTemplate] = useState<TaskTemplate>();
  const effectiveSearch =
    search.trim().length >= 2 ? search.trim() : undefined;
  const templateFilters: TaskTemplateFilters = {
    page,
    limit: 10,
    ...(effectiveSearch ? { search: effectiveSearch } : {}),
    sortBy,
    sortOrder,
  };
  const hasActiveTemplateFilters =
    !!search.trim() || sortBy !== "createdAt" || sortOrder !== "desc";
  const { data: labels } = useQuery({
    queryKey: keys.labels(workspaceId),
    queryFn: () => api.labels(workspaceId),
  });
  const { data, isLoading, error } = useQuery({
    queryKey: keys.taskTemplates(workspaceId, templateFilters),
    queryFn: () => api.taskTemplates(workspaceId, templateFilters),
  });
  const resetTemplateFilters = () => {
    setSearch("");
    setSortBy("createdAt");
    setSortOrder("desc");
    setPage(1);
    setOpenTemplateFilter(null);
  };
  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        templateFiltersRef.current &&
        !templateFiltersRef.current.contains(event.target as Node)
      ) {
        setOpenTemplateFilter(null);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick, true);
  }, []);
  const remove = useMutation({
    mutationFn: () => {
      if (!deleteTemplate) throw new Error("No template selected");
      return api.removeTaskTemplate(workspaceId, deleteTemplate.id);
    },
    onSuccess: () => {
      setDeleteTemplate(undefined);
      invalidate("task-templates", workspaceId);
      toast.success("Template deleted");
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <>
      <div className="toolbar template-toolbar">
        <div>
          <strong>Reusable task blueprints</strong>
          <p className="template-toolbar-copy">
            Create templates now, then use them later when creating tasks.
          </p>
        </div>
        <Button onClick={() => setCreate(true)}>
          <Plus size={15} /> New template
        </Button>
      </div>
      <div className="template-filters" ref={templateFiltersRef}>
        <label className="template-search">
          <Search size={15} />
          <Input
            value={search}
            placeholder="Search templates..."
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className="task-filter-popover template-filter-popover">
          <button
            className={
              sortBy !== "createdAt"
                ? "task-filter-button active"
                : "task-filter-button"
            }
            type="button"
            onClick={() =>
              setOpenTemplateFilter(
                openTemplateFilter === "sortBy" ? null : "sortBy",
              )
            }
          >
            Sort:{" "}
            {taskTemplateSortOptions.find((option) => option.value === sortBy)
              ?.label || "Created"}
            <ChevronDown size={14} />
          </button>
          {openTemplateFilter === "sortBy" && (
            <div className="task-filter-menu compact template-filter-menu">
              {taskTemplateSortOptions.map((option) => (
                <button
                  className={option.value === sortBy ? "active" : ""}
                  type="button"
                  key={option.value}
                  onClick={() => {
                    setSortBy(option.value);
                    setPage(1);
                    setOpenTemplateFilter(null);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="task-filter-popover template-filter-popover">
          <button
            className={
              sortOrder !== "desc"
                ? "task-filter-button active"
                : "task-filter-button"
            }
            type="button"
            onClick={() =>
              setOpenTemplateFilter(
                openTemplateFilter === "sortOrder" ? null : "sortOrder",
              )
            }
          >
            {
              sortOrderOptions.find((option) => option.value === sortOrder)
                ?.label
            }
            <ChevronDown size={14} />
          </button>
          {openTemplateFilter === "sortOrder" && (
            <div className="task-filter-menu compact template-filter-menu">
              {sortOrderOptions.map((option) => (
                <button
                  className={option.value === sortOrder ? "active" : ""}
                  type="button"
                  key={option.value}
                  onClick={() => {
                    setSortOrder(option.value);
                    setPage(1);
                    setOpenTemplateFilter(null);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {hasActiveTemplateFilters && (
          <Button type="button" variant="secondary" onClick={resetTemplateFilters}>
            Clear
          </Button>
        )}
      </div>
      {isLoading ? (
        <Skeleton />
      ) : error ? (
        <Empty title="Could not load templates" detail={error.message} />
      ) : !data?.data.length ? (
        <Empty
          title={
            hasActiveTemplateFilters
              ? "No templates found"
              : "No task templates yet"
          }
          detail={
            hasActiveTemplateFilters
              ? "Try another search or reset sorting."
              : "Create templates for common tasks like bug reports, stories or recurring work."
          }
          action={
            hasActiveTemplateFilters ? (
              <Button variant="secondary" onClick={resetTemplateFilters}>
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setCreate(true)}>
                <Plus size={15} /> New template
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Used</th>
                  <th>Last used</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((template) => (
                  <tr key={template.id}>
                    <td>
                      <div className="template-table-title">
                        <strong>{template.name}</strong>
                      </div>
                    </td>
                    <td>{template.usageCount ?? 0}</td>
                    <td>
                      {template.lastUsedAt
                        ? formatDistanceToNow(new Date(template.lastUsedAt), {
                            addSuffix: true,
                          })
                        : "Never"}
                    </td>
                    <td>
                      {formatDistanceToNow(new Date(template.updatedAt), {
                        addSuffix: true,
                      })}
                    </td>
                    <td>
                      <div className="row-actions">
                        <Button
                          variant="ghost"
                          aria-label={`Edit ${template.name}`}
                          onClick={() => setEdit(template)}
                        >
                          <Edit3 size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label={`Delete ${template.name}`}
                          onClick={() => setDeleteTemplate(template)}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.meta.totalPages > 1 && (
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
        </>
      )}
      <Dialog
        open={create}
        title="New task template"
        onClose={() => setCreate(false)}
      >
        <TaskTemplateForm
          workspaceId={workspaceId}
          labels={labels}
          onClose={() => setCreate(false)}
        />
      </Dialog>
      <Dialog
        open={!!edit}
        title="Edit task template"
        onClose={() => setEdit(undefined)}
      >
        {edit && (
          <TaskTemplateForm
            workspaceId={workspaceId}
            labels={labels}
            initial={edit}
            onClose={() => setEdit(undefined)}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={!!deleteTemplate}
        title="Delete task template?"
        description={`Are you sure you want to delete "${
          deleteTemplate?.name || "this template"
        }"? This action cannot be undone.`}
        confirmText="Delete template"
        loading={remove.isPending}
        onClose={() => setDeleteTemplate(undefined)}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
export function WorkspacePage() {
  const { workspaceId = "" } = useParams();
  const [tab, setTab] = useState<
    "projects" | "members" | "labels" | "templates"
  >("projects");
  const [edit, setEdit] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deleteWorkspaceOpen, setDeleteWorkspaceOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const invalidate = useInvalidate();
  const { data, isLoading } = useQuery({
    queryKey: keys.workspace(workspaceId),
    queryFn: () => api.workspace(workspaceId),
  });
  const remove = useMutation({
    mutationFn: () => api.removeWorkspace(workspaceId),
    onSuccess: () => {
      invalidate(...keys.workspaces);
      location.assign("/");
    },
  });
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
  if (isLoading || !data) return <Skeleton />;
  return (
    <>
      <header className="page-header workspace-heading">
        <div>
          <p className="breadcrumbs">
            <Link to="/">Workspaces</Link> / {data.name}
          </p>
          <h1>{data.name}</h1>
          <p>{data.description || "No description yet"}</p>
        </div>
        <div className="row-actions">
          <Button variant="secondary" onClick={() => setEdit(true)}>
            <Edit3 size={15} /> Edit
          </Button>
          <div className="workspace-actions-menu" ref={actionsRef}>
            <Button
              variant="ghost"
              aria-label="Workspace actions"
              onClick={() => setActionsOpen((open) => !open)}
            >
              <MoreHorizontal size={16} />
            </Button>
            {actionsOpen && (
              <div className="workspace-actions-popover">
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setActionsOpen(false);
                    setDeleteWorkspaceOpen(true);
                  }}
                >
                  Delete workspace
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <nav className="tabs">
        <button
          className={tab === "projects" ? "active" : ""}
          onClick={() => setTab("projects")}
        >
          <FolderKanban size={15} /> Projects
        </button>
        <button
          className={tab === "members" ? "active" : ""}
          onClick={() => setTab("members")}
        >
          <Users size={15} /> Members
        </button>
        <button
          className={tab === "labels" ? "active" : ""}
          onClick={() => setTab("labels")}
        >
          <Tags size={15} /> Labels
        </button>
        <button
          className={tab === "templates" ? "active" : ""}
          onClick={() => setTab("templates")}
        >
          <FileText size={15} /> Task templates
        </button>
      </nav>
      {tab === "projects" ? (
        <ProjectsTab workspaceId={workspaceId} />
      ) : tab === "members" ? (
        <MembersTab workspaceId={workspaceId} />
      ) : tab === "labels" ? (
        <LabelsTab workspaceId={workspaceId} />
      ) : (
        <TaskTemplatesTab workspaceId={workspaceId} />
      )}
      <Dialog open={edit} title="Edit workspace" onClose={() => setEdit(false)}>
        <WorkspaceForm initial={data} onClose={() => setEdit(false)} />
      </Dialog>
      <ConfirmDialog
        open={deleteWorkspaceOpen}
        title="Delete workspace?"
        description={`Are you sure you want to delete "${data.name}" and everything inside it? This action cannot be undone.`}
        confirmText="Delete workspace"
        loading={remove.isPending}
        onClose={() => setDeleteWorkspaceOpen(false)}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
