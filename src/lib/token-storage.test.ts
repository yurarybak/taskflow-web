import { beforeEach, describe, expect, it } from "vitest";
import { tokenStorage } from "./token-storage";

describe("tokenStorage", () => {
  beforeEach(() => tokenStorage.clear());

  it("keeps the access token in memory and refresh token in local storage", () => {
    tokenStorage.set("access", "refresh");
    expect(tokenStorage.getAccess()).toBe("access");
    expect(tokenStorage.getRefresh()).toBe("refresh");
    expect(localStorage.getItem("taskflow.refreshToken")).toBe("refresh");
  });

  it("clears both tokens", () => {
    tokenStorage.set("access", "refresh");
    tokenStorage.clear();
    expect(tokenStorage.getAccess()).toBeNull();
    expect(tokenStorage.getRefresh()).toBeNull();
  });
});
