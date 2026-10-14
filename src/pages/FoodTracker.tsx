import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { MEAL_TYPES, FOOD_DB } from "../data";
import { useStore } from "../store";
import { todayStr, dayNutrition, nutritionScore, portionScaled } from "../domain";
import { toast } from "../App";

import type { MealType } from "../types";

interface FoodEntry {
  id: string;
  date: string;
  mealType: MealType;
  name: string;
  qty: string;
  servings: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  source: string;
  createdAt: string;
}

const NUTRIENT_ROWS = [
  { key: "kcal", label: "Calories", unit: "kcal", color: "var(--accent-text)", barColor: "var(--accent)" },
  { key: "protein", label: "Protein", unit: "g", color: "var(--accent-text)", barColor: "var(--accent)" },
  { key: "carbs", label: "Carbs", unit: "g", color: "var(--info)", barColor: "var(--info)" },
  { key: "fat", label: "Fat", unit: "g", color: "var(--warning)", barColor: "var(--warning)" },
  { key: "fiber", label: "Fiber", unit: "g", color: "var(--success)", barColor: "var(--success)" },
  { key: "sodium", label: "Sodium", unit: "mg", color: "var(--danger)", barColor: "var(--danger)" },
];

function clamp(v: number, min = 0, max = 9999) { return Math.max(min, Math.min(max, v)); }

