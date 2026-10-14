import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { ALLERGENS, DIET_TAGS, MEAL_TYPES } from "../data";
import { generateWeekPlan, todayStr } from "../domain";
import { toast } from "../App";

const STEPS = ["Profile", "Preferences", "Allergies", "Likes & dislikes", "Goals", "Plan setup", "Done"];

export default function Onboarding() {
  const store = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    name: "",
    age: "" as string | number,
    diet: "No preference",
    allergies: [] as string[],
    customAllergy: "",
    dislikes: "",
    goal: "Eat balanced meals",
    waterGoalMl: 2000,
    breakfast: "08:00",
    lunch: "13:00",
    snack: "16:30",
    dinner: "20:00",
  });
  const set = (patch: Partial<typeof data>) => setData((d) => ({ ...d, ...patch }));

  function finish() {
    const allergies = [...data.allergies];
    const custom = data.customAllergy.trim();
    if (custom && !allergies.includes(custom)) allergies.push(custom);

    store.update((s) => {
      s.profile = {
        ...s.profile,
        name: data.name.trim(),
        age: data.age ? Number(data.age) : null,
        diet: data.diet,
        allergies,
        dislikes: data.dislikes,
        waterGoalMl: Number(data.waterGoalMl) || 2000,
        onboarded: true,
      };
    });
    store.update((s) => {
      for (const m of MEAL_TYPES) {
        const key = m.type as keyof typeof data;
        if (typeof data[key] === "string" && (data[key] as string)) {
          // meal time customization is stored in data.ts defaults for MVP
        }
      }
      const week = generateWeekPlan(todayStr(), s.profile);
      for (const [d, plan] of week) s.plans[d] = plan;
    });
    toast(`Welcome${data.name ? ", " + data.name : ""}! Your first week is planned 🎉`, "success");
    navigate("/");
  }

  const toggleAllergy = (a: string) =>
    set({ allergies: data.allergies.includes(a) ? data.allergies.filter((x) => x !== a) : [...data.allergies, a] });

  return (
    <div className="onboard">
      <div style={{ marginBottom: "1rem" }}>
        <div className="bar"><div className="bar-fill" style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} /></div>
        <p className="muted small" style={{ marginTop: "0.4rem" }}>Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
      </div>

      {step === 0 && (
        <>
          <h2>Welcome to NutriPlan 🥗</h2>
          <p className="muted">Let's set up your plan. Everything can be edited later in Profile.</p>
          <label style={{ marginTop: "0.8rem" }}>Your name
            <input className="input" value={data.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Aarav" autoFocus />
          </label>
          <label style={{ marginTop: "0.6rem" }}>Age
            <input className="input" type="number" min={10} max={120} value={data.age} onChange={(e) => set({ age: e.target.value })} />
          </label>
        </>
      )}

      {step === 1 && (
        <>
          <h2>Food preference</h2>
          <p className="muted small">Pick the pattern that fits you best.</p>
          <div className="ob-choice-grid">
            {DIET_TAGS.map((d) => (
              <button key={d} className={`ob-choice${data.diet === d ? " on" : ""}`} onClick={() => set({ diet: d })}>{d}</button>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h2>Allergies</h2>
          <div className="allergy-warn">⚠ Allergy information must be accurate. Meals containing your allergens will never be suggested.</div>
          <div className="chip-grid">
            {ALLERGENS.map((a) => (
              <button key={a} className={`chip${data.allergies.includes(a) ? " on" : ""}`} onClick={() => toggleAllergy(a)}>
                {data.allergies.includes(a) ? `⚠ ${a} ✓` : a}
              </button>
            ))}
          </div>
          <label style={{ marginTop: "0.8rem" }}>Custom allergy (optional)
            <input className="input" value={data.customAllergy} onChange={(e) => set({ customAllergy: e.target.value })} placeholder="e.g. Mustard" />
          </label>
        </>
      )}

      {step === 3 && (
        <>
          <h2>Likes &amp; dislikes</h2>
          <label>Dislikes (comma separated)
            <input className="input" value={data.dislikes} onChange={(e) => set({ dislikes: e.target.value })} placeholder="e.g. mushrooms, cilantro" />
          </label>
          <p className="muted small">Meal suggestions will avoid these where possible — allergy rules are always strict.</p>
        </>
      )}

      {step === 4 && (
        <>
          <h2>What's your main goal?</h2>
          <div className="ob-choice-grid">
            {["Eat balanced meals", "Build consistent habits", "Drink more water", "Home-cook more often", "Feel more energetic"].map((g) => (
              <button key={g} className={`ob-choice${data.goal === g ? " on" : ""}`} onClick={() => set({ goal: g })}>{g}</button>
            ))}
          </div>
          <p className="muted small">NutriPlan focuses on sustainable habits — never extreme restriction.</p>
        </>
      )}

      {step === 5 && (
        <>
          <h2>Plan setup</h2>
          <div className="form-grid">
            <label>Water goal (ml/day)
              <input className="input" type="number" min={1000} max={6000} step={100} value={data.waterGoalMl} onChange={(e) => set({ waterGoalMl: Number(e.target.value) })} />
            </label>
          </div>
          <p className="muted small" style={{ marginTop: "0.6rem" }}>
            Default meal times: breakfast 08:00, lunch 13:00, snack 16:30, dinner 20:00. You can adjust meal times anytime from My Plan.
          </p>
        </>
      )}

      {step === 6 && (
        <>
          <h2>You're all set! 🎉</h2>
          <p className="muted">
            We'll generate your first week plan now, built around your {data.diet.toLowerCase()} preference
            {data.allergies.length ? ` and free of ${data.allergies.join(", ")}` : ""}.
          </p>
          <p className="muted small" style={{ marginTop: "0.6rem" }}>🛡️ NutriPlan is a planning tool, not medical advice.</p>
        </>
      )}

      <div className="ob-row">
        <button className="btn ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>← Back</button>
        {step < STEPS.length - 1
          ? <button className="btn primary" onClick={() => setStep((s) => s + 1)}>Next →</button>
          : <button className="btn primary" onClick={finish}>Finish &amp; generate plan 🎉</button>}
      </div>
    </div>
  );
}
