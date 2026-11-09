import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  makeAuth,
  makeMember,
  makePage,
  makeProject,
  makeTask,
  makeUser,
  makeWorkspace,
} from "./fixtures";

export const API_URL = "http://localhost:3000";
export const apiUrl = (path: string) => `${API_URL}${path}`;

const emptyPage = () => HttpResponse.json(makePage([]));

/**
 * Handlers for a signed-in user with one workspace, one project and one task.
 * Tests override individual endpoints with `server.use(...)`.
 */
export const defaultHandlers = [
  http.post(apiUrl("/auth/refresh"), () => HttpResponse.json(makeAuth())),
  http.post(apiUrl("/auth/login"), () => HttpResponse.json(makeAuth())),
  http.post(apiUrl("/auth/logout"), () => HttpResponse.json({ success: true })),
  http.get(apiUrl("/auth/me"), () => HttpResponse.json(makeUser())),
  http.get(apiUrl("/users/me"), () => HttpResponse.json(makeUser())),
  http.get(
    apiUrl("/users/:id/avatar"),
    () => new HttpResponse(null, { status: 404 }),
  ),
  http.get(apiUrl("/notifications"), emptyPage),
  http.get(apiUrl("/notifications/unread-count"), () =>
    HttpResponse.json({ count: 0 }),
  ),
  http.get(apiUrl("/workspaces"), () =>
    HttpResponse.json(makePage([makeWorkspace()])),
  ),
  http.get(apiUrl("/workspaces/:workspaceId"), () =>
    HttpResponse.json(makeWorkspace()),
  ),
  http.get(apiUrl("/workspaces/:workspaceId/members"), () =>
    HttpResponse.json([makeMember()]),
  ),
  http.get(apiUrl("/workspaces/:workspaceId/projects"), () =>
    HttpResponse.json(makePage([makeProject()])),
  ),
  http.get(apiUrl("/workspaces/:workspaceId/task-templates"), emptyPage),
  http.get(apiUrl("/workspace/:workspaceId/labels"), () =>
    HttpResponse.json([]),
  ),
  http.get(apiUrl("/projects/:projectId/milestones"), () =>
    HttpResponse.json([]),
  ),
  http.get(apiUrl("/projects/:projectId/saved-filters"), () =>
    HttpResponse.json([]),
  ),
  http.get(apiUrl("/projects/:projectId/task-exports"), emptyPage),
  http.get(apiUrl("/projects/:projectId/tasks"), () =>
    HttpResponse.json(makePage([makeTask()])),
  ),
  http.get(apiUrl("/projects/:projectId/tasks/:taskId"), () =>
    HttpResponse.json(makeTask()),
  ),
  http.get(apiUrl("/projects/:projectId/tasks/:taskId/worklogs"), emptyPage),
  http.get(apiUrl("/tasks/:taskId/comments"), emptyPage),
  http.get(apiUrl("/tasks/:taskId/activity"), emptyPage),
  http.get(apiUrl("/tasks/:taskId/checklist-items"), () =>
    HttpResponse.json([]),
  ),
  http.get(apiUrl("/tasks/:taskId/attachments"), () => HttpResponse.json([])),
  http.get(apiUrl("/tasks/:taskId/watchers"), () => HttpResponse.json([])),
  http.get(apiUrl("/tasks/:taskId/reminders"), () => HttpResponse.json([])),
];

export const server = setupServer(...defaultHandlers);
