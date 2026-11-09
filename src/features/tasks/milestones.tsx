import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  Empty,
  Field,
  Input,
  Skeleton,
  Textarea,
} from "../../components/ui";
import { api } from "../../lib/api";
import { keys } from "../../lib/query-keys";
import type { Milestone } from "../../lib/types";
import { DatePickerField } from "./task-fields";

function MilestoneForm({
  projectId,
  initial,
  onClose,
}: {
  projectId: string;
  initial?: Milestone;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [startDate, setStartDate] = useState(
    initial?.startDate?.slice(0, 10) || "",
  );
  const [dueDate, setDueDate] = useState(initial?.dueDate?.slice(0, 10) || "");
  const hasDateRangeError =
    !!startDate && !!dueDate && new Date(startDate) > new Date(dueDate);
  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      };
      return initial
        ? api.updateMilestone(projectId, initial.id, body)
        : api.createMilestone(projectId, body);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.milestones(projectId) });
      toast.success(initial ? "Milestone updated" : "Milestone created");
      onClose();
    },
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (hasDateRangeError) return;
        if (name.trim().length >= 2) mutation.mutate();
      }}
    >
      <Field label="Name">
        <Input
          value={name}
          minLength={2}
          required
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field label="Description">
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <div className="date-field-grid">
        <Field
          label="Start date"
          error={
            hasDateRangeError
              ? "Start date cannot be later than due date."
              : undefined
          }
        >
          <DatePickerField
            ariaLabel="Milestone start date"
            value={startDate}
            invalid={hasDateRangeError}
            onChange={setStartDate}
          />
        </Field>
        <Field
          label="Due date"
          error={
            hasDateRangeError
              ? "Due date cannot be earlier than start date."
              : undefined
          }
        >
          <DatePickerField
            ariaLabel="Milestone due date"
            value={dueDate}
            invalid={hasDateRangeError}
            onChange={setDueDate}
          />
        </Field>
      </div>
      <div className="dialog-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={mutation.isPending} disabled={hasDateRangeError}>
          {initial ? "Save milestone" : "Create milestone"}
        </Button>
      </div>
    </form>
  );
}
export function MilestonesTab({ projectId }: { projectId: string }) {
  const client = useQueryClient();
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<Milestone | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: keys.milestones(projectId),
    queryFn: () => api.milestones(projectId),
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: keys.milestones(projectId) });
  const remove = useMutation({
    mutationFn: (id: string) => api.removeMilestone(projectId, id),
    onSuccess: () => {
      setDeleteId(null);
      refresh();
      toast.success("Milestone deleted");
    },
  });
  const toggleComplete = useMutation({
    mutationFn: (milestone: Milestone) =>
      milestone.completedAt
        ? api.reopenMilestone(projectId, milestone.id)
        : api.completeMilestone(projectId, milestone.id),
    onSuccess: (updated) => {
      refresh();
      toast.success(
        updated.completedAt ? "Milestone completed" : "Milestone reopened",
      );
    },
  });
  const milestones = [...(data ?? [])].sort((a, b) => {
    if (a.completedAt && !b.completedAt) return 1;
    if (!a.completedAt && b.completedAt) return -1;
    return (
      new Date(a.dueDate || a.createdAt).getTime() -
      new Date(b.dueDate || b.createdAt).getTime()
    );
  });
  return (
    <>
      <div className="milestones-toolbar">
        <div>
          <h2>Milestones</h2>
          <p>Plan larger project goals and track delivery windows.</p>
        </div>
        <Button onClick={() => setCreate(true)}>
          <Plus size={15} /> New milestone
        </Button>
      </div>
      {isLoading ? (
        <Skeleton rows={3} />
      ) : error ? (
        <Empty title="Could not load milestones" detail={error.message} />
      ) : !milestones.length ? (
        <Empty
          title="No milestones yet"
          detail="Create a milestone to group future task work."
          action={
            <Button onClick={() => setCreate(true)}>
              <Plus size={15} /> New milestone
            </Button>
          }
        />
      ) : (
        <div className="milestone-grid">
          {milestones.map((milestone) => {
            const completed = !!milestone.completedAt;
            return (
              <article
                className={
                  completed ? "milestone-card completed" : "milestone-card"
                }
                key={milestone.id}
              >
                <header>
                  <div>
                    <Badge tone={completed ? "done" : "in_progress"}>
                      {completed ? "Completed" : "Open"}
                    </Badge>
                    <h3>{milestone.name}</h3>
                  </div>
                  <div className="row-actions">
                    <Button
                      variant="ghost"
                      aria-label={`Edit ${milestone.name}`}
                      onClick={() => setEdit(milestone)}
                    >
                      <Edit3 size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`Delete ${milestone.name}`}
                      onClick={() => setDeleteId(milestone.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </header>
                <p>{milestone.description || "No description yet."}</p>
                <div className="milestone-dates">
                  <span>
                    Start{" "}
                    <strong>
                      {milestone.startDate
                        ? format(new Date(milestone.startDate), "MMM d, yyyy")
                        : "None"}
                    </strong>
                  </span>
                  <span>
                    Due{" "}
                    <strong>
                      {milestone.dueDate
                        ? format(new Date(milestone.dueDate), "MMM d, yyyy")
                        : "None"}
                    </strong>
                  </span>
                </div>
                <div className="milestone-progress">
                  <div>
                    <span style={{ width: "0%" }} />
                  </div>
                  <small>0 tasks linked yet</small>
                </div>
                <Button
                  variant={completed ? "secondary" : "primary"}
                  loading={toggleComplete.isPending}
                  onClick={() => toggleComplete.mutate(milestone)}
                >
                  {completed ? "Reopen milestone" : "Complete milestone"}
                </Button>
              </article>
            );
          })}
        </div>
      )}
      <Dialog
        open={create}
        title="New milestone"
        onClose={() => setCreate(false)}
      >
        <MilestoneForm projectId={projectId} onClose={() => setCreate(false)} />
      </Dialog>
      <Dialog
        open={!!edit}
        title="Edit milestone"
        onClose={() => setEdit(undefined)}
      >
        {edit && (
          <MilestoneForm
            projectId={projectId}
            initial={edit}
            onClose={() => setEdit(undefined)}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={!!deleteId}
        title="Delete milestone?"
        description={`Are you sure you want to delete "${
          milestones.find((item) => item.id === deleteId)?.name ||
          "this milestone"
        }"? This action cannot be undone.`}
        confirmText="Delete milestone"
        loading={remove.isPending}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
      />
    </>
  );
}
