import { tokenStorage } from "./token-storage";
import type {
  Activity,
  Attachment,
  AuthResponse,
  ChecklistItem,
  Comment,
  Label,
  Member,
  Milestone,
  Page,
  Project,
  SavedTaskFilter,
  Task,
  TaskFilters,
  TaskWatcher,
  User,
  Workspace,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
let refreshPromise: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function refreshSession() {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) return false;
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    tokenStorage.clear();
    return false;
  }
  const auth = (await response.json()) as AuthResponse;
  tokenStorage.set(auth.accessToken, auth.refreshToken);
  return true;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  const token = tokenStorage.getAccess();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!(init.body instanceof FormData) && init.body)
    headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (
    response.status === 401 &&
    retry &&
    tokenStorage.getRefresh() &&
    path !== "/auth/refresh"
  ) {
    refreshPromise ||= refreshSession().finally(() => {
      refreshPromise = null;
    });
    if (await refreshPromise) return request<T>(path, init, false);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;
    throw new ApiError(response.status, message || "Something went wrong");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
const json = (body: unknown) => ({ body: JSON.stringify(body) });
const query = (values: Record<string, unknown>) => {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(","));
      return;
    }
    if (value !== undefined && value !== "" && value !== false)
      search.set(key, String(value));
  });
  const result = search.toString();
  return result ? `?${result}` : "";
};
const normalizePage = <T>(response: Page<T> | T[]): Page<T> =>
  Array.isArray(response)
    ? {
        data: response,
        meta: {
          page: 1,
          limit: response.length,
          total: response.length,
          totalPages: 1,
        },
      }
    : response;
const normalizeList = <T>(response: Page<T> | T[]): T[] =>
  normalizePage(response).data;
const normalizeTask = (task: Task): Task => ({
  ...task,
  labels: task.labels ?? [],
});
const normalizeTaskPage = (response: Page<Task> | Task[]): Page<Task> => {
  const page = normalizePage(response);
  return { ...page, data: page.data.map(normalizeTask) };
};

