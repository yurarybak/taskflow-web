import { useInfiniteQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useRef } from "react";
import { Avatar, Empty, Skeleton } from "../../../components/ui";
import { api } from "../../../lib/api";
import { nextPageParam, useLoadMore } from "../../../hooks/use-load-more";
import { keys } from "../../../lib/query-keys";
import { initials, personName } from "../../../lib/utils";

export function History({ taskId }: { taskId: string }) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: keys.activity(taskId),
      initialPageParam: 1,
      queryFn: ({ pageParam }) =>
        api.activity(taskId, { page: pageParam, limit: 10 }),
      getNextPageParam: nextPageParam,
    });
  useLoadMore(loadMoreRef, {
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });
  const activity = [...(data?.pages.flatMap((page) => page.data) ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  if (isLoading) return <Skeleton rows={2} />;
  if (!activity.length)
    return (
      <Empty title="No history yet" detail="Task changes will appear here." />
    );
  return (
    <div className="history-list">
      {activity.map((entry) => (
        <article className="comment history-entry" key={entry.id}>
          <div className="comment-heading">
            <Avatar
              label={initials(entry.actor)}
              src={api.avatarUrl(entry.actor.id)}
            />
            <div>
              <strong>{personName(entry.actor)}</strong>
              <small>
                {formatDistanceToNow(new Date(entry.createdAt), {
                  addSuffix: true,
                })}
              </small>
            </div>
          </div>
          <p>{entry.type.toLowerCase().replaceAll("_", " ")}</p>
        </article>
      ))}
      <div className="history-load-more" ref={loadMoreRef}>
        {isFetchingNextPage
          ? "Loading more history..."
          : hasNextPage
            ? "Scroll to load more"
            : ""}
      </div>
    </div>
  );
}
