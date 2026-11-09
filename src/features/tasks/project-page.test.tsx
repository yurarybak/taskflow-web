import { fireEvent, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { makePage, makeTask } from "../../test/fixtures";
import { apiUrl, server } from "../../test/server";
import { renderApp } from "../../test/render";

const projectPath = "/workspaces/workspace-1/projects/project-1";

describe("ProjectPage", () => {
  beforeEach(() => {
    localStorage.setItem("taskflow.refreshToken", "stored-refresh");
  });

  it("renders tasks on the board", async () => {
    server.use(
      http.get(apiUrl("/projects/:projectId/tasks"), () =>
        HttpResponse.json(
          makePage([
            makeTask({ id: "task-1", title: "Write docs", status: "TODO" }),
            makeTask({ id: "task-2", title: "Ship it", status: "DONE" }),
          ]),
        ),
      ),
    );
    renderApp(projectPath);
    expect(await screen.findByText("Write docs")).toBeInTheDocument();
    expect(screen.getByText("Ship it")).toBeInTheDocument();
  });

  it("opens the task details dialog when a task is clicked", async () => {
    renderApp(projectPath);
    fireEvent.click(await screen.findByText("Write docs"));
    const dialog = await screen.findByRole("dialog", { name: "Task details" });
    expect(within(dialog).getByText("Write docs")).toBeInTheDocument();
  });

  it("renders a task description without executable markup", async () => {
    const description =
      "<p>Hello <b>team</b></p><img src=x onerror=window.__xss=1>";
    server.use(
      http.get(apiUrl("/projects/:projectId/tasks"), () =>
        HttpResponse.json(makePage([makeTask({ description })])),
      ),
    );
    renderApp(projectPath);
    fireEvent.click(await screen.findByText("Write docs"));
    const dialog = await screen.findByRole("dialog", { name: "Task details" });
    const rendered = within(dialog).getByText("team").closest("div");
    expect(within(dialog).getByText("team").tagName).toBe("B");
    expect(rendered?.querySelector("img")).toBeNull();
    expect(dialog.innerHTML).not.toContain("onerror");
  });

  it("loads the next page of tasks on request", async () => {
    server.use(
      http.get(apiUrl("/projects/:projectId/tasks"), ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        const task =
          page === 2
            ? makeTask({ id: "task-2", title: "Second page task" })
            : makeTask({ id: "task-1", title: "First page task" });
        return HttpResponse.json(
          makePage([task], { page, limit: 1, total: 2, totalPages: 2 }),
        );
      }),
    );
    renderApp(projectPath);
    expect(await screen.findByText("First page task")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 2 tasks")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more tasks" }));
    expect(await screen.findByText("Second page task")).toBeInTheDocument();
    expect(screen.getByText("First page task")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Load more tasks" }),
    ).not.toBeInTheDocument();
  });
});
