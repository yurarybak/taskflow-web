import {
  Navigate,
  Outlet,
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import { AppShell } from "./app-shell";
import {
  ForgotPage,
  LoginPage,
  RegisterPage,
  ResetPage,
} from "./features/auth/auth-pages";
import { useAuth } from "./features/auth/auth-provider";
import { ProfilePage } from "./features/profile/profile-page";
import { ProjectPage } from "./features/tasks/project-page";
import {
  WorkspacePage,
  WorkspacesPage,
} from "./features/workspaces/workspace-pages";
import { Skeleton } from "./components/ui";

function Protected() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <main className="boot">
        <Skeleton rows={5} />
      </main>
    );
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
const router = createBrowserRouter([
  {
    element: <Protected />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <WorkspacesPage /> },
          { path: "/workspaces/:workspaceId", element: <WorkspacePage /> },
          {
            path: "/workspaces/:workspaceId/projects/:projectId",
            element: <ProjectPage />,
          },
          { path: "/profile", element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/forgot-password", element: <ForgotPage /> },
  { path: "/reset-password", element: <ResetPage /> },
]);
export function App() {
  return <RouterProvider router={router} />;
}
