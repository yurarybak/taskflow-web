# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server on http://localhost:5173
npm run build     # tsc -b (type check) + vite build
npm run lint      # type-aware eslint + jsx-a11y, --max-warnings=0, so any warning fails
npm run test      # vitest run (jsdom)
npm run format    # prettier --write on src/**/*.{ts,tsx}; config in .prettierrc (double quotes, semicolons, trailing commas)
npm run format:check

npx vitest run src/lib/api.test.ts             # one test file
npx vitest run src/lib/api.test.ts -t "bootstrap"  # tests whose name matches
```

Before handing off changes, run `npm run build`, `npm run lint`, `npm run test` and `npm run format:check`. GitHub Actions (`.github/workflows/ci.yml`) runs the same four checks after a clean `npm ci` on Linux, on pushes to `main` and on pull requests. Node is pinned in `.nvmrc` (24). Linux paths are case-sensitive, so import paths must match file names exactly. Line endings are LF (`.gitattributes`); `src/styles.css` is excluded from prettier because it is minified.

### Lint conventions

ESLint uses `typescript-eslint` `recommendedTypeChecked` (with `projectService`) and `jsx-a11y` recommended. In practice:

- **Promises must be handled.** Fire-and-forget calls get an explicit `void`, e.g. `void client.invalidateQueries(...)` in `onSuccess`, so the mutation does not wait for the refetch. Event handlers must not return promises: write `onClick={() => void fetchNextPage()}`, and with react-hook-form `onSubmit={(event) => void handleSubmit(onValid)(event)}`.
- **No `any`.** Cast parsed JSON to a known shape (`(await response.json()) as AuthResponse`) and narrow `unknown` before use.
- **Accessibility.** Clickable non-button elements need `role`, `tabIndex` and a keyboard handler (see the task card). Icon-only buttons need `aria-label`. Inputs without a visible label need `aria-label`. `jsx-a11y/no-autofocus` is off on purpose: use `autoFocus` only in dialogs and inline editors the user just opened.

The app needs a running TaskFlow REST API backend. Its URL comes from `VITE_API_URL` (copy `.env.example` to `.env`; default `http://localhost:3000`). The backend must allow CORS from `http://localhost:5173`.

## Architecture

React 19 + TypeScript SPA built with Vite. Server state goes through TanStack Query. There is no global client store besides auth context.

### Data layer (`src/lib/`)

- **`api.ts`**: the single typed REST adapter. Every backend call is a method on the exported `api` object. Components never call `fetch` directly.
  - `fetchWithAuth()` attaches the bearer token. On a 401 it calls `refreshOnce()` (one shared refresh, so concurrent 401s and the StrictMode double bootstrap refresh once) and retries the request once. Public auth endpoints (login, register, forgot/reset password) go through `publicRequest`, which never refreshes: a 401 there means wrong credentials. Options may be a function (`() => RequestInit`), which is called again for the retry; `logout` uses this so the retry sends the rotated refresh token. Non-OK responses throw `ApiError(status, message)`, joining NestJS-style `message` arrays. `request<T>()` parses JSON on top of it (a 204 returns `undefined`).
  - **Session expiry**: only a 401/403 from `/auth/refresh` ends the session. It clears the tokens and fires `onSessionExpired` listeners (`AuthProvider` subscribes, clears the query cache and drops the user, so `Protected` redirects to `/login`). Network, 429 and 5xx errors are thrown and keep the refresh token. Removing the refresh token in another tab (sign out) also ends the session in this tab (`storage` event).
  - **Refresh token rotation**: the backend revokes a refresh token once it is used (reusing one revokes the whole session). Tabs share the token in `localStorage`, so `refreshSession` runs inside a Web Lock (`navigator.locks`, name `taskflow.refresh`) and reads the token inside the lock. Never cache the refresh token in memory.
  - `requestBlob(path, fallbackName)` is the authenticated file-download variant (task CSV exports, attachments). It reads the filename from `Content-Disposition`. Protected files are never linked with a plain `<a href>`, since that sends no bearer token: download them with `requestBlob` + `saveBlobFile`.
  - **Response normalization**: list endpoints may return either a bare array or `Page<T>` (`{data, meta}`). `normalizePage` / `normalizeList` turn either into one shape, and `normalizeTask` defaults `labels` to `[]`. `normalizeUser` keeps only known `User` fields, because `/users/me` also returns the password hash. New list/task/user endpoints should go through these helpers.
  - `query()` builds query strings: arrays are comma-joined, and `undefined`, `""` and `false` are dropped.
