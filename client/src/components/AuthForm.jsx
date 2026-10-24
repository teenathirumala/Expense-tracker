import { useState } from "react";
import { api } from "../api.js";

export default function AuthForm({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api(`/auth/${mode}`, { method: "POST", body: form });
      onAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth" onSubmit={submit}>
        <h1>💸 Expense Tracker</h1>
        <p className="muted">{mode === "login" ? "Welcome back" : "Create your account"}</p>

        {mode === "register" && (
          <input name="name" placeholder="Name" value={form.name} onChange={update} required />
        )}
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={update} required />
        <input name="password" type="password" placeholder="Password (min 6)" value={form.password} onChange={update} required />

        {error && <p className="error">{error}</p>}
        <button disabled={loading}>{loading ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}</button>

        <p className="muted small">
          {mode === "login" ? "No account?" : "Already registered?"}{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === "login" ? "register" : "login"); }}>
            {mode === "login" ? "Sign up" : "Log in"}
          </a>
        </p>
      </form>
    </div>
  );
}
