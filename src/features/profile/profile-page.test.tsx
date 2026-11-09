import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { makeUser } from "../../test/fixtures";
import { apiUrl, server } from "../../test/server";
import { renderApp } from "../../test/render";

const sidebar = () => screen.getByRole("complementary");

describe("ProfilePage", () => {
  beforeEach(() => {
    localStorage.setItem("taskflow.refreshToken", "stored-refresh");
  });

  it("shows the signed-in user's name from the restored session", async () => {
    renderApp("/profile");
    expect(await screen.findByLabelText("First name")).toHaveValue("Ada");
    expect(within(sidebar()).getByText("Ada")).toBeInTheDocument();
  });

  it("reloads the sidebar avatar after uploading a new one", async () => {
    server.use(
      http.post(apiUrl("/users/me/avatar"), () =>
        HttpResponse.json({
          avatarUrl: "http://localhost:3000/users/1/avatar",
        }),
      ),
    );
    renderApp("/profile");
    const sidebarAvatar = () =>
      sidebar().querySelector("img.avatar")?.getAttribute("src");
    await screen.findByLabelText("First name");
    expect(sidebarAvatar()).toMatch(/\/avatar$/);
    const fileInput = screen
      .getByLabelText("Change avatar")
      .querySelector("input[type=file]");
    if (!fileInput) throw new Error("Avatar file input not found");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["png"], "me.png", { type: "image/png" })],
      },
    });
    await waitFor(() => expect(sidebarAvatar()).toMatch(/\/avatar\?v=1$/));
  });

  it("updates the sidebar after saving the profile", async () => {
    let sentBody: unknown;
    server.use(
      http.patch(apiUrl("/users/me"), async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json(
          makeUser({ firstName: "Grace", lastName: "Hopper" }),
        );
      }),
    );
    renderApp("/profile");
    fireEvent.change(await screen.findByLabelText("First name"), {
      target: { value: "Grace" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Hopper" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await within(sidebar()).findByText("Grace")).toBeInTheDocument();
    expect(sentBody).toEqual({ firstName: "Grace", lastName: "Hopper" });
  });
});
