import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bell, Edit3, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Dialog,
  Field,
  Input,
  Skeleton,
} from "../../../components/ui";
import { api } from "../../../lib/api";
import { keys } from "../../../lib/query-keys";
import type { Task, TaskReminder } from "../../../lib/types";
import { formatDateInput, formatTimeInput } from "../task-utils";
import { CollapsibleTaskSection } from "../task-fields";

export function TaskReminders({ task }: { task: Task }) {
  const client = useQueryClient();
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<TaskReminder | null>(
    null,
  );
  const now = new Date();
  const defaultReminder = new Date(now.getTime() + 60 * 60 * 1000);
  const [reminderDate, setReminderDate] = useState(
    formatDateInput(defaultReminder),
  );
  const [reminderTime, setReminderTime] = useState(
    formatTimeInput(defaultReminder),
  );
  const { data, isLoading } = useQuery({
    queryKey: keys.reminders(task.id),
    queryFn: () => api.reminders(task.id),
  });
  const reminders = [...(data ?? [])].sort(
    (a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime(),
  );
  const pendingCount = reminders.filter((reminder) => !reminder.sentAt).length;
  const refresh = () =>
    client.invalidateQueries({ queryKey: keys.reminders(task.id) });
  const setReminderValue = (date: Date) => {
    setReminderDate(formatDateInput(date));
    setReminderTime(formatTimeInput(date));
  };
  const openCreateReminder = () => {
    setEditingReminder(null);
    setReminderValue(new Date(Date.now() + 60 * 60 * 1000));
    setReminderDialogOpen(true);
  };
  const openEditReminder = (reminder: TaskReminder) => {
    setEditingReminder(reminder);
    setReminderValue(new Date(reminder.remindAt));
    setReminderDialogOpen(true);
  };
  const closeReminderDialog = () => {
    setReminderDialogOpen(false);
    setEditingReminder(null);
  };
  const saveReminder = useMutation({
    mutationFn: () => {
      if (!reminderDate || !reminderTime) {
        throw new Error("Reminder date and time are required");
      }
      const remindAt = new Date(
        `${reminderDate}T${reminderTime}:00`,
      ).toISOString();
      return editingReminder
        ? api.updateReminder(task.id, editingReminder.id, remindAt)
        : api.createReminder(task.id, remindAt);
    },
    onSuccess: () => {
      void refresh();
      closeReminderDialog();
      toast.success(editingReminder ? "Reminder updated" : "Reminder created");
    },
  });
  const removeReminder = useMutation({
    mutationFn: (id: string) => api.removeReminder(task.id, id),
    onSuccess: () => {
      void refresh();
      toast.success("Reminder deleted");
    },
  });
  const tomorrowNine = () => {
    const value = new Date();
    value.setDate(value.getDate() + 1);
    value.setHours(9, 0, 0, 0);
    setReminderValue(value);
  };
  const inOneHour = () =>
    setReminderValue(new Date(Date.now() + 60 * 60 * 1000));
  const onDueDate = () => {
    if (!task.dueDate) return;
    const value = new Date(task.dueDate);
    if (value.getHours() === 0 && value.getMinutes() === 0) {
      value.setHours(9, 0, 0, 0);
    }
    setReminderValue(value);
  };
  return (
    <CollapsibleTaskSection
      title="Reminders"
      className="reminders-panel"
      actions={!!pendingCount && <Badge>{pendingCount} pending</Badge>}
    >
      <button
        type="button"
        className="add-reminder-button"
        onClick={openCreateReminder}
      >
        <Plus size={15} />
        Add reminder
      </button>
      {isLoading ? (
        <Skeleton rows={2} />
      ) : reminders.length ? (
        <div className="reminders-list">
          {reminders.map((reminder: TaskReminder) => {
            const pending = !reminder.sentAt;
            return (
              <article className="reminder-row" key={reminder.id}>
                <Bell size={15} />
                <div>
                  <strong>
                    {format(new Date(reminder.remindAt), "MMM d, HH:mm")}
                  </strong>
                  <span
                    className={`reminder-status ${
                      pending ? "pending" : "sent"
                    }`}
                  >
                    {pending ? "Pending" : "Sent"}
                  </span>
                </div>
                {pending && (
                  <div className="reminder-actions">
                    <button
                      type="button"
                      aria-label="Edit reminder"
                      disabled={saveReminder.isPending}
                      onClick={() => openEditReminder(reminder)}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete reminder"
                      disabled={removeReminder.isPending}
                      onClick={() => removeReminder.mutate(reminder.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="reminders-empty">No reminders yet.</p>
      )}
      <Dialog
        open={reminderDialogOpen}
        title={editingReminder ? "Update reminder" : "Remind me"}
        onClose={closeReminderDialog}
      >
        <form
          className="reminder-form"
          onSubmit={(event) => {
            event.preventDefault();
            saveReminder.mutate();
          }}
        >
          <div className="date-time-grid">
            <Field label="Date">
              <Input
                type="date"
                value={reminderDate}
                required
                onChange={(event) => setReminderDate(event.target.value)}
              />
            </Field>
            <Field label="Time">
              <Input
                type="time"
                value={reminderTime}
                required
                onChange={(event) => setReminderTime(event.target.value)}
              />
            </Field>
          </div>
          <div className="reminder-quick-options">
            <span>Quick options</span>
            <div>
              <button type="button" onClick={tomorrowNine}>
                Tomorrow 9:00
              </button>
              <button type="button" onClick={inOneHour}>
                In 1 hour
              </button>
              <button
                type="button"
                disabled={!task.dueDate}
                onClick={onDueDate}
              >
                On due date
              </button>
            </div>
          </div>
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={closeReminderDialog}
            >
              Cancel
            </Button>
            <Button loading={saveReminder.isPending}>
              {editingReminder ? "Save reminder" : "Create reminder"}
            </Button>
          </div>
        </form>
      </Dialog>
    </CollapsibleTaskSection>
  );
}
