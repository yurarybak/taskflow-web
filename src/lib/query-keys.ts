export const keys = {
  workspaces: ["workspaces"] as const,
  workspace: (id: string) => ["workspace", id] as const,
  members: (id: string) => ["members", id] as const,
  taskTemplates: (workspaceId: string, filters: object = {}) =>
    ["task-templates", workspaceId, filters] as const,
  taskTemplate: (workspaceId: string, id: string) =>
    ["task-template", workspaceId, id] as const,
  projects: (id: string, search = "") => ["projects", id, search] as const,
  milestones: (projectId: string) => ["milestones", projectId] as const,
  milestone: (projectId: string, id: string) =>
    ["milestone", projectId, id] as const,
  savedFilters: (projectId: string) => ["saved-filters", projectId] as const,
  savedFilter: (projectId: string, id: string) =>
    ["saved-filter", projectId, id] as const,
  notifications: (unreadOnly = false) =>
    ["notifications", unreadOnly] as const,
  unreadNotifications: ["notifications", "unread-count"] as const,
  tasks: (id: string, filters: object = {}) => ["tasks", id, filters] as const,
  task: (projectId: string, id: string) => ["task", projectId, id] as const,
  taskExports: (projectId: string, page = 1) =>
    ["task-exports", projectId, page] as const,
  taskExport: (projectId: string, id: string) =>
    ["task-export", projectId, id] as const,
  labels: (id: string) => ["labels", id] as const,
  comments: (id: string) => ["comments", id] as const,
  checklist: (id: string) => ["checklist", id] as const,
  worklogs: (projectId: string, taskId: string) =>
    ["worklogs", projectId, taskId] as const,
  worklog: (projectId: string, taskId: string, id: string) =>
    ["worklog", projectId, taskId, id] as const,
  watchers: (id: string) => ["watchers", id] as const,
  reminders: (id: string) => ["reminders", id] as const,
  activity: (id: string) => ["activity", id] as const,
  attachments: (id: string) => ["attachments", id] as const,
};
