import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatQuantity(quantity: number, unit?: string | null): string {
  if (unit) {
    return `${quantity} ${unit}`;
  }
  if (quantity === 1) {
    return "";
  }
  return `x${quantity}`;
}

export function getCategoryColor(categoryId: string): string {
  const colors: Record<string, string> = {
    produce: "#22C55E",
    dairy: "#3B82F6",
    meat: "#EF4444",
    bakery: "#F59E0B",
    frozen: "#06B6D4",
    beverages: "#8B5CF6",
    snacks: "#EC4899",
    pantry: "#78716C",
    household: "#6366F1",
    other: "#94A3B8",
  };
  return colors[categoryId] ?? colors["other"]!;
}
