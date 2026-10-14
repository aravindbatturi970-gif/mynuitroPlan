import { useState } from "react";
import { GROCERY_CATEGORIES, RECIPES } from "../data";
import { categorizeIngredient } from "../data";
import { useStore } from "../store";
import { todayStr, addDays } from "../domain";
import { toast } from "../App";
import type { GroceryItem } from "../types";

export default function Grocery() {
  const store = useStore();
  const [customName, setCustomName] = useState("");
  const [customCat, setCustomCat] = useState<string>(GROCERY_CATEGORIES[0]);

  function generateFromWeek() {
    const items = new Map<string, GroceryItem>();
    const start = todayStr();
    for (let i = 0; i < 7; i++) {
      const plan = store.plans[addDays(start, i)];
      if (!plan) continue;
      for (const item of Object.values(plan)) {
        if (!item) continue;
        const recipe = RECIPES.find((r) => r.name.toLowerCase() === item.food.toLowerCase());
        if (recipe) {
          for (const ing of recipe.ingredients) {
            const key = ing.name.toLowerCase();
            if (!items.has(key)) {
              items.set(key, { name: ing.name, qty: ing.qty, category: categorizeIngredient(ing.name), checked: false });
            }
          }
        } else {
          const key = item.food.toLowerCase();
          if (!items.has(key)) {
            items.set(key, { name: item.food, qty: "1 serving", category: categorizeIngredient(item.food), checked: false });
          }
        }
      }
    }
    const checkedMap = new Map(store.grocery.map((g) => [g.name.toLowerCase(), g.checked]));
    const generated = [...items.values()].map((it) => ({ ...it, checked: checkedMap.get(it.name.toLowerCase()) || false }));
    store.update((s) => {
      const customs = s.grocery.filter((g) => g.custom);
      s.grocery = [...generated, ...customs];
    });
    toast("Grocery list generated from your week plan", "success");
  }

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    store.update((s) => {
      s.grocery = [...s.grocery, { name, qty: "", category: customCat, checked: false, custom: true }];
    });
    setCustomName("");
    toast("Item added", "success");
  }

  const byCategory = GROCERY_CATEGORIES.map((cat) => ({
    cat,
    items: store.grocery.filter((g) => g.category === cat),
  })).filter((g) => g.items.length > 0);

  const checkedCount = store.grocery.filter((g) => g.checked).length;

  return (
    <>
      <div className="toolbar">
        <button className="btn primary" onClick={generateFromWeek}>Generate from this week's plan</button>
        <button className="btn ghost" onClick={() => {
          store.update((s) => { s.grocery = s.grocery.filter((g) => !g.checked); });
          toast("Checked items cleared", "success");
        }}>Clear checked ({checkedCount})</button>
        <button className="btn ghost" onClick={() => window.print()}>🖨️ Print</button>
      </div>

      <div className="card">
        <div className="row gap">
          <input className="input grow" placeholder="Add custom item…" value={customName} onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()} />
          <select className="input" style={{ width: "auto" }} value={customCat} onChange={(e) => setCustomCat(e.target.value)}>
            {GROCERY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className="btn primary" onClick={addCustom}>Add</button>
        </div>
      </div>

      {store.grocery.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon">🛒</span>
            <h3>Your list is empty</h3>
            <p>Generate a consolidated list from your weekly plan.</p>
          </div>
        </div>
      ) : (
        byCategory.map(({ cat, items }) => (
          <div className="card" key={cat}>
            <div className="card-label">{cat}</div>
            {items.map((it) => (
              <div className={`grocery-item${it.checked ? " checked" : ""}`} key={it.name}>
                <input
                  type="checkbox" checked={it.checked} aria-label={`Check ${it.name}`}
                  onChange={() => store.toggleGroceryCheck(it.name)}
                />
                <span>{it.name}</span>
                <span className="grocery-qty">{it.qty}</span>
                <button className="icon-btn" aria-label={`Remove ${it.name}`} onClick={() => store.removeGroceryItem(it.name)}>🗑</button>
              </div>
            ))}
          </div>
        ))
      )}
    </>
  );
}
