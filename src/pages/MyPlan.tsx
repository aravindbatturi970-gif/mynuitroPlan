import { useState } from "react";
import { MEAL_TYPES } from "../data";
import { useStore } from "../store";
import { todayStr, addDays, prettyDate, generateWeekPlan, generateDayPlan } from "../domain";
import { toast } from "../App";
import MealCard from "../components/MealCard";

export default function MyPlan() {
  const store = useStore();
  const [mode, setMode] = useState<"day" | "week">("week");
  const [anchor, setAnchor] = useState(todayStr());

  const days = mode === "week"
    ? Array.from({ length: 7 }, (_, i) => addDays(anchor, i))
    : [anchor];

  function generate() {
    const profile = store.profile;
    store.update((s) => {
      const week = generateWeekPlan(todayStr(), profile);
      for (const [d, plan] of week) s.plans[d] = plan;
    });
    toast("Week plan generated ✨", "success");
  }

  function generateSingle(date: string) {
    const profile = store.profile;
    store.update((s) => {
      s.plans[date] = generateDayPlan(date, profile);
    });
    toast(`Plan generated for ${prettyDate(date)}`, "success");
  }

  return (
    <>
      <div className="toolbar">
        <div className="seg">
          <button className={`seg-btn${mode === "day" ? " active" : ""}`} onClick={() => setMode("day")}>Day</button>
          <button className={`seg-btn${mode === "week" ? " active" : ""}`} onClick={() => setMode("week")}>Week</button>
        </div>
        <div className="row gap">
          <button className="btn ghost small" onClick={() => setAnchor(addDays(anchor, mode === "week" ? -7 : -1))}>← Prev</button>
          <button className="btn ghost small" onClick={() => setAnchor(todayStr())}>Today</button>
          <button className="btn ghost small" onClick={() => setAnchor(addDays(anchor, mode === "week" ? 7 : 1))}>Next →</button>
        </div>
        <button className="btn primary" onClick={generate}>✨ Generate week plan</button>
      </div>

      {days.map((date) => {
        const plan = store.plans[date];
        const logs = store.mealLogs[date] || {};
        return (
          <div key={date} style={{ marginBottom: "1.4rem" }}>
            <h3 className="section-title">
              {prettyDate(date)}{date === todayStr() ? " · Today" : ""}
              {!plan && <button className="btn small ghost" style={{ marginLeft: "0.6rem" }} onClick={() => generateSingle(date)}>+ Plan this day</button>}
            </h3>
            {plan ? (
              <div className="meal-grid">
                {MEAL_TYPES.map((m) => {
                  const item = plan[m.type];
                  if (!item) return null;
                  return (
                    <MealCard
                      key={m.type}
                      date={date}
                      mealType={m.type}
                      item={item}
                      log={logs[m.type]}
                      showEdit={date === todayStr()}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="card muted small">No plan for this day yet.</div>
            )}
          </div>
        );
      })}
    </>
  );
}
