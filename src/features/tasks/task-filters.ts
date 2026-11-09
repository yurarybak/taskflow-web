import type {
  TaskFilters,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "../../lib/types";

export const statuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
export const priorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];
export const types: TaskType[] = ["TASK", "BUG", "FEATURE", "IMPROVEMENT"];

const isStatus = (value: unknown): value is TaskStatus =>
  typeof value === "string" && statuses.includes(value as TaskStatus);
const isPriority = (value: unknown): value is TaskPriority =>
  typeof value === "string" && priorities.includes(value as TaskPriority);
const isType = (value: unknown): value is TaskType =>
  typeof value === "string" && types.includes(value as TaskType);
const stringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;

/** Drops empty values and trims the search, so equal filters look equal. */
export const cleanTaskFilters = (filters: TaskFilters): TaskFilters => ({
  ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
  ...(filters.statuses?.length ? { statuses: filters.statuses } : {}),
  ...(filters.priorities?.length ? { priorities: filters.priorities } : {}),
  ...(filters.types?.length ? { types: filters.types } : {}),
  ...(filters.assigneeIds?.length ? { assigneeIds: filters.assigneeIds } : {}),
  ...(filters.unassigned ? { unassigned: true } : {}),
  ...(filters.milestoneIds?.length
    ? { milestoneIds: filters.milestoneIds }
    : {}),
  ...(filters.withoutMilestone ? { withoutMilestone: true } : {}),
});

/** Order-insensitive fingerprint, used to tell whether a saved filter was modified. */
export const comparableFilters = (filters: TaskFilters) =>
  JSON.stringify({
    ...cleanTaskFilters(filters),
    statuses: [...(filters.statuses ?? [])].sort(),
    priorities: [...(filters.priorities ?? [])].sort(),
    types: [...(filters.types ?? [])].sort(),
    assigneeIds: [...(filters.assigneeIds ?? [])].sort(),
    milestoneIds: [...(filters.milestoneIds ?? [])].sort(),
  });

/** Validates untrusted filter data (saved filters from the API, URL params). */
export const normalizeSavedFilters = (
  value: Record<string, unknown>,
): TaskFilters =>
  cleanTaskFilters({
    search: typeof value.search === "string" ? value.search : undefined,
    statuses: Array.isArray(value.statuses)
      ? value.statuses.filter(isStatus)
      : undefined,
    priorities: Array.isArray(value.priorities)
      ? value.priorities.filter(isPriority)
      : undefined,
    types: Array.isArray(value.types) ? value.types.filter(isType) : undefined,
    assigneeIds: stringArray(value.assigneeIds),
    unassigned: value.unassigned === true,
    milestoneIds: stringArray(value.milestoneIds),
    withoutMilestone: value.withoutMilestone === true,
  });

export const taskFiltersRecord = (
  filters: TaskFilters,
): Record<string, unknown> => ({ ...filters });

export const savedFilterStorageKey = (projectId: string) =>
  `taskflow.activeSavedFilter.${projectId}`;

/** Adds `value` if missing, removes it otherwise; an empty result becomes `undefined`. */
export const toggleValue = <T>(values: readonly T[] | undefined, value: T) => {
  const current = values ?? [];
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
  return next.length ? next : undefined;
};

// URL format: ?q=text&statuses=TODO,DONE&assignees=id1,id2&unassigned=1&view=<savedFilterId>
const LIST_PARAMS = {
  statuses: "statuses",
  priorities: "priorities",
  types: "types",
  assigneeIds: "assignees",
  milestoneIds: "milestones",
} as const;
const SAVED_FILTER_PARAM = "view";
const FILTER_PARAMS = [
  "q",
  "unassigned",
  "withoutMilestone",
  SAVED_FILTER_PARAM,
  ...Object.values(LIST_PARAMS),
];

export const hasFilterParams = (params: URLSearchParams) =>
  FILTER_PARAMS.some((name) => params.has(name));

export const savedFilterIdFromParams = (params: URLSearchParams) =>
  params.get(SAVED_FILTER_PARAM);

export function filtersFromParams(params: URLSearchParams): TaskFilters {
  const list = (name: string) =>
    params.get(name)?.split(",").filter(Boolean) ?? undefined;
  const filters = normalizeSavedFilters({
    statuses: list(LIST_PARAMS.statuses),
    priorities: list(LIST_PARAMS.priorities),
    types: list(LIST_PARAMS.types),
    assigneeIds: list(LIST_PARAMS.assigneeIds),
    milestoneIds: list(LIST_PARAMS.milestoneIds),
    unassigned: params.get("unassigned") === "1",
    withoutMilestone: params.get("withoutMilestone") === "1",
  });
  // The search is kept as typed (not trimmed) so the input can contain spaces.
  const search = params.get("q");
  return search ? { ...filters, search } : filters;
}

/** Returns `params` with the filter params replaced; unrelated params are kept. */
export function paramsWithFilters(
  params: URLSearchParams,
  filters: TaskFilters,
  savedFilterId: string | null,
) {
  const next = new URLSearchParams(params);
  FILTER_PARAMS.forEach((name) => next.delete(name));
  if (filters.search) next.set("q", filters.search);
  (Object.keys(LIST_PARAMS) as (keyof typeof LIST_PARAMS)[]).forEach((key) => {
    const values = filters[key];
    if (values?.length) next.set(LIST_PARAMS[key], values.join(","));
  });
  if (filters.unassigned) next.set("unassigned", "1");
  if (filters.withoutMilestone) next.set("withoutMilestone", "1");
  if (savedFilterId) next.set(SAVED_FILTER_PARAM, savedFilterId);
  return next;
}
