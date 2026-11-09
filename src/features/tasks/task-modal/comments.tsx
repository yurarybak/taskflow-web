import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Edit3, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  ConfirmDialog,
  Skeleton,
} from "../../../components/ui";
import { api } from "../../../lib/api";
import { nextPageParam, useLoadMore } from "../../../hooks/use-load-more";
import { keys } from "../../../lib/query-keys";
import { initials, personName } from "../../../lib/utils";
import type { Member, Role, User } from "../../../lib/types";
import {
  displayMentionText,
  MentionTextarea,
  renderMentionText,
  serializeMentionText,
} from "../mentions";
import { wasUpdated } from "../task-utils";

export function Comments({
  taskId,
  currentUser,
  currentRole,
  members,
}: {
  taskId: string;
  currentUser?: User;
  currentRole?: Role;
  members?: Member[];
}) {
  const client = useQueryClient();
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: keys.comments(taskId),
      initialPageParam: 1,
      queryFn: ({ pageParam }) =>
        api.comments(taskId, { page: pageParam, limit: 10 }),
      getNextPageParam: nextPageParam,
    });
  useLoadMore(loadMoreRef, {
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });
  const comments = [...(data?.pages.flatMap((page) => page.data) ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const add = useMutation({
    mutationFn: () =>
      api.createComment(taskId, serializeMentionText(content, members)),
    onSuccess: () => {
      setContent("");
      client.invalidateQueries({ queryKey: keys.comments(taskId) });
      client.invalidateQueries({ queryKey: keys.activity(taskId) });
    },
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: keys.comments(taskId) });
  const update = useMutation({
    mutationFn: () =>
      api.updateComment(
        taskId,
        editingId || "",
        serializeMentionText(editingContent, members),
      ),
    onSuccess: () => {
      setEditingId(null);
      setEditingContent("");
      refresh();
      toast.success("Comment updated");
    },
  });
  const remove = useMutation({
    mutationFn: (commentId: string) => api.removeComment(taskId, commentId),
    onSuccess: () => {
      setDeleteCommentId(null);
      refresh();
      client.invalidateQueries({ queryKey: keys.activity(taskId) });
      toast.success("Comment deleted");
    },
  });
  return (
    <section>
      <form
        className="comment-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (content.trim()) add.mutate();
        }}
      >
        <div className="comment-composer-row">
          <Avatar
            label={initials(currentUser)}
            src={currentUser ? api.avatarUrl(currentUser.id) : undefined}
          />
          <div className="comment-composer-body">
            <MentionTextarea
              placeholder="Add a comment..."
              value={content}
              members={members}
              onChange={setContent}
            />
            {content.trim() && (
              <div className="inline-actions">
                <Button loading={add.isPending}>Comment</Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setContent("")}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </form>
      {isLoading ? (
        <Skeleton rows={2} />
      ) : (
        <>
          {comments.map((comment) => {
            const canEdit = currentUser?.id === comment.authorId;
            const canDelete =
              canEdit || currentRole === "OWNER" || currentRole === "ADMIN";
            const isEditing = editingId === comment.id;
            const edited = wasUpdated(comment.createdAt, comment.updatedAt);
            const timestamp = edited ? comment.updatedAt : comment.createdAt;
            return (
              <article className="comment" key={comment.id}>
                <div className="comment-heading">
                  <Avatar
                    label={initials(comment.author)}
                    src={api.avatarUrl(comment.author.id)}
                  />
                  <div>
                    <strong>{personName(comment.author)}</strong>
                    <small>
                      {formatDistanceToNow(new Date(timestamp), {
                        addSuffix: true,
                      })}
                      {edited && " (edited)"}
                    </small>
                  </div>
                </div>
                {isEditing ? (
                  <div className="comment-edit-form">
                    <MentionTextarea
                      value={editingContent}
                      members={members}
                      onChange={setEditingContent}
                      autoFocus
                    />
                    <div className="inline-actions">
                      <Button
                        loading={update.isPending}
                        onClick={() => editingContent.trim() && update.mutate()}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setEditingId(null);
                          setEditingContent("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p>{renderMentionText(comment.content, members)}</p>
                )}
                {!isEditing && (canEdit || canDelete) && (
                  <div className="comment-actions">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(comment.id);
                          setEditingContent(
                            displayMentionText(comment.content, members),
                          );
                        }}
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteCommentId(comment.id)}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
          <div className="comment-load-more" ref={loadMoreRef}>
            {isFetchingNextPage
              ? "Loading more comments..."
              : hasNextPage
                ? "Scroll to load more"
                : ""}
          </div>
        </>
      )}
      <ConfirmDialog
        open={!!deleteCommentId}
        title="Delete comment?"
        description="This comment will be permanently deleted. This action cannot be undone."
        confirmText="Delete comment"
        loading={remove.isPending}
        onClose={() => setDeleteCommentId(null)}
        onConfirm={() => deleteCommentId && remove.mutate(deleteCommentId)}
      />
    </section>
  );
}
