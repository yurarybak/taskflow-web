import {
  MutationCache,
  QueryClient,
  type DefaultOptions,
} from "@tanstack/react-query";
import { toast } from "sonner";

export const errorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : "Something went wrong";

/**
 * Every mutation without its own `onError` reports failures with a toast, so a
 * failed request is never silent. A mutation that handles errors itself opts out.
 */
export const createQueryClient = (defaultOptions: DefaultOptions = {}) =>
  new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.options.onError) return;
        toast.error(errorMessage(error));
      },
    }),
    defaultOptions: {
      ...defaultOptions,
      queries: { staleTime: 20_000, retry: 1, ...defaultOptions.queries },
    },
  });
