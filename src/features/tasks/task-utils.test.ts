import { describe, expect, it } from "vitest";
import { makePage, makeTask } from "../../test/fixtures";
import { formatEstimate, parseEstimate, patchTaskInPages } from "./task-utils";

describe("patchTaskInPages", () => {
  it("updates the task on whichever page it is", () => {
    const data = {
      pageParams: [1, 2],
      pages: [
        makePage([makeTask({ id: "a" })]),
        makePage([makeTask({ id: "b", status: "TODO" })]),
      ],
    };
    const next = patchTaskInPages(data, "b", { status: "DONE" });
    expect(next?.pages[1].data[0].status).toBe("DONE");
    expect(next?.pages[0].data[0]).toBe(data.pages[0].data[0]);
    expect(data.pages[1].data[0].status).toBe("TODO");
  });

  it("leaves an empty cache empty", () => {
    expect(
      patchTaskInPages(undefined, "a", { status: "DONE" }),
    ).toBeUndefined();
  });
});

describe("estimates", () => {
  it("parses and formats with 1w = 5d and 1d = 8h", () => {
    expect(parseEstimate("1w 2d 3h 15m")).toEqual({
      minutes: 5 * 8 * 60 + 2 * 8 * 60 + 3 * 60 + 15,
      error: undefined,
    });
    expect(formatEstimate(8 * 60 + 30)).toBe("1d 30m");
  });

  it("rejects unknown units", () => {
    expect(parseEstimate("3 hours").error).toBeDefined();
  });
});
