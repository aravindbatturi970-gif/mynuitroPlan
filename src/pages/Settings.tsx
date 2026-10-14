import { useState } from "react";
import { useStore } from "../store";
import { toast } from "../App";

export default function Settings() {
  const store = useStore();
  const [notifMeals, setNotifMeals] = useState(true);
  const [notifWater, setNotifWater] = useState(true);

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <div className="card-label">Appearance</div>
          <div className="row gap">
            <button className={`btn ghost${store.theme === "light" ? " primary" : ""}`} onClick={() => { if (store.theme !== "light") store.toggleTheme(); }}>☀️ Light</button>
            <button className={`btn ghost${store.theme === "dark" ? " primary" : ""}`} onClick={() => { if (store.theme !== "dark") store.toggleTheme(); }}>🌙 Dark</button>
          </div>
        </div>
        <div className="card">
          <div className="card-label">Notifications (local reminders)</div>
          <label className="check"><input type="checkbox" checked={notifMeals} onChange={(e) => { setNotifMeals(e.target.checked); toast(e.target.checked ? "Meal reminders on" : "Meal reminders off"); }} /> Meal reminders</label>
          <label className="check"><input type="checkbox" checked={notifWater} onChange={(e) => setNotifWater(e.target.checked)} /> Water reminders</label>
          <p className="muted small">Reminder preferences are saved locally. (Push delivery comes in a later release.)</p>
        </div>
      </div>

      <div className="card">
        <div className="card-label">Privacy</div>
        <p className="muted small">All data lives only in this browser (localStorage). Nothing is uploaded.</p>
        <div className="row gap">
          <button className="btn ghost" onClick={() => { store.exportData(); toast("Data exported", "success"); }}>⬇ Export my data (JSON)</button>
          <button className="btn danger" onClick={() => {
            if (confirm("Permanently delete ALL NutriPlan data from this browser? This cannot be undone.")) {
              store.resetAll();
              toast("All data deleted", "success");
            }
          }}>🗑 Delete all data</button>
        </div>
      </div>
    </>
  );
}
