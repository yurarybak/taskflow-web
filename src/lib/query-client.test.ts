import { MutationObserver } from "@tanstack/react-query";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "./query-client";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const runFailingMutation = async (onError?: () => void) => {
  const client = createQueryClient({ mutations: { retry: false } });
  const observer = new MutationObserver(client, {
    mutationFn: () => Promise.reject(new Error("Request failed")),
    onError,
  });
  await observer.mutate().catch(() => undefined);
};

describe("createQueryClient", () => {
  afterEach(() => vi.mocked(toast.error).mockClear());

  it("shows a toast for a failed mutation without its own onError", async () => {
    await runFailingMutation();
    expect(toast.error).toHaveBeenCalledWith("Request failed");
  });

  it("leaves error reporting to a mutation that handles errors itself", async () => {
    const onError = vi.fn();
    await runFailingMutation(onError);
    expect(onError).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
