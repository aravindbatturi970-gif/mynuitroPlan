import type { PlanItem, Food, MealType, Plan, FoodLogEntry, CustomFood, CustomRecipe, Profile, AppState, Achievement } from "./types";
import { FOOD_DB, RECIPES, MEAL_TYPES } from "./data";

/* ---------- calorie / protein defaults ---------- */
export function defaultCalorieTarget(goalType: Profile["goalType"], _profile: Profile): number {
  const base = 1800;
  if (goalType === "lose") return 1400;
  if (goalType === "gain") return 2400;
  if (goalType === "maintain") return 2000;
  return base;
}

export function defaultProteinTarget(goalType: Profile["goalType"], profile: Profile): number {
  const weight = profile.weightKg || 70;
  if (goalType === "lose") return Math.round(weight * 1.6);
  if (goalType === "gain") return Math.round(weight * 1.8);
  if (goalType === "maintain") return Math.round(weight * 1.4);
  return Math.round(weight * 1.2);
}

/* ---------- nutrient estimation ---------- */
export function estimateFood(
  name: string,
  mealType: MealType,
  quantity: string,
  servings: number,
  profile: Profile,
  customFoods: CustomFood[],
  customRecipes: CustomRecipe[],
): FoodLogEntry {
  const cleaned = name.trim();
  if (!cleaned) {
    return makeEntry(cleaned, mealType, quantity, servings, 0, 0, 0, 0, 0, 0, "estimated");
  }

  const db = matchFoodDb(cleaned, mealType, profile);
  if (db) {
    return makeEntry(cleaned, mealType, quantity, servings,
      db.kcal, db.protein, db.carbs, db.fat, db.fiber, 0, "fooddb");
  }

  const custom = customFoods.find((c) => c.name.toLowerCase() === cleaned.toLowerCase());
  if (custom) {
    return makeEntry(cleaned, mealType, quantity, servings,
      custom.kcal, custom.protein, custom.carbs, custom.fat, custom.fiber, custom.sodium, "custom");
  }

  const recipe = customRecipes.find((r) => r.name.toLowerCase() === cleaned.toLowerCase());
  if (recipe) {
    const s = servings;
    return makeEntry(cleaned, mealType, quantity, s,
      recipe.kcalPerServing * s, recipe.proteinPerServing * s,
      recipe.carbsPerServing * s, recipe.fatPerServing * s,
      recipe.fiberPerServing * s, recipe.sodiumPerServing * s, "recipe");
  }

  const est = heuristicEstimate(cleaned);
  if (est) {
    return makeEntry(cleaned, mealType, quantity, servings,
      est.kcal, est.protein, est.carbs, est.fat, est.fiber, est.sodium, "estimated");
  }

  return makeEntry(cleaned, mealType, quantity, servings, 120, 5, 15, 4, 2, 30, "estimated");
}

function makeEntry(
  name: string, mealType: MealType, qty: string, servings: number,
  kcal: number, protein: number, carbs: number, fat: number, fiber: number, sodium: number,
  source: FoodLogEntry["source"],
): FoodLogEntry {
  const scale = Math.max(0, servings);
  return {
    id: "f_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    date: todayStr(),
    mealType,
    name: name || "(unnamed food)",
    qty,
    servings,
    kcal: Math.round(kcal * scale),
    protein: Math.round(protein * scale * 10) / 10,
    carbs: Math.round(carbs * scale * 10) / 10,
    fat: Math.round(fat * scale * 10) / 10,
    fiber: Math.round(fiber * scale * 10) / 10,
    sodium: Math.round(sodium * scale),
    source,
    createdAt: new Date().toISOString(),
  };
}

