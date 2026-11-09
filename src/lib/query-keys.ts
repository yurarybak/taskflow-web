// `*All` keys are prefixes: invalidating one hits every filter/page variant.
const projectsAll = (workspaceId: string) => ["projects", workspaceId] as const;
const taskTemplatesAll = (workspaceId: string) =>
  ["task-templates", workspaceId] as const;
const tasksAll = (projectId: string) => ["tasks", projectId] as const;
const taskExportsAll = (projectId: string) =>
  ["task-exports", projectId] as const;

export const keys = {
  workspaces: ["workspaces"] as const,
  workspace: (id: string) => ["workspace", id] as const,
  members: (id: string) => ["members", id] as const,
  taskTemplatesAll,
  taskTemplates: (workspaceId: string, filters: object = {}) =>
    [...taskTemplatesAll(workspaceId), filters] as const,
  taskTemplate: (workspaceId: string, id: string) =>
    ["task-template", workspaceId, id] as const,
  projectsAll,
  projects: (workspaceId: string, search = "") =>
    [...projectsAll(workspaceId), search] as const,
  milestones: (projectId: string) => ["milestones", projectId] as const,
  milestone: (projectId: string, id: string) =>
    ["milestone", projectId, id] as const,
  savedFilters: (projectId: string) => ["saved-filters", projectId] as const,
  savedFilter: (projectId: string, id: string) =>
    ["saved-filter", projectId, id] as const,
  notifications: (unreadOnly = false) => ["notifications", unreadOnly] as const,
  unreadNotifications: ["notifications", "unread-count"] as const,
  tasksAll,
  tasks: (projectId: string, filters: object = {}) =>
    [...tasksAll(projectId), filters] as const,
  task: (projectId: string, id: string) => ["task", projectId, id] as const,
  taskExportsAll,
  taskExports: (projectId: string, page = 1) =>
    [...taskExportsAll(projectId), page] as const,
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
