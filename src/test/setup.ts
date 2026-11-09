import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { tokenStorage } from "../lib/token-storage";
import { server } from "./server";

// Pages are lazy-loaded; under a busy parallel run the first import of a page
// chunk can take longer than the default 1s of findBy*/waitFor.
configure({ asyncUtilTimeout: 5000 });

// jsdom has no layout engine. ProseMirror (Tiptap) measures ranges when it
// scrolls the selection into view, so give ranges empty geometry.
const emptyRects = Object.assign([], {
  item: () => null,
}) as unknown as DOMRectList;
const emptyRect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0 };
const stub = (target: object, name: string, value: unknown) => {
  if (!(name in target))
    Object.defineProperty(target, name, { configurable: true, value });
};
stub(Range.prototype, "getClientRects", () => emptyRects);
stub(Range.prototype, "getBoundingClientRect", () => ({
  ...emptyRect,
  width: 0,
  height: 0,
}));
stub(document, "elementFromPoint", () => null);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  tokenStorage.clear();
  localStorage.clear();
});
afterAll(() => server.close());
