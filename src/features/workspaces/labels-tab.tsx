import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, ConfirmDialog, Input, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { keys } from "../../lib/query-keys";
import type { Label } from "../../lib/types";
import { useInvalidate } from "./workspace-utils";

export function LabelsTab({ workspaceId }: { workspaceId: string }) {
  const invalidate = useInvalidate();
  const { data, isLoading } = useQuery({
    queryKey: keys.labels(workspaceId),
    queryFn: () => api.labels(workspaceId),
  });
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2563EB");
  const refresh = () => invalidate(keys.labels(workspaceId));
  const add = useMutation({
    mutationFn: () => api.createLabel(workspaceId, { name, color }),
    onSuccess: () => {
      setName("");
      void refresh();
      toast.success("Label created");
    },
  });
  const [deleteLabel, setDeleteLabel] = useState<Label>();
  const remove = useMutation({
    mutationFn: (id: string) => api.removeLabel(workspaceId, id),
    onSuccess: () => {
      void refresh();
      setDeleteLabel(undefined);
      toast.success("Label deleted");
    },
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
                aria-label={`Delete label ${label.name}`}
                onClick={() => setDeleteLabel(label)}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!deleteLabel}
        title="Delete label?"
        description={`"${deleteLabel?.name}" will be removed from all tasks and templates.`}
        loading={remove.isPending}
        onConfirm={() => deleteLabel && remove.mutate(deleteLabel.id)}
        onClose={() => setDeleteLabel(undefined)}
      />
    </>
  );
}
