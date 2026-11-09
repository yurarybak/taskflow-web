# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server on http://localhost:5173
npm run build     # tsc -b (type check) + vite build
npm run lint      # eslint with --max-warnings=0, so any warning fails
npm run test      # vitest run (jsdom)

npx vitest run src/lib/api.test.ts             # one test file
npx vitest run src/lib/api.test.ts -t "bootstrap"  # tests whose name matches
npx prettier --write <files>                    # no npm script; config in .prettierrc (double quotes, semicolons, trailing commas)
```

Before handing off changes, run `npm run build`, `npm run lint` and `npm run test` (the README asks for all three).

The app needs a running TaskFlow REST API backend. Its URL comes from `VITE_API_URL` (copy `.env.example` to `.env`; default `http://localhost:3000`). The backend must allow CORS from `http://localhost:5173`.

## Architecture

React 19 + TypeScript SPA built with Vite. Server state goes through TanStack Query. There is no global client store besides auth context.

### Data layer (`src/lib/`)

- **`api.ts`**: the single typed REST adapter. Every backend call is a method on the exported `api` object. Components never call `fetch` directly.
  - `request<T>()` attaches the bearer token. On a 401 it runs one shared refresh (a module-level `refreshPromise`, so concurrent 401s refresh once) and retries the request once. Non-OK responses throw `ApiError(status, message)`, joining NestJS-style `message` arrays. A 204 returns `undefined`.
  - `requestBlob()` does the same for file downloads (task CSV exports) and reads the filename from `Content-Disposition`.
  - **Response normalization**: list endpoints may return either a bare array or `Page<T>` (`{data, meta}`). `normalizePage` / `normalizeList` turn either into one shape, and `normalizeTask` defaults `labels` to `[]`. New list/task endpoints should go through these helpers.
  - `query()` builds query strings: arrays are comma-joined, and `undefined`, `""` and `false` are dropped.
- **`token-storage.ts`**: the access token lives only in memory. The refresh token is in `localStorage` (`taskflow.refreshToken`). On page load, `AuthProvider` calls `api.bootstrap()` (a refresh), then `api.me()`.
- **`query-keys.ts`**: central factory for all query keys. Use `keys.*` for queries and invalidation. Some invalidations use prefix keys such as `["tasks", projectId]` to hit every filter variant.
- **`types.ts`**: frontend DTOs that mirror the API.

### Routing and auth (`src/app.tsx`, `src/features/auth/`)

`createBrowserRouter`. The `Protected` route waits for `useAuth().loading`, then either renders `AppShell` (sidebar, notifications) with child pages or redirects to `/login`. Public routes are login, register, forgot-password and reset-password.

### Features (`src/features/`)

Each feature is one or two large files that hold many private components, not a folder of small modules:

- **`tasks/project-page.tsx`** (~5k lines): `ProjectPage` with board/list views, HTML5 drag-and-drop status changes, filters and saved filters, and `TaskModal` (comments with mentions, checklist, history, worklogs/time tracking, attachments, watchers, reminders, milestones), plus task export dialogs. Find a component with grep on `^function <Name>`.
- **`workspaces/workspace-pages.tsx`**: the workspaces list, plus a workspace page with Projects, Members, Labels and Task Templates tabs.
- **`profile/`** and **`auth/`**: auth forms use react-hook-form with zod (`zodResolver`). Most other forms use local `useState`.

Typical mutation pattern: `useMutation` → `client.invalidateQueries({ queryKey: keys.… })` → `toast.success/error` (sonner).

### UI and styling

- `src/components/ui.tsx` holds the shared primitives (`Button`, `Input`, `Select`, `Dialog`, `ConfirmDialog`, `Field`, `Badge`, `Avatar`, `Empty`, `Skeleton`, `RichTextEditor`). Use `cn()` from `lib/utils.ts` for class merging.
- Tailwind v4 is imported in `styles.css`, but components are styled mostly with **hand-written semantic CSS classes** (`.button-primary`, `.dialog`, `.board-column`, and so on). Those classes live in `src/styles.css` (minified, single line) and per-area CSS files (`task-modal.css`, `milestones.css`, …). All CSS files are imported globally in `src/main.tsx`, so a new CSS file has to be added there. Follow the existing class-based approach rather than switching to utility classes.

### Domain notes

- Estimates are shown and entered as `2w 4d 6h 45m` and sent to the API as `originalEstimateMinutes`, with `1w = 5d` and `1d = 8h` (`ESTIMATE_MINUTES` in `project-page.tsx`).
- The active saved filter is remembered per project in `localStorage` (`savedFilterStorageKey(projectId)`).
- `PATCH /projects/:projectId/tasks/:id/milestone` is expected to return the updated task.

### Tests

Tests live next to the code (`*.test.ts`) and currently cover `lib/` only. API tests stub the global `fetch` with `vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(...)))` and call `tokenStorage.clear()` in `beforeEach`. `msw` is installed but not used yet. Setup (`src/test/setup.ts`) loads the jest-dom matchers.
