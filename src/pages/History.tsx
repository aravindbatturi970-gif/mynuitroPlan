import { useMemo, useState } from "react";
import { useStore } from "../store";
import { todayStr, currentStreak } from "../domain";
import {
  weeklyRows,
  monthlyRows,
  trendRows,
  weekdayLabel,
  monthLabel,
  isToday,
  kcalAxis,
  waterAxis,
  barColor,
} from "../components/Charts";

type View = "7d" | "month" | "trend";

const NUTRIENT_TARGETS = {
  protein: 80,
  carbs: 220,
  fat: 60,
  fiber: 25,
  sodium: 2300,
} as const;

function histChart({
  rows,
  getValue,
  color,
  accent,
  showZero = false,
  barW = 70,
}: {
  rows: ReturnType<typeof weeklyRows>;
  getValue: (r: ReturnType<typeof weeklyRows>[0]) => number;
  color: string;
  accent: string;
  showZero?: boolean;
  barW?: number;
}) {
  const axis = kcalAxis(Math.max(...rows.map(getValue), 1));
  const bars = rows.map((r, i) => {
    const v = getValue(r);
    const pct = Math.max(showZero ? 0 : 2, (v / axis.max) * 100);
    const isT = isToday(r.date);
    return { date: r.date, val: v, pct, isT, color: isT ? accent : barColor(i), accent };
  });
  const slot = 100 / rows.length;
  const inner = Math.min(barW, slot - 4);
  return (
    <div className="hist-chart">
      <div className="hist-labels">
        {bars.map((b) => (
          <span key={b.date} className={b.isT ? "hist-today" : ""}>{weekdayLabel(b.date)}</span>
        ))}
      </div>
      <div className="hist-bars">
        {bars.map((b) => (
          <div key={b.date} className="hist-bar-col" style={{ width: `${slot}%` }}>
            <div className="hist-bar-track">
              <div className="hist-bar-fill" style={{ width: `${Math.max(showZero ? 0 : 2, (b.val / axis.max) * 100)}%`, background: b.isT ? accent : b.color, height: `${Math.max(8, (b.val / axis.max) * 120)}px` }} />
            </div>
            <span className="hist-val" style={{ color: b.isT ? accent : "var(--text-mid)" }}>
              {b.val > 0 ? b.val : "–"}
            </span>
          </div>
        ))}
      </div>
      <div className="hist-axis">
        {axis.ticks.map((t) => <span key={t} className="hist-axis-tick">{t}</span>)}
      </div>
    </div>
  );
}

