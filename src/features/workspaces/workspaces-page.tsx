import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  Empty,
  Field,
  Input,
  Skeleton,
  Textarea,
} from "../../components/ui";
import { api } from "../../lib/api";
import { keys } from "../../lib/query-keys";
import type { Workspace } from "../../lib/types";
import { useInvalidate } from "./workspace-utils";

export function WorkspaceForm({
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
      void invalidate(keys.workspaces);
      toast.success(initial ? "Workspace updated" : "Workspace created");
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
