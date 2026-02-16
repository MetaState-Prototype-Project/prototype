import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEName(ename: string | null | undefined): string {
  if (!ename) return "";
  return ename.startsWith("@") ? ename : `@${ename}`;
}

