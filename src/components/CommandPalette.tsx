import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";

interface Cmd {
  id: string;
  label: string;
  icon: string;
  group: string;
  run: () => void;
  hint?: string;
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Cmd[] = useMemo(() => [
    { id: "home", label: "Dashboard", icon: "🏠", group: "Navigate", run: () => navigate("/") },
    { id: "plan", label: "My Plan", icon: "📅", group: "Navigate", run: () => navigate("/plan") },
    { id: "track", label: "Track", icon: "✏️", group: "Navigate", run: () => navigate("/track") },
    { id: "recipes", label: "Recipes", icon: "🍲", group: "Navigate", run: () => navigate("/recipes") },
    { id: "grocery", label: "Grocery list", icon: "🛒", group: "Navigate", run: () => navigate("/grocery") },
    { id: "progress", label: "Progress", icon: "📈", group: "Navigate", run: () => navigate("/progress") },
    { id: "calendar", label: "Calendar", icon: "🗓️", group: "Navigate", run: () => navigate("/calendar") },
    { id: "assistant", label: "AI Assistant", icon: "🤖", group: "Navigate", run: () => navigate("/assistant") },
    { id: "profile", label: "Profile", icon: "👤", group: "Navigate", run: () => navigate("/profile") },
    { id: "settings", label: "Settings", icon: "⚙️", group: "Navigate", run: () => navigate("/settings") },
    {
      id: "theme", label: `Switch to ${store.theme === "dark" ? "light" : "dark"} theme`,
      icon: store.theme === "dark" ? "☀️" : "🌙", group: "Actions",
      run: () => store.toggleTheme(),
    },
    {
      id: "water", label: "Log 250 ml water", icon: "💧", group: "Actions",
      run: () => {
        const d = new Date();
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        store.addWater(ds, 250);
      },
      hint: "today",
    },
    {
      id: "export", label: "Export my data (JSON)", icon: "⬇️", group: "Actions",
      run: () => store.exportData(),
    },
  ], [navigate, store]);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    if (!needle) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(needle) || c.group.toLowerCase().includes(needle));
  }, [q, commands]);

  const groups = useMemo(() => {
    const map = new Map<string, Cmd[]>();
    for (const c of filtered) {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    }
    return [...map.entries()];
  }, [filtered]);

  const flat = groups.flatMap(([, cmds]) => cmds);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  if (!open) return null;

  function runCmd(cmd: Cmd) {
    cmd.run();
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && flat[sel]) { e.preventDefault(); runCmd(flat[sel]); }
  }

  let flatIdx = -1;

  return (
    <div className="cmdk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk" role="dialog" aria-label="Command palette" onKeyDown={onKeyDown}>
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Type a command or search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search commands"
        />
        <div className="cmdk-list" ref={listRef}>
          {flat.length === 0 && <div className="cmdk-empty">No commands match “{q}”</div>}
          {groups.map(([group, cmds]) => (
            <div key={group}>
              <div className="cmdk-group">{group}</div>
              {cmds.map((cmd) => {
                flatIdx++;
                const idx = flatIdx;
                return (
                  <button
                    key={cmd.id}
                    className={`cmdk-item${idx === sel ? " selected" : ""}`}
                    onMouseEnter={() => setSel(idx)}
                    onClick={() => runCmd(cmd)}
                  >
                    <i>{cmd.icon}</i> {cmd.label}
                    {cmd.hint && <span className="muted small">{cmd.hint}</span>}
                    <kbd>↵</kbd>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> run</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
