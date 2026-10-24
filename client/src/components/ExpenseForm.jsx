import { useState } from "react";
import { CATEGORIES, todayISO } from "../constants.js";


export default function ExpenseForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: initial?.title || "",
    amount: initial?.amount ?? "",
    category: initial?.category || "Food",
    date: initial?.date ? initial.date.slice(0, 10) : todayISO(),
  });
  const [error, setError] = useState("");

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await onSave({ ...form, amount: Number(form.amount) });
      if (!initial) setForm({ title: "", amount: "", category: "Food", date: todayISO() });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2>{initial ? "Edit expense" : "Add expense"}</h2>
      <input name="title" placeholder="What did you spend on?" value={form.title} onChange={update} required />
      <input name="amount" type="number" min="0" step="0.01" placeholder="Amount (₹)" value={form.amount} onChange={update} required />
      <select name="category" value={form.category} onChange={update}>
        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
      </select>
      <input name="date" type="date" value={form.date} onChange={update} />
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button>{initial ? "Update" : "Add"}</button>
        {initial && <button type="button" className="ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
