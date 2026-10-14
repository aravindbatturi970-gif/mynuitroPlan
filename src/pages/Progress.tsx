import { useMemo } from "react";
import { useStore } from "../store";
import { todayStr, addDays, prettyDate, dayCompletionPct } from "../domain";

export default function ProgressPage() {
  const store = useStore();
  const date = todayStr();
  const goal = store.profile.waterGoalMl || 2000;

  const stats = useMemo(() => {
    let done = 0, total = 0, waterDays = 0;
    for (const d of Object.keys(store.plans)) {
      const plan = store.plans[d];
      const logs = store.mealLogs[d] || {};
      for (const t of Object.keys(plan) as (keyof typeof plan)[]) {
        total++;
        if (logs[t]?.status === "done") done++;
      }
    }
    for (const d in store.water) {
      if (store.water[d] >= goal * 0.8) waterDays++;
    }
    return { done, total, waterDays, weightEntries: Object.keys(store.weights).length };
  }, [store.mealLogs, store.plans, store.water, store.weights, goal]);

  const adherenceDays = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => addDays(date, -(i * 3))).reverse()
      .map((d) => ({ d, pct: dayCompletionPct(d, store.plans[d], store.mealLogs[d]) })),
  [store.plans, store.mealLogs, date]);

  const waterData = useMemo(() => {
    const vals = Array.from({ length: 14 }, (_, i) => addDays(date, -(13 - i)))
      .map((d) => ({ d, v: store.water[d] || 0 }));
    const max = Math.max(goal, ...vals.map((x) => x.v));
    return { vals, max };
  }, [store.water, date, goal]);

  const weightEntries = useMemo(() => Object.keys(store.weights).sort(), [store.weights]);

  const cards = [
    { v: stats.total ? `${Math.round((stats.done / stats.total) * 100)}%` : "–", c: "Meal adherence (all time)" },
    { v: `${stats.done}/${stats.total}`, c: "Meals completed" },
    { v: String(stats.waterDays), c: "Days ≥80% water goal" },
    { v: String(stats.weightEntries), c: "Weight entries" },
  ];

  return (
    <>
      <div className="stat-cards">
        {cards.map((s) => (
          <div className="card" key={s.c}>
            <span className="stat-value">{s.v}</span>
            <span className="stat-cap">{s.c}</span>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: "1rem" }}>
        <div className="card">
          <div className="card-label">Meal adherence — last 30 days</div>
          <div className="hchart">
            {adherenceDays.map(({ d, pct }) => (
              <div className="hchart-row" key={d}>
                <span className="hchart-label">{prettyDate(d).replace(/,.*/, "")}</span>
                <div className="hchart-bar-wrap"><div className="hchart-bar" style={{ width: `${pct}%` }} /></div>
                <span className="hchart-val">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-label">Water — last 14 days (ml)</div>
          <div className="vchart">
            {waterData.vals.map(({ d, v }) => (
              <div className="vbar-wrap" key={d} title={`${d}: ${v} ml`}>
                <div className="vbar" style={{ height: `${Math.max(3, Math.round((v / waterData.max) * 100))}%` }} />
                <span className="vbar-label">{Number(d.split("-")[2])}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="card-label">Weight trend</div>
        {weightEntries.length ? (
          <>
            <p>
              <strong>{store.weights[weightEntries[0]]} kg → {store.weights[weightEntries[weightEntries.length - 1]]} kg</strong>{" "}
              over {weightEntries.length} entries
            </p>
            <div className="hchart" style={{ marginTop: "0.5rem" }}>
              {weightEntries.slice(-10).map((d) => {
                const min = Math.min(...weightEntries.map((x) => store.weights[x]));
                const max = Math.max(...weightEntries.map((x) => store.weights[x]));
                const range = max - min || 1;
                const pct = 20 + ((store.weights[d] - min) / range) * 80;
                return (
                  <div className="hchart-row" key={d}>
                    <span className="hchart-label">{d.slice(5)}</span>
                    <div className="hchart-bar-wrap"><div className="hchart-bar" style={{ width: `${pct}%`, background: "var(--accent)" }} /></div>
                    <span className="hchart-val">{store.weights[d]}kg</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="muted">No weight entries yet. Add one from the Track view.</p>
        )}
        <p className="muted small">Trends are informational only — consult a professional for guidance.</p>
      </div>
    </>
  );
}
