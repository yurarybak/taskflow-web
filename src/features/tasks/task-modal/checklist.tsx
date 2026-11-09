import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckSquare2,
  Edit3,
  GripVertical,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { type DragEvent, useState } from "react";
import { Button, Input, Skeleton } from "../../../components/ui";
import { api } from "../../../lib/api";
import { keys } from "../../../lib/query-keys";
import type { ChecklistItem } from "../../../lib/types";

export function Checklist({ taskId }: { taskId: string }) {
  const client = useQueryClient();
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<{
    id: string;
    placement: "before" | "after";
  } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: keys.checklist(taskId),
    queryFn: () => api.checklistItems(taskId),
  });
  const items = [...(data ?? [])].sort((a, b) => a.position - b.position);
  const completed = items.filter((item) => item.isCompleted).length;
  const total = items.length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const refresh = () =>
    client.invalidateQueries({ queryKey: keys.checklist(taskId) });
  const add = useMutation({
    mutationFn: () =>
      api.createChecklistItem(taskId, {
        title: title.trim(),
        position: total,
      }),
    onSuccess: () => {
      setTitle("");
      refresh();
    },
  });
  const update = useMutation({
    mutationFn: () =>
      api.updateChecklistItem(taskId, editingId || "", {
        title: editingTitle.trim(),
      }),
    onSuccess: () => {
      setEditingId(null);
      setEditingTitle("");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.removeChecklistItem(taskId, id),
    onSuccess: refresh,
  });
  const toggle = useMutation({
    mutationFn: (item: ChecklistItem) =>
      api.toggleChecklistItem(taskId, item.id, !item.isCompleted),
    onSuccess: refresh,
  });
  const reorder = useMutation({
    mutationFn: async ({
      sourceId,
      targetId,
      placement,
    }: {
      sourceId: string;
      targetId: string;
      placement: "before" | "after";
    }) => {
      if (sourceId === targetId) return;
      const sourceIndex = items.findIndex((item) => item.id === sourceId);
      const targetIndex = items.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return;
      const next = [...items];
      const [moved] = next.splice(sourceIndex, 1);
      const targetIndexAfterRemoval = next.findIndex(
        (item) => item.id === targetId,
      );
      const insertIndex =
        placement === "after"
          ? targetIndexAfterRemoval + 1
          : targetIndexAfterRemoval;
      next.splice(insertIndex, 0, moved);
      await Promise.all(
        next.map((item, position) =>
          item.position === position
            ? Promise.resolve(item)
            : api.updateChecklistItem(taskId, item.id, { position }),
        ),
      );
    },
    onSuccess: refresh,
  });
  const previewDrop = (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault();
    if (draggedItemId === targetId) {
      setDropPreview(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const placement =
      event.clientY > rect.top + rect.height / 2 ? "after" : "before";
    setDropPreview({ id: targetId, placement });
  };
  return (
    <section className="checklist-section">
      <div className="checklist-heading">
        <h3>
          <CheckSquare2 size={15} /> Checklist
        </h3>
        <span>
          {completed}/{total} completed
        </span>
      </div>
      <div className="checklist-progress" aria-label={`${progress}% completed`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <form
        className="checklist-add-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim().length >= 2) add.mutate();
        }}
      >
        <Input
          placeholder="Add checklist item..."
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Button
          type="submit"
          variant="secondary"
          loading={add.isPending}
          disabled={title.trim().length < 2}
        >
          <Plus size={14} /> Add
        </Button>
      </form>
      {isLoading ? (
        <Skeleton rows={2} />
      ) : (
        <div className="checklist-list">
          {!items.length ? (
            <p className="checklist-empty">No checklist items yet.</p>
          ) : (
            items.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <article
                  className={[
                    "checklist-item",
                    item.isCompleted ? "completed" : "",
                    draggedItemId === item.id ? "dragging" : "",
                    dropPreview?.id === item.id
                      ? `drop-${dropPreview.placement}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={item.id}
                  onDragOver={(event) => previewDrop(event, item.id)}
                  onDragLeave={() => {
                    if (dropPreview?.id === item.id) setDropPreview(null);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceId =
                      event.dataTransfer.getData("text/plain") || draggedItemId;
                    const placement = dropPreview?.placement || "before";
                    setDraggedItemId(null);
                    setDropPreview(null);
                    if (sourceId)
                      reorder.mutate({
                        sourceId,
                        targetId: item.id,
                        placement,
                      });
                  }}
                >
                  <span
                    className="checklist-drag-handle"
                    draggable={!isEditing}
                    aria-label="Drag checklist item"
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", item.id);
                      setDraggedItemId(item.id);
                    }}
                    onDragEnd={() => {
                      setDraggedItemId(null);
                      setDropPreview(null);
                    }}
                  >
                    <GripVertical size={14} />
                  </span>
                  <input
                    type="checkbox"
                    checked={item.isCompleted}
                    disabled={toggle.isPending || reorder.isPending}
                    onChange={() => toggle.mutate(item)}
                  />
                  {isEditing ? (
                    <form
                      className="checklist-edit-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (editingTitle.trim().length >= 2) update.mutate();
                      }}
                    >
                      <Input
                        value={editingTitle}
                        maxLength={200}
                        autoFocus
                        onChange={(event) =>
                          setEditingTitle(event.target.value)
                        }
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        aria-label="Save checklist item"
                        loading={update.isPending}
                        disabled={editingTitle.trim().length < 2}
                      >
                        <Check size={15} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label="Cancel checklist item edit"
                        onClick={() => {
                          setEditingId(null);
                          setEditingTitle("");
                        }}
                      >
                        <X size={15} />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <span className="checklist-item-title">{item.title}</span>
                      <div className="checklist-item-actions">
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label="Edit checklist item"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditingTitle(item.title);
                          }}
                        >
                          <Edit3 size={13} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label="Delete checklist item"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(item.id)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
