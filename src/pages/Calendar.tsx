import { useState } from "react";
import { useStore } from "../store";
import { todayStr } from "../domain";
import { MEAL_TYPES } from "../data";
import type { MealType } from "../types";

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const store = useStore();
  const [anchor, setAnchor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState<string | null>(null);

  const y = anchor.getFullYear(), m = anchor.getMonth();
  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const cells: (string | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => fmtDate(new Date(y, m, i + 1))),
  ];

  function statusFor(date: string): string {
    const plan = store.plans[date];
    if (!plan) return "none";
    const logs = store.mealLogs[date] || {};
    const statuses = (Object.keys(plan) as MealType[]).map((t) => logs[t]?.status);
    if (statuses.length && statuses.every((s) => s === "done")) return "done";
    if (statuses.includes("skipped")) return "skipped";
    if (statuses.some((s) => s === "partial" || s === "done")) return "partial";
    return "planned";
  }

  const sel = selected ? { date: selected, plan: store.plans[selected], logs: store.mealLogs[selected] || {} } : null;

  return (
    <>
      <div className="toolbar">
        <button className="btn ghost small" onClick={() => setAnchor(new Date(y, m - 1, 1))}>← Prev</button>
        <h3 style={{ margin: 0, flex: 1, textAlign: "center" }}>
          {anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h3>
        <button className="btn ghost small" onClick={() => setAnchor(new Date(y, m + 1, 1))}>Next →</button>
      </div>

      <div className="cal-weekdays">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
      </div>

      <div className="cal-grid">
        {cells.map((d, i) => d === null ? (
          <div className="cal-cell empty" key={`e${i}`} />
        ) : (
          <div
            key={d}
            className={`cal-cell${d === todayStr() ? " today" : ""}${selected === d ? " " : ""}`}
            style={{ cursor: "pointer" }}
            onClick={() => setSelected(d === selected ? null : d)}
          >
            <strong>{Number(d.split("-")[2])}</strong>
            {store.plans[d] && (
              <span className="cal-count"><i className={`dot ${statusFor(d)}`} />{Object.keys(store.plans[d]).length} meals</span>
            )}
          </div>
        ))}
      </div>

      <div className="cal-legend">
        <span><i className="dot done" /> Completed</span>
        <span><i className="dot partial" /> Partial</span>
        <span><i className="dot skipped" /> Skipped</span>
        <span><i className="dot planned" /> Planned</span>
      </div>

      {sel && sel.plan && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <div className="card-label">Day detail — {selected}</div>
          {MEAL_TYPES.map((mt) => {
            const item = sel.plan[mt.type];
            if (!item) return null;
            const status = sel.logs[mt.type]?.status || "planned";
            return (
              <div className="track-row" key={mt.type}>
                <span><strong>{mt.emoji} {mt.label}</strong> — {item.food}</span>
                <span className={`badge ${status}`}>{status}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
