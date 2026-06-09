import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { User } from "./types";
export const cn = (...values: ClassValue[]) => twMerge(clsx(values));
export const initials = (user?: User) =>
  `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase() ||
  user?.email?.[0]?.toUpperCase() ||
  "?";
export const personName = (user?: User) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
  user?.email ||
  "Unknown user";
