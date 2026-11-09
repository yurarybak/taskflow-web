import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { SavedTaskFilter } from "../../lib/types";
import { apiUrl, server } from "../../test/server";
import { renderApp } from "../../test/render";

const projectPath = "/workspaces/workspace-1/projects/project-1";
const bugs: SavedTaskFilter = {
  id: "saved-1",
  name: "Bugs",
  projectId: "project-1",
  userId: "user-1",
  filters: { types: ["BUG"] },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

/** In-memory saved filters endpoints for one project. */
const useSavedFilters = (initial: SavedTaskFilter[]) => {
  let saved = [...initial];
  const created: unknown[] = [];
  server.use(
    http.get(apiUrl("/projects/:projectId/saved-filters"), () =>
      HttpResponse.json(saved),
    ),
    http.post(
      apiUrl("/projects/:projectId/saved-filters"),
      async ({ request }) => {
        const body = (await request.json()) as Pick<
          SavedTaskFilter,
          "name" | "filters"
        >;
        created.push(body);
        const filter: SavedTaskFilter = {
          ...body,
          id: "saved-new",
          projectId: "project-1",
          userId: "user-1",
          createdAt: bugs.createdAt,
          updatedAt: bugs.updatedAt,
        };
        saved = [...saved, filter];
        return HttpResponse.json(filter);
      },
    ),
    http.delete(
      apiUrl("/projects/:projectId/saved-filters/:id"),
      ({ params }) => {
        saved = saved.filter((item) => item.id !== params.id);
        return HttpResponse.json({ success: true });
      },
    ),
  );
  return { created };
};

describe("TaskFiltersBar saved filters", () => {
  beforeEach(() => {
    localStorage.setItem("taskflow.refreshToken", "stored-refresh");
  });

  it("saves the current filters and makes them the active view", async () => {
    const { created } = useSavedFilters([]);
    const { router } = renderApp(`${projectPath}?statuses=DONE`);
    fireEvent.click(
      await screen.findByRole("button", { name: /saved filters/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /save current filter/i }),
    );
    const dialog = screen.getByRole("dialog", { name: "Save current filter" });
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Done work" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save filter" }),
    );
    await waitFor(() =>
      expect(created).toEqual([
        { name: "Done work", filters: { statuses: ["DONE"] } },
      ]),
    );
    await waitFor(() =>
      expect(router.state.location.search).toBe(
        "?statuses=DONE&view=saved-new",
      ),
    );
    expect(localStorage.getItem("taskflow.activeSavedFilter.project-1")).toBe(
      "saved-new",
    );
  });

  it("marks the active view as modified when the filters change", async () => {
    useSavedFilters([bugs]);
    renderApp(`${projectPath}?types=BUG&view=saved-1`);
    expect(await screen.findByText("Bugs")).toBeInTheDocument();
    expect(screen.queryByText(/\(modified\)/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /statuses/i }));
    fireEvent.click(screen.getByLabelText("Done"));
    expect(await screen.findByText(/\(modified\)/)).toBeInTheDocument();
  });

  it("clears the active view when its saved filter is deleted", async () => {
    useSavedFilters([bugs]);
    localStorage.setItem("taskflow.activeSavedFilter.project-1", "saved-1");
    const { router } = renderApp(`${projectPath}?types=BUG&view=saved-1`);
    fireEvent.click(
      await screen.findByRole("button", { name: /saved filters/i }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Delete Bugs" }));
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Delete saved filter?" }),
      ).getByRole("button", { name: "Delete filter" }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toBe("?types=BUG"),
    );
    expect(
      localStorage.getItem("taskflow.activeSavedFilter.project-1"),
    ).toBeNull();
  });
});
