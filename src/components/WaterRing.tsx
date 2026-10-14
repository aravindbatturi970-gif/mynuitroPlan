export default function WaterRing({ value, goal }: { value: number; goal: number }) {
  const pct = Math.min(100, Math.round((value / goal) * 100));
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring-wrap">
      <svg width="118" height="118" viewBox="0 0 118 118">
        <circle cx="59" cy="59" r={r} fill="none" stroke="var(--glass-strong)" strokeWidth="8" />
        <circle
          cx="59" cy="59" r={r} fill="none" stroke="var(--primary)" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div className="ring-center">
        <div>
          <div className="ring-value">{value} <span style={{ fontSize: "0.7rem", fontWeight: 600 }}>ml</span></div>
          <div className="ring-label">{pct}% of {goal}</div>
        </div>
      </div>
    </div>
  );
}
