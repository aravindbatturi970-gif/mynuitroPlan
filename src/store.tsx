import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
// (useContext used below; ensure no 'unused' flags)
import type { AppState, GroceryItem, MealLogEntry, MealType, LogStatus, Profile, FoodLogEntry, CustomFood, CustomRecipe, Achievement } from "./types";
import { fmtDate } from "./domain";
import { FOOD_DB, RECIPES } from "./data";

const STORAGE_KEY = "nutriplan.v3";

const DEFAULT_PROFILE: Profile = {
  name: "",
  age: null,
  heightCm: null,
  weightKg: null,
  diet: "No preference",
  allergies: [],
  dislikes: "",
  waterGoalMl: 2000,
  clinicianNotes: "",
  onboarded: false,
  calorieTarget: 1800,
  goalType: "general",
  goalNotes: "",
  proteinTarget: 80,
  comfortCarbs: true,
  remindersEnabled: false,
  waterReminderMinutes: 60,
  mealReminderTimes: ["08:00", "13:00", "16:30", "20:00"],
  reminderSound: false,
};

export const DEFAULT_STATE: AppState = {
  theme: "dark",
  profile: { ...DEFAULT_PROFILE },
  plans: {},
  mealLogs: {},
  water: {},
  dayNotes: {},
  weights: {},
  grocery: [],
  favorites: [],
  foodLog: [],
  customFoods: [],
  customRecipes: [],
  frequentFoods: [],
  achievements: [],
};

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE, profile: { ...DEFAULT_PROFILE } };
    const saved = JSON.parse(raw) as Partial<AppState>;
    return {
      ...DEFAULT_STATE,
      ...saved,
      profile: { ...DEFAULT_PROFILE, ...(saved.profile || {}) },
    };
  } catch {
    return { ...DEFAULT_STATE, profile: { ...DEFAULT_PROFILE } };
  }
}

export interface AppStore extends AppState {
  update: (fn: (draft: AppState) => void) => void;
  setMealLog: (date: string, mealType: MealType, status: LogStatus, notes?: string) => void;
  addWater: (date: string, amount: number) => void;
  toggleAllergy: (a: string) => void;
  addAllergy: (a: string) => void;
  setProfile: (p: Partial<Profile>) => void;
  addGroceryItems: (items: GroceryItem[]) => void;
  toggleGroceryCheck: (name: string) => void;
  removeGroceryItem: (name: string) => void;
  toggleFavorite: (recipeId: string) => void;
  toggleTheme: () => void;
  resetAll: () => void;
  exportData: () => void;
  addFoodEntry: (entry: FoodLogEntry) => void;
  updateFoodEntry: (id: string, patch: Partial<FoodLogEntry>) => void;
  removeFoodEntry: (id: string) => void;
  addCustomFood: (f: CustomFood) => void;
  updateCustomFood: (id: string, patch: Partial<CustomFood>) => void;
  removeCustomFood: (id: string) => void;
  addCustomRecipe: (r: CustomRecipe) => void;
  removeCustomRecipe: (id: string) => void;
  addAchievement: (a: Achievement) => void;
}

