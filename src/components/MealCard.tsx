import { MEAL_TYPES, RECIPES } from "../data";
import type { MealType, MealTypeInfo, Plan, MealLogEntry } from "../types";
import { useStore } from "../store";
import { toast } from "../App";
import { replaceMeal } from "../domain";

export function mealInfo(type: MealType): MealTypeInfo {
  return MEAL_TYPES.find((m) => m.type === type)!;
}

interface Props {
  date: string;
  mealType: MealType;
  item: { food: string; kcal: number; cuisine: string };
  log?: MealLogEntry;
  showEdit?: boolean;
}

export default function MealCard({ date, mealType, item, log, showEdit = true }: Props) {
  const store = useStore();
  const info = mealInfo(mealType);
  const status = log?.status || "planned";
  const recipe = RECIPES.find((r) => r.name === item.food);

  function handleReplace() {
    const plan = store.plans[date] as Plan;
    const pick = replaceMeal(plan, mealType, store.profile);
    if (!pick) {
      toast("No safe alternatives match your restrictions", "warn");
      return;
    }
    store.update((s) => {
      const p = s.plans[date];
      if (p) {
        p[mealType] = { food: pick.name, kcal: pick.kcal, cuisine: pick.cuisine };
        if (s.mealLogs[date]) delete s.mealLogs[date][mealType];
      }
    });
    toast(`Replaced with ${pick.name}`, "success");
  }

  return (
    <div className="meal-card">
      <div className="meal-card-header">
        <span className="meal-emoji">{info.emoji}</span>
        <div>
          <div className="meal-type-name">{info.label} · {info.time}</div>
        </div>
        <span className={`badge ${status}`} style={{ marginLeft: "auto" }}>{status}</span>
      </div>
      <div className="meal-name">{item.food}</div>
      <div className="meal-meta">
        {item.kcal} kcal · {item.cuisine}
        {recipe ? ` · ⏱ ${recipe.prepTime} min` : ""}
      </div>
      <div className="meal-actions">
        {showEdit && (
          <>
            <button className="btn small primary" onClick={() => { store.setMealLog(date, mealType, "done"); toast("Logged ✓", "success"); }} disabled={status === "done"}>✓ Done</button>
            <button className="btn small" onClick={() => { store.setMealLog(date, mealType, "partial"); toast("Partial logged", "success"); }} disabled={status === "partial"}>~ Partial</button>
            <button className="btn small ghost" onClick={() => { store.setMealLog(date, mealType, "skipped"); toast("Skipped", "success"); }} disabled={status === "skipped"}>✕ Skip</button>
          </>
        )}
        <button className="btn small ghost" onClick={handleReplace}>🔄</button>
        {recipe && (
          <a className="btn small ghost" href={`/recipes?open=${recipe.id}`} onClick={(e) => {
            e.preventDefault();
            window.location.hash = "";
            window.history.pushState({}, "", `/recipes?open=${recipe.id}`);
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}>View</a>
        )}
      </div>
    </div>
  );
}
