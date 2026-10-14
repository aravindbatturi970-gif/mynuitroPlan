import { MEAL_TYPES } from "../data";
import { useStore } from "../store";
import { todayStr, dayCompletionPct, prettyDate } from "../domain";
import { toast } from "../App";
import MealCard, { mealInfo } from "../components/MealCard";
import WaterRing from "../components/WaterRing";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const store = useStore();
  const navigate = useNavigate();
  const date = todayStr();
  const plan = store.plans[date];
  const logs = store.mealLogs[date] || {};

  const next = plan
    ? MEAL_TYPES.find((m) => plan[m.type] && !logs[m.type])
    : undefined;

  const completion = dayCompletionPct(date, plan, logs);
  const water = store.water[date] || 0;
  const goal = store.profile.waterGoalMl || 2000;

  const week = Array.from({ length: 7 }, (_, i) => addDaysSafe(i));

  function addDaysSafe(offset: number) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return d;
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>
        {store.profile.name ? `Hi ${store.profile.name} 👋` : "Welcome 👋"}
        <span className="muted" style={{ fontWeight: 500, fontSize: "0.85rem", marginLeft: "0.6rem" }}>
          {prettyDate(date)}
        </span>
      </h2>

      {/* Next meal hero */}
      <div className="card" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem" }}>
        <div style={{ flex: "1 1 260px" }}>
          <div className="card-label">Next up</div>
          {next ? (
            <>
              <div className="meal-name" style={{ fontSize: "1.15rem" }}>{plan![next.type]!.food}</div>
              <div className="meal-meta">
                {mealInfo(next.type).label} · {plan![next.type]!.kcal} kcal · {mealInfo(next.type).time}
              </div>
            </>
          ) : plan ? (
            <>
              <div className="meal-name" style={{ fontSize: "1.15rem" }}>All logged for today! 🎉</div>
              <div className="meal-meta">Great consistency today.</div>
            </>
          ) : (
            <>
              <div className="meal-name" style={{ fontSize: "1.15rem" }}>No meals planned yet</div>
              <div className="meal-meta">Generate a plan from the My Plan view.</div>
            </>
          )}
        </div>
        {plan && !next && null}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn primary" disabled={!next} onClick={() => {
            if (next) {
              store.setMealLog(date, next.type, "done");
              toast(`${mealInfo(next.type).label} logged!`, "success");
            }
          }}>Quick log ✓</button>
          <button className="btn" onClick={() => navigate("/plan")}>My Plan</button>
        </div>
      </div>

      <h3 className="section-title">Today's meals</h3>
      {plan ? (
        <div className="meal-grid">
          {MEAL_TYPES.map((m) => {
            const item = plan[m.type];
            if (!item) return null;
            return <MealCard key={m.type} date={date} mealType={m.type} item={item} log={logs[m.type]} />;
          })}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon">🍽️</span>
            <h3>No meals yet</h3>
            <p>Create your first day plan to see meals here.</p>
            <button className="btn primary" onClick={() => navigate("/plan")}>Go to My Plan</button>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ marginTop: "1rem" }}>
        <div className="card" style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <WaterRing value={water} goal={goal} />
          <div>
            <div className="card-label">Hydration</div>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              <button className="btn small primary" onClick={() => { store.addWater(date, 250); toast("+250 ml 💧", "success"); }}>+250 ml</button>
              <button className="btn small" onClick={() => { store.addWater(date, 500); toast("+500 ml 💧", "success"); }}>+500 ml</button>
              <button className="btn small ghost" onClick={() => { store.addWater(date, -250); }}>undo</button>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-label">Daily completion</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem" }}>
            <span className="stat-value">{completion}%</span>
            <span className="muted small">
              {Object.keys(logs).length
                ? `${Object.keys(logs).length} meal${Object.keys(logs).length > 1 ? "s" : ""} logged today`
                : "No meals logged yet"}
            </span>
          </div>
          <div className="bar" style={{ marginTop: "0.5rem" }}><div className="bar-fill" style={{ width: `${completion}%` }} /></div>
          <div className="card-label" style={{ marginTop: "0.9rem" }}>This week</div>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            {week.map((d) => {
              const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              const pct = dayCompletionPct(ds, store.plans[ds], store.mealLogs[ds]);
              return (
                <div key={ds} style={{ flex: 1, textAlign: "center" }}>
                  <div className="bar" style={{ height: 40, display: "flex", alignItems: "flex-end", background: "var(--glass-strong)" }}>
                    <div className="bar-fill" style={{ width: "100%", height: `${Math.max(4, pct)}%` }} />
                  </div>
                  <span className="muted small" style={{ fontSize: "0.6rem" }}>
                    {d.toLocaleDateString(undefined, { weekday: "narrow" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="row gap wrap" style={{ marginTop: "1rem" }}>
        <button className="btn" onClick={() => navigate("/grocery")}>🛒 Grocery list</button>
        <button className="btn" onClick={() => navigate("/track")}>✏️ Log food</button>
        <button className="btn" onClick={() => { store.addWater(date, 250); toast("+250 ml 💧", "success"); }}>💧 Add water</button>
        <button className="btn" onClick={() => navigate("/recipes")}>🍲 Find recipes</button>
      </div>
    </>
  );
}
