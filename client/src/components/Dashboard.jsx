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
const PAGE_SIZE = 10;

export default function Dashboard({ user, onLogout }) {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ grandTotal: 0, byCategory: [] });
  const [trend, setTrend] = useState({ granularity: "day", points: [] });
  const [budget, setBudget] = useState(null);
  const [range, setRange] = useState({ from: monthStartISO(), to: todayISO() });
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const rangeQuery = `from=${range.from}&to=${range.to}`;
  const listQuery = rangeQuery + (category ? `&category=${encodeURIComponent(category)}` : "");
  const rangeInvalid = !range.from || !range.to || range.from > range.to;

  // The page number belongs to the current filters: change the dates or category
  // and it automatically goes back to page 1.
  const [pageState, setPageState] = useState({ filters: listQuery, page: 1 });
  const page = pageState.filters === listQuery ? pageState.page : 1;
  const goToPage = (p) => setPageState({ filters: listQuery, page: p });

  const load = useCallback(async () => {
    if (rangeInvalid) return setError("Pick a valid date range (start date before end date).");
    setError("");
    try {
      const [list, sum, tr, bud] = await Promise.all([
        api(`/expenses?${listQuery}&page=${page}&limit=${PAGE_SIZE}`),
        api(`/expenses/summary?${rangeQuery}`),
        api(`/expenses/trend?${rangeQuery}`),
        api("/budget"),
      ]);
      // If this page became empty (e.g. you deleted its last item), go back one page.
      if (list.data.length === 0 && page > list.pagination.totalPages) {
        return goToPage(list.pagination.totalPages);
      }
      setExpenses(list.data);
      setPagination(list.pagination);
      setSummary(sum);
      setTrend(tr);
      setBudget(bud);
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    }
  }, [listQuery, rangeQuery, rangeInvalid, page, onLogout]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <button className="ghost" onClick={exportCsv} disabled={pagination.total === 0}>⬇ Export CSV</button>
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

        {pagination.totalPages > 1 && (
          <div className="pager">
            <button className="ghost small" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
              ← Prev
            </button>
            <span className="muted small">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} expenses
            </span>
            <button className="ghost small" disabled={page >= pagination.totalPages} onClick={() => goToPage(page + 1)}>
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}