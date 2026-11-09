import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { routes } from "../app";
import { AuthProvider } from "../features/auth/auth-provider";
import { createQueryClient } from "../lib/query-client";

export const createTestQueryClient = () =>
  createQueryClient({
    queries: { retry: false, staleTime: Infinity },
    mutations: { retry: false },
  });

/** Renders the real route tree at `path` with fresh providers. */
export function renderApp(path = "/") {
  const client = createTestQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...view, client, router };
}
