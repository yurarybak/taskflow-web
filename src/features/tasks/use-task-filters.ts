import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import { keys } from "../../lib/query-keys";
import type { SavedTaskFilter, TaskFilters } from "../../lib/types";
import {
  filtersFromParams,
  hasFilterParams,
  normalizeSavedFilters,
  paramsWithFilters,
  savedFilterIdFromParams,
  savedFilterStorageKey,
  toggleValue,
} from "./task-filters";

export type ListFilterKey =
  | "statuses"
  | "priorities"
  | "types"
  | "assigneeIds"
  | "milestoneIds";

/**
 * Project task filters. They and the active saved filter live in the URL, so
 * a filtered view can be shared and survives a reload.
 */
export function useTaskFilters(projectId: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: savedFilters } = useQuery({
    queryKey: keys.savedFilters(projectId),
    queryFn: () => api.savedFilters(projectId),
  });
  const filters = filtersFromParams(searchParams);
  const activeSavedFilterId = savedFilterIdFromParams(searchParams);
  const setFilters = (
    next: TaskFilters,
    savedFilterId: string | null = activeSavedFilterId,
  ) =>
    setSearchParams(
      (current) => paramsWithFilters(current, next, savedFilterId),
      { replace: true },
    );
  const applySavedFilter = (savedFilter: SavedTaskFilter | null) => {
    setFilters(
      savedFilter ? normalizeSavedFilters(savedFilter.filters) : {},
      savedFilter?.id ?? null,
    );
    if (savedFilter)
      localStorage.setItem(savedFilterStorageKey(projectId), savedFilter.id);
    else localStorage.removeItem(savedFilterStorageKey(projectId));
  };
  // Opening a project without filters in the URL restores the saved filter
  // that was last active there (remembered in localStorage). Runs once, after
  // the saved filters have loaded; it syncs the URL, not React state.
  const restoredSavedFilterRef = useRef(false);
  useEffect(() => {
    if (!savedFilters || restoredSavedFilterRef.current) return;
    restoredSavedFilterRef.current = true;
    if (hasFilterParams(searchParams)) return;
    const storedId = localStorage.getItem(savedFilterStorageKey(projectId));
    if (!storedId) return;
    const savedFilter = savedFilters.find((item) => item.id === storedId);
    if (!savedFilter) {
      localStorage.removeItem(savedFilterStorageKey(projectId));
      return;
    }
    setSearchParams(
      (current) =>
        paramsWithFilters(
          current,
          normalizeSavedFilters(savedFilter.filters),
          savedFilter.id,
        ),
      { replace: true },
    );
  }, [savedFilters, searchParams, setSearchParams, projectId]);
  const toggleFilterValue = (key: ListFilterKey, value: string) => {
    const next = toggleValue<string>(filters[key], value);
    setFilters({
      ...filters,
      [key]: next,
      // Picking assignees/milestones replaces the "without" option.
      ...(key === "assigneeIds" && next ? { unassigned: false } : {}),
      ...(key === "milestoneIds" && next ? { withoutMilestone: false } : {}),
    });
  };
  return {
    filters,
    savedFilters,
    activeSavedFilterId,
    setFilters,
    applySavedFilter,
    toggleFilterValue,
  };
}

export type TaskFiltersState = ReturnType<typeof useTaskFilters>;
