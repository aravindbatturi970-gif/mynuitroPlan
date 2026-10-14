import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ALLERGENS, DIET_TAGS } from "../data";
import { useStore } from "../store";
import { toast } from "../App";

export default function ProfilePage() {
  const store = useStore();
  const navigate = useNavigate();
  const p = store.profile;
  const [form, setForm] = useState({
    name: p.name, age: p.age?.toString() || "", heightCm: p.heightCm?.toString() || "",
    weightKg: p.weightKg?.toString() || "", diet: p.diet, dislikes: p.dislikes,
    waterGoalMl: p.waterGoalMl.toString(), clinicianNotes: p.clinicianNotes,
  });
  const [customAllergy, setCustomAllergy] = useState("");
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const allAllergies = [...new Set([...ALLERGENS, ...p.allergies])];

  function save() {
    store.setProfile({
      name: form.name.trim(),
      age: form.age ? Number(form.age) : null,
      heightCm: form.heightCm ? Number(form.heightCm) : null,
      weightKg: form.weightKg ? Number(form.weightKg) : null,
      diet: form.diet,
      dislikes: form.dislikes,
      waterGoalMl: Number(form.waterGoalMl) || 2000,
      clinicianNotes: form.clinicianNotes,
    });
    toast("Profile saved", "success");
  }

  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="card-label">Personal details</div>
      <div className="form-grid">
        <label>Name <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} required /></label>
        <label>Age <input className="input" type="number" min={10} max={120} value={form.age} onChange={(e) => set({ age: e.target.value })} /></label>
        <label>Height (cm) <input className="input" type="number" min={80} max={250} value={form.heightCm} onChange={(e) => set({ heightCm: e.target.value })} /></label>
        <label>Weight (kg) <input className="input" type="number" step="0.1" min={20} max={400} value={form.weightKg} onChange={(e) => set({ weightKg: e.target.value })} /></label>
      </div>

      <div className="card-label" style={{ marginTop: "1rem" }}>Food preference</div>
      <select className="input" value={form.diet} onChange={(e) => set({ diet: e.target.value })}>
        {DIET_TAGS.map((d) => <option key={d}>{d}</option>)}
      </select>

      <div className="card-label" style={{ marginTop: "1rem" }}>
        Allergies <span className="danger-text">— please keep accurate!</span>
      </div>
      <div className="chip-grid">
        {allAllergies.map((a) => {
          const on = p.allergies.includes(a);
          return (
            <button type="button" key={a} className={`chip${on ? " on" : ""}`} onClick={() => store.toggleAllergy(a)}>
              {on ? `⚠ ${a} ✓` : a}
            </button>
          );
        })}
      </div>
      <div className="row gap" style={{ marginTop: "0.6rem" }}>
        <input className="input grow" placeholder="Custom allergy…" value={customAllergy} onChange={(e) => setCustomAllergy(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              store.addAllergy(customAllergy.trim());
              setCustomAllergy("");
            }
          }} />
        <button type="button" className="btn ghost" onClick={() => { store.addAllergy(customAllergy.trim()); setCustomAllergy(""); }}>Add</button>
      </div>

      <div className="card-label" style={{ marginTop: "1rem" }}>Dislikes</div>
      <input className="input" placeholder="Comma separated, e.g. mushrooms, cilantro" value={form.dislikes} onChange={(e) => set({ dislikes: e.target.value })} />

      <div className="card-label" style={{ marginTop: "1rem" }}>Water goal (ml/day)</div>
      <input className="input" type="number" min={1000} max={6000} step={100} value={form.waterGoalMl} onChange={(e) => set({ waterGoalMl: e.target.value })} />

      <div className="card-label" style={{ marginTop: "1rem" }}>
        Clinician instructions <span className="muted small">(optional)</span>
      </div>
      <textarea className="input" rows={2} placeholder="Restrictions or instructions provided by your clinician"
        value={form.clinicianNotes} onChange={(e) => set({ clinicianNotes: e.target.value })} />
      {p.clinicianNotes && (
        <p className="muted small">🩺 Clinician-provided instructions are shown as user-entered information and are never overridden by automatic substitutions.</p>
      )}

      <div className="row gap" style={{ marginTop: "1rem" }}>
        <button className="btn primary" type="submit">Save profile</button>
        <button className="btn ghost" type="button" onClick={() => { if (confirm("Redo onboarding and regenerate your plan? Profile data will be cleared.")) { store.update((s) => { s.profile.onboarded = false; }); navigate("/"); } }}>Redo setup</button>
      </div>
    </form>
  );
}
