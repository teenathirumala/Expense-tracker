import { useEffect, useState, useCallback } from "react";
import { api, download } from "../api.js";
import ExpenseForm from "./ExpenseForm.jsx";
import BudgetCard from "./BudgetCard.jsx";
import Charts from "./Charts.jsx";
import {
  CATEGORIES, formatINR, formatDate, todayISO, monthStartISO, daysAgoISO, yearStartISO,
} from "../constants.js";

const PRESETS = [
  { label: "This month", from: monthStartISO },
  { label: "Last 30 days", from: () => daysAgoISO(29) },
  { label: "This year", from: yearStartISO },
];

export default function Dashboard({ user, onLogout }) {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ grandTotal: 0, byCategory: [] });
  const [trend, setTrend] = useState({ granularity: "day", points: [] });
  const [budget, setBudget] = useState(null);
  const [range, setRange] = useState({ from: monthStartISO(), to: todayISO() });
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const rangeQuery = `from=${range.from}&to=${range.to}`;
  const listQuery = rangeQuery + (category ? `&category=${encodeURIComponent(category)}` : "");
  const rangeInvalid = !range.from || !range.to || range.from > range.to;

  const load = useCallback(async () => {
    if (rangeInvalid) return setError("Pick a valid date range (start date before end date).");
    setError("");
    try {
      const [list, sum, tr, bud] = await Promise.all([
        api(`/expenses?${listQuery}`),
        api(`/expenses/summary?${rangeQuery}`),
        api(`/expenses/trend?${rangeQuery}`),
        api("/budget"),
      ]);
      setExpenses(list);
      setSummary(sum);
      setTrend(tr);
      setBudget(bud);
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    }
  }, [listQuery, rangeQuery, rangeInvalid, onLogout]);

  useEffect(() => { load(); }, [load]);

  const save = async (data) => {
    if (editing) await api(`/expenses/${editing._id}`, { method: "PUT", body: data });
    else await api("/expenses", { method: "POST", body: data });
    setEditing(null);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await api(`/expenses/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const exportCsv = async () => {
    try {
      await download(`/expenses/export?${listQuery}`, `expenses_${range.from}_to_${range.to}.csv`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>💸 Hi, {user.name.split(" ")[0]}</h1>
        <button className="ghost" onClick={onLogout}>Log out</button>
      </header>

      {error && <p className="error banner">{error}</p>}

      <div className="grid">
        <ExpenseForm key={editing?._id || "new"} initial={editing} onSave={save} onCancel={() => setEditing(null)} />
        <BudgetCard budget={budget} onChange={load} />
      </div>

      <div className="card filters">
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className={`chip ${range.from === p.from() && range.to === todayISO() ? "active" : ""}`}
              onClick={() => setRange({ from: p.from(), to: todayISO() })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="range">
          <label>From <input type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
          <label>To <input type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
        </div>
      </div>

      <Charts summary={summary} trend={trend} />

      <div className="card">
        <div className="row-between">
          <h2>Expenses</h2>
          <div className="row">
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button className="ghost" onClick={exportCsv} disabled={expenses.length === 0}>⬇ Export CSV</button>
          </div>
        </div>

        {expenses.length === 0 ? (
          <p className="muted">No expenses in this range — add one above or widen the dates.</p>
        ) : (
          <ul className="list">
            {expenses.map((e) => (
              <li key={e._id}>
                <div>
                  <strong>{e.title}</strong>
                  <span className="muted small"> · {e.category} · {formatDate(e.date)}</span>
                </div>
                <div className="actions">
                  <span className="amount">{formatINR(e.amount)}</span>
                  <button className="ghost small" onClick={() => setEditing(e)}>Edit</button>
                  <button className="danger small" onClick={() => remove(e._id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
