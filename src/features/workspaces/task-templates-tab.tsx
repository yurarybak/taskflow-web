import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, Copy, Edit3, Plus, Search, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Button,
  ConfirmDialog,
  Dialog,
  Empty,
  Input,
  Skeleton,
} from "../../components/ui";
import { useDismiss } from "../../hooks/use-dismiss";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { api } from "../../lib/api";
import { keys } from "../../lib/query-keys";
import type {
  SortOrder,
  TaskTemplate,
  TaskTemplateFilters,
  TaskTemplateSortBy,
} from "../../lib/types";
import {
  sortOrderOptions,
  taskTemplateSortOptions,
  useInvalidate,
} from "./workspace-utils";
import { TaskTemplateForm } from "./task-template-form";

export function TaskTemplatesTab({ workspaceId }: { workspaceId: string }) {
  const invalidate = useInvalidate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<TaskTemplateSortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [openTemplateFilter, setOpenTemplateFilter] = useState<
    "sortBy" | "sortOrder" | null
  >(null);
  const templateFiltersRef = useRef<HTMLDivElement>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<TaskTemplate>();
  const [deleteTemplate, setDeleteTemplate] = useState<TaskTemplate>();
  const debouncedSearch = useDebouncedValue(search.trim());
  const effectiveSearch =
    debouncedSearch.length >= 2 ? debouncedSearch : undefined;
  const templateFilters: TaskTemplateFilters = {
    page,
    limit: 10,
    ...(effectiveSearch ? { search: effectiveSearch } : {}),
    sortBy,
    sortOrder,
  };
  const hasActiveTemplateFilters =
    !!search.trim() || sortBy !== "createdAt" || sortOrder !== "desc";
  const { data: labels } = useQuery({
    queryKey: keys.labels(workspaceId),
    queryFn: () => api.labels(workspaceId),
  });
  const { data, isLoading, error } = useQuery({
    queryKey: keys.taskTemplates(workspaceId, templateFilters),
    queryFn: () => api.taskTemplates(workspaceId, templateFilters),
    placeholderData: keepPreviousData,
  });
  const visibleTemplateIds = data?.data.map((template) => template.id) ?? [];
  const selectedVisibleCount = visibleTemplateIds.filter((id) =>
    selectedTemplateIds.includes(id),
  ).length;
  const allVisibleSelected =
    !!visibleTemplateIds.length &&
    selectedVisibleCount === visibleTemplateIds.length;
  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplateIds((current) =>
      current.includes(templateId)
        ? current.filter((id) => id !== templateId)
        : [...current, templateId],
    );
  };
  const toggleVisibleTemplates = () => {
    setSelectedTemplateIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleTemplateIds.includes(id));
      }
      return Array.from(new Set([...current, ...visibleTemplateIds]));
    });
  };
  const resetTemplateFilters = () => {
    setSearch("");
    setSortBy("createdAt");
    setSortOrder("desc");
    setPage(1);
    setOpenTemplateFilter(null);
    setSelectedTemplateIds([]);
  };
  useDismiss(
    templateFiltersRef,
    () => setOpenTemplateFilter(null),
    openTemplateFilter !== null,
  );
  const remove = useMutation({
    mutationFn: () => {
      if (!deleteTemplate) throw new Error("No template selected");
      return api.removeTaskTemplate(workspaceId, deleteTemplate.id);
    },
    onSuccess: () => {
      setDeleteTemplate(undefined);
      void invalidate(keys.taskTemplatesAll(workspaceId));
      toast.success("Template deleted");
    },
  });
  const bulkDelete = useMutation({
    mutationFn: () =>
      api.bulkDeleteTaskTemplates(workspaceId, selectedTemplateIds),
    onSuccess: () => {
      setBulkDeleteOpen(false);
      setSelectedTemplateIds([]);
      void invalidate(keys.taskTemplatesAll(workspaceId));
      toast.success("Templates deleted");
    },
  });
  const duplicate = useMutation({
    mutationFn: (template: TaskTemplate) =>
      api.duplicateTaskTemplate(workspaceId, template.id),
    onSuccess: () => {
      void invalidate(keys.taskTemplatesAll(workspaceId));
      toast.success("Template duplicated");
    },
  });
  return (
    <>
      <div className="toolbar template-toolbar">
        <div>
          <strong>Reusable task blueprints</strong>
          <p className="template-toolbar-copy">
            Create templates now, then use them later when creating tasks.
          </p>
        </div>
        <Button onClick={() => setCreate(true)}>
          <Plus size={15} /> New template
        </Button>
      </div>
      <div className="template-filters" ref={templateFiltersRef}>
        <div className="template-search">
          <Search size={15} aria-hidden="true" />
          <Input
            aria-label="Search templates"
            value={search}
            placeholder="Search templates..."
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
              setSelectedTemplateIds([]);
            }}
          />
        </div>
        <div className="task-filter-popover template-filter-popover">
          <button
            className={
              sortBy !== "createdAt"
                ? "task-filter-button active"
                : "task-filter-button"
            }
            type="button"
            onClick={() =>
              setOpenTemplateFilter(
                openTemplateFilter === "sortBy" ? null : "sortBy",
              )
            }
          >
            Sort:{" "}
            {taskTemplateSortOptions.find((option) => option.value === sortBy)
              ?.label || "Created"}
            <ChevronDown size={14} />
          </button>
          {openTemplateFilter === "sortBy" && (
            <div className="task-filter-menu compact template-filter-menu">
              {taskTemplateSortOptions.map((option) => (
                <button
                  className={option.value === sortBy ? "active" : ""}
                  type="button"
                  key={option.value}
                  onClick={() => {
                    setSortBy(option.value);
                    setPage(1);
                    setSelectedTemplateIds([]);
                    setOpenTemplateFilter(null);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="task-filter-popover template-filter-popover">
          <button
            className={
              sortOrder !== "desc"
                ? "task-filter-button active"
                : "task-filter-button"
            }
            type="button"
            onClick={() =>
              setOpenTemplateFilter(
                openTemplateFilter === "sortOrder" ? null : "sortOrder",
              )
            }
          >
            {
              sortOrderOptions.find((option) => option.value === sortOrder)
                ?.label
            }
            <ChevronDown size={14} />
          </button>
          {openTemplateFilter === "sortOrder" && (
            <div className="task-filter-menu compact template-filter-menu">
              {sortOrderOptions.map((option) => (
                <button
                  className={option.value === sortOrder ? "active" : ""}
                  type="button"
                  key={option.value}
                  onClick={() => {
                    setSortOrder(option.value);
                    setPage(1);
                    setSelectedTemplateIds([]);
                    setOpenTemplateFilter(null);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {hasActiveTemplateFilters && (
          <Button
            type="button"
            variant="secondary"
            onClick={resetTemplateFilters}
          >
            Clear
          </Button>
        )}
      </div>
      {isLoading ? (
        <Skeleton />
      ) : error ? (
        <Empty title="Could not load templates" detail={error.message} />
      ) : !data?.data.length ? (
        <Empty
          title={
            hasActiveTemplateFilters
              ? "No templates found"
              : "No task templates yet"
          }
          detail={
            hasActiveTemplateFilters
              ? "Try another search or reset sorting."
              : "Create templates for common tasks like bug reports, stories or recurring work."
          }
          action={
            hasActiveTemplateFilters ? (
              <Button variant="secondary" onClick={resetTemplateFilters}>
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setCreate(true)}>
                <Plus size={15} /> New template
              </Button>
            )
          }
        />
      ) : (
        <>
          {!!selectedTemplateIds.length && (
            <div className="template-bulk-bar">
              <span>
                {selectedTemplateIds.length} template
                {selectedTemplateIds.length > 1 ? "s" : ""} selected
              </span>
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelectedTemplateIds([])}
                >
                  Clear selection
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 size={15} /> Delete selected
                </Button>
              </div>
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="template-select-column">
                    <input
                      type="checkbox"
                      aria-label="Select all visible templates"
                      checked={allVisibleSelected}
                      onChange={toggleVisibleTemplates}
                    />
                  </th>
                  <th>Template</th>
                  <th>Used</th>
                  <th>Last used</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((template) => (
                  <tr key={template.id}>
                    <td className="template-select-column">
                      <input
                        type="checkbox"
                        aria-label={`Select ${template.name}`}
                        checked={selectedTemplateIds.includes(template.id)}
                        onChange={() => toggleTemplateSelection(template.id)}
                      />
                    </td>
                    <td>
                      <div className="template-table-title">
                        <strong>{template.name}</strong>
                      </div>
                    </td>
                    <td>{template.usageCount ?? 0}</td>
                    <td>
                      {template.lastUsedAt
                        ? formatDistanceToNow(new Date(template.lastUsedAt), {
                            addSuffix: true,
                          })
                        : "Never"}
                    </td>
                    <td>
                      {formatDistanceToNow(new Date(template.updatedAt), {
                        addSuffix: true,
                      })}
                    </td>
                    <td>
                      <div className="row-actions template-row-actions">
                        <Button
                          variant="ghost"
                          aria-label={`Edit ${template.name}`}
                          onClick={() => setEdit(template)}
                        >
                          <Edit3 size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label={`Duplicate ${template.name}`}
                          disabled={duplicate.isPending}
                          onClick={() => duplicate.mutate(template)}
                        >
                          <Copy size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label={`Delete ${template.name}`}
                          onClick={() => setDeleteTemplate(template)}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.meta.totalPages > 1 && (
            <div className="task-export-pagination">
              <Button
                type="button"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => {
                  setSelectedTemplateIds([]);
                  setPage((value) => Math.max(1, value - 1));
                }}
              >
                Previous
              </Button>
              <span>
                Page {data.meta.page} of {data.meta.totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={page >= data.meta.totalPages}
                onClick={() => {
                  setSelectedTemplateIds([]);
                  setPage((value) => Math.min(data.meta.totalPages, value + 1));
                }}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
      <Dialog
        open={create}
        title="New task template"
        onClose={() => setCreate(false)}
      >
        <TaskTemplateForm
          workspaceId={workspaceId}
          labels={labels}
          onClose={() => setCreate(false)}
        />
      </Dialog>
      <Dialog
        open={!!edit}
        title="Edit task template"
        onClose={() => setEdit(undefined)}
      >
        {edit && (
          <TaskTemplateForm
            workspaceId={workspaceId}
            labels={labels}
            initial={edit}
            onClose={() => setEdit(undefined)}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={!!deleteTemplate}
        title="Delete task template?"
        description={`Are you sure you want to delete "${
          deleteTemplate?.name || "this template"
        }"? This action cannot be undone.`}
        confirmText="Delete template"
        loading={remove.isPending}
        onClose={() => setDeleteTemplate(undefined)}
        onConfirm={() => remove.mutate()}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Delete selected templates?"
        description={`Are you sure you want to delete ${
          selectedTemplateIds.length
        } selected template${
          selectedTemplateIds.length === 1 ? "" : "s"
        }? This action cannot be undone.`}
        confirmText="Delete templates"
        loading={bulkDelete.isPending}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => selectedTemplateIds.length && bulkDelete.mutate()}
      />
    </>
  );
}
