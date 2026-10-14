import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "../store";
import { MEAL_TYPES } from "../data";
import { toast } from "../App";
import { v4 as uuidv4 } from "uuid";

function nowTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

function logReminder(id: string, kind: "water" | "meal", label: string) {
  try {
    const key = "np.reminder.log." + id;
    const prev = JSON.parse(localStorage.getItem(key) || "[]") as string[];
    if (!prev.includes(kind + "|" + label)) {
      localStorage.setItem(key, JSON.stringify([...prev, kind + "|" + label]));
    }
  } catch {
    /* ignore */
  }
}

function nextTickAt(t: string): Date {
  const [h, m] = t.split(":").map(Number);
  const now = new Date();
  const next = new Date(0, 0, 0, h, m, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

function msUntil(t: string): number {
  return nextTickAt(t).getTime() - Date.now();
}

function prettyRemain(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function Reminders() {
  const store = useStore();
  const p = store.profile;
  const [notifStatus, setNotifStatus] = useState<"idle" | "granted" | "denied" | "prompting">("idle");
  const [waterNext, setWaterNext] = useState<string>("");
  const [mealNext, setMealNext] = useState<Record<number, string>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestNotifPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      toast("Notifications not supported in this browser", "warn");
      return;
    }
    setNotifStatus("prompting");
    const status = await Notification.requestPermission();
    setNotifStatus(status === "granted" ? "granted" : "denied");
    store.setProfile({ remindersEnabled: status === "granted" });
    if (status === "granted") toast("Notifications enabled", "success");
    else toast("Notifications blocked", "warn");
  }, [store]);

  const setWaterInterval = useCallback((minutes: number) => {
    store.setProfile({ waterReminderMinutes: minutes });
  }, [store]);

  const setMealTime = useCallback((i: number, time: string) => {
    const times = [...(p.mealReminderTimes || [])] as string[];
    times[i] = time;
    store.setProfile({ mealReminderTimes: times });
  }, [store, p.mealReminderTimes]);

  const scheduleWaterTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!p.remindersEnabled) return;
    const tick = () => {
      if (msUntilWater() <= 0) {
        fireWater();
        setWaterNext(nowTime());
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  }, [p.remindersEnabled]);

  const msUntilWater = useCallback((): number => {
    const m = p.waterReminderMinutes || 60;
    const now = new Date();
    const base = new Date(0, 0, 0, now.getHours(), Math.floor(now.getMinutes() / m) * m, 0);
    return new Date(0, 0, 0, base.getHours(), base.getMinutes() + m, 0).getTime() - now.getTime();
  }, [p.waterReminderMinutes]);

  const fireWater = useCallback(() => {
    if (!p.remindersEnabled) return;
    if (Notification.permission === "granted") {
      new Notification("Time to hydrate 💧", { body: "Log your next glass of water.", silent: false });
    }
    toast("Water reminder: drink up 💧", "info");
  }, [p.remindersEnabled]);

  const scheduleMealTimer = useCallback((i: number, time: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!p.remindersEnabled) return;
    const tick = () => {
      if (msUntil(time) <= 0) {
        fireMeal(i);
        setMealNext((prev) => ({ ...prev, [i]: nowTime() }));
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  }, [p.remindersEnabled]);

  const fireMeal = useCallback((i: number) => {
    if (!p.remindersEnabled) return;
    const m = MEAL_TYPES[i].label;
    if (Notification.permission === "granted") {
      new Notification(`Meal reminder: ${m}`, { body: "Time for your planned meal.", silent: false });
    }
    toast(`Meal reminder: ${m}`, "info");
  }, [p.remindersEnabled]);

  useEffect(() => {
    if (p.remindersEnabled) {
      scheduleWaterTimer();
      MEAL_TYPES.forEach((m, i) => {
        const t = p.mealReminderTimes[i] || m.time;
        scheduleMealTimer(i, t);
      });
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [p.remindersEnabled]);

  useEffect(() => {
    if (!p.remindersEnabled) return;
    const tick = () => {
      setWaterNext(nowTime());
      MEAL_TYPES.forEach((m, i) => {
        const t = p.mealReminderTimes[i] || m.time;
        setMealNext((prev) => ({ ...prev, [i]: msUntil(t) <= 0 ? nowTime() : prettyRemain(msUntil(t)) }));
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [p.remindersEnabled]);

  const waterRange = [15, 30, 45, 60, 75, 90, 120, 180];

  return (
    <>
      <div className="reminders-head">
        <div className="card-label">Reminder settings</div>
        <p className="muted small">Browser notifications plus in-app toast reminders. Your preferences are saved locally.</p>
      </div>

      <div className="card" style={{ marginTop: "0.6rem" }}>
        <div className="card-label">Notifications</div>
        <div className="remind-row">
          <div className="remind-info">
            <div className="small muted">Browser notification permission</div>
            <div className="remind-status" data-status={notifStatus}>
              {notifStatus === "granted" ? "Enabled" : notifStatus === "denied" ? "Blocked" : "Click to enable"}
            </div>
          </div>
          <button
            className="btn primary"
            onClick={requestNotifPermission}
            disabled={notifStatus === "prompting" || (("Notification" in window) && Notification.permission === "granted")}
          >
            {notifStatus === "prompting" ? "Requesting…" : notifStatus === "granted" ? "Reopen settings" : "Enable notifications"}
          </button>
        </div>
        <p className="muted small" style={{ marginTop: "0.6rem" }}>
          {notifStatus === "granted" ? "You’ll get a system notification for water and meal reminders." : "Enable this and turn on reminders below to receive alerts."}
        </p>
      </div>

      <div className="card" style={{ marginTop: "0.8rem" }}>
        <div className="card-label">Reminders</div>
        <div className="remind-row">
          <div className="remind-info">
            <div className="small muted">Enable all reminders</div>
            <div className="small muted">In-app toast + browser notification when permission is granted.</div>
          </div>
          <button
            className={`toggle${p.remindersEnabled ? " on" : ""}`}
            onClick={() => store.setProfile({ remindersEnabled: !p.remindersEnabled })}
            role="switch"
            aria-checked={p.remindersEnabled}
          >
            <span className="toggle-knob" />
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: "0.8rem" }}>
        <div className="card-label">Water reminder interval</div>
        <div className="remind-row">
          <div className="remind-info">
            <div className="small muted">Remind me every</div>
            <div className="remind-value">{p.waterReminderMinutes} min</div>
          </div>
          <div className="water-presets">
            {waterRange.map((m) => (
              <button key={m} className={`chip${p.waterReminderMinutes === m ? " active" : ""}`} onClick={() => setWaterInterval(m)}>
                {m} min
              </button>
            ))}
          </div>
        </div>
        {waterNext && <div className="remind-next">Next water reminder at {waterNext}</div>}
      </div>

      <div className="card" style={{ marginTop: "0.8rem" }}>
        <div className="card-label">Meal reminder times</div>
        <p className="muted small" style={{ marginBottom: "0.6rem" }}>Leave blank to disable that meal’s reminder. 24-hour format, e.g. 08:00.</p>
        {MEAL_TYPES.map((m, i) => {
          const t = p.mealReminderTimes[i] || m.time;
          return (
            <div key={m.type} className="meal-time-row" style={{ padding: "0.6rem 0", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
              <div className="remind-info" style={{ flex: 1 }}>
                <div className="small muted" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span>{m.emoji}</span> {m.label} <span className="muted small">· default {m.time}</span>
                </div>
                {mealNext[i] !== undefined && mealNext[i] !== "" && (
                  <div className="remind-next small">Next reminder {mealNext[i]}</div>
                )}
              </div>
              <input
                className="input time-input"
                type="time"
                value={t}
                onChange={(e) => setMealTime(i, e.target.value || m.time)}
                aria-label={`${m.label} reminder time`}
              />
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: "0.8rem", background: "var(--surface-2)" }}>
        <div className="card-label">Active today</div>
        {p.remindersEnabled ? (
          <div className="remind-active">
            <div className="remind-active-row">
              <span className="remind-active-dot water" />
              <span>Water every {p.waterReminderMinutes} min</span>
              <span className="muted small">{waterNext ? "next · " + waterNext : ""}</span>
            </div>
            {MEAL_TYPES.map((m, i) => p.mealReminderTimes[i] && (
              <div key={m.type} className="remind-active-row">
                <span className="remind-active-dot meal" />
                <span>{m.emoji} {m.label} at {p.mealReminderTimes[i]}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted small">Turn on reminders above to schedule these.</div>
        )}
      </div>
    </>
  );
}
