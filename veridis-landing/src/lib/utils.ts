import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes with clsx
 * Handles class conflicts and conditional classes elegantly
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
