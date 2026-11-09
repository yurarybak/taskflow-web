import { lazy, Suspense } from "react";
import {
  Navigate,
  Outlet,
  createBrowserRouter,
  RouterProvider,
  type RouteObject,
} from "react-router-dom";
import { AppShell } from "./app-shell";
import { useAuth } from "./features/auth/auth-provider";
import { Skeleton } from "./components/ui";

// Every page is code-split. Signed-in pages suspend inside AppShell (the
// sidebar stays visible); public pages use the full-screen boot skeleton.
const authPage = (
  name: "LoginPage" | "RegisterPage" | "ForgotPage" | "ResetPage",
) =>
  lazy(() =>
    import("./features/auth/auth-pages").then((module) => ({
      default: module[name],
    })),
  );
const LoginPage = authPage("LoginPage");
const RegisterPage = authPage("RegisterPage");
const ForgotPage = authPage("ForgotPage");
const ResetPage = authPage("ResetPage");
const ProfilePage = lazy(() =>
  import("./features/profile/profile-page").then((module) => ({
    default: module.ProfilePage,
  })),
);
const ProjectPage = lazy(() =>
  import("./features/tasks/project-page").then((module) => ({
    default: module.ProjectPage,
  })),
);
const WorkspacePage = lazy(() =>
  import("./features/workspaces/workspace-page").then((module) => ({
    default: module.WorkspacePage,
  })),
);
const WorkspacesPage = lazy(() =>
  import("./features/workspaces/workspaces-page").then((module) => ({
    default: module.WorkspacesPage,
  })),
);

const bootSkeleton = (
  <main className="boot">
    <Skeleton rows={5} />
  </main>
);
function Protected() {
  const { user, loading } = useAuth();
  if (loading) return bootSkeleton;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
function PublicPages() {
  return (
    <Suspense fallback={bootSkeleton}>
      <Outlet />
    </Suspense>
  );
}
export const routes: RouteObject[] = [
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
  {
    element: <PublicPages />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/forgot-password", element: <ForgotPage /> },
      { path: "/reset-password", element: <ResetPage /> },
    ],
  },
];
const router = createBrowserRouter(routes);
export function App() {
  return <RouterProvider router={router} />;
}