export default function FoodTracker() {
  const store = useStore();
  const date = todayStr();
  const profile = store.profile;
  const goal = profile.calorieTarget || 1800;
  const goalLabel = { lose: "Lose", maintain: "Maintain", gain: "Gain", general: "General" }[profile.goalType] ?? "General";

  const water = store.water[date] || 0;
  const waterGoal = profile.waterGoalMl || 2000;
  const plan = store.plans[date];
  const planLogs = store.mealLogs[date] || {};
  const planDone = plan ? Object.entries(plan).filter(([, p]) => { const key = (p as PlanItem & { mealType?: MealType }).mealType; return (planLogs[key] as any)?.status === 'done'; }).length : 0;
  const planTotal = plan ? Object.keys(plan).length : 0;
  const planPct = planTotal ? Math.round((planDone / planTotal) * 100) : 0;

  const todayLog = useMemo(() => store.foodLog.filter((e) => e.date === date), [store.foodLog, date]);
  const totals = useMemo(() => dayNutrition(date, store.foodLog), [store.foodLog, date]);
  const score = useMemo(() => nutritionScore(totals, profile, water, waterGoal, planTotal ? planDone / planTotal : 0), [totals, profile, water, waterGoal, planTotal, planDone]);
  const remaining = Math.max(0, goal - totals.kcal);

  const [qf, setQf] = useState({ query: "", mealType: "lunch" as MealType, qty: "1 serving", servings: 1 });
  const [showingForm, setShowingForm] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ food: typeof FOOD_DB[0]; score: number }>>([]);
  const [customMode, setCustomMode] = useState<"food" | "recipe" | null>(null);
  const [custom, setCustom] = useState({
    name: "", mealType: "lunch" as MealType, qty: "1 serving", kcal: 200, protein: 10, carbs: 20, fat: 5, fiber: 2, sodium: 100,
    allergens: "", diet: "", cuisine: "", prepTime: 15, servings: 2, ingredients: "", steps: ""
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<{
    name: string; qty: string; servings: number; kcal: number; protein: number; carbs: number; fat: number; fiber: number; sodium: number; mealType: MealType
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!qf.query.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      const q = qf.query.trim().toLowerCase();
      const pool = FOOD_DB.filter((f) => isSafeForProfile(f, profile));
      const scored = pool
        .map((f) => ({ food: f, score: matchScore(q, f.name.toLowerCase()) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
      setSearchResults(scored);
    }, 120);
    return () => clearTimeout(t);
  }, [qf.query, profile]);

  function isSafeForProfile(f: typeof FOOD_DB[0]) {
    return !profile.allergies.some((a) => (f.allergens || []).some((x) => x.toLowerCase() === a.toLowerCase())) &&
      (profile.diet === "No preference" || (f.diet || []).includes(profile.diet));
  }

  function matchScore(q: string, name: string) {
    if (name === q) return 3;
    if (name.startsWith(q) || name.endsWith(q)) return 2;
    if (name.includes(q)) return 1.5;
    const qt = q.split(/\s+/).filter(Boolean);
    const nt = name.split(/\s+/).filter(Boolean);
    if (qt.length && nt.length) {
      let hit = 0;
      for (const t of qt) { if (nt.some((n) => n.includes(t) || t.includes(n))) hit++; }
      if (hit === qt.length) return 1;
    }
    return 0;
  }

  function applySearch(food: typeof FOOD_DB[0]) {
    setQf((p) => ({ ...p, query: food.name, mealType: food.meal, qty: food.name, servings: 1 }));
    setSearchResults([]);
  }

  function onQuickAdd(name: string) {
    const entry = inlineEntry(name, qf.mealType, "1 serving", 1);
    store.addFoodEntry(entry);
    toast(`${name} added`, "success");
  }

  function inlineEntry(name: string, mealType: MealType, qty: string, servings: number) {
    const e = estimateInline(name, mealType, qty, servings);
    return e;
  }

  function estimateInline(name: string, mealType: MealType, qty: string, servings: number) {
    const cleaned = name.trim();
    if (!cleaned) return makeEntry(cleaned, mealType, qty, servings, 0, 0, 0, 0, 0, 0);
    const db = matchDb(cleaned, mealType);
    if (db) return makeEntry(cleaned, mealType, qty, servings, db.kcal, db.protein, db.carbs, db.fat, db.fiber, db.sodium ?? 0);
    const est = heuristic(cleaned);
    return makeEntry(cleaned, mealType, qty, servings,
      est.kcal, est.protein, est.carbs, est.fat, est.fiber, est.sodium);
  }

  function makeEntry(name: string, mealType: MealType, qty: string, servings: number, kcal: number, p: number, c: number, f: number, fib: number, na: number) {
    const scale = Math.max(0, servings);
    return {
      id: "f_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      date: todayStr(), mealType, name: name || "(unnamed)",
      qty, servings,
      kcal: Math.round(kcal * scale),
      protein: Math.round(p * scale * 10) / 10,
      carbs: Math.round(c * scale * 10) / 10,
      fat: Math.round(f * scale * 10) / 10,
      fiber: Math.round(fib * scale * 10) / 10,
      sodium: Math.round(na * scale),
      source: "estimated",
      createdAt: new Date().toISOString(),
    };
  }

  function matchDb(name: string, mealType: MealType) {
    const low = name.toLowerCase();
    if (store.customFoods.length) {
      const cf = store.customFoods.find((c) => c.name.toLowerCase() === low);
      if (cf) return { kcal: cf.kcal, protein: cf.protein, carbs: cf.carbs, fat: cf.fat, fiber: cf.fiber, sodium: cf.sodium };
    }
    if (store.customRecipes.length) {
      const cr = store.customRecipes.find((r) => r.name.toLowerCase() === low);
      if (cr) return { kcal: cr.kcalPerServing, protein: cr.proteinPerServing, carbs: cr.carbsPerServing, fat: cr.fatPerServing, fiber: cr.fiberPerServing, sodium: cr.sodiumPerServing };
    }
    const exact = FOOD_DB.find((f) => f.name.toLowerCase() === low && isSafeForProfile(f));
    if (exact) return { kcal: exact.kcal, protein: exact.protein, carbs: exact.carbs, fat: exact.fat, fiber: exact.fiber, sodium: exact.sodium ?? 0 };
    const contains = FOOD_DB.find((f) => f.name.toLowerCase().includes(low) && isSafeForProfile(f));
    if (contains) return { kcal: contains.kcal, protein: contains.protein, carbs: contains.carbs, fat: contains.fat, fiber: contains.fiber, sodium: contains.sodium ?? 0 };
    const tokenScore = FOOD_DB.filter(isSafeForProfile).map((f) => ({ f, s: tokenOverlap(low, f.name.toLowerCase()) })).sort((a, b) => b.s - a.s);
    const best = tokenScore[0];
    if (best && best.s > 0) return { kcal: best.f.kcal, protein: best.f.protein, carbs: best.f.carbs, fat: best.f.fat, fiber: best.f.fiber, sodium: best.f.sodium ?? 0 };
    const est = heuristic(cleaned(name));
    return est ? { kcal: est.kcal, protein: est.protein, carbs: est.carbs, fat: est.fat, fiber: est.fiber, sodium: est.sodium } : null;
  }

  function cleaned(s: string) { return s.trim(); }

  function tokenOverlap(a: string, b: string) {
    const at = a.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 1);
    const bt = b.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 1);
    if (!at.length || !bt.length) return 0;
    let hit = 0;
    for (const t of at) { if (bt.some((x) => x === t || x.includes(t) || t.includes(x))) hit++; }
    return hit / Math.max(at.length, bt.length);
  }

  function heuristic(name: string) {
    const rules: Array<{ pattern: RegExp; est: { kcal: number; protein: number; carbs: number; fat: number; fiber: number; sodium: number } }> = [
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
    for (const r of rules) { if (r.pattern.test(name)) return r.est; }
    return { kcal: 120, protein: 5, carbs: 15, fat: 4, fiber: 2, sodium: 30 };
  }

  const handleAdd = useCallback(() => {
    const name = qf.query.trim() || custom.name.trim();
    if (!name) { toast("Enter a food name", "warn"); return; }
    let entry = estimateInline(name, qf.mealType, qf.qty, qf.servings);
    store.addFoodEntry(entry);
    if (customMode) {
      if (customMode === "food") {
        store.addCustomFood({
          id: "cf_" + Date.now(),
          name,
          mealType: qf.mealType,
          kcal: entry.kcal,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          fiber: entry.fiber,
          sodium: entry.sodium,
          allergens: parseList(custom.allergens),
          diet: parseList(custom.diet),
          servingText: qf.qty,
          createdAt: new Date().toISOString(),
        });
        toast(`Saved “${name}” as custom food`, "success");
      } else {
        store.addCustomRecipe({
          id: "cr_" + Date.now(),
          name,
          cuisine: custom.cuisine || "Custom",
          diet: parseList(custom.diet),
          allergens: parseList(custom.allergens),
          mealType: qf.mealType,
          prepTime: Math.max(1, custom.prepTime || 15),
          servings: Math.max(1, custom.servings || 2),
          kcalPerServing: entry.kcal,
          proteinPerServing: entry.protein,
          carbsPerServing: entry.carbs,
          fatPerServing: entry.fat,
          fiberPerServing: entry.fiber,
          sodiumPerServing: entry.sodium,
          ingredients: parseLines(custom.ingredients),
          steps: parseSteps(custom.steps),
          createdAt: new Date().toISOString(),
        });
        toast(`Saved “${name}” as custom recipe`, "success");
      }
    }
    setShowingForm(false);
    setCustomMode(null);
    resetCustom();
    toast(`${name} added to today`, "success");
  }, [qf, custom, customMode, profile, store]);

  function parseList(s: string) { return s.split(",").map((x) => x.trim()).filter(Boolean); }
  function parseLines(s: string) { return s.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [n, ...rest] = l.split(":").map((x) => x.trim()); return { name: n || l, qty: rest.join(":") || "1 serving" }; }); }
  function parseSteps(s: string) { return s.split("\n").map((l) => l.trim()).filter(Boolean); }
  function resetCustom() { setCustom({ name: "", mealType: "lunch", qty: "1 serving", kcal: 200, protein: 10, carbs: 20, fat: 5, fiber: 2, sodium: 100, allergens: "", diet: "", cuisine: "", prepTime: 15, servings: 2, ingredients: "", steps: "" }); }

  const openEdit = (e: FoodEntry) => {
    setEditId(e.id);
    setEditVals({ name: e.name, qty: e.qty, servings: e.servings, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, fiber: e.fiber, sodium: e.sodium, mealType: e.mealType });
  };

  const saveEdit = () => {
    if (!editId || !editVals) return;
    const scaled = portionScaled({
      id: editId, date: todayStr(), mealType: editVals.mealType, name: editVals.name, qty: editVals.qty,
      servings: editVals.servings, kcal: editVals.kcal, protein: editVals.protein, carbs: editVals.carbs,
      fat: editVals.fat, fiber: editVals.fiber, sodium: editVals.sodium, source: "estimated",
      createdAt: new Date().toISOString(),
    }, editVals.servings);
    store.updateFoodEntry(editId, {
      name: scaled.name, qty: scaled.qty, servings: scaled.servings,
      kcal: scaled.kcal, protein: scaled.protein, carbs: scaled.carbs, fat: scaled.fat, fiber: scaled.fiber, sodium: scaled.sodium,
      mealType: scaled.mealType,
    });
    setEditId(null); setEditVals(null);
    toast("Entry updated", "success");
  };

  const delEntry = (id: string) => { store.removeFoodEntry(id); toast("Entry removed", "success"); };
  const quickAdd = (name: string) => { onQuickAdd(name); };

  const byMeal = useMemo(() => {
    const m: Record<string, FoodEntry[]> = {};
    for (const e of todayLog) { (m[e.mealType] = m[e.mealType] || []).push(e); }
    return m;
  }, [todayLog]);

  return (
    <>
      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "stretch" }}>
        <div style={{ flex: "2 1 280px" }}>
          <div className="card-label">Today's nutrition</div>
          <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
            <div><span className="stat-value" style={{ fontSize: "1.7rem" }}>{totals.kcal}</span><span className="stat-cap" style={{ marginLeft: "0.2rem" }}>kcal eaten</span></div>
            <div><span className={`stat-value${remaining <= 0 ? " danger-text" : ""}`} style={{ fontSize: "1.7rem" }}>{remaining}</span><span className="stat-cap" style={{ marginLeft: "0.2rem" }}>remaining</span></div>
            <div><span className="stat-value" style={{ fontSize: "1.3rem" }}>{planPct}%</span><span className="stat-cap" style={{ marginLeft: "0.2rem" }}>meals done</span></div>
          </div>
          <div className="bar" style={{ height: 10, marginTop: "0.5rem", background: "var(--surface-2)" }}>
            <div className="bar-fill" style={{ width: `${Math.min(100, (totals.kcal / goal) * 100)}%`, background: totals.kcal > goal ? "var(--danger)" : "linear-gradient(90deg, var(--accent), var(--info))" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.4rem", fontSize: "0.72rem", color: "var(--text-low)" }}>
            <span>0</span>
            <span>{goal} kcal goal ({goalLabel})</span>
          </div>
        </div>
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: "0.6rem", alignItems: "flex-end" }}>
          <div style={{ textAlign: "right" }}>
            <div className="stat-value" style={{ fontSize: "1.5rem" }}>{score}<span className="muted small" style={{ marginLeft: "0.2rem" }}>/100</span></div>
            <div className="stat-cap">nutrition score</div>
          </div>
          <div className="ring-wrap" style={{ margin: "0 auto" }}>
            <WaterRingCompact value={water} goal={waterGoal} />
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          {!showingForm ? (
            <div className="card hoverable" style={{ cursor: "pointer" }} onClick={() => { setShowingForm(true); inputRef.current?.focus(); setSearchResults([]); }}>
              <div className="card-label">+ Add food</div>
              <p className="muted small">Search the food database, add a custom food or recipe, or use a quick-add favorite.</p>
              <div className="row gap" style={{ marginTop: "0.8rem", flexWrap: "wrap" }}>
                {store.frequentFoods.length === 0 ? (
                  <span className="muted small">Log food to build quick-add favorites.</span>
                ) : (
                  store.frequentFoods.slice(0, 6).map((name) => (
                    <button key={name} className="chip" onClick={(e) => { e.stopPropagation(); quickAdd(name); setShowingForm(false); }}>{name}</button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-label">Add food</div>
              <div className="form-grid" style={{ marginBottom: "0.6rem" }}>
                <label>Meal type
                  <select className="input" style={{ width: "100%" }} value={qf.mealType} onChange={(e) => setQf((p) => ({ ...p, mealType: e2p(e) }))}>
                    {MEAL_TYPES.map((m) => <option key={m.type} value={m.type}>{m.emoji} {m.label}</option>)}
                  </select>
                </label>
                <label>Quantity / serving
                  <input className="input" value={qf.qty} onChange={(e) => setQf((p) => ({ ...p, qty: e2p(e) }))} placeholder="e.g. 1 cup, 200 g" />
                </label>
                <label>Servings
                  <input className="input" type="number" min={0.25} max={20} step={0.25} value={qf.servings} onChange={(e) => setQf((p) => ({ ...p, servings: Math.max(0.25, parseFloat(e2p(e)) || 1) }))} />
                </label>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.6rem" }}>
                <input ref={inputRef} className="input" value={qf.query} onChange={(e) => setQf((p) => ({ ...p, query: e2p(e) }))} placeholder="Search food database..." style={{ flex: 1 }} />
                <button className="btn ghost small" onClick={() => { setCustomMode("food"); }}>Custom food</button>
                <button className="btn ghost small" onClick={() => { setCustomMode("recipe"); }}>Custom recipe</button>
                <button className="btn ghost small" onClick={() => { setShowingForm(false); setSearchResults([]); setQf((p) => ({ ...p, query: "" })); }}>Cancel</button>
              </div>

              {searchResults.length > 0 && (
                <div className="card" style={{ padding: "0.6rem", marginBottom: "0.6rem", background: "var(--surface-2)", border: "1px dashed var(--border)" }}>
                  <div className="small muted" style={{ marginBottom: "0.4rem" }}>Suggestions (click to add)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {searchResults.map(({ food }) => (
                      <button key={food.name} className="chip" style={{ justifyContent: "flex-start", textAlign: "left" }} onClick={() => applySearch(food)}>
                        {food.name} <span className="muted small">· {food.kcal} kcal</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {customMode && (
                <div className="card" style={{ background: "var(--surface-2)", border: "1px solid var(--accent)", margin: "0.6rem 0" }}>
                  <div className="card-label" style={{ color: "var(--accent-text)" }}>{customMode === "food" ? "Custom food per serving" : "Custom recipe per serving"}</div>
                  <div className="form-grid">
                    <label>Name
                      <input className="input" value={custom.name} onChange={(e) => setCustom((c) => ({ ...c, name: e2p(e) }))} placeholder="e.g. Peanut butter sandwich" />
                    </label>
                    {customMode === "recipe" && (
                      <label>Cuisine
                        <input className="input" value={custom.cuisine} onChange={(e) => setCustom((c) => ({ ...c, cuisine: e2p(e) }))} placeholder="e.g. Indian" />
                      </label>
                    )}
                    {customMode === "recipe" && (
                      <label>Prep time (min)
                        <input className="input" type="number" min={1} max={480} value={custom.prepTime} onChange={(e) => setCustom((c) => ({ ...c, prepTime: Math.max(1, parseInt(e2p(e)) || 15) }))} />
                      </label>
                    )}
                    {customMode === "recipe" && (
                      <label>Servings
                        <input className="input" type="number" min={1} max={50} value={custom.servings} onChange={(e) => setCustom((c) => ({ ...c, servings: Math.max(1, parseInt(e2p(e)) || 2) }))} />
                      </label>
                    )}
                  </div>
                  <div className="card-label" style={{ marginTop: "0.6rem", marginBottom: "0.3rem" }}>Per serving nutrients</div>
                  <div className="form-grid">
                    <label>Calories (kcal)
                      <input className="input" type="number" min={0} max={2000} value={custom.kcal} onChange={(e) => setCustom((c) => ({ ...c, kcal: clamp(parseFloat(e2p(e)) || 0) }))} />
                    </label>
                    <label>Protein (g)
                      <input className="input" type="number" min={0} max={200} step={0.1} value={custom.protein} onChange={(e) => setCustom((c) => ({ ...c, protein: clamp(parseFloat(e2p(e)) || 0, 0, 200) }))} />
                    </label>
                    <label>Carbs (g)
                      <input className="input" type="number" min={0} max={500} step={0.1} value={custom.carbs} onChange={(e) => setCustom((c) => ({ ...c, carbs: clamp(parseFloat(e2p(e)) || 0, 0, 500) }))} />
                    </label>
                    <label>Fat (g)
                      <input className="input" type="number" min={0} max={200} step={0.1} value={custom.fat} onChange={(e) => setCustom((c) => ({ ...c, fat: clamp(parseFloat(e2p(e)) || 0, 0, 200) }))} />
                    </label>
                    <label>Fiber (g)
                      <input className="input" type="number" min={0} max={100} step={0.1} value={custom.fiber} onChange={(e) => setCustom((c) => ({ ...c, fiber: clamp(parseFloat(e2p(e)) || 0, 0, 100) }))} />
                    </label>
                    <label>Sodium (mg)
                      <input className="input" type="number" min={0} max={5000} value={custom.sodium} onChange={(e) => setCustom((c) => ({ ...c, sodium: clamp(parseInt(e2p(e)) || 0, 0, 5000) }))} />
                    </label>
                  </div>
                  <div className="form-grid" style={{ marginTop: "0.5rem" }}>
                    <label>Suggested meal
                      <select className="input" style={{ width: "100%" }} value={custom.mealType} onChange={(e) => setCustom((c) => ({ ...c, mealType: e2p(e) }))}>
                        {MEAL_TYPES.map((m) => <option key={m.type} value={m.type}>{m.label}</option>)}
                      </select>
                    </label>
                    <label>Serving text
                      <input className="input" value={custom.qty} onChange={(e) => setCustom((c) => ({ ...c, qty: e2p(e) }))} placeholder="e.g. 100 g" />
                    </label>
                    <label>Allergens (comma separated)
                      <input className="input" value={custom.allergens} onChange={(e) => setCustom((c) => ({ ...c, allergens: e2p(e) }))} placeholder="Eggs, Gluten" />
                    </label>
                    <label>Diet tags (comma separated)
                      <input className="input" value={custom.diet} onChange={(e) => setCustom((c) => ({ ...c, diet: e2p(e) }))} placeholder="Vegetarian, Gluten-free" />
                    </label>
                  </div>
                  {customMode === "recipe" && (
                    <>
                      <div className="card-label" style={{ marginTop: "0.6rem", marginBottom: "0.3rem" }}>Ingredients (one per line, name: qty)</div>
                      <textarea className="input" rows={4} value={custom.ingredients} onChange={(e) => setCustom((c) => ({ ...c, ingredients: e2p(e) }))} placeholder={"Onion: 1\nTomato: 2\nGhee: 1 tbsp"} />
                      <div className="card-label" style={{ marginTop: "0.6rem", marginBottom: "0.3rem" }}>Steps (one per line)</div>
                      <textarea className="input" rows={4} value={custom.steps} onChange={(e) => setCustom((c) => ({ ...c, steps: e2p(e) }))} placeholder={"Step 1: …\nStep 2: …"} />
                    </>
                  )}
                  <div className="row gap" style={{ marginTop: "0.8rem" }}>
                    <button className="btn primary" onClick={handleAdd}>Add {customMode === "food" ? "custom food" : "recipe"}</button>
                    <button className="btn ghost" onClick={() => { setCustomMode(null); resetCustom(); }}>Cancel</button>
                  </div>
                </div>
              )}

              <div className="row gap" style={{ marginTop: "0.6rem" }}>
                <button className="btn primary" onClick={handleAdd}>Add to today</button>
                {!customMode && qf.query.trim() && (
                  <button className="btn ghost" onClick={() => { setQf((p) => ({ ...p, query: "" })); setSearchResults([]); }}>Clear search</button>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="section-title">Today's food <span className="muted small" style={{ fontWeight: 500 }}>({totals.count} items)</span></div>
          {todayLog.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <span className="empty-icon">🍽️</span>
                <h3>Nothing logged yet today</h3>
                <p>Add a food entry to see calories and nutrients here.</p>
                <button className="btn primary" onClick={() => { setShowingForm(true); inputRef.current?.focus(); }}>+ Add food</button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ display: "flex", flexDirection: "column" }}>
              {MEAL_TYPES.map((m) => {
                const items = (byMeal[m.type] || []).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                if (!items.length) return null;
                return (
                  <div key={m.type} style={{ marginBottom: "0.6rem", paddingBottom: "0.6rem", borderBottom: "1px solid var(--border)" }}>
                    <div className="small muted" style={{ marginBottom: "0.3rem" }}>
                      {m.emoji} {m.label} — {items.reduce((s, e) => s + e.kcal, 0)} kcal total
                    </div>
                    {items.map((e) => (
                      <div key={e.id} className="track-row" style={{ paddingLeft: "0.4rem", paddingRight: "0.4rem" }}>
                        <div style={{ flex: "1 1 200px" }}>
                          <strong>{e.name}</strong>
                          <span className="muted small" style={{ marginLeft: "0.4rem" }}>{e.qty} · {e.servings}× · {e.source}</span>
                        </div>
                        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
                          <span className="muted small" style={{ fontVariantNumeric: "tabular-nums" }}>{e.kcal} kcal</span>
                          <button className="btn small ghost" onClick={() => openEdit(e)} title="Edit portion & nutrients">Edit</button>
                          <button className="btn small danger" onClick={() => delEntry(e.id)} title="Remove entry">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="section-title" style={{ marginTop: "1.2rem" }}>Nutrient breakdown</div>
      <div className="grid-2">
        {NUTRIENT_ROWS.map((r) => {
          const val = totals[r.key];
          const isKcal = r.key === "kcal";
          const target = isKcal ? goal : (r.key === "protein" ? profile.proteinTarget : r.key === "carbs" ? (profile.goalType === "lose" ? 180 : 220) : r.key === "fat" ? 60 : r.key === "fiber" ? 25 : 2300);
          const pct = target > 0 ? Math.min(100, (val / target) * 100) : 0;
          return (
            <div key={r.key} className="card">
              <div className="card-label">{r.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginBottom: "0.4rem" }}>
                <span className="stat-value" style={{ fontSize: "1.4rem", color: r.color }}>{val}</span>
                <span className="stat-cap">{r.unit}</span>
                <span className="muted small" style={{ marginLeft: "0.3rem" }}>of {target} {r.unit}</span>
              </div>
              <div className="bar" style={{ height: 8 }}><div className="bar-fill" style={{ width: `${pct}%`, background: r.barColor }} /></div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: "1rem", background: "var(--surface-2)", border: "1px solid var(--accent)", textAlign: "center" }}>
        <div className="card-label" style={{ color: "var(--accent-text)", textAlign: "center" }}>Today's note</div>
        <p style={{ fontSize: "var(--fs-md)", color: "var(--text-hi)", maxWidth: "600px", margin: "0 auto" }}>{dailyMotivation(date)}</p>
      </div>
    </>
  );
}

function e2p(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) { return e.target.value; }

function WaterRingCompact({ value, goal }: { value: number; goal: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / goal) * 100)));
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden="true">
      <circle cx="46" cy="46" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="6" />
      <circle cx="46" cy="46" r={r} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        style={{ transition: "stroke-dashoffset 0.4s ease" }} />
      <text x="46" y="44" textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-hi)" fontSize="14" fontWeight="700" fontFamily="inherit">{value}</text>
      <text x="46" y="58" textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-low)" fontSize="9" fontFamily="inherit">/ {goal} ml</text>
    </svg>
  );
}

function dailyMotivation(seed: string): string {
  const msgs = [
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
  let hash = 0;
  for (let i = 0; i < seed.length; i++) { hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0; }
  return msgs[Math.abs(hash) % msgs.length];
}

function mealInfo(mealType: MealType): { label: string; emoji: string; time: string } {
  return MEAL_TYPES.find((m) => m.type === mealType) || { label: mealType, emoji: "🍽️", time: "12:00" };
}