export const api = {
  bootstrap: refreshSession,
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", ...json(body) }),
  register: (body: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) =>
    request<AuthResponse>("/auth/register", { method: "POST", ...json(body) }),
  forgot: (email: string) =>
    request<{ success: boolean }>("/auth/forgot-password", {
      method: "POST",
      ...json({ email }),
    }),
  reset: (body: { token: string; newPassword: string }) =>
    request<{ success: boolean }>("/auth/reset-password", {
      method: "POST",
      ...json(body),
    }),
  me: () => request<User>("/auth/me"),
  profile: () => request<User>("/users/me"),
  updateProfile: (body: { firstName: string; lastName: string }) =>
    request<User>("/users/me", { method: "PATCH", ...json(body) }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<{ success: boolean }>("/users/me/password", {
      method: "PATCH",
      ...json(body),
    }),
  uploadAvatar: (file: File) => {
    const body = new FormData();
    body.set("file", file);
    return request<{ avatarUrl: string }>("/users/me/avatar", {
      method: "POST",
      body,
    });
  },
  removeAvatar: () =>
    request<{ success: boolean }>("/users/me/avatar", { method: "DELETE" }),
  avatarUrl: (id: string) => `${API_URL}/users/${id}/avatar`,
  logout: () =>
    request<{ success: boolean }>("/auth/logout", {
      method: "POST",
      ...json({ refreshToken: tokenStorage.getRefresh() }),
    }),
  logoutAll: () =>
    request<{ success: boolean }>("/auth/logout-all", { method: "POST" }),
  workspaces: async () =>
    normalizePage(await request<Page<Workspace> | Workspace[]>("/workspaces")),
  createWorkspace: (body: { name: string; description?: string }) =>
    request<Workspace>("/workspaces", { method: "POST", ...json(body) }),
  workspace: (id: string) => request<Workspace>(`/workspaces/${id}`),
  updateWorkspace: (
    id: string,
    body: Partial<Pick<Workspace, "name" | "description">>,
  ) =>
    request<Workspace>(`/workspaces/${id}`, { method: "PATCH", ...json(body) }),
  removeWorkspace: (id: string) =>
    request<{ success: boolean }>(`/workspaces/${id}`, { method: "DELETE" }),
  members: async (id: string) =>
    normalizeList(
      await request<Page<Member> | Member[]>(`/workspaces/${id}/members`),
    ),
  addMember: (id: string, body: { email: string; role: string }) =>
    request<Member>(`/workspaces/${id}/members`, {
      method: "POST",
      ...json(body),
    }),
  updateMember: (id: string, memberId: string, role: string) =>
    request<Member>(`/workspaces/${id}/members/${memberId}`, {
      method: "PATCH",
      ...json({ role }),
    }),
  removeMember: (id: string, memberId: string) =>
    request<{ success: boolean }>(`/workspaces/${id}/members/${memberId}`, {
      method: "DELETE",
    }),
  projects: async (workspaceId: string, search = "") =>
    normalizePage(
      await request<Page<Project> | Project[]>(
        `/workspaces/${workspaceId}/projects${query({ search })}`,
      ),
    ),
  createProject: (
    workspaceId: string,
    body: { name: string; description?: string },
  ) =>
    request<Project>(`/workspaces/${workspaceId}/projects`, {
      method: "POST",
      ...json(body),
    }),
  updateProject: (
    workspaceId: string,
    id: string,
    body: Partial<Pick<Project, "name" | "description">>,
  ) =>
    request<Project>(`/workspaces/${workspaceId}/projects/${id}`, {
      method: "PATCH",
      ...json(body),
    }),
  removeProject: (workspaceId: string, id: string) =>
    request<{ success: boolean }>(`/workspaces/${workspaceId}/projects/${id}`, {
      method: "DELETE",
    }),
  milestones: async (projectId: string) =>
    normalizeList(
      await request<Page<Milestone> | Milestone[]>(
        `/projects/${projectId}/milestones`,
      ),
    ),
  milestone: (projectId: string, id: string) =>
    request<Milestone>(`/projects/${projectId}/milestones/${id}`),
  createMilestone: (
    projectId: string,
    body: {
      name: string;
      description?: string;
      startDate?: string;
      dueDate?: string;
    },
  ) =>
    request<Milestone>(`/projects/${projectId}/milestones`, {
      method: "POST",
      ...json(body),
    }),
  updateMilestone: (
    projectId: string,
    id: string,
    body: Partial<
      Pick<Milestone, "name" | "description" | "startDate" | "dueDate">
    >,
  ) =>
    request<Milestone>(`/projects/${projectId}/milestones/${id}`, {
      method: "PATCH",
      ...json(body),
    }),
  removeMilestone: (projectId: string, id: string) =>
    request<{ success: boolean }>(
      `/projects/${projectId}/milestones/${id}`,
      { method: "DELETE" },
    ),
  completeMilestone: (projectId: string, id: string) =>
    request<Milestone>(`/projects/${projectId}/milestones/${id}/complete`, {
      method: "PATCH",
    }),
  reopenMilestone: (projectId: string, id: string) =>
    request<Milestone>(`/projects/${projectId}/milestones/${id}/reopen`, {
      method: "PATCH",
    }),
  savedFilters: async (projectId: string) =>
    normalizeList(
      await request<Page<SavedTaskFilter> | SavedTaskFilter[]>(
        `/projects/${projectId}/saved-filters`,
      ),
    ),
  savedFilter: (projectId: string, id: string) =>
    request<SavedTaskFilter>(`/projects/${projectId}/saved-filters/${id}`),
  createSavedFilter: (
    projectId: string,
    body: { name: string; filters: Record<string, unknown> },
  ) =>
    request<SavedTaskFilter>(`/projects/${projectId}/saved-filters`, {
      method: "POST",
      ...json(body),
    }),
  updateSavedFilter: (
    projectId: string,
    id: string,
    body: Partial<{ name: string; filters: Record<string, unknown> }>,
  ) =>
    request<SavedTaskFilter>(`/projects/${projectId}/saved-filters/${id}`, {
      method: "PATCH",
      ...json(body),
    }),
  removeSavedFilter: (projectId: string, id: string) =>
    request<{ success: boolean }>(
      `/projects/${projectId}/saved-filters/${id}`,
      { method: "DELETE" },
    ),
  tasks: async (projectId: string, filters: TaskFilters = {}) =>
    normalizeTaskPage(
      await request<Page<Task> | Task[]>(
        `/projects/${projectId}/tasks${query({ ...filters })}`,
      ),
    ),
  task: async (projectId: string, id: string) =>
    normalizeTask(await request<Task>(`/projects/${projectId}/tasks/${id}`)),
  createTask: async (projectId: string, body: Partial<Task>) =>
    normalizeTask(
      await request<Task>(`/projects/${projectId}/tasks`, {
        method: "POST",
        ...json(body),
      }),
    ),
  updateTask: async (projectId: string, id: string, body: Partial<Task>) =>
    normalizeTask(
      await request<Task>(`/projects/${projectId}/tasks/${id}`, {
        method: "PATCH",
        ...json(body),
      }),
    ),
  setTaskMilestone: async (
    projectId: string,
    id: string,
    milestoneId: string | null,
  ) =>
    normalizeTask(
      await request<Task>(`/projects/${projectId}/tasks/${id}/milestone`, {
        method: "PATCH",
        ...json({ milestoneId }),
      }),
    ),
  cloneTask: async (projectId: string, id: string) =>
    normalizeTask(
      await request<Task>(`/projects/${projectId}/tasks/${id}/clone`, {
        method: "POST",
      }),
    ),
  removeTask: (projectId: string, id: string) =>
    request<{ success: boolean }>(`/projects/${projectId}/tasks/${id}`, {
      method: "DELETE",
    }),
  archiveTask: async (projectId: string, id: string) =>
    normalizeTask(
      await request<Task>(`/projects/${projectId}/tasks/${id}/archive`, {
        method: "PATCH",
      }),
    ),
  unarchiveTask: async (projectId: string, id: string) =>
    normalizeTask(
      await request<Task>(`/projects/${projectId}/tasks/${id}/unarchive`, {
        method: "PATCH",
      }),
    ),
  flagTask: async (projectId: string, id: string) =>
    normalizeTask(
      await request<Task>(`/projects/${projectId}/tasks/${id}/flag`, {
        method: "PATCH",
      }),
    ),
  unflagTask: async (projectId: string, id: string) =>
    normalizeTask(
      await request<Task>(`/projects/${projectId}/tasks/${id}/unflag`, {
        method: "PATCH",
      }),
    ),
  assign: async (projectId: string, id: string, assigneeId: string | null) =>
    normalizeTask(
      await request<Task>(`/projects/${projectId}/tasks/${id}/assign`, {
        method: "PATCH",
        ...json({ assigneeId }),
      }),
    ),
  attachLabel: async (projectId: string, id: string, labelId: string) =>
    normalizeTask(
      await request<Task>(
        `/projects/${projectId}/tasks/${id}/labels/${labelId}`,
        { method: "POST" },
      ),
    ),
  detachLabel: async (projectId: string, id: string, labelId: string) =>
    normalizeTask(
      await request<Task>(
        `/projects/${projectId}/tasks/${id}/labels/${labelId}`,
        { method: "DELETE" },
      ),
    ),
  labels: async (workspaceId: string) =>
    normalizeList(
      await request<Page<Label> | Label[]>(`/workspace/${workspaceId}/labels`),
    ),
  createLabel: (workspaceId: string, body: { name: string; color: string }) =>
    request<Label>(`/workspace/${workspaceId}/labels`, {
      method: "POST",
      ...json(body),
    }),
  updateLabel: (
    workspaceId: string,
    id: string,
    body: Partial<Pick<Label, "name" | "color">>,
  ) =>
    request<Label>(`/workspace/${workspaceId}/labels/${id}`, {
      method: "PATCH",
      ...json(body),
    }),
  removeLabel: (workspaceId: string, id: string) =>
    request<{ success: boolean }>(`/workspace/${workspaceId}/labels/${id}`, {
      method: "DELETE",
    }),
  comments: async (taskId: string) =>
    normalizeList(
      await request<Page<Comment> | Comment[]>(`/tasks/${taskId}/comments`),
    ),
  createComment: (taskId: string, content: string) =>
    request<Comment>(`/tasks/${taskId}/comments`, {
      method: "POST",
      ...json({ content }),
    }),
  updateComment: (taskId: string, id: string, content: string) =>
    request<Comment>(`/tasks/${taskId}/comments/${id}`, {
      method: "PATCH",
      ...json({ content }),
    }),
  removeComment: (taskId: string, id: string) =>
    request<{ success: boolean }>(`/tasks/${taskId}/comments/${id}`, {
      method: "DELETE",
    }),
  checklistItems: async (taskId: string) =>
    normalizeList(
      await request<Page<ChecklistItem> | ChecklistItem[]>(
        `/tasks/${taskId}/checklist-items`,
      ),
    ),
  createChecklistItem: (taskId: string, body: { title: string; position?: number }) =>
    request<ChecklistItem>(`/tasks/${taskId}/checklist-items`, {
      method: "POST",
      ...json(body),
    }),
  updateChecklistItem: (
    taskId: string,
    id: string,
    body: Partial<Pick<ChecklistItem, "title" | "position" | "isCompleted">>,
  ) =>
    request<ChecklistItem>(`/tasks/${taskId}/checklist-items/${id}`, {
      method: "PATCH",
      ...json(body),
    }),
  removeChecklistItem: (taskId: string, id: string) =>
    request<{ success: boolean }>(`/tasks/${taskId}/checklist-items/${id}`, {
      method: "DELETE",
    }),
  toggleChecklistItem: (taskId: string, id: string, isCompleted: boolean) =>
    request<ChecklistItem>(`/tasks/${taskId}/checklist-items/${id}/toggle`, {
      method: "PATCH",
      ...json({ isCompleted }),
    }),
  watchers: async (taskId: string) =>
    normalizeList(
      await request<Page<TaskWatcher> | TaskWatcher[]>(
        `/tasks/${taskId}/watchers`,
      ),
    ),
  watchMe: (taskId: string) =>
    request<TaskWatcher>(`/tasks/${taskId}/watchers/me`, { method: "POST" }),
  unwatchMe: (taskId: string) =>
    request<{ success: boolean }>(`/tasks/${taskId}/watchers/me`, {
      method: "DELETE",
    }),
  addWatcher: (taskId: string, userId: string) =>
    request<TaskWatcher>(`/tasks/${taskId}/watchers/${userId}`, {
      method: "POST",
    }),
  removeWatcher: (taskId: string, userId: string) =>
    request<{ success: boolean }>(`/tasks/${taskId}/watchers/${userId}`, {
      method: "DELETE",
    }),
  activity: async (taskId: string) =>
    normalizeList(
      await request<Page<Activity> | Activity[]>(`/tasks/${taskId}/activity`),
    ),
  attachments: async (taskId: string) =>
    normalizeList(
      await request<Page<Attachment> | Attachment[]>(
        `/tasks/${taskId}/attachments`,
      ),
    ),
  uploadAttachment: (taskId: string, file: File) => {
    const body = new FormData();
    body.set("file", file);
    return request<Attachment>(`/tasks/${taskId}/attachments`, {
      method: "POST",
      body,
    });
  },
  removeAttachment: (taskId: string, id: string) =>
    request<{ success: boolean }>(`/tasks/${taskId}/attachments/${id}`, {
      method: "DELETE",
    }),
  attachmentUrl: (taskId: string, id: string) =>
    `${API_URL}/tasks/${taskId}/attachments/${id}/download`,
};
// TODO: Prefer HttpOnly refresh cookies after the backend contract supports them.
