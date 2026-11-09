import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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

  it("shows the task details loaded for the open task", async () => {
    server.use(
      http.get(apiUrl("/projects/:projectId/tasks/:taskId"), () =>
        HttpResponse.json(
          makeTask({ description: "<p>Loaded from the details endpoint</p>" }),
        ),
      ),
    );
    renderApp(projectPath);
    fireEvent.click(await screen.findByText("Write docs"));
    const dialog = await screen.findByRole("dialog", { name: "Task details" });
    expect(
      await within(dialog).findByText("Loaded from the details endpoint"),
    ).toBeInTheDocument();
  });

  it("searches tasks once the user stops typing", async () => {
    const searches: string[] = [];
    server.use(
      http.get(apiUrl("/projects/:projectId/tasks"), ({ request }) => {
        searches.push(new URL(request.url).searchParams.get("search") ?? "");
        return HttpResponse.json(makePage([makeTask()]));
      }),
    );
    renderApp(projectPath);
    const search = await screen.findByPlaceholderText(/search/i);
    for (const value of ["d", "do", "doc", "docs"]) {
      fireEvent.change(search, { target: { value } });
    }
    await waitFor(() => expect(searches).toContain("docs"));
    expect(searches).toEqual(["", "docs"]);
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

describe("ProjectPage filters and keyboard access", () => {
  beforeEach(() => {
    localStorage.setItem("taskflow.refreshToken", "stored-refresh");
  });

  const recordTaskRequests = () => {
    const requests: { projectId: string; params: URLSearchParams }[] = [];
    server.use(
      http.get(apiUrl("/projects/:projectId/tasks"), ({ request, params }) => {
        requests.push({
          projectId: String(params.projectId),
          params: new URL(request.url).searchParams,
        });
        return HttpResponse.json(makePage([makeTask()]));
      }),
    );
    return requests;
  };

  it("keeps the selected filters in the URL", async () => {
    const requests = recordTaskRequests();
    const { router } = renderApp(projectPath);
    fireEvent.click(await screen.findByRole("button", { name: /statuses/i }));
    fireEvent.click(screen.getByLabelText("Done"));
    await waitFor(() =>
      expect(router.state.location.search).toBe("?statuses=DONE"),
    );
    await waitFor(() =>
      expect(requests.at(-1)?.params.get("statuses")).toBe("DONE"),
    );
  });

  it("applies filters from a shared link", async () => {
    const requests = recordTaskRequests();
    renderApp(`${projectPath}?statuses=TODO,IN_PROGRESS&q=docs`);
    await screen.findByText("Write docs");
    expect(requests[0].params.get("statuses")).toBe("TODO,IN_PROGRESS");
    expect(requests[0].params.get("search")).toBe("docs");
    expect(screen.getByPlaceholderText("Search tasks")).toHaveValue("docs");
  });

  it("restores the last active saved filter when the URL has no filters", async () => {
    localStorage.setItem("taskflow.activeSavedFilter.project-1", "saved-1");
    server.use(
      http.get(apiUrl("/projects/:projectId/saved-filters"), () =>
        HttpResponse.json([
          {
            id: "saved-1",
            name: "Bugs",
            projectId: "project-1",
            filters: { types: ["BUG"] },
          },
        ]),
      ),
    );
    const requests = recordTaskRequests();
    const { router } = renderApp(projectPath);
    expect(await screen.findByText("Bugs")).toBeInTheDocument();
    await waitFor(() =>
      expect(router.state.location.search).toBe("?types=BUG&view=saved-1"),
    );
    await waitFor(() =>
      expect(requests.at(-1)?.params.get("types")).toBe("BUG"),
    );
  });

  it("resets page state when switching to another project", async () => {
    localStorage.setItem("taskflow.activeSavedFilter.project-2", "saved-2");
    server.use(
      http.get(apiUrl("/projects/:projectId/saved-filters"), ({ params }) =>
        HttpResponse.json(
          params.projectId === "project-2"
            ? [
                {
                  id: "saved-2",
                  name: "High priority",
                  projectId: "project-2",
                  filters: { priorities: ["HIGH"] },
                },
              ]
            : [],
        ),
      ),
    );
    const requests = recordTaskRequests();
    const { router } = renderApp(projectPath);
    await screen.findByText("Write docs");
    await router.navigate("/workspaces/workspace-1/projects/project-2");
    // The saved filter of project-2 is restored, which requires fresh state.
    await waitFor(() =>
      expect(router.state.location.search).toBe(
        "?priorities=HIGH&view=saved-2",
      ),
    );
    await waitFor(() =>
      expect(
        requests.some(
          (item) =>
            item.projectId === "project-2" &&
            item.params.get("priorities") === "HIGH",
        ),
      ).toBe(true),
    );
  });

  it("opens a task with the keyboard and closes it with Escape", async () => {
    renderApp(projectPath);
    const card = (await screen.findByText("Write docs")).closest("article");
    expect(card).toHaveAttribute("tabindex", "0");
    card!.focus();
    fireEvent.keyDown(card!, { key: "Enter" });
    const dialog = await screen.findByRole("dialog", { name: "Task details" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Task details" }),
      ).not.toBeInTheDocument(),
    );
    expect(card).toHaveFocus();
  });
});
