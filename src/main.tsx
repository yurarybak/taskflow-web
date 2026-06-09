import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { App } from "./app";
import { AuthProvider } from "./features/auth/auth-provider";
import "./styles.css";
import "./board-dnd.css";
import "./task-filters.css";
import "./profile-avatar.css";
import "./task-details.css";
import "./task-modal.css";
import "./select-arrow.css";
import "./rich-text-editor.css";
import "./workspace-members.css";
import "./milestones.css";
const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, retry: 1 } },
});
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <AuthProvider>
        <App />
        <Toaster richColors position="bottom-right" />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
