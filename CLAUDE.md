# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server on http://localhost:5173
npm run build     # tsc -b (type check) + vite build
npm run lint      # eslint with --max-warnings=0, so any warning fails
npm run test      # vitest run (jsdom)
npm run format    # prettier --write on src/**/*.{ts,tsx}; config in .prettierrc (double quotes, semicolons, trailing commas)
npm run format:check

npx vitest run src/lib/api.test.ts             # one test file
npx vitest run src/lib/api.test.ts -t "bootstrap"  # tests whose name matches
```

Before handing off changes, run `npm run build`, `npm run lint`, `npm run test` and `npm run format:check`. Line endings are LF (`.gitattributes`); `src/styles.css` is excluded from prettier because it is minified.

The app needs a running TaskFlow REST API backend. Its URL comes from `VITE_API_URL` (copy `.env.example` to `.env`; default `http://localhost:3000`). The backend must allow CORS from `http://localhost:5173`.

## Architecture

React 19 + TypeScript SPA built with Vite. Server state goes through TanStack Query. There is no global client store besides auth context.

### Data layer (`src/lib/`)

- **`api.ts`**: the single typed REST adapter. Every backend call is a method on the exported `api` object. Components never call `fetch` directly.
  - `fetchWithAuth()` attaches the bearer token. On a 401 it calls `refreshOnce()` (one shared refresh, so concurrent 401s and the StrictMode double bootstrap refresh once) and retries the request once. Non-OK responses throw `ApiError(status, message)`, joining NestJS-style `message` arrays. `request<T>()` parses JSON on top of it (a 204 returns `undefined`).
  - **Session expiry**: only a 401/403 from `/auth/refresh` ends the session. It clears the tokens and fires `onSessionExpired` listeners (`AuthProvider` subscribes, clears the query cache and drops the user, so `Protected` redirects to `/login`). Network and 5xx errors are thrown and keep the refresh token.
  - `requestBlob()` is the file-download variant (task CSV exports) and reads the filename from `Content-Disposition`.
  - **Response normalization**: list endpoints may return either a bare array or `Page<T>` (`{data, meta}`). `normalizePage` / `normalizeList` turn either into one shape, and `normalizeTask` defaults `labels` to `[]`. `normalizeUser` keeps only known `User` fields, because `/users/me` also returns the password hash. New list/task/user endpoints should go through these helpers.
  - `query()` builds query strings: arrays are comma-joined, and `undefined`, `""` and `false` are dropped.
- **`token-storage.ts`**: the access token lives only in memory. The refresh token is in `localStorage` (`taskflow.refreshToken`). On page load, `AuthProvider` calls `api.bootstrap()`, which refreshes the session and returns the user from the refresh response (`/auth/me` is not used: it only returns `id` and `email`). Login, register and logout all call `queryClient.clear()` so no cached data crosses sessions.
- **Current user**: `useAuth().user` is the only source. Don't add a separate "me"/"profile" query. After a profile change, call `useAuth().updateUser(updated)`.
- **`query-client.ts`**: `createQueryClient()` is used by `main.tsx` and the tests. Its `MutationCache.onError` shows `toast.error` for any mutation **without its own `onError`**, so don't add `onError: (e) => toast.error(e.message)` by hand; write `onError` only when a mutation needs extra error handling.
- **`sanitize.ts`**: `sanitizeRichText()` (DOMPurify, allowlist of formatting tags, no attributes). Any HTML from the API must go through it before `dangerouslySetInnerHTML` or `innerHTML`.
- **`query-keys.ts`**: central factory for all query keys. Use `keys.*` for queries and invalidation, never inline arrays. `keys.tasksAll`, `taskExportsAll`, `projectsAll` and `taskTemplatesAll` are prefixes that hit every filter/page variant.
- **`src/hooks/`**: shared React hooks. Use them instead of hand-written effects:
  - `useClickOutside(ref, onOutside, enabled?)` closes popovers and menus.
  - `useLoadMore(ref, { hasNextPage, isFetchingNextPage, fetchNextPage })` gives infinite scroll on a sentinel element. Pair it with `getNextPageParam: nextPageParam`.
  - `useDebouncedValue` is used for search inputs.
- **`types.ts`**: frontend DTOs that mirror the API.

### Routing and auth (`src/app.tsx`, `src/features/auth/`)

`createBrowserRouter`. The `Protected` route waits for `useAuth().loading`, then either renders `AppShell` (sidebar, notifications) with child pages or redirects to `/login`. Public routes are login, register, forgot-password and reset-password.

