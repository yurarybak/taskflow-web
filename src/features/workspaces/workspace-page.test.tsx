import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { apiUrl, server } from "../../test/server";
import { renderApp } from "../../test/render";

const workspacePath = "/workspaces/workspace-1";
const label = {
  id: "label-1",
  name: "Urgent",
  color: "#ff0000",
  workspaceId: "workspace-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("WorkspacePage", () => {
  beforeEach(() => {
    localStorage.setItem("taskflow.refreshToken", "stored-refresh");
  });

  it("clears a template description with null when editing", async () => {
    const template = {
      id: "template-1",
      name: "Bug report",
      title: "Bug: ",
      description: "Steps to reproduce",
      type: "BUG",
      priority: "HIGH",
      workspaceId: "workspace-1",
      labels: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    let sent: unknown;
    server.use(
      http.get(apiUrl("/workspaces/:workspaceId/task-templates"), () =>
        HttpResponse.json([template]),
      ),
      http.patch(
        apiUrl("/workspaces/:workspaceId/task-templates/:id"),
        async ({ request }) => {
          sent = await request.json();
          return HttpResponse.json({ ...template, description: null });
        },
      ),
    );
    renderApp(workspacePath);
    fireEvent.click(
      await screen.findByRole("button", { name: "Task templates" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Bug report" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Edit task template" });
    fireEvent.change(within(dialog).getByLabelText("Description"), {
      target: { value: "  " },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save template" }),
    );
    await waitFor(() =>
      expect(sent).toMatchObject({ name: "Bug report", description: null }),
    );
  });

  it("asks for confirmation before deleting a label", async () => {
    const deleted: string[] = [];
    server.use(
      http.get(apiUrl("/workspace/:workspaceId/labels"), () =>
        HttpResponse.json(deleted.length ? [] : [label]),
      ),
      http.delete(
        apiUrl("/workspace/:workspaceId/labels/:id"),
        ({ params }) => {
          deleted.push(String(params.id));
          return HttpResponse.json({ success: true });
        },
      ),
    );
    renderApp(workspacePath);
    fireEvent.click(await screen.findByRole("button", { name: "Labels" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete label Urgent" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Delete label?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(deleted).toEqual([]);

    fireEvent.click(
      screen.getByRole("button", { name: "Delete label Urgent" }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Delete label?" })).getByRole(
        "button",
        { name: "Delete" },
      ),
    );
    await waitFor(() => expect(deleted).toEqual(["label-1"]));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Delete label?" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("returns to the workspaces list in-app after deleting the workspace", async () => {
    server.use(
      http.delete(apiUrl("/workspaces/:workspaceId"), () =>
        HttpResponse.json({ success: true }),
      ),
    );
    const { router } = renderApp(workspacePath);
    fireEvent.click(
      await screen.findByRole("button", { name: "Workspace actions" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /delete workspace/i }));
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Delete workspace?" }),
      ).getByRole("button", { name: "Delete workspace" }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });
});
