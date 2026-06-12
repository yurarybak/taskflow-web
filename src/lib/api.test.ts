import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import { tokenStorage } from "./token-storage";

const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("api authentication", () => {
  beforeEach(() => tokenStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("stores a refreshed session during bootstrap", async () => {
    tokenStorage.set("old", "refresh-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { accessToken: "new-access", refreshToken: "new-refresh", user: { id: "1", email: "me@example.com" } })));
    expect(await api.bootstrap()).toBe(true);
    expect(tokenStorage.getAccess()).toBe("new-access");
    expect(tokenStorage.getRefresh()).toBe("new-refresh");
  });

  it("clears the session when refresh is rejected", async () => {
    tokenStorage.set("old", "invalid");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(401, { message: "Invalid refresh token" })));
    expect(await api.bootstrap()).toBe(false);
    expect(tokenStorage.getAccess()).toBeNull();
    expect(tokenStorage.getRefresh()).toBeNull();
  });

  it("normalizes an array workspace response for the UI", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, [{ id: "workspace-1", name: "Personal" }])));
    await expect(api.workspaces()).resolves.toEqual({
      data: [{ id: "workspace-1", name: "Personal" }],
      meta: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });
  });

  it("adds an empty labels collection to tasks without labels", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, [{ id: "task-1", title: "Review API" }])));
    await expect(api.tasks("project-1")).resolves.toMatchObject({
      data: [{ id: "task-1", title: "Review API", labels: [] }],
    });
  });

  it("serializes assignee filters as a comma-separated query value", async () => {
    const fetch = vi.fn().mockResolvedValue(response(200, []));
    vi.stubGlobal("fetch", fetch);
    await api.tasks("project-1", { assigneeIds: ["user-1", "user-2"] });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/projects/project-1/tasks?assigneeIds=user-1%2Cuser-2",
      expect.any(Object),
    );
  });

  it("serializes multi-value task filters with plural keys", async () => {
    const fetch = vi.fn().mockResolvedValue(response(200, []));
    vi.stubGlobal("fetch", fetch);
    await api.tasks("project-1", {
      statuses: ["TODO", "DONE"],
      priorities: ["LOW", "HIGH"],
      types: ["TASK", "BUG"],
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/projects/project-1/tasks?statuses=TODO%2CDONE&priorities=LOW%2CHIGH&types=TASK%2CBUG",
      expect.any(Object),
    );
  });

  it("serializes milestone task filters", async () => {
    const fetch = vi.fn().mockResolvedValue(response(200, []));
    vi.stubGlobal("fetch", fetch);
    await api.tasks("project-1", {
      milestoneIds: ["milestone-1", "milestone-2"],
      withoutMilestone: true,
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/projects/project-1/tasks?milestoneIds=milestone-1%2Cmilestone-2&withoutMilestone=true",
      expect.any(Object),
    );
  });

  it("calls task archive and unarchive endpoints", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, { id: "task-1", labels: [], archivedAt: "2026-06-04T10:00:00.000Z" }))
      .mockResolvedValueOnce(response(200, { id: "task-1", labels: [], archivedAt: null }));
    vi.stubGlobal("fetch", fetch);
    await api.archiveTask("project-1", "task-1");
    await api.unarchiveTask("project-1", "task-1");
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/projects/project-1/tasks/task-1/archive",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/projects/project-1/tasks/task-1/unarchive",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("calls task flag and unflag endpoints", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, { id: "task-1", labels: [], flaggedAt: "2026-06-04T10:00:00.000Z" }))
      .mockResolvedValueOnce(response(200, { id: "task-1", labels: [], flaggedAt: null }));
    vi.stubGlobal("fetch", fetch);
    await api.flagTask("project-1", "task-1");
    await api.unflagTask("project-1", "task-1");
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/projects/project-1/tasks/task-1/flag",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/projects/project-1/tasks/task-1/unflag",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("calls the task clone endpoint", async () => {
    const fetch = vi.fn().mockResolvedValue(response(200, { id: "task-copy", labels: [] }));
    vi.stubGlobal("fetch", fetch);
    await api.cloneTask("project-1", "task-1");
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/projects/project-1/tasks/task-1/clone",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls checklist item endpoints", async () => {
    const item = {
      id: "item-1",
      taskId: "task-1",
      title: "Write tests",
      isCompleted: false,
      position: 0,
      createdAt: "2026-06-04T10:00:00.000Z",
      updatedAt: "2026-06-04T10:00:00.000Z",
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, [item]))
      .mockResolvedValueOnce(response(200, item))
      .mockResolvedValueOnce(response(200, { ...item, title: "Write more tests" }))
      .mockResolvedValueOnce(response(200, { ...item, isCompleted: true }))
      .mockResolvedValueOnce(response(200, { success: true }));
    vi.stubGlobal("fetch", fetch);
    await api.checklistItems("task-1");
    await api.createChecklistItem("task-1", { title: "Write tests", position: 0 });
    await api.updateChecklistItem("task-1", "item-1", { title: "Write more tests" });
    await api.toggleChecklistItem("task-1", "item-1", true);
    await api.removeChecklistItem("task-1", "item-1");
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/tasks/task-1/checklist-items",
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/tasks/task-1/checklist-items",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "http://localhost:3000/tasks/task-1/checklist-items/item-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "http://localhost:3000/tasks/task-1/checklist-items/item-1/toggle",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      5,
      "http://localhost:3000/tasks/task-1/checklist-items/item-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("calls task watcher endpoints", async () => {
    const watcher = { userId: "user-1", user: { id: "user-1", email: "one@example.com" } };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, [watcher]))
      .mockResolvedValueOnce(response(200, watcher))
      .mockResolvedValueOnce(response(200, { success: true }))
      .mockResolvedValueOnce(response(200, { userId: "user-2" }))
      .mockResolvedValueOnce(response(200, { success: true }));
    vi.stubGlobal("fetch", fetch);
    await api.watchers("task-1");
    await api.watchMe("task-1");
    await api.unwatchMe("task-1");
    await api.addWatcher("task-1", "user-2");
    await api.removeWatcher("task-1", "user-2");
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/tasks/task-1/watchers",
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/tasks/task-1/watchers/me",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "http://localhost:3000/tasks/task-1/watchers/me",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "http://localhost:3000/tasks/task-1/watchers/user-2",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      5,
      "http://localhost:3000/tasks/task-1/watchers/user-2",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("calls task reminder endpoints", async () => {
    const reminder = {
      id: "reminder-1",
      taskId: "task-1",
      userId: "user-1",
      remindAt: "2026-06-12T10:30:00.000Z",
      sentAt: null,
      createdAt: "2026-06-12T09:00:00.000Z",
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, [reminder]))
      .mockResolvedValueOnce(response(200, reminder))
      .mockResolvedValueOnce(response(200, { ...reminder, remindAt: "2026-06-12T11:00:00.000Z" }))
      .mockResolvedValueOnce(response(200, { success: true }));
    vi.stubGlobal("fetch", fetch);
    await api.reminders("task-1");
    await api.createReminder("task-1", "2026-06-12T10:30:00.000Z");
    await api.updateReminder("task-1", "reminder-1", "2026-06-12T11:00:00.000Z");
    await api.removeReminder("task-1", "reminder-1");
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/tasks/task-1/reminders",
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/tasks/task-1/reminders",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ remindAt: "2026-06-12T10:30:00.000Z" }),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "http://localhost:3000/tasks/task-1/reminders/reminder-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ remindAt: "2026-06-12T11:00:00.000Z" }),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "http://localhost:3000/tasks/task-1/reminders/reminder-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("calls milestone endpoints", async () => {
    const milestone = {
      id: "milestone-1",
      name: "MVP",
      projectId: "project-1",
      completedAt: null,
      createdAt: "2026-06-04T10:00:00.000Z",
      updatedAt: "2026-06-04T10:00:00.000Z",
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, [milestone]))
      .mockResolvedValueOnce(response(200, milestone))
      .mockResolvedValueOnce(response(200, milestone))
      .mockResolvedValueOnce(response(200, { ...milestone, name: "MVP 2" }))
      .mockResolvedValueOnce(response(200, { ...milestone, completedAt: "2026-06-05T10:00:00.000Z" }))
      .mockResolvedValueOnce(response(200, { ...milestone, completedAt: null }))
      .mockResolvedValueOnce(response(200, { success: true }));
    vi.stubGlobal("fetch", fetch);
    await api.milestones("project-1");
    await api.milestone("project-1", "milestone-1");
    await api.createMilestone("project-1", { name: "MVP" });
    await api.updateMilestone("project-1", "milestone-1", { name: "MVP 2" });
    await api.completeMilestone("project-1", "milestone-1");
    await api.reopenMilestone("project-1", "milestone-1");
    await api.removeMilestone("project-1", "milestone-1");
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/projects/project-1/milestones",
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/projects/project-1/milestones/milestone-1",
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "http://localhost:3000/projects/project-1/milestones",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "http://localhost:3000/projects/project-1/milestones/milestone-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      5,
      "http://localhost:3000/projects/project-1/milestones/milestone-1/complete",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      6,
      "http://localhost:3000/projects/project-1/milestones/milestone-1/reopen",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      7,
      "http://localhost:3000/projects/project-1/milestones/milestone-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("calls saved filter endpoints", async () => {
    const savedFilter = {
      id: "filter-1",
      name: "High bugs",
      filters: { priorities: ["HIGH"], types: ["BUG"] },
      projectId: "project-1",
      userId: "user-1",
      createdAt: "2026-06-08T10:00:00.000Z",
      updatedAt: "2026-06-08T10:00:00.000Z",
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, [savedFilter]))
      .mockResolvedValueOnce(response(200, savedFilter))
      .mockResolvedValueOnce(response(200, savedFilter))
      .mockResolvedValueOnce(response(200, { ...savedFilter, name: "Bugs" }))
      .mockResolvedValueOnce(response(200, { success: true }));
    vi.stubGlobal("fetch", fetch);
    await api.savedFilters("project-1");
    await api.savedFilter("project-1", "filter-1");
    await api.createSavedFilter("project-1", {
      name: "High bugs",
      filters: { priorities: ["HIGH"], types: ["BUG"] },
    });
    await api.updateSavedFilter("project-1", "filter-1", { name: "Bugs" });
    await api.removeSavedFilter("project-1", "filter-1");
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/projects/project-1/saved-filters",
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/projects/project-1/saved-filters/filter-1",
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "http://localhost:3000/projects/project-1/saved-filters",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "http://localhost:3000/projects/project-1/saved-filters/filter-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      5,
      "http://localhost:3000/projects/project-1/saved-filters/filter-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("sets a task milestone", async () => {
    const task = {
      id: "task-1",
      title: "Task",
      status: "TODO",
      priority: "MEDIUM",
      type: "TASK",
      labels: [],
      milestoneId: "milestone-1",
    };
    const fetch = vi.fn().mockResolvedValue(response(200, task));
    vi.stubGlobal("fetch", fetch);
    await api.setTaskMilestone("project-1", "task-1", "milestone-1");
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/projects/project-1/tasks/task-1/milestone",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ milestoneId: "milestone-1" }),
      }),
    );
  });

  it("calls worklog endpoints", async () => {
    const worklog = {
      id: "worklog-1",
      timeSpentMinutes: 120,
      description: "Implemented service",
      startedAt: "2026-06-08T10:00:00.000Z",
      taskId: "task-1",
      authorId: "user-1",
      author: { id: "user-1", email: "me@example.com" },
      createdAt: "2026-06-08T10:00:00.000Z",
      updatedAt: "2026-06-08T10:00:00.000Z",
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, [worklog]))
      .mockResolvedValueOnce(response(200, worklog))
      .mockResolvedValueOnce(response(200, worklog))
      .mockResolvedValueOnce(response(200, { ...worklog, timeSpentMinutes: 90 }))
      .mockResolvedValueOnce(response(200, { success: true }));
    vi.stubGlobal("fetch", fetch);
    await api.worklogs("project-1", "task-1");
    await api.worklog("project-1", "task-1", "worklog-1");
    await api.createWorklog("project-1", "task-1", {
      timeSpentMinutes: 120,
      description: "Implemented service",
      startedAt: "2026-06-08T10:00:00.000Z",
      remainingEstimateMinutes: 240,
    });
    await api.updateWorklog("project-1", "task-1", "worklog-1", {
      timeSpentMinutes: 90,
    });
    await api.removeWorklog("project-1", "task-1", "worklog-1");
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/projects/project-1/tasks/task-1/worklogs",
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/projects/project-1/tasks/task-1/worklogs/worklog-1",
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "http://localhost:3000/projects/project-1/tasks/task-1/worklogs",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "http://localhost:3000/projects/project-1/tasks/task-1/worklogs/worklog-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      5,
      "http://localhost:3000/projects/project-1/tasks/task-1/worklogs/worklog-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("serializes worklog pagination", async () => {
    const fetch = vi.fn().mockResolvedValue(response(200, {
      data: [],
      meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
    }));
    vi.stubGlobal("fetch", fetch);
    await api.worklogs("project-1", "task-1", { page: 2, limit: 10 });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/projects/project-1/tasks/task-1/worklogs?page=2&limit=10",
      expect.any(Object),
    );
  });

  it("keeps paginated comments metadata for infinite scroll", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, {
      data: [{ id: "comment-1", content: "Looks good" }],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    })));
    await expect(api.comments("task-1")).resolves.toEqual({
      data: [{ id: "comment-1", content: "Looks good" }],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
  });

  it("serializes comments pagination", async () => {
    const fetch = vi.fn().mockResolvedValue(response(200, {
      data: [],
      meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
    }));
    vi.stubGlobal("fetch", fetch);
    await api.comments("task-1", { page: 2, limit: 10 });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/tasks/task-1/comments?page=2&limit=10",
      expect.any(Object),
    );
  });

  it("serializes activity pagination", async () => {
    const fetch = vi.fn().mockResolvedValue(response(200, {
      data: [],
      meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
    }));
    vi.stubGlobal("fetch", fetch);
    await api.activity("task-1", { page: 2, limit: 10 });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/tasks/task-1/activity?page=2&limit=10",
      expect.any(Object),
    );
  });

  it("calls notification endpoints", async () => {
    const notification = {
      id: "notification-1",
      type: "TASK_ASSIGNED",
      title: "You were assigned to a task",
      message: "Task: Implement auth flow",
      data: { workspaceId: "workspace-1", projectId: "project-1" },
      readAt: null,
      userId: "user-1",
      createdAt: "2026-06-09T10:00:00.000Z",
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, {
        data: [notification],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }))
      .mockResolvedValueOnce(response(200, { count: 1 }))
      .mockResolvedValueOnce(response(200, { ...notification, readAt: "2026-06-09T10:01:00.000Z" }))
      .mockResolvedValueOnce(response(200, { success: true }))
      .mockResolvedValueOnce(response(200, { success: true }));
    vi.stubGlobal("fetch", fetch);
    await api.notifications({ page: 1, limit: 10, unreadOnly: true });
    await api.unreadNotifications();
    await api.markNotificationRead("notification-1");
    await api.markAllNotificationsRead();
    await api.removeNotification("notification-1");
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/notifications?page=1&limit=10&unreadOnly=true",
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/notifications/unread-count",
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "http://localhost:3000/notifications/notification-1/read",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "http://localhost:3000/notifications/read-all",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      5,
      "http://localhost:3000/notifications/notification-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("builds the public user avatar route", () => {
    expect(api.avatarUrl("user-1")).toBe("http://localhost:3000/users/user-1/avatar");
  });
});
