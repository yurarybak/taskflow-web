import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import type {
  SortOrder,
  TaskPriority,
  TaskTemplateSortBy,
  TaskType,
} from "../../lib/types";

export const taskTemplateTypes: TaskType[] = [
  "TASK",
  "BUG",
  "FEATURE",
  "IMPROVEMENT",
];
export const taskTemplatePriorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];
export const taskTemplateSortOptions: {
  value: TaskTemplateSortBy;
  label: string;
}[] = [
  { value: "createdAt", label: "Created" },
  { value: "name", label: "Name" },
  { value: "usageCount", label: "Usage" },
  { value: "lastUsedAt", label: "Last used" },
];
export const sortOrderOptions: { value: SortOrder; label: string }[] = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
];
export const humanizeConstant = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
export const useInvalidate = () => {
  const client = useQueryClient();
  return (queryKey: QueryKey) => client.invalidateQueries({ queryKey });
};
