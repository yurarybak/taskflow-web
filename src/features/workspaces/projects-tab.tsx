import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Edit3, FolderKanban, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Button,
  ConfirmDialog,
  Dialog,
  Empty,
  Field,
  Input,
  Skeleton,
  Textarea,
} from "../../components/ui";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { api } from "../../lib/api";
import { keys } from "../../lib/query-keys";
import type { Project } from "../../lib/types";
import { useInvalidate } from "./workspace-utils";

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
      void invalidate(keys.projectsAll(workspaceId));
      toast.success(initial ? "Project updated" : "Project created");
      onClose();
    },
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
export function ProjectsTab({ workspaceId }: { workspaceId: string }) {
  const invalidate = useInvalidate();
  const [search, setSearch] = useState("");
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<Project>();
  const [deleteProject, setDeleteProject] = useState<Project>();
  const debouncedSearch = useDebouncedValue(search.trim());
  const { data, isLoading } = useQuery({
    queryKey: keys.projects(workspaceId, debouncedSearch),
    queryFn: () => api.projects(workspaceId, debouncedSearch),
    placeholderData: keepPreviousData,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.removeProject(workspaceId, id),
    onSuccess: () => {
      void invalidate(keys.projectsAll(workspaceId));
      setDeleteProject(undefined);
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
                    <div className="row-actions project-row-actions">
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
                        onClick={() => setDeleteProject(project)}
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
      <ConfirmDialog
        open={!!deleteProject}
        title="Delete project?"
        description={`"${deleteProject?.name}" and all of its tasks will be permanently deleted.`}
        loading={remove.isPending}
        onConfirm={() => deleteProject && remove.mutate(deleteProject.id)}
        onClose={() => setDeleteProject(undefined)}
      />
    </>
  );
}
