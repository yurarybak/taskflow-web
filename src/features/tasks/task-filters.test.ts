import { describe, expect, it } from "vitest";
import {
  filtersFromParams,
  hasFilterParams,
  paramsWithFilters,
  savedFilterIdFromParams,
  toggleValue,
} from "./task-filters";

describe("task filter URL params", () => {
  it("round-trips filters and the saved filter id", () => {
    const filters = {
      search: "fix login ",
      statuses: ["TODO" as const, "DONE" as const],
      assigneeIds: ["user-1"],
      withoutMilestone: true,
    };
    const params = paramsWithFilters(new URLSearchParams(), filters, "saved-1");
    expect(params.toString()).toBe(
      "q=fix+login+&statuses=TODO%2CDONE&assignees=user-1&withoutMilestone=1&view=saved-1",
    );
    expect(filtersFromParams(params)).toEqual(filters);
    expect(savedFilterIdFromParams(params)).toBe("saved-1");
  });

  it("ignores unknown enum values from a hand-edited URL", () => {
    const params = new URLSearchParams("statuses=TODO,NOPE&priorities=URGENT");
    expect(filtersFromParams(params)).toEqual({ statuses: ["TODO"] });
  });

  it("keeps unrelated params and removes cleared filters", () => {
    const params = paramsWithFilters(
      new URLSearchParams("tab=milestones&statuses=TODO&view=old"),
      {},
      null,
    );
    expect(params.toString()).toBe("tab=milestones");
    expect(hasFilterParams(params)).toBe(false);
  });
});

describe("toggleValue", () => {
  it("adds and removes values and returns undefined when empty", () => {
    expect(toggleValue(undefined, "a")).toEqual(["a"]);
    expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
    expect(toggleValue(["a"], "a")).toBeUndefined();
  });
});