function matchFoodDb(name: string, mealType: MealType, profile: Profile): Food | null {
  const low = name.toLowerCase();
  const candidates = FOOD_DB.filter((f) => isSafeItem(f, profile));
  if (!candidates.length) return null;

  const exact = candidates.find((f) => f.name.toLowerCase() === low);
  if (exact) return exact;

  const contains = candidates.find((f) => f.name.toLowerCase().includes(low));
  if (contains) return contains;

  const scored = candidates
    .map((f) => ({
      f,
      score: tokenOverlap(low, f.name.toLowerCase()) - (f.meal === mealType ? 0 : 0.0001),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best && best.score > 0) return best.f;
  return null;
}

function tokenOverlap(a: string, b: string): number {
  const at = tokenize(a);
  const bt = tokenize(b);
  if (!at.length || !bt.length) return 0;
  let hit = 0;
  for (const t of at) {
    if (bt.some((x) => x === t || x.includes(t) || t.includes(x))) hit++;
  }
  return hit / Math.max(at.length, bt.length);
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

interface Est {
  kcal: number; protein: number; carbs: number; fat: number; fiber: number; sodium: number;
}

const HEURISTICS: Array<{ pattern: RegExp; est: Est }> = [
  { pattern: /^water$/i, est: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 } },
  { pattern: /^(black|coffee|espresso)/i, est: { kcal: 2, protein: 0.3, carbs: 0, fat: 0, fiber: 0, sodium: 2 } },
  { pattern: /^(tea|green tea|black tea|herbal tea)/i, est: { kcal: 1, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 1 } },
  { pattern: /^(milk|whole milk|skim milk|low fat milk)/i, est: { kcal: 150, protein: 8, carbs: 12, fat: 8, fiber: 0, sodium: 120 } },
  { pattern: /^buttermilk/i, est: { kcal: 90, protein: 4, carbs: 12, fat: 3, fiber: 0, sodium: 190 } },
  { pattern: /^apple/i, est: { kcal: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4, sodium: 2 } },
  { pattern: /^banana/i, est: { kcal: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3, sodium: 1 } },
  { pattern: /^orange/i, est: { kcal: 62, protein: 1.2, carbs: 15, fat: 0.2, fiber: 3, sodium: 0 } },
  { pattern: /^grape/i, est: { kcal: 104, protein: 1.1, carbs: 27, fat: 0.2, fiber: 1, sodium: 2 } },
  { pattern: /^papaya/i, est: { kcal: 62, protein: 0.7, carbs: 16, fat: 0.4, fiber: 3, sodium: 5 } },
  { pattern: /^mango/i, est: { kcal: 99, protein: 1.4, carbs: 25, fat: 0.6, fiber: 3, sodium: 1 } },
  { pattern: /^watermelon/i, est: { kcal: 86, protein: 1.7, carbs: 22, fat: 0.4, fiber: 1, sodium: 17 } },
  { pattern: /^pineapple/i, est: { kcal: 82, protein: 0.9, carbs: 22, fat: 0.2, fiber: 2, sodium: 1 } },
  { pattern: /^strawberr/i, est: { kcal: 49, protein: 1.2, carbs: 12, fat: 0.5, fiber: 3, sodium: 2 } },
  { pattern: /^mixed fruit/i, est: { kcal: 140, protein: 2, carbs: 34, fat: 1, fiber: 5, sodium: 2 } },
  { pattern: /^rice/i, est: { kcal: 200, protein: 4, carbs: 45, fat: 0.4, fiber: 0.6, sodium: 2 } },
  { pattern: /^(roti|chapati|flatbread|paratha)/i, est: { kcal: 120, protein: 4, carbs: 20, fat: 3, fiber: 2, sodium: 10 } },
  { pattern: /^(bread|toast|garlic bread)/i, est: { kcal: 80, protein: 3, carbs: 14, fat: 1, fiber: 1, sodium: 150 } },
  { pattern: /^pasta/i, est: { kcal: 200, protein: 7, carbs: 42, fat: 1, fiber: 2, sodium: 5 } },
  { pattern: /^(oat|oats)/i, est: { kcal: 150, protein: 5, carbs: 27, fat: 3, fiber: 4, sodium: 2 } },
  { pattern: /^cereal/i, est: { kcal: 120, protein: 3, carbs: 25, fat: 2, fiber: 2, sodium: 150 } },
  { pattern: /^quinoa/i, est: { kcal: 220, protein: 8, carbs: 39, fat: 3.5, fiber: 5, sodium: 13 } },
  { pattern: /^(egg|omelette)/i, est: { kcal: 75, protein: 6, carbs: 0.6, fat: 5, fiber: 0, sodium: 70 } },
  { pattern: /^(chicken|grilled chicken)/i, est: { kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sodium: 70 } },
  { pattern: /^(fish|salmon|grilled fish)/i, est: { kcal: 175, protein: 19, carbs: 0, fat: 10, fiber: 0, sodium: 60 } },
  { pattern: /^tofu/i, est: { kcal: 80, protein: 8, carbs: 2, fat: 4, fiber: 1, sodium: 7 } },
  { pattern: /^paneer/i, est: { kcal: 265, protein: 18, carbs: 1.2, fat: 20, fiber: 0, sodium: 60 } },
  { pattern: /^(dal|khichdi|moong|lentil|sprout)/i, est: { kcal: 120, protein: 8, carbs: 20, fat: 0.5, fiber: 8, sodium: 5 } },
  { pattern: /^trail mix/i, est: { kcal: 200, protein: 6, carbs: 18, fat: 12, fiber: 4, sodium: 50 } },
  { pattern: /^(nuts|peanuts|almonds|walnut|seed)/i, est: { kcal: 170, protein: 6, carbs: 6, fat: 15, fiber: 3, sodium: 5 } },
  { pattern: /^(chana|roasted chana|chickpea)/i, est: { kcal: 160, protein: 9, carbs: 26, fat: 2, fiber: 8, sodium: 10 } },
  { pattern: /^makhana/i, est: { kcal: 150, protein: 6, carbs: 20, fat: 4, fiber: 2, sodium: 10 } },
  { pattern: /^hummus/i, est: { kcal: 170, protein: 6, carbs: 18, fat: 8, fiber: 6, sodium: 350 } },
  { pattern: /^(salad|salad bowl|green salad)/i, est: { kcal: 60, protein: 2, carbs: 6, fat: 3, fiber: 4, sodium: 80 } },
  { pattern: /^(yogurt|greek yogurt|curd|dahi)/i, est: { kcal: 120, protein: 10, carbs: 10, fat: 4, fiber: 0, sodium: 80 } },
  { pattern: /^(cheese|cheddar)/i, est: { kcal: 110, protein: 7, carbs: 0.4, fat: 9, fiber: 0, sodium: 180 } },
  { pattern: /^honey/i, est: { kcal: 60, protein: 0, carbs: 17, fat: 0, fiber: 0, sodium: 0 } },
  { pattern: /^peanut butter/i, est: { kcal: 190, protein: 7, carbs: 7, fat: 16, fiber: 2, sodium: 150 } },
  { pattern: /^(chips|packet|snack|namkeen)/i, est: { kcal: 150, protein: 3, carbs: 18, fat: 6, fiber: 1, sodium: 300 } },
];

function heuristicEstimate(name: string): Est | null {
  for (const rule of HEURISTICS) {
    if (rule.pattern.test(name)) return rule.est;
  }
  return null;
}

export function portionScaled(entry: FoodLogEntry, newServings: number): FoodLogEntry {
  const s = Math.max(0, newServings);
  const scale = s / Math.max(0.0001, entry.servings || 1);
  return {
    ...entry,
    servings: s,
    kcal: Math.round(entry.kcal * scale),
    protein: Math.round(entry.protein * scale * 10) / 10,
    carbs: Math.round(entry.carbs * scale * 10) / 10,
    fat: Math.round(entry.fat * scale * 10) / 10,
    fiber: Math.round(entry.fiber * scale * 10) / 10,
    sodium: Math.round(entry.sodium * scale),
  };
}

/* ---------- nutrition aggregates ---------- */
export function dayNutrition(date: string, foodLog: FoodLogEntry[]): {
  kcal: number; protein: number; carbs: number; fat: number; fiber: number; sodium: number; count: number;
} {
  let kcal = 0, protein = 0, carbs = 0, fat = 0, fiber = 0, sodium = 0;
  let count = 0;
  for (const e of foodLog) {
    if (e.date === date) {
      kcal += e.kcal; protein += e.protein; carbs += e.carbs; fat += e.fat; fiber += e.fiber; sodium += e.sodium;
      count++;
    }
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
    sodium: Math.round(sodium),
    count,
  };
}

/* ---------- daily nutrition score ---------- */
export function nutritionScore(
  nut: ReturnType<typeof dayNutrition>,
  profile: Profile,
  water: number,
  waterGoal: number,
  planCompleted: number,
): number {
  const target = profile.calorieTarget || 1800;
  const ratio = target > 0 ? nut.kcal / target : 0;
  let calScore = 0;
  if (ratio <= 1) {
    calScore = Math.round(ratio * 40);
  } else if (ratio <= 1.3) {
    calScore = Math.round(40 - ((ratio - 1) / 0.3) * 40);
  } else {
    calScore = 0;
  }
  calScore = Math.max(0, Math.min(40, calScore));

  const protTarget = profile.proteinTarget || 80;
  const protRatio = protTarget > 0 ? nut.protein / protTarget : 0;
  const protScore = Math.min(15, Math.round(protRatio * 15));

  const balanceScore = Math.min(15, Math.round(planCompleted * 15));

  const waterRatio = waterGoal > 0 ? water / waterGoal : 0;
  const waterScore = Math.min(15, Math.round(Math.min(1, waterRatio) * 15));

  const fiberScore = Math.min(10, Math.round((nut.fiber / 25) * 10));

  const sodiumScore = nut.sodium > 2300 ? Math.max(0, 5 - Math.round((nut.sodium - 2300) / 500)) : 5;

  return Math.max(0, Math.min(100, calScore + protScore + balanceScore + waterScore + fiberScore + sodiumScore));
}

/* ---------- streak ---------- */
export function currentStreak(foodLog: FoodLogEntry[], water: Record<string, number>): number {
  let s = 0;
  for (let i = 0; i < 365; i++) {
    const d = addDays(todayStr(), -i);
    const hasFood = foodLog.some((e) => e.date === d);
    const hasWater = (water[d] || 0) > 0;
    if (hasFood || hasWater) s++;
    else if (i > 0) break;
  }
  return s;
}

/* ---------- achievements ---------- */
export function achievementsToCheck(state: AppState): Achievement[] {
  const next: Achievement[] = [];
  const totalLogs = state.foodLog.length;
  const daysWithLog = new Set(state.foodLog.map((e) => e.date)).size;
  const today = todayStr();
  const todayLogs = state.foodLog.filter((e) => e.date === today).length;

  if (totalLogs >= 1) next.push({ id: "first-log", unlockedAt: today, label: "First bite", icon: "🥄", desc: "Log your first food entry." });
  if (totalLogs >= 7) next.push({ id: "week-logger", unlockedAt: today, label: "Week logger", icon: "📝", desc: "Log food for 7 total entries." });
  if (daysWithLog >= 3) next.push({ id: "three-days", unlockedAt: today, label: "3-day tracker", icon: "🗓", desc: "Track food across 3 different days." });
  if (todayLogs >= 4) next.push({ id: "full-day", unlockedAt: today, label: "Full day logged", icon: "🌞", desc: "Log 4 food entries in one day." });
  if (totalLogs >= 30) next.push({ id: "30-entries", unlockedAt: today, label: "Dedicated", icon: "🏅", desc: "Log 30 food entries in total." });
  if (daysWithLog >= 7) next.push({ id: "one-week", unlockedAt: today, label: "One week strong", icon: "💪", desc: "Track food for 7 different days." });
  if (state.customFoods.length >= 1) next.push({ id: "custom-food", unlockedAt: today, label: "Home cook", icon: "🍳", desc: "Add your first custom food." });
  if (state.customRecipes.length >= 1) next.push({ id: "custom-recipe", unlockedAt: today, label: "Recipe builder", icon: "📖", desc: "Create your first custom recipe." });
  if (totalLogs >= 100) next.push({ id: "100-entries", unlockedAt: today, label: "Century", icon: "💯", desc: "Log 100 food entries." });
  if (daysWithLog >= 30) next.push({ id: "month-tracker", unlockedAt: today, label: "Monthly tracker", icon: "📆", desc: "Track food across a full month of days." });

  return next;
}

/* ---------- daily motivational message ---------- */
const MOTIVATIONS = [
  "Small, consistent choices add up faster than perfection.",
  "You don't have to be perfect — just show up today.",
  "A healthy day is built one meal at a time.",
  "Drink water before you reach for a snack.",
  "Balance beats restriction — aim for variety.",
  "Protein at each meal helps you stay full and focused.",
  "Fiber-rich foods help you feel satisfied longer.",
  "Celebrate what you logged, not just what you didn't.",
  "Your goals are a direction, not a deadline.",
  "Today's logging is tomorrow's insight.",
  "Hydration can make a bigger difference than you think.",
  "If a meal slipped, the next one is a fresh start.",
];
export function dailyMotivation(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return MOTIVATIONS[Math.abs(hash) % MOTIVATIONS.length];
}

/* ---------- goal-based suggestions ---------- */
export function goalSuggestions(profile: Profile, count = 6): Food[] {
  const pool = FOOD_DB.filter((f) => isSafeItem(f, profile));
  const ranked = pool
    .map((f) => {
      let score = 0;
      if (profile.goalType === "lose") score += f.kcal <= 300 ? 2 : 0;
      if (profile.goalType === "gain") score += f.kcal >= 400 ? 2 : 0;
      if (profile.goalType === "maintain" || profile.goalType === "general") score += (f.kcal >= 300 && f.kcal <= 500) ? 2 : 0;
      if (f.protein >= 15) score += 1;
      if (f.fiber >= 6) score += 1;
      if (!profile.comfortCarbs && f.carbs > 60) score -= 1;
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, count).map((x) => x.f);
}

export function healthyRecommendations(profile: Profile, count = 4): Food[] {
  const pool = FOOD_DB.filter((f) => isSafeItem(f, profile));
  const ranked = pool
    .map((f) => ({ f, density: f.kcal / Math.max(1, (f.protein + f.fiber * 2)) }))
    .sort((a, b) => a.density - b.density);
  return ranked.slice(0, count).map((x) => x.f);
}

/* ---------- date helpers ---------- */
export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export const todayStr = () => fmtDate(new Date());
export function daysBetween(a: string, b: string): number {
  const da = parseDate(a);
  const db = parseDate(b);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (true) {
    out.push(cur);
    if (cur === to) break;
    cur = addDays(cur, 1);
  }
  return out;
}
export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}
export function prettyDate(s: string): string {
  return parseDate(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/* ---------- safety ---------- */
export function isSafeItem(item: { name: string; allergens?: string[]; diet?: string[] }, profile: Profile): boolean {
  const allergies = profile.allergies || [];
  if ((item.allergens || []).some((a) =>
    allergies.some((u) => u.toLowerCase() === a.toLowerCase()))) return false;

  const diet = profile.diet;
  if (diet && diet !== "No preference" && item.diet && !(item.diet || []).includes(diet)) return false;

  const dislikes = (profile.dislikes || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  if (dislikes.some((d) => item.name.toLowerCase().includes(d))) return false;

  return true;
}

export function allergenConflicts(item: { allergens?: string[] }, profile: Profile): string[] {
  return (item.allergens || []).filter((a) => profile.allergies.some((u) => u.toLowerCase() === a.toLowerCase()));
}

/* ---------- plan generation ---------- */
export function pickMeal(mealType: MealType, profile: Profile, exclude: string[] = []): Food | null {
  const pool = FOOD_DB.filter((f) => f.meal === mealType && isSafeItem(f, profile) && !exclude.includes(f.name));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generateDayPlan(_date: string, profile: Profile): Plan {
  const plan: Plan = {};
  const used: string[] = [];
  for (const m of MEAL_TYPES) {
    const pick = pickMeal(m.type, profile, used);
    if (pick) {
      plan[m.type] = { food: pick.name, kcal: pick.kcal, cuisine: pick.cuisine };
      used.push(pick.name);
    }
  }
  return plan;
}

export function generateWeekPlan(startDate: string, profile: Profile): [string, Plan][] {
  const out: [string, Plan][] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(startDate, i);
    out.push([d, generateDayPlan(d, profile)]);
  }
  return out;
}

export function replaceMeal(plan: Plan, mealType: MealType, profile: Profile): Food | null {
  const existing = Object.values(plan).map((p) => p?.food || "");
  return pickMeal(mealType, profile, existing);
}

/* ---------- adherence ---------- */
export function dayCompletionPct(_date: string, plan: Plan | undefined, logs: Record<string, { status: string }> | undefined): number {
  if (!plan) return 0;
  const types = Object.keys(plan) as MealType[];
  if (!types.length) return 0;
  let score = 0;
  for (const t of types) {
    const s = logs?.[t]?.status;
    if (s === "done") score += 1;
    else if (s === "partial") score += 0.5;
  }
  return Math.round((score / types.length) * 100);
}

/* ---------- misc ---------- */
export function planItemConflicts(item: PlanItem | undefined, profile: Profile): string[] {
  if (!item) return [];
  const food = FOOD_DB.find((f) => f.name === item.food);
  const r = recipesByName[item.food];
  return allergenConflicts(food || r || { allergens: [] }, profile);
}

const recipesByName: Record<string, { allergens?: string[] }> = Object.fromEntries(
  RECIPES.map((r) => [r.name, r]),
);