export default function History() {
  const store = useStore();
  const [view, setView] = useState<View>("7d");

  const rows = useMemo(
    () => {
      if (view === "7d") return weeklyRows(store.foodLog, store.water);
      if (view === "month") return monthlyRows(store.foodLog, store.water);
      return trendRows(store.foodLog, store.water, 30);
    },
    [store.foodLog, store.water, view],
  );

  const totals = useMemo(() => {
    let kcal = 0, water = 0, protein = 0, carbs = 0, fat = 0, fiber = 0, count = 0, days = 0;
    for (const r of rows) {
      if (r.kcal > 0 || r.water > 0) days++;
      kcal += r.kcal;
      water += r.water;
      protein += r.protein;
      carbs += r.carbs;
      fat += r.fat;
      fiber += r.fiber;
      count += r.count;
    }
    return { kcal, water, protein, carbs, fat, fiber, count, days, entries: rows.length };
  }, [rows]);

  const avg = (v: number) => (rows.length ? Math.round(v / rows.length) : 0);
  const avgKcal = avg(totals.kcal);
  const avgWater = avg(totals.water);
  const streak = currentStreak(store.foodLog, store.water);

  const showWaterTarget = store.profile.waterGoalMl || 2000;
  const waterAxisObj = waterAxis(Math.max(...rows.map((r) => r.water), showWaterTarget));

  return (
    <>
      <div className="hist-head">
        <div className="card-label">Intake history</div>
        <div className="hist-tabs" role="tablist">
          {(["7d", "month", "trend"] as View[]).map((v) => (
            <button
              key={v}
              role="tab"
              className={`hist-tab${view === v ? " active" : ""}`}
              onClick={() => setView(v)}
            >
              {v === "7d" ? "7 days" : v === "month" ? "This month" : "30-day trend"}
            </button>
          ))}
        </div>
      </div>

      {/* summary cards */}
      <div className="grid-2" style={{ marginTop: "0.5rem" }}>
        <div className="card">
          <div className="card-label">Period summary</div>
          <div className="hist-summary">
            <div className="hist-summary-row">
              <span>Days tracked</span>
              <b>{totals.days}</b>
            </div>
            <div className="hist-summary-row">
              <span>Entries logged</span>
              <b>{totals.count}</b>
            </div>
            <div className="hist-summary-row">
              <span>Current streak</span>
              <b style={{ color: "var(--accent-text)" }}>{streak} days</b>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-label">Daily averages</div>
          <div className="hist-summary">
            <div className="hist-summary-row">
              <span>Calories</span>
              <b style={{ color: "var(--info)" }}>{avgKcal} kcal</b>
            </div>
            <div className="hist-summary-row">
              <span>Water</span>
              <b style={{ color: "var(--success)" }}>{avgWater} ml</b>
            </div>
            <div className="hist-summary-row muted">
              <span>Protein</span>
              <b>{avg(totals.protein)} g</b>
            </div>
            <div className="hist-summary-row muted">
              <span>Carbs</span>
              <b>{avg(totals.carbs)} g</b>
            </div>
            <div className="hist-summary-row muted">
              <span>Fat</span>
              <b>{avg(totals.fat)} g</b>
            </div>
            <div className="hist-summary-row muted">
              <span>Fiber</span>
              <b>{avg(totals.fiber)} g</b>
            </div>
          </div>
        </div>
      </div>

      {/* calories chart */}
      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="card-label">
          {view === "7d"
            ? "Calories · last 7 days"
            : view === "month"
            ? "Calories · this month"
            : "Calories · 30-day trend"}
        </div>
        {rows.some((r) => r.kcal > 0) ? (
          histChart({
            rows,
            getValue: (r) => r.kcal,
            color: "var(--info)",
            accent: "var(--accent)",
            showZero: view === "trend",
            barW: view === "7d" ? 70 : view === "month" ? 40 : 30,
          })
        ) : (
          <div className="empty-state">
            <span className="empty-icon">📉</span>
            <h3>No calorie data yet</h3>
            <p>Log food to see your history here.</p>
          </div>
        )}
      </div>

      {/* water chart */}
      <div className="card" style={{ marginTop: "0.8rem" }}>
        <div className="card-label">
          Water · {view === "7d" ? "last 7 days" : view === "month" ? "this month" : "30-day trend"}
        </div>
        {rows.some((r) => r.water > 0) ? (
          <div className="hist-chart">
            <div className="hist-labels">
              {rows.map((r) => (
                <span
                  key={r.date}
                  className={isToday(r.date) ? "hist-today" : ""}
                >
                  {view === "7d"
                    ? weekdayLabel(r.date)
                    : view === "trend"
                    ? weekdayLabel(r.date).slice(0, 1)
                    : monthLabel(r.date)}
                </span>
              ))}
            </div>
            <div className="hist-bars">
              {rows.map((r) => {
                const pct = Math.max(2, (r.water / waterAxisObj.max) * 100);
                return (
                  <div
                    key={r.date}
                    className="hist-bar-col"
                    style={{ width: `${100 / rows.length}%` }}
                  >
                    <div className="hist-bar-track">
                      <div
                        className="hist-bar-fill hist-water"
                        style={{
                          width: "100%",
                          height: `${Math.max(8, (r.water / waterAxisObj.max) * 120)}px`,
                        }}
                      />
                    </div>
                    <span className="hist-val">
                      {r.water > 0 ? r.water : "–"}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="hist-axis">
              {waterAxisObj.ticks.map((t) => (
                <span key={t} className="hist-axis-tick">
                  {t}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">💧</span>
            <h3>No water data yet</h3>
            <p>Log water to see your hydration history.</p>
          </div>
        )}
        <div className="hist-goal-note">Goal: {showWaterTarget} ml/day</div>
      </div>

      {/* nutrition trend */}
      <div className="section-title" style={{ marginTop: "1.2rem" }}>
        Nutrition trend
      </div>
      <div className="grid-2">
        {(["protein", "carbs", "fat", "fiber"] as const).map((key) => {
          const vals = rows.map((r) => r[key]);
          const max = Math.max(...vals, NUTRIENT_TARGETS[key], 1);
          const avgVal = avg(totals[key as keyof typeof totals] as number);
          return (
            <div key={key} className="card">
              <div
                className="card-label"
                style={{ textTransform: "none", letterSpacing: "0" }}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </div>
              {vals.some((v) => v > 0) ? (
                <div className="hist-chart">
                  <div className="hist-bars">
                    {rows.map((r) => (
                      <div
                        key={r.date}
                        className="hist-bar-col"
                        style={{ width: `${100 / rows.length}%` }}
                      >
                        <div className="hist-bar-track">
                          <div
                            className="hist-bar-fill"
                            style={{
                              width: "100%",
                              height: `${Math.max(6, (r[key] / max) * 120)}px`,
                              background:
                                r[key] >= NUTRIENT_TARGETS[key]
                                  ? "var(--success)"
                                  : "var(--info)",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="muted small" style={{ padding: "0.6rem 0" }}>
                  no data
                </div>
              )}
              <div
                className="hist-summary-row muted"
                style={{ justifyContent: "space-between" }}
              >
                <span>daily avg</span>
                <b>{avgVal} g</b>
              </div>
              {key !== "sodium" && (
                <div
                  className="hist-summary-row muted"
                  style={{ justifyContent: "space-between" }}
                >
                  <span>target</span>
                  <b>{NUTRIENT_TARGETS[key]} g</b>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
