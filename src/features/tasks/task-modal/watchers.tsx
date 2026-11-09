import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar, Button } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useDismiss } from "../../../hooks/use-dismiss";
import { keys } from "../../../lib/query-keys";
import { initials, personName } from "../../../lib/utils";
import type { Member, TaskWatcher, User } from "../../../lib/types";

const watcherUserId = (watcher: TaskWatcher) =>
  watcher.user?.id || watcher.userId || watcher.id || "";
const watcherUser = (watcher: TaskWatcher): User => ({
  id: watcherUserId(watcher),
  email: watcher.user?.email || watcher.email || "",
  firstName: watcher.user?.firstName || watcher.firstName,
  lastName: watcher.user?.lastName || watcher.lastName,
});
export function WatchersPopover({
  taskId,
  currentUser,
  members,
}: {
  taskId: string;
  currentUser?: User;
  members?: Member[];
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useQuery({
    queryKey: keys.watchers(taskId),
    queryFn: () => api.watchers(taskId),
  });
  const watchers = data ?? [];
  const watcherIds = new Set(watchers.map(watcherUserId).filter(Boolean));
  const isWatching = !!currentUser?.id && watcherIds.has(currentUser.id);
  const availableMembers =
    members?.filter((member) => !watcherIds.has(member.user.id)) ?? [];
  const refresh = () =>
    client.invalidateQueries({ queryKey: keys.watchers(taskId) });
  const watchMe = useMutation({
    mutationFn: () => api.watchMe(taskId),
    onSuccess: refresh,
  });
  const unwatchMe = useMutation({
    mutationFn: () => api.unwatchMe(taskId),
    onSuccess: refresh,
  });
  const addWatcher = useMutation({
    mutationFn: (userId: string) => api.addWatcher(taskId, userId),
    onSuccess: () => {
      setAdding(false);
      void refresh();
    },
  });
  const removeWatcher = useMutation({
    mutationFn: (userId: string) => api.removeWatcher(taskId, userId),
    onSuccess: refresh,
  });
  useDismiss(
    ref,
    () => {
      setOpen(false);
      setAdding(false);
    },
    open,
  );
  return (
    <div className="watchers-menu" ref={ref}>
      <Button
        className="watchers-trigger"
        variant="ghost"
        aria-label="Task watchers"
        onClick={() => setOpen((current) => !current)}
      >
        <Eye size={17} />
        {!!watchers.length && <span>{watchers.length}</span>}
      </Button>
      {open && (
        <div className="watchers-popover">
          <button
            type="button"
            className="watchers-primary-action"
            disabled={watchMe.isPending || unwatchMe.isPending}
            onClick={() => (isWatching ? unwatchMe.mutate() : watchMe.mutate())}
          >
            <Eye size={15} />
            <span>{isWatching ? "Stop watching" : "Start watching"}</span>
          </button>
          <div className="watchers-content">
            <h4>Watching this task</h4>
            {!watchers.length ? (
              <p>No watchers yet.</p>
            ) : (
              watchers.map((watcher) => {
                const user = watcherUser(watcher);
                return (
                  <div className="watcher-row" key={user.id}>
                    <Avatar
                      label={initials(user)}
                      src={api.avatarUrl(user.id)}
                    />
                    <span>{personName(user)}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${personName(user)} from watchers`}
                      disabled={removeWatcher.isPending}
                      onClick={() => removeWatcher.mutate(user.id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <div className="watchers-add">
            <button type="button" onClick={() => setAdding((value) => !value)}>
              <Plus size={15} />
              Add watchers
            </button>
            {adding && (
              <div className="watchers-add-list">
                {!availableMembers.length ? (
                  <p>No members to add.</p>
                ) : (
                  availableMembers.map((member) => (
                    <button
                      type="button"
                      key={member.id}
                      disabled={addWatcher.isPending}
                      onClick={() => addWatcher.mutate(member.user.id)}
                    >
                      <Avatar
                        label={initials(member.user)}
                        src={api.avatarUrl(member.user.id)}
                      />
                      <span>{personName(member.user)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
