import { format } from "date-fns";
import type { Member, Milestone, Task, TaskStatus } from "../../lib/types";

export const statusLabel = (status: TaskStatus) =>
  ({ TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done" })[status];
const ESTIMATE_MINUTES = {
  w: 5 * 8 * 60,
  d: 8 * 60,
  h: 60,
  m: 1,
} as const;
const estimateHelpText = "Use the format: 2w 4d 6h 45m";
export const formatEstimate = (minutes?: number | null) => {
  if (!minutes) return "";
  const parts: string[] = [];
  let remaining = minutes;
  (
    Object.entries(ESTIMATE_MINUTES) as Array<
      [keyof typeof ESTIMATE_MINUTES, number]
    >
  ).forEach(([unit, unitMinutes]) => {
    const value = Math.floor(remaining / unitMinutes);
    if (!value) return;
    parts.push(`${value}${unit}`);
    remaining %= unitMinutes;
  });
  return parts.join(" ");
};
export const formatEstimateLabel = (minutes?: number | null) =>
  formatEstimate(minutes) || "0m";
export const formatDateInput = (date: Date) => format(date, "yyyy-MM-dd");
export const formatTimeInput = (date: Date) => format(date, "HH:mm");
export const parseEstimate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return { minutes: null, error: undefined };
  let minutes = 0;
  let matched = "";
  const tokenPattern = /(\d+)\s*([wdhm])/gi;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(trimmed))) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase() as keyof typeof ESTIMATE_MINUTES;
    minutes += amount * ESTIMATE_MINUTES[unit];
    matched += match[0];
  }
  if (!matched || matched.replace(/\s/g, "") !== trimmed.replace(/\s/g, "")) {
    return { minutes: null, error: estimateHelpText };
  }
  return { minutes, error: undefined };
};
export const humanizeConstant = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
export const wasUpdated = (createdAt?: string, updatedAt?: string) =>
  !!createdAt &&
  !!updatedAt &&
  Math.abs(new Date(updatedAt).getTime() - new Date(createdAt).getTime()) >
    1000;
export const saveBlobFile = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
/** Resolves after `ms`, or rejects with the abort reason once `signal` aborts. */
export const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
export const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";
export function findMilestoneById(
  milestones: Milestone[] | undefined,
  milestoneId?: string | null,
) {
  return milestones?.find((milestone) => milestone.id === milestoneId);
}
export const findUserById = (
  members: Member[] | undefined,
  userId?: string | null,
) =>
  members?.find(
    (member) => member.userId === userId || member.user.id === userId,
  )?.user;
export const findAssignee = (members: Member[] | undefined, task: Task) =>
  findUserById(members, task.assigneeId);
