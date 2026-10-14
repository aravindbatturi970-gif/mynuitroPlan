import { useState, useRef, useEffect } from "react";
import { useStore } from "../store";
import { todayStr, dayCompletionPct, isSafeItem } from "../domain";
import { FOOD_DB, MEAL_TYPES, RECIPES } from "../data";
import { toast } from "../App";
import type { Profile } from "../types";

interface Msg { role: "bot" | "user"; text: string }

const SUBS: Record<string, string> = {
  paneer: "tofu, firm cottage cheese, or boiled potato cubes",
  yogurt: "coconut yogurt (dairy-free) or soy yogurt",
  honey: "maple syrup or jaggery",
  wheat: "rice, millet or gluten-free oats",
  rice: "quinoa, millet or broken wheat (dalia)",
  egg: "besan chilla or silken tofu scramble",
  milk: "almond, soy or oat milk",
  ghee: "neutral oil or vegan butter",
};

function assistantReply(q: string, profile: Profile, ctx: { monthPct: string; monthDays: number; todaysPlan: string }): string {
  const lower = q.toLowerCase();

  // Safety guardrails first
  if (/(medicine|medication|dose|diagnos|cure|disease|treat|prescrib)/.test(lower)) {
    return "I can't help with medications, diagnoses or treatment decisions — those belong with a qualified healthcare professional. I'm great at meal ideas, substitutions and planning though!";
  }
  if (/(fast|starve|extreme diet|300 calorie|500 calorie diet)/.test(lower)) {
    return "I don't support extreme restriction or unsafe fasting. Balanced, sustainable meals are the goal — your plan is built around that principle.";
  }

  // Kitchen ingredient search
  if (/(i have|ingredients?|what can i cook|kitchen)/.test(lower)) {
    const words = lower.replace(/[^a-z\s]/g, " ").split(/\s+/)
      .filter((w) => w.length > 3 && !["have", "what", "cook", "with", "some", "ingredient", "ingredients"].includes(w));
    const results = RECIPES.map((r) => {
      const names = r.ingredients.map((i) => i.name.toLowerCase());
      const matched = names.filter((n) => words.some((w) => n.includes(w) || w.includes(n.split(" ")[0]))).length;
      return { r, matched, missing: r.ingredients.length - matched };
    })
      .filter((x) => x.matched > 0 && isSafeItem(x.r, profile))
      .sort((a, b) => b.matched - a.matched)
      .slice(0, 3);
    if (results.length) {
      return "Based on your kitchen (allergy-safe options only):\n" +
        results.map((x) => `• ${x.r.name} — missing ${x.missing} ingredient${x.missing === 1 ? "" : "s"} (${x.r.prepTime} min)`).join("\n") +
        "\nFind them under Recipes for full steps.";
    }
    return "I couldn't match those ingredients to a safe recipe. Try naming foods more specifically (e.g. \"rice, tomato, onion\").";
  }

  // Substitutions
  for (const key of Object.keys(SUBS)) {
    if (lower.includes(key)) {
      return `Common substitutes for ${key}: ${SUBS[key]}. I've filtered out anything that conflicts with your allergies — double-check labels, especially for processed items.`;
    }
  }

  // Month performance
  if (/(month|doing|progress|analysis)/.test(lower)) {
    return ctx.monthDays
      ? `This month you've logged ${ctx.monthDays} day${ctx.monthDays > 1 ? "s" : ""} with about ${ctx.monthPct} average adherence. ${parseInt(ctx.monthPct) >= 70 ? "That's strong consistency — keep it up! 🌟" : "Every logged meal counts — small steps add up."}`
      : `No meals logged yet — log a few and I'll summarize your month.`;
  }

  // Time-limited suggestions
  const mins = lower.match(/(\d+)\s*(min|minute)/);
  if (mins || /(quick|fast|easy)/.test(lower)) {
    const limit = mins ? parseInt(mins[1]) : 20;
    const meal = (["breakfast", "lunch", "snack", "dinner"] as const).find((m) => lower.includes(m)) || "lunch";
    const pool = FOOD_DB.filter((f) => f.meal === meal && isSafeItem(f, profile));
    const quick = pool.filter((f) => {
      const r = RECIPES.find((x) => x.name.toLowerCase() === f.name.toLowerCase());
      return !r || r.prepTime <= limit;
    });
    const picks = (quick.length ? quick : pool).slice(0, 3);
    return picks.length
      ? `Quick ${meal} ideas (≤${limit} min, safe for your profile):\n` + picks.map((p) => `• ${p.name} (${p.kcal} kcal)`).join("\n")
      : "I couldn't find quick options matching your restrictions for that meal.";
  }

  if (ctx.todaysPlan) {
    return "Here's today's plan:\n" + ctx.todaysPlan + "\nAsk me for substitutions, quick recipes or your month summary.";
  }
  return "I can suggest recipes, find substitutions for ingredients, search by what's in your kitchen, or summarize your month. What would you like?";
}

const SUGGESTIONS = [
  "Suggest a lunch I can make in 15 minutes",
  "What can I substitute for paneer?",
  "I have rice, tomatoes and onions — what can I cook?",
  "How am I doing this month?",
];

export default function AssistantPage() {
  const store = useStore();
  const [chat, setChat] = useState<Msg[]>([{
    role: "bot",
    text: "Hi! I can suggest recipes, find substitutions, and help navigate your plan. I respect your allergies and restrictions always — and I never give medical advice.",
  }]);
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [chat]);

  function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setChat((c) => [...c, { role: "user", text }]);

    setTimeout(() => {
      const monthLogs = Object.keys(store.mealLogs).filter((d) => d.startsWith(todayStr().slice(0, 7)));
      const monthPct = monthLogs.length
        ? `${Math.round(monthLogs.reduce((a, d) => a + dayCompletionPct(d, store.plans[d], store.mealLogs[d]), 0) / monthLogs.length)}%`
        : "0%";
      const plan = store.plans[todayStr()];
      const todaysPlan = plan
        ? MEAL_TYPES.filter((m) => plan[m.type]).map((m) => `• ${m.label}: ${plan[m.type]!.food} (${plan[m.type]!.kcal} kcal)`).join("\n")
        : "";
      const reply = assistantReply(text, store.profile, { monthPct, monthDays: monthLogs.length, todaysPlan });
      setChat((c) => [...c, { role: "bot", text: reply }]);
      void store; void toast;
    }, 350);
  }

  return (
    <>
      <div className="card chat-card">
        <div className="chat-log" ref={logRef}>
          {chat.map((m, i) => <div key={i} className={`chat-msg ${m.role}`}>{m.text}</div>)}
        </div>
        <div className="chat-suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chat-suggestion" onClick={() => { setInput(s); setTimeout(send, 30); }}>{s}</button>
          ))}
        </div>
        <div className="row gap">
          <input className="input grow" placeholder="Ask about recipes, substitutions or your plan…" value={input}
            onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
          <button className="btn primary" onClick={send}>Send</button>
        </div>
      </div>
      <p className="muted small">The assistant plans and suggests only — it never gives medical advice or overrides your stored allergies.</p>
    </>
  );
}
