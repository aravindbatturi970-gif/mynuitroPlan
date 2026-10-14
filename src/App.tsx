import { useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useStore } from "./store";
import { todayStr, addDays, dayCompletionPct } from "./domain";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import MyPlan from "./pages/MyPlan";
import Track from "./pages/Track";
import FoodTracker from "./pages/FoodTracker";
import RecipesPage from "./pages/Recipes";
import Grocery from "./pages/Grocery";
import HistoryPage from "./pages/History";
import ProgressPage from "./pages/Progress";
import CalendarPage from "./pages/Calendar";
import RemindersPage from "./pages/Reminders";
import AssistantPage from "./pages/Assistant";
import ProfilePage from "./pages/ProfilePage";
import Settings from "./pages/Settings";
import CommandPalette from "./components/CommandPalette";

const NAV_MAIN = [
  { to: "/", icon: "🏠", label: "Home" },
  { to: "/plan", icon: "📅", label: "Plan" },
  { to: "/track", icon: "✏️", label: "Track" },
  { to: "/food", icon: "🍽️", label: "Food log" },
  { to: "/recipes", icon: "🍲", label: "Recipes" },
  { to: "/progress", icon: "📈", label: "Progress" },
];
const NAV_SECONDARY = [
  { to: "/grocery", icon: "🛒", label: "Grocery" },
  { to: "/calendar", icon: "🗓️", label: "Calendar" },
  { to: "/history", icon: "📊", label: "History" },
  { to: "/reminders", icon: "🔔", label: "Reminders" },
  { to: "/assistant", icon: "🤖", label: "Assistant" },
  { to: "/profile", icon: "👤", label: "Profile" },
  { to: "/settings", icon: "⚙️", label: "Settings" },
];

const TITLES: Record<string, [string, string]> = {
  "/": ["Dashboard", "Your day at a glance"],
  "/plan": ["My Plan", "Daily and weekly meal planning"],
  "/track": ["Track", "Log meals, notes and weight"],
  "/food": ["Food log", "Today's meals, calories and nutrients"],
  "/recipes": ["Recipes", "Discover safe, suitable recipes"],
  "/grocery": ["Grocery", "Shopping list generated from your plan"],
  "/progress": ["Progress", "Trends and adherence"],
  "/calendar": ["Calendar", "Plan and history by day"],
  "/history": ["History", "7-day and monthly intake trends"],
  "/reminders": ["Reminders", "Water and meal reminder settings"],
  "/assistant": ["AI Assistant", "Safe, rule-respecting suggestions"],
  "/profile": ["Profile", "Your details, preferences and allergies"],
  "/settings": ["Settings", "Appearance, notifications and privacy"],
};

function Toasts() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);
  useEffect(() => {
    const handler = (e: Event) => {
      const { msg, kind } = (e as CustomEvent).detail;
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, msg, kind }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
    };
    window.addEventListener("np-toast", handler);
    return () => window.removeEventListener("np-toast", handler);
  }, []);
  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>
      ))}
    </div>
  );
}

export function toast(msg: string, kind = "") {
  window.dispatchEvent(new CustomEvent("np-toast", { detail: { msg, kind } }));
}

export default function App() {
  const store = useStore();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const onboarded = store.profile.onboarded;

  useEffect(() => setSidebarOpen(false), [location.pathname]);

  // Global shortcuts: ⌘K / Ctrl+K opens palette
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!onboarded) {
    return (
      <>
        <div className="app-bg" aria-hidden="true" />
        <Routes>
          <Route path="/start" element={<Onboarding />} />
          <Route path="*" element={<Landing />} />
        </Routes>
        <Toasts />
      </>
    );
  }

  const [title, subtitle] = TITLES[location.pathname] || [null as unknown as string, ""];
  const streak = (() => {
    let s = 0;
    for (let i = 0; i < 365; i++) {
      const d = addDays(todayStr(), -i);
      const logs = store.mealLogs[d] || {};
      const has = Object.values(logs).some((l) => l.status === "done");
      if (has) s++;
      else if (i > 0) break;
    }
    return s;
  })();
  const adherence = (() => {
    let score = 0, n = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(todayStr(), -i);
      const plan = store.plans[d];
      if (plan) {
        score += dayCompletionPct(d, plan, store.mealLogs[d]);
        n++;
      }
    }
    return n ? `${Math.round(score / n)}%` : "–";
  })();

  const NavItem = ({ to, icon, label }: { to: string; icon: string; label: string }) => (
    <NavLink to={to} end={to === "/"} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
      <i>{icon}</i> {label}
    </NavLink>
  );

  return (
    <>
      <div className="app-bg" aria-hidden="true" />
      <div className="app-shell">
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
        <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
          <div className="brand">
            <div className="brand-logo">🥗</div>
            <div>
              <div className="brand-name">NutriPlan</div>
              <div className="brand-sub">Diet planner MVP</div>
            </div>
          </div>
          <nav className="nav">
            {NAV_MAIN.map((n) => <NavItem key={n.to} {...n} />)}
            <div className="nav-section">More</div>
            {NAV_SECONDARY.map((n) => <NavItem key={n.to} {...n} />)}
          </nav>
          <div className="sidebar-stats">
            <div className="stat-mini"><b>{streak}</b><span>day streak</span></div>
            <div className="stat-mini"><b>{adherence}</b><span>7-day</span></div>
          </div>
        </aside>

        <div className="main">
          <header className="header">
            <button className="menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>
            <div>
              <div className="header-title">{title}</div>
              <div className="header-sub">{subtitle}</div>
            </div>
            <div className="header-right">
              <button className="search-trigger" onClick={() => setPaletteOpen(true)} aria-label="Open command palette">
                <span aria-hidden="true">⌕</span>
                <span className="st-label">Search…</span>
                <kbd>⌘K</kbd>
              </button>
              <button className="icon-btn" onClick={store.toggleTheme} aria-label="Toggle theme">
                {store.theme === "dark" ? "☀️" : "🌙"}
              </button>
            </div>
          </header>
          <main className="content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/plan" element={<MyPlan />} />
              <Route path="/track" element={<Track />} />
              <Route path="/food" element={<FoodTracker />} />
              <Route path="/recipes" element={<RecipesPage />} />
              <Route path="/grocery" element={<Grocery />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/reminders" element={<RemindersPage />} />
              <Route path="/assistant" element={<AssistantPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <nav className="bottom-nav">
            {NAV_MAIN.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
                <i>{n.icon}</i>
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <Toasts />
      </div>
    </>
  );
}