- **`token-storage.ts`**: the access token lives only in memory. The refresh token is in `localStorage` (`taskflow.refreshToken`). On page load, `AuthProvider` calls `api.bootstrap()`, which refreshes the session and returns the user from the refresh response (`/auth/me` is not used: it only returns `id` and `email`). Login, register and logout all call `queryClient.clear()` so no cached data crosses sessions.
- **Current user**: `useAuth().user` is the only source. Don't add a separate "me"/"profile" query. After a profile change, call `useAuth().updateUser(updated)`. After an avatar upload/removal call `useAuth().avatarChanged()`; own-avatar URLs are built with `api.avatarUrl(id, avatarVersion)` so the browser reloads them.
- **`query-client.ts`**: `createQueryClient()` is used by `main.tsx` and the tests. Its `MutationCache.onError` shows `toast.error` for any mutation **without its own `onError`**, so don't add `onError: (e) => toast.error(e.message)` by hand; write `onError` only when a mutation needs extra error handling.
- **`sanitize.ts`**: `sanitizeRichText()` (DOMPurify, allowlist of formatting tags, no attributes). Any HTML from the API must go through it before `dangerouslySetInnerHTML` or `innerHTML`.
- **`query-keys.ts`**: central factory for all query keys. Use `keys.*` for queries and invalidation, never inline arrays. `keys.tasksAll`, `taskExportsAll`, `projectsAll` and `taskTemplatesAll` are prefixes that hit every filter/page variant.
- **`src/hooks/`**: shared React hooks. Use them instead of hand-written effects:
  - `useDismiss(ref, onClose, open)` is for every popover, dropdown and menu. It closes on a click outside or on Escape, returns focus to the trigger, and stops Escape from also closing a surrounding `Dialog`. Pass the real open state, because only an open popover takes Escape.
  - `useClickOutside(ref, onOutside, enabled?)` is the click-only building block (e.g. the inline title editor, whose input handles Escape itself).
  - `useLoadMore(ref, { hasNextPage, isFetchingNextPage, fetchNextPage })` gives infinite scroll on a sentinel element. Pair it with `getNextPageParam: nextPageParam`.
  - `useDebouncedValue` is used for search inputs.
- **`types.ts`**: frontend DTOs that mirror the API.

### Routing and auth (`src/app.tsx`, `src/features/auth/`)

`createBrowserRouter`. The `Protected` route waits for `useAuth().loading`, then either renders `AppShell` (sidebar, notifications) with child pages or redirects to `/login`. Public routes are login, register, forgot-password and reset-password.

Every page is code-split with `React.lazy` in `app.tsx`. Signed-in pages suspend inside `AppShell` (the sidebar stays). Public pages suspend in `PublicPages` with the boot skeleton. `vite.config.ts` puts React and the router in a separate `vendor-react` chunk. Keep heavy dependencies (like DOMPurify via `components/rich-text-editor.tsx`) out of modules that the main bundle imports (`app-shell.tsx`, `components/ui.tsx`, `lib/`).

### Features (`src/features/`)

A feature is a folder of focused modules. One component, or a few tightly related ones, per file. Pure helpers live in `.ts` files next to them. Modules export only what other modules use.

- **`tasks/`**:
  - `project-page.tsx`: `ProjectPage` (renders `ProjectBoard` keyed by `projectId`, so all page state resets when switching projects) with board/list views, HTML5 drag-and-drop status changes, pagination and the task modal.
  - `use-task-filters.ts`: `useTaskFilters(projectId)` holds the URL-backed filters, the saved filters query, `applySavedFilter`, `toggleFilterValue` and the localStorage restore. `task-filters-bar.tsx`: `TaskFiltersBar` (search, saved filters with their create/edit/delete dialogs, the filter popovers). It receives that state as `filterState`, and `children` render at the end of the toolbar (the board/list switch).
  - `task-modal/`: `task-modal.tsx` (`TaskModal`) plus one file per section: `comments`, `checklist`, `history`, `worklogs` (time tracking dialog, worklog list/edit), `attachments`, `reminders`, `watchers`.
  - `task-form.tsx` (create/edit task, from templates), `milestones.tsx` (milestones tab), `task-exports-dialog.tsx`.
  - `task-fields.tsx`: shared field controls (date picker, priority/type/user/milestone dropdowns, collapsible section). `mentions.tsx`: mention parsing/rendering and `MentionTextarea`.
  - `task-utils.ts`: estimates (`ESTIMATE_MINUTES`, `parseEstimate`, `formatEstimate`), date input formatting, `find*` lookups, `saveBlobFile`, abortable `wait`.
  - `task-filters.ts`: pure task-filter helpers (validation, `cleanTaskFilters`, `toggleValue`, export-filter helpers) and the URL format (`filtersFromParams` / `paramsWithFilters`).
