import { fireEvent, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { tokenStorage } from "../../lib/token-storage";
import { makeAuth, makePage, makeWorkspace } from "../../test/fixtures";
import { apiUrl, server } from "../../test/server";
import { renderApp } from "../../test/render";

const fillLogin = (email: string, password: string) => {
  fireEvent.input(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.input(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
};

describe("auth flow", () => {
  it("redirects a signed-out visitor to the login page", async () => {
    renderApp("/");
    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
  });

  it("restores the session from a stored refresh token", async () => {
    localStorage.setItem("taskflow.refreshToken", "stored-refresh");
    renderApp("/");
    expect(
      await screen.findByRole("heading", { name: "Workspaces" }),
    ).toBeInTheDocument();
    expect(tokenStorage.getAccess()).toBe("access-token");
  });

  it("signs in and opens the workspaces page", async () => {
    renderApp("/login");
    await screen.findByRole("heading", { name: "Welcome back" });
    fillLogin("ada@example.com", "correct-password");
    expect(
      await screen.findByRole("heading", { name: "Workspaces" }),
    ).toBeInTheDocument();
    expect(tokenStorage.getRefresh()).toBe("refresh-token");
  });

  it("shows the API error when credentials are rejected", async () => {
    server.use(
      http.post(apiUrl("/auth/login"), () =>
        HttpResponse.json({ message: "Invalid credentials" }, { status: 401 }),
      ),
    );
    renderApp("/login");
    await screen.findByRole("heading", { name: "Welcome back" });
    fillLogin("ada@example.com", "wrong-password");
    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });

  it("signs out and returns to the login page", async () => {
    localStorage.setItem("taskflow.refreshToken", "stored-refresh");
    renderApp("/");
    fireEvent.click(await screen.findByRole("button", { name: /sign out/i }));
    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(tokenStorage.getRefresh()).toBeNull();
  });

  it("does not show cached data from the previous session after signing in again", async () => {
    localStorage.setItem("taskflow.refreshToken", "stored-refresh");
    renderApp("/");
    expect((await screen.findAllByText("Acme")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await screen.findByRole("heading", { name: "Welcome back" });

    server.use(
      http.get(apiUrl("/workspaces"), () =>
        HttpResponse.json(makePage([makeWorkspace({ name: "Beta Corp" })])),
      ),
    );
    fillLogin("grace@example.com", "correct-password");
    expect((await screen.findAllByText("Beta Corp")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
  });

  it("returns to the login page when the session can no longer be refreshed", async () => {
    localStorage.setItem("taskflow.refreshToken", "stored-refresh");
    let refreshCalls = 0;
    server.use(
      http.post(apiUrl("/auth/refresh"), () =>
        ++refreshCalls === 1
          ? HttpResponse.json(makeAuth())
          : HttpResponse.json({ message: "Expired" }, { status: 401 }),
      ),
      http.get(apiUrl("/workspaces"), () =>
        HttpResponse.json({ message: "Unauthorized" }, { status: 401 }),
      ),
    );
    renderApp("/");
    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(tokenStorage.getRefresh()).toBeNull();
  });
});

describe("sign out without the API", () => {
  it("ends the local session even when the logout request fails", async () => {
    localStorage.setItem("taskflow.refreshToken", "stored-refresh");
    server.use(
      http.post(apiUrl("/auth/logout"), () =>
        HttpResponse.json({ message: "Server down" }, { status: 500 }),
      ),
    );
    renderApp("/");
    fireEvent.click(await screen.findByRole("button", { name: /sign out/i }));
    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(tokenStorage.getRefresh()).toBeNull();
  });
});
