import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Edit3,
  FileText,
  FolderKanban,
  MoreHorizontal,
  Tags,
  Users,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, ConfirmDialog, Dialog, Skeleton } from "../../components/ui";
import { useDismiss } from "../../hooks/use-dismiss";
import { api } from "../../lib/api";
import { keys } from "../../lib/query-keys";
import { useInvalidate } from "./workspace-utils";
import { ProjectsTab } from "./projects-tab";
import { MembersTab } from "./members-tab";
import { LabelsTab } from "./labels-tab";
import { TaskTemplatesTab } from "./task-templates-tab";
import { WorkspaceForm } from "./workspaces-page";

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
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: keys.workspace(workspaceId),
    queryFn: () => api.workspace(workspaceId),
  });
  const remove = useMutation({
    mutationFn: () => api.removeWorkspace(workspaceId),
    onSuccess: () => {
      void invalidate(keys.workspaces);
      toast.success("Workspace deleted");
      void navigate("/", { replace: true });
    },
  });
  useDismiss(actionsRef, () => setActionsOpen(false), actionsOpen);
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
