import { useState } from "react";
import { MEAL_TYPES } from "../data";
import { useStore } from "../store";
import { todayStr } from "../domain";
import { toast } from "../App";
import { mealInfo } from "../components/MealCard";

export default function Track() {
  const store = useStore();
  const date = todayStr();
  const plan = store.plans[date];
  const logs = store.mealLogs[date] || {};
  const [notes, setNotes] = useState(store.dayNotes[date] || "");
  const [weight, setWeight] = useState("");

  return (
    <>
      <div className="card">
        <div className="card-label">Log today's meals</div>
        {plan ? (
          MEAL_TYPES.map((m) => {
            const item = plan[m.type];
            if (!item) return null;
            const status = logs[m.type]?.status || "planned";
            const info = mealInfo(m.type);
            return (
              <div className="track-row" key={m.type}>
                <div>
                  <strong>{info.emoji} {info.label}</strong> — {item.food}
                  <span className={`badge ${status}`} style={{ marginLeft: "0.5rem" }}>{status}</span>
                </div>
                <div style={{ display: "flex", gap: "0.35rem" }}>
                  <button className="btn small primary" onClick={() => { store.setMealLog(date, m.type, "done"); toast("Logged ✓", "success"); }} disabled={status === "done"}>Done</button>
                  <button className="btn small" onClick={() => { store.setMealLog(date, m.type, "partial"); toast("Partial ✓", "success"); }} disabled={status === "partial"}>Partial</button>
                  <button className="btn small ghost" onClick={() => { store.setMealLog(date, m.type, "skipped"); toast("Skipped", "success"); }} disabled={status === "skipped"}>Skip</button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="muted">No plan for today yet — generate one from My Plan.</p>
        )}
      </div>

      <div className="card">
        <div className="card-label">Notes for today</div>
        <textarea
          className="input" rows={3} value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How did today go?"
        />
        <button className="btn primary" style={{ marginTop: "0.5rem" }} onClick={() => {
          store.update((s) => { s.dayNotes[date] = notes; });
          toast("Notes saved", "success");
        }}>Save notes</button>
      </div>

      <div className="card">
        <div className="card-label">Optional water & weight log</div>
        <div className="row gap wrap">
          <button className="btn small primary" onClick={() => { store.addWater(date, 250); toast("+250 ml 💧", "success"); }}>💧 +250 ml</button>
          <input
            className="input" type="number" step="0.1" min={20} max={400}
            style={{ width: 110 }} placeholder="weight kg"
            value={weight} onChange={(e) => setWeight(e.target.value)}
          />
          <button className="btn primary" onClick={() => {
            const v = parseFloat(weight);
            if (!v || v < 20 || v > 400) { toast("Enter a valid weight (20–400 kg)", "warn"); return; }
            store.update((s) => { s.weights[date] = v; });
            setWeight("");
            toast("Weight logged", "success");
          }}>Log weight</button>
        </div>
        <p className="muted small">Weight logging is optional and used only for your own trend view.</p>
      </div>
    </>
  );
}
