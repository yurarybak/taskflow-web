# TaskFlow Web

TaskFlow Web is a React + TypeScript frontend for the TaskFlow REST API. It provides workspace/project management, a Jira-style task board, task details, comments, attachments, checklist items, milestones, saved task filters, watchers, avatar support, and profile management.

## Tech Stack

- React 19
- TypeScript
- Vite
- React Router
- TanStack Query
- Vitest
- ESLint
- date-fns
- lucide-react
- sonner

## Requirements

- Node.js 22+
- npm
- Running TaskFlow API backend

The app reads the backend URL from `VITE_API_URL`.

## Environment

Create a local `.env` file:

```bash
cp .env.example .env
```

Default value:

```env
VITE_API_URL=http://localhost:3000
```

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run test
```

## WSL Usage

This project currently lives in WSL at:

```text
/home/yrybak/projects/taskflow-web
```

From Windows PowerShell, you can run commands with:

```powershell
wsl.exe -d Ubuntu --cd /home/yrybak/projects/taskflow-web -- bash -ic 'npm run dev'
```

## Main Features

- Authentication and token refresh
- Workspaces, projects, members, labels
- Profile settings, password update, avatar upload/delete
- Public user avatars via `GET /users/:userId/avatar`
- Task board and list views
- Drag-and-drop task status changes on the board
- Task filters for search, statuses, priorities, types, assignees, unassigned tasks, milestones, and tasks without milestones
- Saved task filters with create, apply, edit, update, delete, active view display, and local persistence per project
- Jira-style task modal
- Inline task title and rich text description editing
- Task status, priority, type, assignee, reporter, milestone, start date, due date, and original estimate editing
- Original estimate input format: `2w 4d 6h 45m`
- Task clone, archive/unarchive, flag/unflag, and delete actions
- Flagged task visual highlighting
- Comments with edit/delete permissions
- Activity history
- Attachments
- Checklist items with create, edit, delete, toggle, progress, and drag-and-drop ordering
- Watchers with start/stop watching and add/remove watchers
- Milestones with create, edit, delete, complete/reopen, and task milestone assignment

## Time Estimate Format

Task estimates are displayed and entered as:

```text
2w 4d 6h 45m
```

The frontend converts this to `originalEstimateMinutes` before sending it to the API.

Current conversion rules:

- `1w = 5d`
- `1d = 8h`
- `1h = 60m`

## Project Structure

```text
src/
  app.tsx
  app-shell.tsx
  components/
  features/
    auth/
    profile/
    tasks/
    workspaces/
  lib/
    api.ts
    query-keys.ts
    token-storage.ts
    types.ts
    utils.ts
  test/
```

Key files:

- `src/lib/api.ts` - typed REST adapter and token refresh handling
- `src/lib/types.ts` - shared frontend DTO/types
- `src/features/tasks/project-page.tsx` - project tasks, board, task modal, milestones, filters
- `src/components/ui.tsx` - shared UI primitives

## API Notes

The frontend expects the TaskFlow API to be available at `VITE_API_URL`.

The API should allow the Vite dev origin:

```ts
app.enableCors({
  origin: "http://localhost:5173",
});
```

For task milestone updates, the frontend expects:

```http
PATCH /projects/:projectId/tasks/:id/milestone
```

to return the updated task.

## Verification

Before handing off changes, run:

```bash
npm run build
npm run lint
npm run test
```
