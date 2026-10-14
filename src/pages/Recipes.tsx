import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DIET_TAGS, RECIPES } from "../data";
import { allergenConflicts, isSafeItem } from "../domain";
import { useStore } from "../store";
import { toast } from "../App";
import { useEffect } from "react";
import type { Recipe } from "../types";

export default function RecipesPage() {
  const store = useStore();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [diet, setDiet] = useState("");
  const [safeOnly, setSafeOnly] = useState(true);
  const [favOnly, setFavOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [kitchenInput, setKitchenInput] = useState("");
  const [kitchenChips, setKitchenChips] = useState<string[]>([]);
  const [kitchenResults, setKitchenResults] = useState<{ recipe: Recipe; matched: number; missing: number }[] | null>(null);

  useEffect(() => {
    const open = params.get("open");
    if (open) setOpenId(open);
  }, [params]);

  // Close recipe modal on Escape (keyboard accessibility)
  useEffect(() => {
    if (!openId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  const cuisines = useMemo(() => [...new Set(RECIPES.map((r) => r.cuisine))], []);

  const list = useMemo(() => RECIPES.filter((r) => {
    if (q && !(r.name.toLowerCase().includes(q) || r.ingredients.some((i) => i.name.toLowerCase().includes(q)))) return false;
    if (cuisine && r.cuisine !== cuisine) return false;
    if (diet && !r.diet.includes(diet)) return false;
    if (safeOnly && !isSafeItem(r, store.profile)) return false;
    if (favOnly && !store.favorites.includes(r.id)) return false;
    return true;
  }), [q, cuisine, diet, safeOnly, favOnly, store.profile, store.favorites]);

  const openRecipe = openId ? RECIPES.find((r) => r.id === openId) : null;

  function runKitchenSearch() {
    const terms = kitchenChips.map((c) => c.toLowerCase());
    const extra = kitchenInput.toLowerCase().trim();
    if (extra) terms.push(extra);
    if (!terms.length) return;

    const results = RECIPES.map((r) => {
      const names = r.ingredients.map((i) => i.name.toLowerCase());
      const matched = names.filter((n) => terms.some((t) => n.includes(t) || t.includes(n.split(" ")[0]))).length;
      return { recipe: r, matched, missing: r.ingredients.length - matched };
    })
      .filter((x) => x.matched > 0 && isSafeItem(x.recipe, store.profile))
      .sort((a, b) => b.matched - a.matched);

    setKitchenResults(results);
  }

  return (
    <>
      <div className="toolbar">
        <input className="input grow" placeholder="Search recipes or ingredients…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ width: "auto" }} value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
          <option value="">All cuisines</option>
          {cuisines.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="input" style={{ width: "auto" }} value={diet} onChange={(e) => setDiet(e.target.value)}>
          <option value="">All diets</option>
          {DIET_TAGS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <label className="check">
          <input type="checkbox" checked={safeOnly} onChange={(e) => setSafeOnly(e.target.checked)} />
          Hide allergy conflicts
        </label>
        <label className="check">
          <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} />
          ★ Favorites
        </label>
      </div>

      <div className="card">
        <div className="card-label">Kitchen search — what's in your fridge?</div>
        <div className="row gap wrap">
          <input
            className="input grow" placeholder="Enter an ingredient and press Enter…"
            value={kitchenInput}
            onChange={(e) => setKitchenInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && kitchenInput.trim()) {
                setKitchenChips((c) => [...c, kitchenInput.trim()]);
                setKitchenInput("");
              }
            }}
          />
          <button className="btn primary small" onClick={runKitchenSearch}>Find recipes</button>
          {kitchenChips.length > 0 && (
            <button className="btn ghost small" onClick={() => { setKitchenChips([]); setKitchenResults(null); }}>Clear</button>
          )}
        </div>
        {kitchenChips.length > 0 && (
          <div className="chip-grid" style={{ marginTop: "0.5rem" }}>
            {kitchenChips.map((c) => <span key={c} className="chip on">{c}</span>)}
          </div>
        )}
        {kitchenResults && (
          <div style={{ marginTop: "0.7rem" }}>
            {kitchenResults.length === 0 ? (
              <p className="muted small">No safe recipes match those ingredients. Try different terms — allergy filtering is never relaxed.</p>
            ) : (
              kitchenResults.slice(0, 6).map(({ recipe, missing }) => (
                <div className="track-row" key={recipe.id}>
                  <span><strong>{recipe.name}</strong> <span className="muted small">· ⏱ {recipe.prepTime} min</span></span>
                  <span className="muted small">{missing === 0 ? "All ingredients ✓" : `missing ${missing} ingredient${missing > 1 ? "s" : ""}`}</span>
                  <button className="btn small ghost" onClick={() => setOpenId(recipe.id)}>View →</button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="recipe-grid">
        {list.length === 0 ? (
          <div className="card" style={{ gridColumn: "1/-1" }}>
            <div className="empty-state">
              <span className="empty-icon">🔍</span>
              <h3>No recipes match</h3>
              <p>Try relaxing search or filters — allergy-safe filtering is never relaxed.</p>
            </div>
          </div>
        ) : list.map((r) => {
          const conflicts = allergenConflicts(r, store.profile);
          const fav = store.favorites.includes(r.id);
          return (
            <div key={r.id} className={`recipe-card${conflicts.length ? " locked" : ""}`} onClick={() => setOpenId(r.id)}>
              <h3 style={{ fontSize: "1rem" }}>{r.name}</h3>
              <div className="recipe-meta">
                <span className="tag">⏱ {r.prepTime} min</span>
                <span className="tag">🔥 {r.kcalPerServing} kcal</span>
                <span className="tag">{r.cuisine}</span>
                {r.diet.map((d) => <span key={d} className="tag diet">{d}</span>)}
              </div>
              {conflicts.length > 0 && (
                <div className="recipe-warn">⚠ Contains: {conflicts.join(", ")} — conflicts with your allergies</div>
              )}
              <button
                className="icon-btn" style={{ marginTop: "0.4rem" }}
                onClick={(e) => { e.stopPropagation(); store.toggleFavorite(r.id); toast(fav ? "Removed from favorites" : "Added to favorites ★"); }}
                aria-label="Toggle favorite"
              >{fav ? "★" : "☆"}</button>
            </div>
          );
        })}
      </div>

      {openRecipe && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpenId(null); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={openRecipe.name}>
            <button className="icon-btn modal-close" onClick={() => setOpenId(null)} aria-label="Close">✕</button>
            <h2 style={{ paddingRight: "2rem" }}>{openRecipe.name}</h2>
            <div className="recipe-meta">
              <span className="tag">⏱ {openRecipe.prepTime} min</span>
              <span className="tag">🍽 {openRecipe.servings} servings</span>
              <span className="tag">🔥 {openRecipe.kcalPerServing} kcal/serving</span>
              <span className="tag">{openRecipe.cuisine}</span>
              {openRecipe.diet.map((d) => <span key={d} className="tag diet">{d}</span>)}
            </div>
            {allergenConflicts(openRecipe, store.profile).length > 0 && (
              <div className="allergy-warn">
                ⚠ Allergy warning: contains {allergenConflicts(openRecipe, store.profile).join(", ")}. This conflicts with your stored allergies.
              </div>
            )}
            <h3 className="section-title">Ingredients</h3>
            <ul style={{ margin: "0 0 0 1.2rem" }}>
              {openRecipe.ingredients.map((i, idx) => <li key={idx}>{i.name} — {i.qty}</li>)}
            </ul>
            <h3 className="section-title">Instructions</h3>
            <ol style={{ margin: "0 0 0 1.2rem" }}>
              {openRecipe.steps.map((s, idx) => <li key={idx}>{s}</li>)}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
