import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
  Edit3,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
} from "../../components/ui";
import { useDismiss } from "../../hooks/use-dismiss";
import { api } from "../../lib/api";
import { keys } from "../../lib/query-keys";
import type { Member, Milestone, SavedTaskFilter } from "../../lib/types";
import { initials, personName } from "../../lib/utils";
import { PriorityIcon, TypeIcon } from "./task-fields";
import {
  cleanTaskFilters,
  comparableFilters,
  normalizeSavedFilters,
  priorities,
  savedFilterStorageKey,
  statuses,
  taskFiltersRecord,
  types,
} from "./task-filters";
import { humanizeConstant, statusLabel } from "./task-utils";
import type { TaskFiltersState } from "./use-task-filters";

/**
 * The project's filter toolbar: search, saved filters (with their create /
 * edit / delete dialogs) and the status, priority, type, assignee and
 * milestone popovers. `children` render at the end of the toolbar.
 */
export function TaskFiltersBar({
  projectId,
  filterState,
  members,
  milestones,
  children,
}: {
  projectId: string;
  filterState: TaskFiltersState;
  members?: Member[];
  milestones?: Milestone[];
  children?: ReactNode;
}) {
  const {
    filters,
    savedFilters,
    activeSavedFilterId,
    setFilters,
    applySavedFilter,
    toggleFilterValue,
  } = filterState;
  const client = useQueryClient();
  const filtersRef = useRef<HTMLDivElement>(null);
  const [saveFilterOpen, setSaveFilterOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState("");
  const [editFilter, setEditFilter] = useState<SavedTaskFilter>();
  const [editFilterName, setEditFilterName] = useState("");
  const [editFilterUsesCurrent, setEditFilterUsesCurrent] = useState(false);
  const [deleteFilter, setDeleteFilter] = useState<SavedTaskFilter>();
  const [openFilter, setOpenFilter] = useState<
    | "saved"
    | "statuses"
    | "priorities"
    | "types"
    | "assignees"
    | "milestones"
    | null
  >(null);
  const selectedStatuses = filters.statuses ?? [];
  const selectedPriorities = filters.priorities ?? [];
  const selectedTypes = filters.types ?? [];
  const selectedAssigneeIds = filters.assigneeIds ?? [];
  const selectedMilestoneIds = filters.milestoneIds ?? [];
  const currentSavedFilters = cleanTaskFilters(filters);
  const hasActiveFilters = Object.keys(currentSavedFilters).length > 0;
  const activeSavedFilter = savedFilters?.find(
    (savedFilter) => savedFilter.id === activeSavedFilterId,
  );
  const activeSavedFilterModified =
    !!activeSavedFilter &&
    comparableFilters(filters) !==
      comparableFilters(normalizeSavedFilters(activeSavedFilter.filters));
  const invalidateSavedFilters = () =>
    client.invalidateQueries({ queryKey: keys.savedFilters(projectId) });
  useDismiss(filtersRef, () => setOpenFilter(null), openFilter !== null);
  const createSavedFilter = useMutation({
    mutationFn: () =>
      api.createSavedFilter(projectId, {
        name: saveFilterName.trim(),
        filters: taskFiltersRecord(currentSavedFilters),
      }),
    onSuccess: (savedFilter) => {
      void invalidateSavedFilters();
      setFilters(filters, savedFilter.id);
      localStorage.setItem(savedFilterStorageKey(projectId), savedFilter.id);
      setSaveFilterOpen(false);
      setSaveFilterName("");
      toast.success("Filter saved");
    },
  });
  const updateSavedFilter = useMutation({
    mutationFn: () => {
      if (!editFilter) throw new Error("No filter selected");
      return api.updateSavedFilter(projectId, editFilter.id, {
        name: editFilterName.trim(),
        ...(editFilterUsesCurrent
          ? { filters: taskFiltersRecord(currentSavedFilters) }
          : {}),
      });
    },
    onSuccess: () => {
      void invalidateSavedFilters();
      setEditFilter(undefined);
      setEditFilterName("");
      setEditFilterUsesCurrent(false);
      toast.success("Saved filter updated");
    },
  });
  const removeSavedFilter = useMutation({
    mutationFn: () => {
      if (!deleteFilter) throw new Error("No filter selected");
      return api.removeSavedFilter(projectId, deleteFilter.id);
    },
    onSuccess: () => {
      void invalidateSavedFilters();
      if (deleteFilter?.id === activeSavedFilterId) {
        setFilters(filters, null);
        localStorage.removeItem(savedFilterStorageKey(projectId));
      }
      setDeleteFilter(undefined);
      toast.success("Saved filter deleted");
    },
  });
  return (
    <>
      <div className="toolbar task-filters" ref={filtersRef}>
        <div className="search task-search">
          <Search size={15} />
          <Input
            placeholder="Search tasks"
            value={filters.search || ""}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <div className="task-filter-popover saved-filter-popover">
          <button
            className="task-filter-button"
            type="button"
            onClick={() =>
              setOpenFilter(openFilter === "saved" ? null : "saved")
            }
          >
            Saved filters
            <ChevronDown size={14} />
          </button>
          {openFilter === "saved" && (
            <div className="task-filter-menu saved-filter-menu">
              {!savedFilters?.length ? (
                <p>No saved filters yet</p>
              ) : (
                savedFilters.map((savedFilter) => (
                  <div className="saved-filter-row" key={savedFilter.id}>
                    <button
                      type="button"
                      onClick={() => {
                        applySavedFilter(savedFilter);
                        setOpenFilter(null);
                      }}
                    >
                      {savedFilter.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`Edit ${savedFilter.name}`}
                      onClick={() => {
                        setEditFilter(savedFilter);
                        setEditFilterName(savedFilter.name);
                        setEditFilterUsesCurrent(false);
                        setOpenFilter(null);
                      }}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${savedFilter.name}`}
                      onClick={() => {
                        setDeleteFilter(savedFilter);
                        setOpenFilter(null);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
              <div className="saved-filter-footer">
                <Button
                  variant="secondary"
                  disabled={!hasActiveFilters}
                  onClick={() => {
                    setSaveFilterName("");
                    setSaveFilterOpen(true);
                    setOpenFilter(null);
                  }}
                >
                  <Plus size={15} /> Save current filter
                </Button>
              </div>
            </div>
          )}
        </div>
        {activeSavedFilter && (
          <div
            className={
              activeSavedFilterModified
                ? "active-saved-filter modified"
                : "active-saved-filter"
            }
          >
            <span>
              View: <strong>{activeSavedFilter.name}</strong>
              {activeSavedFilterModified ? " (modified)" : ""}
            </span>
            <button
              type="button"
              aria-label="Clear active saved filter"
              onClick={() => applySavedFilter(null)}
            >
              <X size={13} />
            </button>
          </div>
        )}
        <div className="task-filter-popover">
          <button
            className={
              selectedStatuses.length
                ? "task-filter-button active"
                : "task-filter-button"
            }
            type="button"
            onClick={() =>
              setOpenFilter(openFilter === "statuses" ? null : "statuses")
            }
          >
            {selectedStatuses.length
              ? `${selectedStatuses.length} status${selectedStatuses.length > 1 ? "es" : ""}`
              : "Statuses"}
            <ChevronDown size={14} />
          </button>
          {openFilter === "statuses" && (
            <div className="task-filter-menu compact">
              {statuses.map((status) => (
                <label className="task-filter-option" key={status}>
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(status)}
                    onChange={() => toggleFilterValue("statuses", status)}
                  />
                  <span>{statusLabel(status)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="task-filter-popover">
          <button
            className={
              selectedPriorities.length
                ? "task-filter-button active"
                : "task-filter-button"
            }
            type="button"
            onClick={() =>
              setOpenFilter(openFilter === "priorities" ? null : "priorities")
            }
          >
            {selectedPriorities.length
              ? `${selectedPriorities.length} priorit${selectedPriorities.length > 1 ? "ies" : "y"}`
              : "Priorities"}
            <ChevronDown size={14} />
          </button>
          {openFilter === "priorities" && (
            <div className="task-filter-menu compact">
              {priorities.map((priority) => (
                <label className="task-filter-option" key={priority}>
                  <input
                    type="checkbox"
                    checked={selectedPriorities.includes(priority)}
                    onChange={() => toggleFilterValue("priorities", priority)}
                  />
                  <PriorityIcon priority={priority} />
                  <span>{humanizeConstant(priority)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="task-filter-popover">
          <button
            className={
              selectedTypes.length
                ? "task-filter-button active"
                : "task-filter-button"
            }
            type="button"
            onClick={() =>
              setOpenFilter(openFilter === "types" ? null : "types")
            }
          >
            {selectedTypes.length
              ? `${selectedTypes.length} type${selectedTypes.length > 1 ? "s" : ""}`
              : "Types"}
            <ChevronDown size={14} />
          </button>
          {openFilter === "types" && (
            <div className="task-filter-menu compact">
              {types.map((type) => (
                <label className="task-filter-option" key={type}>
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(type)}
                    onChange={() => toggleFilterValue("types", type)}
                  />
                  <TypeIcon type={type} />
                  <span>{humanizeConstant(type)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="task-filter-popover assignee-filter">
          <button
            className={
              selectedAssigneeIds.length || filters.unassigned
                ? "task-filter-button active"
                : "task-filter-button"
            }
            type="button"
            onClick={() =>
              setOpenFilter(openFilter === "assignees" ? null : "assignees")
            }
          >
            <Users size={15} />
            {filters.unassigned
              ? "Unassigned"
              : selectedAssigneeIds.length
                ? `${selectedAssigneeIds.length} assignee${selectedAssigneeIds.length > 1 ? "s" : ""}`
                : "Assignees"}
            <ChevronDown size={14} />
          </button>
          {openFilter === "assignees" && (
            <div className="task-filter-menu assignee-filter-menu">
              <label className="task-filter-option assignee-filter-option">
                <input
                  type="checkbox"
                  checked={!!filters.unassigned}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      assigneeIds: event.target.checked
                        ? undefined
                        : filters.assigneeIds,
                      unassigned: event.target.checked,
                    })
                  }
                />
                <span className="assignee-filter-empty-avatar">-</span>
                <span>
                  <strong>Unassigned</strong>
                </span>
              </label>
              {!members?.length ? (
                <p>No members yet</p>
              ) : (
                members.map((member) => {
                  const checked = selectedAssigneeIds.includes(member.user.id);
                  return (
                    <label
                      className="task-filter-option assignee-filter-option"
                      key={member.id}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          toggleFilterValue("assigneeIds", member.user.id)
                        }
                      />
                      <Avatar
                        label={initials(member.user)}
                        src={api.avatarUrl(member.user.id)}
                      />
                      <span>
                        <strong>{personName(member.user)}</strong>
                        <small>{member.user.email}</small>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          )}
        </div>
        <div className="task-filter-popover milestone-filter">
          <button
            className={
              selectedMilestoneIds.length || filters.withoutMilestone
                ? "task-filter-button active"
                : "task-filter-button"
            }
            type="button"
            onClick={() =>
              setOpenFilter(openFilter === "milestones" ? null : "milestones")
            }
          >
            <CalendarDays size={15} />
            {filters.withoutMilestone
              ? "Without milestone"
              : selectedMilestoneIds.length
                ? `${selectedMilestoneIds.length} milestone${selectedMilestoneIds.length > 1 ? "s" : ""}`
                : "Milestones"}
            <ChevronDown size={14} />
          </button>
          {openFilter === "milestones" && (
            <div className="task-filter-menu milestone-filter-menu">
              <label className="task-filter-option">
                <input
                  type="checkbox"
                  checked={!!filters.withoutMilestone}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      milestoneIds: event.target.checked
                        ? undefined
                        : filters.milestoneIds,
                      withoutMilestone: event.target.checked,
                    })
                  }
                />
                <CalendarDays size={15} />
                <span>Without milestone</span>
              </label>
              {!milestones?.length ? (
                <p>No milestones yet</p>
              ) : (
                milestones.map((milestone) => (
                  <label className="task-filter-option" key={milestone.id}>
                    <input
                      type="checkbox"
                      checked={selectedMilestoneIds.includes(milestone.id)}
                      onChange={() =>
                        toggleFilterValue("milestoneIds", milestone.id)
                      }
                    />
                    <CalendarDays size={15} />
                    <span>{milestone.name}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>
        {children}
      </div>
      <Dialog
        open={saveFilterOpen}
        title="Save current filter"
        onClose={() => setSaveFilterOpen(false)}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (saveFilterName.trim().length >= 2) createSavedFilter.mutate();
          }}
        >
          <Field label="Name">
            <Input
              value={saveFilterName}
              minLength={2}
              maxLength={80}
              autoFocus
              required
              onChange={(event) => setSaveFilterName(event.target.value)}
            />
          </Field>
          <div className="dialog-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSaveFilterOpen(false)}
            >
              Cancel
            </Button>
            <Button
              loading={createSavedFilter.isPending}
              disabled={!hasActiveFilters || saveFilterName.trim().length < 2}
            >
              Save filter
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={!!editFilter}
        title="Edit saved filter"
        onClose={() => setEditFilter(undefined)}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (editFilterName.trim().length >= 2) updateSavedFilter.mutate();
          }}
        >
          <Field label="Name">
            <Input
              value={editFilterName}
              minLength={2}
              maxLength={80}
              autoFocus
              required
              onChange={(event) => setEditFilterName(event.target.value)}
            />
          </Field>
          <label className="saved-filter-current-check">
            <input
              type="checkbox"
              checked={editFilterUsesCurrent}
              disabled={!hasActiveFilters}
              onChange={(event) =>
                setEditFilterUsesCurrent(event.target.checked)
              }
            />
            Replace saved filters with current board filters
          </label>
          <div className="dialog-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditFilter(undefined)}
            >
              Cancel
            </Button>
            <Button
              loading={updateSavedFilter.isPending}
              disabled={editFilterName.trim().length < 2}
            >
              Save changes
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        open={!!deleteFilter}
        title="Delete saved filter?"
        description={`Are you sure you want to delete "${
          deleteFilter?.name || "this filter"
        }"?`}
        confirmText="Delete filter"
        loading={removeSavedFilter.isPending}
        onClose={() => setDeleteFilter(undefined)}
        onConfirm={() => removeSavedFilter.mutate()}
      />
    </>
  );
}