const StoreContext = createContext<AppStore | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota exceeded — ignore */
    }
  }, [state]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", state.theme);
  }, [state.theme]);

  function update(fn: (draft: AppState) => void) {
    setState((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }

  const store: AppStore = useMemo(() => ({
    ...state,
    update,
    setMealLog: (date, mealType, status, notes) =>
      update((s) => {
        s.mealLogs[date] = { ...(s.mealLogs[date] || {}), [mealType]: { status, notes, loggedAt: new Date().toISOString() } as MealLogEntry };
      }),
    addWater: (date, amount) =>
      update((s) => {
        s.water[date] = Math.max(0, (s.water[date] || 0) + amount);
      }),
    addFoodEntry: (entry: FoodLogEntry) =>
      update((s) => {
        s.foodLog = [...s.foodLog, entry];
        s.frequentFoods = frequentFoodRank(s.frequentFoods, entry.name);
      }),
    updateFoodEntry: (id: string, patch: Partial<FoodLogEntry>) =>
      update((s) => {
        const i = s.foodLog.findIndex((e) => e.id === id);
        if (i >= 0) {
          s.foodLog[i] = { ...s.foodLog[i], ...patch };
        }
      }),
    removeFoodEntry: (id: string) =>
      update((s) => {
        s.foodLog = s.foodLog.filter((e) => e.id !== id);
      }),
    addCustomFood: (f: CustomFood) =>
      update((s) => { s.customFoods = [...s.customFoods, f]; }),
    updateCustomFood: (id: string, patch: Partial<CustomFood>) =>
      update((s) => {
        const i = s.customFoods.findIndex((c) => c.id === id);
        if (i >= 0) s.customFoods[i] = { ...s.customFoods[i], ...patch };
      }),
    removeCustomFood: (id: string) =>
      update((s) => { s.customFoods = s.customFoods.filter((c) => c.id !== id); }),
    addCustomRecipe: (r: CustomRecipe) =>
      update((s) => { s.customRecipes = [...s.customRecipes, r]; }),
    removeCustomRecipe: (id: string) =>
      update((s) => { s.customRecipes = s.customRecipes.filter((r) => r.id !== id); }),
    setProfile: (p) =>
      update((s) => {
        if (p.goalType !== undefined) {
          s.profile.calorieTarget = defaultCalorieTarget(p.goalType, s.profile);
          s.profile.proteinTarget = defaultProteinTarget(p.goalType, s.profile);
        }
        s.profile = { ...s.profile, ...p };
      }),
    addAchievement: (a: Achievement) =>
      update((s) => {
        if (!s.achievements.some((x) => x.id === a.id)) s.achievements = [...s.achievements, a];
      }),
    toggleAllergy: (a) =>
      update((s) => {
        s.profile.allergies = s.profile.allergies.includes(a)
          ? s.profile.allergies.filter((x) => x !== a)
          : [...s.profile.allergies, a];
      }),
    addAllergy: (a) =>
      update((s) => {
        if (a && !s.profile.allergies.includes(a)) s.profile.allergies = [...s.profile.allergies, a];
      }),
    addGroceryItems: (items) =>
      update((s) => {
        const have = new Set(s.grocery.map((g) => g.name.toLowerCase()));
        s.grocery = [...s.grocery, ...items.filter((i) => !have.has(i.name.toLowerCase()))];
      }),
    toggleGroceryCheck: (name) =>
      update((s) => {
        s.grocery = s.grocery.map((g) => (g.name === name ? { ...g, checked: !g.checked } : g));
      }),
    removeGroceryItem: (name) =>
      update((s) => {
        s.grocery = s.grocery.filter((g) => g.name !== name);
      }),
    toggleFavorite: (recipeId) =>
      update((s) => {
        s.favorites = s.favorites.includes(recipeId)
          ? s.favorites.filter((f) => f !== recipeId)
          : [...s.favorites, recipeId];
      }),
    toggleTheme: () =>
      update((s) => {
        s.theme = s.theme === "dark" ? "light" : "dark";
      }),
    resetAll: () => {
      localStorage.removeItem(STORAGE_KEY);
      setState({ ...DEFAULT_STATE, profile: { ...DEFAULT_PROFILE }, theme: "dark" });
    },
    exportData: () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nutriplan-export.json";
      a.click();
      URL.revokeObjectURL(url);
    },
  }), [state]);

  // ---- internal helpers ----

  // Simple frequency tracker: keep top ~20 frequently logged food names.
  function frequentFoodRank(current: string[], name: string): string[] {
    const lower = current.map((n) => n.toLowerCase());
    const idx = lower.indexOf(name.toLowerCase());
    if (idx >= 0) {
      const next = [...current];
      next.splice(idx, 1);
      return [name, ...next].slice(0, 20);
    }
    return [name, ...current].slice(0, 20);
  }

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): AppStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used within StoreProvider");
  return store;
}

// ---- internal helpers ----
import { defaultCalorieTarget, defaultProteinTarget, todayStr as _todayStr } from "./domain";
