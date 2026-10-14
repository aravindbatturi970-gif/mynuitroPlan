export type MealType = "breakfast" | "lunch" | "snack" | "dinner";
export type LogStatus = "done" | "partial" | "skipped";

export interface Food {
  name: string;
  meal: MealType;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  allergens: string[];
  diet: string[];
  cuisine: string;
}

export interface Ingredient {
  name: string;
  qty: string;
}

export interface Recipe {
  id: string;
  name: string;
  cuisine: string;
  diet: string[];
  allergens: string[];
  prepTime: number;
  servings: number;
  mealType: MealType;
  kcalPerServing: number;
  ingredients: Ingredient[];
  steps: string[];
}

export interface PlanItem {
  food: string; // matches Food.name or Recipe.name
  kcal: number;
  cuisine: string;
}

export type Plan = Partial<Record<MealType, PlanItem>>;

export interface MealLogEntry {
  status: LogStatus;
  notes?: string;
  loggedAt: string;
}

export interface GroceryItem {
  name: string;
  qty: string;
  category: string;
  checked: boolean;
  custom?: boolean;
}

export interface Profile {
  name: string;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  diet: string;
  allergies: string[];
  dislikes: string; // comma separated
  waterGoalMl: number;
  clinicianNotes: string;
  onboarded: boolean;
  // nutrition target layer
  calorieTarget: number;        // daily kcal target (set from goals / profile)
  goalType: "lose" | "maintain" | "gain" | "general";
  goalNotes: string;
  proteinTarget: number;        // g
  comfortCarbs: boolean;        // user preference: do they want starchy carbs in plan?
  // reminder layer
  remindersEnabled: boolean;
  waterReminderMinutes: number; // interval in minutes, 0 = off
  mealReminderTimes: string[];  // HH:MM strings for breakfast/lunch/snack/dinner, empty = off
  reminderSound: boolean;
}

export interface AppState {
  theme: "dark" | "light";
  profile: Profile;
  plans: Record<string, Plan>; // date -> plan
  mealLogs: Record<string, Partial<Record<MealType, MealLogEntry>>>;
  water: Record<string, number>; // date -> ml
  dayNotes: Record<string, string>;
  weights: Record<string, number>; // date -> kg
  grocery: GroceryItem[];
  favorites: string[]; // recipe ids
  // nutrition tracker layer
  foodLog: FoodLogEntry[];    // free-form food journal (all dates)
  customFoods: CustomFood[];
  customRecipes: CustomRecipe[];
  frequentFoods: string[];    // names of frequently logged foods for quick-add
  // streaks / achievements
  achievements: Achievement[];
}

export interface MealTypeInfo {
  type: MealType;
  label: string;
  emoji: string;
  time: string;
}

// Free-form food journal entry
// id, date (YYYY-MM-DD), mealType, food name, quantity, nutrient estimate
// source: "fooddb" | "custom" | "recipe" | "estimated"
export interface FoodLogEntry {
  id: string;
  date: string;
  mealType: MealType;
  name: string;
  qty: string;                  // user-facing serving text, e.g. "1 cup", "200 g"
  servings: number;             // numeric multiplier applied to nutrient base
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  source: "fooddb" | "custom" | "recipe" | "estimated";
  createdAt: string;
}

// Custom food the user adds (per serving nutrition)
export interface CustomFood {
  id: string;
  name: string;
  mealType: MealType;           // suggested meal type
  servingText: string;          // e.g. "100 g"
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  allergens: string[];
  diet: string[];
  createdAt: string;
}

// Custom recipe the user creates
// kcalPerServing is used when the user logs "1 serving" of the recipe
export interface CustomRecipe {
  id: string;
  name: string;
  cuisine: string;
  diet: string[];
  allergens: string[];
  prepTime: number;
  servings: number;
  mealType: MealType;
  kcalPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  fiberPerServing: number;
  sodiumPerServing: number;
  ingredients: Ingredient[];
  steps: string[];
  createdAt: string;
}

// Achievement badge
// earned when criteria met; kept permanently once earned
export interface Achievement {
  id: string;
  unlockedAt: string;
  label: string;
  icon: string;
  desc: string;
}

