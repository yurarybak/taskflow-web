import { useEffect, useEffectEvent, type RefObject } from "react";
import type { Page } from "../lib/types";

/** `getNextPageParam` for `Page<T>` responses. */
export const nextPageParam = <T>(lastPage: Page<T>) =>
  lastPage.meta.page < lastPage.meta.totalPages
    ? lastPage.meta.page + 1
    : undefined;

/**
 * Infinite scroll: fetches the next page whenever the sentinel `ref` scrolls
 * into view. Pass the matching fields of a `useInfiniteQuery` result.
 */
export function useLoadMore(
  ref: RefObject<HTMLElement | null>,
  {
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    enabled = true,
  }: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => unknown;
    enabled?: boolean;
  },
) {
  const loadMore = useEffectEvent(() => {
    if (!isFetchingNextPage) fetchNextPage();
  });
  useEffect(() => {
    if (!enabled || !hasNextPage || !ref.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, enabled, hasNextPage, isFetchingNextPage]);
}
