import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Attachment } from "../../../lib/types";
import { makeTask } from "../../../test/fixtures";
import { apiUrl, server } from "../../../test/server";
import { renderApp } from "../../../test/render";

const projectPath = "/workspaces/workspace-1/projects/project-1";
const attachment: Attachment = {
  id: "attachment-1",
  originalName: "spec.pdf",
  mimeType: "application/pdf",
  size: 2048,
  taskId: "task-1",
  uploaderId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const openTask = async () => {
  renderApp(projectPath);
  fireEvent.click(await screen.findByText("Write docs"));
  return screen.findByRole("dialog", { name: "Task details" });
};

describe("TaskModal attachments", () => {
  beforeEach(() => {
    localStorage.setItem("taskflow.refreshToken", "stored-refresh");
    server.use(
      http.get(apiUrl("/tasks/:taskId/attachments"), () =>
        HttpResponse.json([attachment]),
      ),
    );
  });
  // jsdom lacks object URLs, so the download test defines them; restore the
  // original properties (usually "not defined") afterwards.
  const urlMethods = ["createObjectURL", "revokeObjectURL"] as const;
  const originals = urlMethods.map((name) =>
    Object.getOwnPropertyDescriptor(URL, name),
  );
  afterEach(() => {
    vi.restoreAllMocks();
    urlMethods.forEach((name, index) => {
      const descriptor = originals[index];
      if (descriptor) Object.defineProperty(URL, name, descriptor);
      else Reflect.deleteProperty(URL, name);
    });
  });

  it("downloads an attachment with the access token", async () => {
    let authorization: string | null = null;
    server.use(
      http.get(
        apiUrl("/tasks/:taskId/attachments/:id/download"),
        ({ request }) => {
          authorization = request.headers.get("Authorization");
          return new HttpResponse("%PDF", {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": 'attachment; filename="spec.pdf"',
            },
          });
        },
      ),
    );
    const createObjectURL = vi.fn(() => "blob:spec");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    const dialog = await openTask();
    fireEvent.click(
      await within(dialog).findByRole("button", { name: "Download spec.pdf" }),
    );
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(authorization).toBe("Bearer access-token");
    expect(createObjectURL).toHaveBeenCalled();
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      "spec.pdf",
    );
  });

  it("rejects a file type the API does not accept before uploading", async () => {
    let uploads = 0;
    server.use(
      http.post(apiUrl("/tasks/:taskId/attachments"), () => {
        uploads += 1;
        return HttpResponse.json(attachment);
      }),
    );
    const dialog = await openTask();
    const input = within(dialog).getByLabelText(/upload file/i);
    fireEvent.change(input, {
      target: {
        files: [
          new File(["x"], "script.exe", { type: "application/x-msdownload" }),
        ],
      },
    });
    expect(await screen.findByText(/upload a pdf, jpeg/i)).toBeInTheDocument();
    expect(uploads).toBe(0);
  });
});

describe("TaskModal dropdowns", () => {
  beforeEach(() => {
    localStorage.setItem("taskflow.refreshToken", "stored-refresh");
  });

  it("closes an open dropdown on Escape and keeps the modal open", async () => {
    const dialog = await openTask();
    fireEvent.click(within(dialog).getByRole("button", { name: "Medium" }));
    expect(
      within(dialog).getByRole("button", { name: "High" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(
      within(dialog).queryByRole("button", { name: "High" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Task details" }),
    ).toBeInTheDocument();
  });
});

describe("TaskModal description", () => {
  beforeEach(() => {
    localStorage.setItem("taskflow.refreshToken", "stored-refresh");
  });

  it("edits the description with the rich text editor and saves its HTML", async () => {
    let sent: { description?: string } | undefined;
    server.use(
      http.get(apiUrl("/projects/:projectId/tasks/:taskId"), () =>
        HttpResponse.json(
          makeTask({ description: "<p><b>Steps</b> to reproduce</p>" }),
        ),
      ),
      http.patch(
        apiUrl("/projects/:projectId/tasks/:taskId"),
        async ({ request }) => {
          sent = (await request.json()) as { description?: string };
          return HttpResponse.json(makeTask({ description: sent.description }));
        },
      ),
    );
    const dialog = await openTask();
    fireEvent.click(
      await within(dialog).findByText("to reproduce", { exact: false }),
    );
    const editor = await within(dialog).findByRole("textbox", {
      name: "Add a description...",
    });
    expect(within(editor).getByText("Steps").tagName).toBe("STRONG");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Bullet list" }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(sent?.description).toBe(
        "<ul><li><p><strong>Steps</strong> to reproduce</p></li></ul>",
      ),
    );
  });

  it("clears the description with null, since the API rejects an empty string", async () => {
    let sent: unknown;
    server.use(
      http.patch(
        apiUrl("/projects/:projectId/tasks/:taskId"),
        async ({ request }) => {
          sent = await request.json();
          return HttpResponse.json(makeTask({ description: null }));
        },
      ),
    );
    const dialog = await openTask();
    fireEvent.click(await within(dialog).findByText("Add a description..."));
    await within(dialog).findByRole("textbox", {
      name: "Add a description...",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sent).toEqual({ description: null }));
  });

  it("cancels the description edit on Escape and keeps the modal open", async () => {
    const dialog = await openTask();
    fireEvent.click(await within(dialog).findByText("Add a description..."));
    const editor = await within(dialog).findByRole("textbox", {
      name: "Add a description...",
    });
    fireEvent.keyDown(editor, { key: "Escape" });
    await waitFor(() =>
      expect(
        within(dialog).queryByRole("textbox", {
          name: "Add a description...",
        }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("dialog", { name: "Task details" }),
    ).toBeInTheDocument();
  });
});
