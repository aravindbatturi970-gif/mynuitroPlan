import type { FoodLogEntry } from "../types";

interface DayRow {
  date: string;
  kcal: number;
  water: number;
  count: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

function dayRow(
  date: string,
  log: FoodLogEntry[],
  waterMap: Record<string, number>,
): DayRow {
  let kcal = 0, protein = 0, carbs = 0, fat = 0, fiber = 0, count = 0, water = 0;
  for (const e of log) {
    if (e.date !== date) continue;
    kcal += e.kcal;
    protein += e.protein;
    carbs += e.carbs;
    fat += e.fat;
    fiber += e.fiber;
    count++;
  }
  water = waterMap[date] || 0;
  return { date, kcal, water, count, protein, carbs, fat, fiber };
}

export function weeklyRows(
  log: FoodLogEntry[],
  waterMap: Record<string, number>,
): DayRow[] {
  const out: DayRow[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    out.push(dayRow(ds, log, waterMap));
  }
  return out;
}

export function monthlyRows(
  log: FoodLogEntry[],
  waterMap: Record<string, number>,
): DayRow[] {
  const out: DayRow[] = [];
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    out.push(dayRow(ds, log, waterMap));
  }
  return out;
}

export function trendRows(
  log: FoodLogEntry[],
  waterMap: Record<string, number>,
  days: number,
): DayRow[] {
  const out: DayRow[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    out.push(dayRow(ds, log, waterMap));
  }
  return out;
}

function weekdayShort(i: number): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i];
}

export function weekdayLabel(date: string): string {
  const d = new Date(date + "T00:00:00");
  return weekdayShort(d.getDay());
}

export function monthLabel(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short" });
}

export function isToday(date: string): boolean {
  return date === new Date().toISOString().slice(0, 10);
}

export function kcalAxis(maxKcal: number): { max: number; step: number; ticks: number[] } {
  const nice = (v: number) => Math.ceil(v / 200) * 200;
  const step = maxKcal <= 1400 ? 200 : maxKcal <= 2400 ? 400 : 600;
  const max = nice(maxKcal);
  const ticks: number[] = [];
  for (let v = 0; v <= max + 1; v += step) ticks.push(v);
  return { max, step, ticks };
}

export function waterAxis(maxMl: number): { max: number; step: number; ticks: number[] } {
  const targets = [1000, 1500, 2000, 2500, 3000, 3500, 4000];
  const goal = targets.find((t) => t >= maxMl) ?? 4000;
  const step = goal <= 2000 ? 500 : 1000;
  const ticks: number[] = [];
  for (let v = 0; v <= goal + 1; v += step) ticks.push(v);
  return { max: goal, step, ticks };
}

const BAR_COLORS = [
  "var(--accent)",
  "var(--info)",
  "var(--success)",
  "var(--warning)",
  "var(--danger)",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#06b6d4",
];

export function barColor(i: number): string {
  return BAR_COLORS[i % BAR_COLORS.length];
}