### Features (`src/features/`)

Each feature is one or two large files that hold many private components, not a folder of small modules:

- **`tasks/project-page.tsx`** (~5k lines): `ProjectPage` (renders `ProjectBoard` keyed by `projectId`, so all page state resets when switching projects) with board/list views, HTML5 drag-and-drop status changes, filters and saved filters, and `TaskModal` (comments with mentions, checklist, history, worklogs/time tracking, attachments, watchers, reminders, milestones), plus task export dialogs. Find a component with grep on `^function <Name>`.
- **`tasks/task-filters.ts`**: pure task-filter helpers (validation, `cleanTaskFilters`, `toggleValue`) and the URL format (`filtersFromParams` / `paramsWithFilters`).
- **`workspaces/workspace-pages.tsx`**: the workspaces list, plus a workspace page with Projects, Members, Labels and Task Templates tabs.
- **`profile/`** and **`auth/`**: auth forms use react-hook-form with zod (`zodResolver`). Most other forms use local `useState`.

Typical mutation pattern: `useMutation` → `onSuccess`: `client.invalidateQueries({ queryKey: keys.… })` + `toast.success` (sonner). Errors are toasted globally (see `query-client.ts`).

The project task list is a `useInfiniteQuery` with pages of 100 (`TASKS_PAGE_SIZE`, the API maximum) and a "Load more tasks" button. Its search is debounced. `ProjectPage` keeps only `selectedTaskId`, and `TaskModal` gets the task from `useQuery(keys.task(...))`, with the list item as placeholder. So invalidating `keys.task` refreshes the open modal, and `onUpdated` writes to that cache entry. In view mode `TaskModal` renders `task` directly; the title/description drafts are copied only when editing starts.

### UI and styling

- `src/components/ui.tsx` holds the shared primitives (`Button`, `Input`, `Select`, `Dialog`, `ConfirmDialog`, `Field`, `Badge`, `Avatar`, `Empty`, `Skeleton`, `RichTextEditor`). Use `cn()` from `lib/utils.ts` for class merging.
- `Dialog` handles modal behaviour itself: focus moves in and is trapped, Escape closes only the innermost dialog, page scroll is locked, and focus returns to the opener. An inner element can keep Escape for itself by calling `event.preventDefault()` (the task title input does this to cancel editing). Ask for confirmation with `ConfirmDialog`, never `window.confirm`.
- Tailwind v4 is imported in `styles.css`, but components are styled mostly with **hand-written semantic CSS classes** (`.button-primary`, `.dialog`, `.board-column`, and so on). Those classes live in `src/styles.css` (minified, single line) and per-area CSS files (`task-modal.css`, `milestones.css`, …). All CSS files are imported globally in `src/main.tsx`, so a new CSS file has to be added there. Follow the existing class-based approach rather than switching to utility classes.

### Domain notes

- Estimates are shown and entered as `2w 4d 6h 45m` and sent to the API as `originalEstimateMinutes`, with `1w = 5d` and `1d = 8h` (`ESTIMATE_MINUTES` in `project-page.tsx`).
- Project task filters live in the URL (`?q=…&statuses=TODO,DONE&assignees=…&unassigned=1&view=<savedFilterId>`), so filtered views can be shared. The last active saved filter is also remembered per project in `localStorage` (`savedFilterStorageKey(projectId)`) and restored when the project opens without filter params.
- `PATCH /projects/:projectId/tasks/:id/milestone` is expected to return the updated task.

### Tests

Tests live next to the code (`*.test.ts` / `*.test.tsx`).

- **`lib/` unit tests** stub the global `fetch` with `vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(...)))`.
- **Component tests** render the real route tree with `renderApp(path)` from `src/test/render.tsx` (memory router, fresh `QueryClient`, `AuthProvider`). The backend is mocked with msw: `src/test/server.ts` holds default handlers for a signed-in user with one workspace, project and task, and a test overrides an endpoint with `server.use(http.get(apiUrl("/..."), ...))`. Unhandled requests fail the test. Fixture builders are in `src/test/fixtures.ts`. To start signed in, put a refresh token in `localStorage` (`taskflow.refreshToken`) before rendering.
- `src/test/setup.ts` loads the jest-dom matchers, starts msw and, after each test, runs RTL `cleanup`, resets handlers and clears tokens and `localStorage`. The test API URL is pinned to `http://localhost:3000` in `vite.config.ts`.
