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
});
