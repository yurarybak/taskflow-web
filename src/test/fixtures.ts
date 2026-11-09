import type {
  AuthResponse,
  Member,
  Page,
  Project,
  Task,
  User,
  Workspace,
} from "../lib/types";

const timestamp = "2026-01-01T00:00:00.000Z";

export const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  ...overrides,
});

export const makeAuth = (overrides: Partial<AuthResponse> = {}) => ({
  accessToken: "access-token",
  refreshToken: "refresh-token",
  user: makeUser(),
  ...overrides,
});

export const makeWorkspace = (
  overrides: Partial<Workspace> = {},
): Workspace => ({
  id: "workspace-1",
  name: "Acme",
  ownerId: "user-1",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...overrides,
});

export const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: "project-1",
  name: "Website",
  workspaceId: "workspace-1",
  createdAt: timestamp,
  updatedAt: timestamp,
  ...overrides,
});

export const makeMember = (overrides: Partial<Member> = {}): Member => ({
  id: "member-1",
  workspaceId: "workspace-1",
  userId: "user-1",
  role: "OWNER",
  createdAt: timestamp,
  updatedAt: timestamp,
  user: makeUser(),
  ...overrides,
});

export const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  title: "Write docs",
  status: "TODO",
  priority: "MEDIUM",
  type: "TASK",
  projectId: "project-1",
  creatorId: "user-1",
  labels: [],
  createdAt: timestamp,
  updatedAt: timestamp,
  ...overrides,
});

export const makePage = <T>(
  data: T[],
  meta: Partial<Page<T>["meta"]> = {},
): Page<T> => ({
  data,
  meta: { page: 1, limit: 10, total: data.length, totalPages: 1, ...meta },
});
