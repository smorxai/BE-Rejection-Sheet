import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
} from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return "N/A";
  return `${value.toFixed(2)}%`;
}

export function safePercent(qty: number, total: number): number | null {
  if (total === 0) return null;
  return (qty / total) * 100;
}

export type DateRange = { from: Date; to: Date };

export type Period =
  | "today"
  | "week"
  | "month"
  | "3m"
  | "6m"
  | "9m"
  | "12m";

export function getPeriodRange(period: Period): DateRange {
  const now = new Date();
  switch (period) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case "month":
      return { from: startOfMonth(now), to: endOfDay(now) };
    case "3m":
      return { from: startOfDay(subMonths(now, 3)), to: endOfDay(now) };
    case "6m":
      return { from: startOfDay(subMonths(now, 6)), to: endOfDay(now) };
    case "9m":
      return { from: startOfDay(subMonths(now, 9)), to: endOfDay(now) };
    case "12m":
      return { from: startOfDay(subMonths(now, 12)), to: endOfDay(now) };
    default:
      return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
  }
}

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  "3m": "3 Months",
  "6m": "6 Months",
  "9m": "9 Months",
  "12m": "12 Months",
};
