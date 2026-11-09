import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makePage } from "../test/fixtures";
import { nextPageParam, useLoadMore } from "./use-load-more";

let intersect: (isIntersecting: boolean) => void = () => undefined;

class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    intersect = (isIntersecting) =>
      callback(
        [{ isIntersecting } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
  }
  observe() {}
  disconnect() {}
}

function Feed(props: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLoadMore(ref, props);
  return <div ref={ref} />;
}

describe("useLoadMore", () => {
  beforeEach(() =>
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver),
  );
  afterEach(() => vi.unstubAllGlobals());

  it("fetches the next page when the sentinel becomes visible", () => {
    const fetchNextPage = vi.fn();
    render(
      <Feed
        hasNextPage
        isFetchingNextPage={false}
        fetchNextPage={fetchNextPage}
      />,
    );
    act(() => intersect(false));
    expect(fetchNextPage).not.toHaveBeenCalled();
    act(() => intersect(true));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("does not fetch while a page is already loading", () => {
    const fetchNextPage = vi.fn();
    render(
      <Feed hasNextPage isFetchingNextPage fetchNextPage={fetchNextPage} />,
    );
    act(() => intersect(true));
    expect(fetchNextPage).not.toHaveBeenCalled();
  });
});

describe("nextPageParam", () => {
  it("returns the next page until the last one", () => {
    expect(nextPageParam(makePage([], { page: 1, totalPages: 2 }))).toBe(2);
    expect(
      nextPageParam(makePage([], { page: 2, totalPages: 2 })),
    ).toBeUndefined();
  });
});
