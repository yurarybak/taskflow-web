export type Role = "OWNER" | "ADMIN" | "MEMBER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";
export type TaskType = "TASK" | "BUG" | "FEATURE" | "IMPROVEMENT";

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt?: string;
  updatedAt?: string;
}
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Page<T> {
  data: T[];
  meta: PageMeta;
}
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
export interface Member {
  id: string;
  workspaceId: string;
  userId: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
  user: User;
}
export interface Project {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}
export interface Milestone {
  id: string;
  name: string;
  description?: string;
  startDate?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}
export interface Label {
  id: string;
  name: string;
  color: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  startDate?: string;
  dueDate?: string;
  originalEstimateMinutes?: number | null;
  timeSpentMinutes?: number | null;
  remainingEstimateMinutes?: number | null;
  projectId: string;
  milestoneId?: string | null;
  milestone?: Milestone | null;
  creatorId: string;
  assigneeId?: string | null;
  labels: Label[];
  archivedAt?: string | null;
  flaggedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description?: string | null;
  type: TaskType;
  priority: TaskPriority;
  workspaceId: string;
  labels: Pick<Label, "id" | "name" | "color">[];
  usageCount?: number;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface Comment {
  id: string;
  content: string;
  authorId: string;
  author: User;
  taskId: string;
  createdAt: string;
  updatedAt: string;
}
export interface Activity {
  id: string;
  type: string;
  taskId: string;
  userId: string;
  actor: User;
  createdAt: string;
}
export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  taskId: string;
  uploaderId: string;
  createdAt: string;
}
export interface ChecklistItem {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}
export interface TaskWatcher {
  id?: string;
  taskId?: string;
  userId?: string;
  user?: User;
  email?: string;
  firstName?: string;
  lastName?: string;
  createdAt?: string;
  updatedAt?: string;
}
export interface TaskReminder {
  id: string;
  taskId: string;
  userId: string;
  remindAt: string;
  sentAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}
export interface TaskExportFilters {
  taskIds?: string[];
  statuses?: TaskStatus[];
  priorities?: TaskPriority[];
  types?: TaskType[];
  assigneeIds?: string[];
  labelIds?: string[];
  milestoneIds?: string[];
  withoutAssignee?: boolean;
  withoutMilestone?: boolean;
  includeArchived?: boolean;
  search?: string;
}
export type TaskExportStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";
export interface TaskExport {
  id: string;
  status: TaskExportStatus | string;
  fileName?: string | null;
  storageName?: string | null;
  error?: string | null;
  filters?: Record<string, unknown> | null;
  jobId?: string | null;
  progress?: number | null;
  projectId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}
export interface Worklog {
  id: string;
  timeSpentMinutes: number;
  description?: string | null;
  startedAt: string;
  taskId: string;
  authorId: string;
  author: User;
  createdAt: string;
  updatedAt: string;
}
export interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  data?: Record<string, unknown> | null;
  readAt?: string | null;
  userId: string;
  createdAt: string;
}
export interface TaskFilters {
  search?: string;
  statuses?: TaskStatus[];
  priorities?: TaskPriority[];
  types?: TaskType[];
  assigneeIds?: string[];
  unassigned?: boolean;
  milestoneIds?: string[];
  withoutMilestone?: boolean;
}
export interface SavedTaskFilter {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  projectId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
