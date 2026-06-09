import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Edit3,
  FolderKanban,
  MoreHorizontal,
  Plus,
  Search,
  Tags,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Avatar,
  Button,
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
import type { Label, Member, Project, Role, Workspace } from "../../lib/types";

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
      <div className="toolbar">
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
export function WorkspacePage() {
  const { workspaceId = "" } = useParams();
  const [tab, setTab] = useState<"projects" | "members" | "labels">("projects");
  const [edit, setEdit] = useState(false);
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
          <Button
            variant="ghost"
            onClick={() =>
              confirm("Delete this workspace and everything inside it?") &&
              remove.mutate()
            }
          >
            <MoreHorizontal size={16} />
          </Button>
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
      </nav>
      {tab === "projects" ? (
        <ProjectsTab workspaceId={workspaceId} />
      ) : tab === "members" ? (
        <MembersTab workspaceId={workspaceId} />
      ) : (
        <LabelsTab workspaceId={workspaceId} />
      )}
      <Dialog open={edit} title="Edit workspace" onClose={() => setEdit(false)}>
        <WorkspaceForm initial={data} onClose={() => setEdit(false)} />
      </Dialog>
    </>
  );
}
