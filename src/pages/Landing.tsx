import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <div className="landing-logo">🥗</div>
      <h1>NutriPlan</h1>
      <p className="muted landing-note">
        A calm, supportive diet planner: personalized meal plans that respect your
        preferences and allergies, plus gentle tracking for meals, water and progress.
      </p>
      <div className="landing-feats">
        <div className="landing-feat"><b>📅</b><strong>Plan</strong><br />Personalized meal plans from your preferences, allergies and goals.</div>
        <div className="landing-feat"><b>✏️</b><strong>Track</strong><br />Meals, water, progress, calendar and adherence.</div>
        <div className="landing-feat"><b>🍲</b><strong>Discover</strong><br />Foods, recipes, substitutions and ingredient-based search.</div>
        <div className="landing-feat"><b>🛒</b><strong>Manage</strong><br />Grocery lists, reminders, profiles and privacy controls.</div>
      </div>
      <button className="btn primary" onClick={() => navigate("/start")}>Get started — it takes a minute →</button>
      <p className="safety-note muted small">
        🛡️ Safety principle: NutriPlan is a planning and tracking tool. It does not diagnose
        conditions, replace medical care, or prescribe therapeutic diets. For patient-specific
        plans, consult a qualified professional. Your data stays in this browser.
      </p>
    </div>
  );
}
