import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { tokenStorage } from "../lib/token-storage";
import { server } from "./server";

// Pages are lazy-loaded; under a busy parallel run the first import of a page
// chunk can take longer than the default 1s of findBy*/waitFor.
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  tokenStorage.clear();
  localStorage.clear();
});
afterAll(() => server.close());