- **`workspaces/`**: `workspaces-page.tsx` (workspaces list and `WorkspaceForm`) and `workspace-page.tsx` (one workspace, with tabs). Each tab is its own module: `projects-tab`, `members-tab`, `labels-tab`, `task-templates-tab` (+ `task-template-form`). `workspace-utils.ts` holds `useInvalidate`, `humanizeConstant` and the template type/priority/sort options.
- **`profile/`** and **`auth/`**: auth forms use react-hook-form with zod (`zodResolver`). Most other forms use local `useState`.

Typical mutation pattern: `useMutation` → `onSuccess`: `void client.invalidateQueries({ queryKey: keys.… })` + `toast.success` (sonner). Errors are toasted globally (see `query-client.ts`).

The project task list is a `useInfiniteQuery` with pages of 100 (`TASKS_PAGE_SIZE`, the API maximum) and a "Load more tasks" button. Drag-and-drop status changes are optimistic. `onMutate` patches every cached list variant with `patchTaskInPages`, `onError` restores the snapshots, and the list refetches only after the last in-flight status change (`isMutating` on the `update-task-status` mutation key). Its search is debounced. `ProjectPage` keeps only `selectedTaskId`, and `TaskModal` gets the task from `useQuery(keys.task(...))`, with the list item as placeholder. So invalidating `keys.task` refreshes the open modal, and `onUpdated` writes to that cache entry. In view mode `TaskModal` renders `task` directly; the title/description drafts are copied only when editing starts.

### UI and styling

- `src/components/ui.tsx` holds the shared primitives (`Button`, `Input`, `Select`, `Dialog`, `ConfirmDialog`, `Field`, `Badge`, `Avatar`, `Empty`, `Skeleton`). `RichTextEditor` is in `components/rich-text-editor.tsx`. It is built on Tiptap (StarterKit limited to bold, italic and lists, so its output matches the `sanitizeRichText` allowlist) and stores HTML. Empty documents are saved as `""`, without trailing empty paragraphs. Tiptap is ~400 kB, so `task-modal.tsx` lazy-loads the editor and preloads it on pointer/focus over the description. Do not import it statically from a page module. It takes `onEscape`, so Escape cancels editing instead of closing the modal. Use `cn()` from `lib/utils.ts` for class merging.
- `Dialog` handles modal behaviour itself: focus moves in and is trapped, Escape closes only the innermost dialog, page scroll is locked, and focus returns to the opener. An inner element can keep Escape for itself by calling `event.preventDefault()` (the task title input does this to cancel editing). Ask for confirmation with `ConfirmDialog`, never `window.confirm`.
- Tailwind v4 is imported in `styles.css`, but components are styled mostly with **hand-written semantic CSS classes** (`.button-primary`, `.dialog`, `.board-column`, and so on). Those classes live in `src/styles.css` (minified, single line) and per-area CSS files (`task-modal.css`, `milestones.css`, …). All CSS files are imported globally in `src/main.tsx`, so a new CSS file has to be added there. Follow the existing class-based approach rather than switching to utility classes.

### Domain notes

- Estimates are shown and entered as `2w 4d 6h 45m` and sent to the API as `originalEstimateMinutes`, with `1w = 5d` and `1d = 8h` (`ESTIMATE_MINUTES` in `tasks/task-utils.ts`).
- Project task filters live in the URL (`?q=…&statuses=TODO,DONE&assignees=…&unassigned=1&view=<savedFilterId>`), so filtered views can be shared. The last active saved filter is also remembered per project in `localStorage` (`savedFilterStorageKey(projectId)`) and restored when the project opens without filter params.
- `PATCH /projects/:projectId/tasks/:id/milestone` is expected to return the updated task.
- Clearing an optional description (task, task template) sends `null`: the API rejects `""`. A create request omits the field instead.

### Tests

Tests live next to the code (`*.test.ts` / `*.test.tsx`).

- **`lib/` unit tests** stub the global `fetch` with `vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(...)))`.
- **Component tests** render the real route tree with `renderApp(path)` from `src/test/render.tsx` (memory router, fresh `QueryClient`, `AuthProvider`). The backend is mocked with msw: `src/test/server.ts` holds default handlers for a signed-in user with one workspace, project and task, and a test overrides an endpoint with `server.use(http.get(apiUrl("/..."), ...))`. Unhandled requests fail the test. Fixture builders are in `src/test/fixtures.ts`. To start signed in, put a refresh token in `localStorage` (`taskflow.refreshToken`) before rendering.
- `src/test/setup.ts` loads the jest-dom matchers, starts msw and, after each test, runs RTL `cleanup`, resets handlers and clears tokens and `localStorage`. The test API URL is pinned to `http://localhost:3000` in `vite.config.ts`. Async RTL queries wait up to 5s (`asyncUtilTimeout`) and a test may take 15s (`testTimeout`), because component tests render lazy-loaded pages.
