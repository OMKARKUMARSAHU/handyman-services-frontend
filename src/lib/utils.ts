import { clsx, type ClassValue } from "clsx";

/** Small class-name join helper used across components. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
