import { fireEvent, screen, within } from "@testing-library/react";
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
