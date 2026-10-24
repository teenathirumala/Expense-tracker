import { useState } from "react";
import { api } from "../api.js";
import { formatINR } from "../constants.js";

export default function BudgetCard({ budget, onChange }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  if (!budget) {
    return (
      <div className="card">
        <h2>Monthly budget</h2>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  const { budget: limit, spent, remaining, percentUsed, overBudget } = budget;
  const level = overBudget ? "danger" : percentUsed >= 80 ? "warn" : "ok";

  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api("/budget", { method: "PUT", body: { monthlyBudget: Number(value) } });
      setEditing(false);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <div className="row-between">
        <h2>Monthly budget</h2>
        {!editing && (
          <button className="ghost small" onClick={() => { setValue(limit || ""); setEditing(true); }}>
            {limit ? "Edit" : "Set budget"}
          </button>
        )}
      </div>

      {editing ? (
        <form className="row" onSubmit={save}>
          <input type="number" min="0" step="1" placeholder="e.g. 15000" value={value}
            onChange={(e) => setValue(e.target.value)} required autoFocus />
          <button>Save</button>
          <button type="button" className="ghost" onClick={() => setEditing(false)}>Cancel</button>
        </form>
      ) : limit > 0 ? (
        <>
          <p className="total">
            {formatINR(spent)} <span className="muted small">of {formatINR(limit)} this month</span>
          </p>
          <div className="bar-track big">
            <div className={`bar-fill ${level}`} style={{ width: `${Math.min(percentUsed, 100)}%` }} />
          </div>
          {overBudget ? (
            <p className="alert danger">⚠️ You're over budget by {formatINR(-remaining)} this month.</p>
          ) : level === "warn" ? (
            <p className="alert warn">Heads up: you've used {percentUsed}% of your budget.</p>
          ) : (
            <p className="muted small">{formatINR(remaining)} left ({percentUsed}% used)</p>
          )}
        </>
      ) : (
        <p className="muted">Set a monthly limit and you'll get a warning when you overspend.</p>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
