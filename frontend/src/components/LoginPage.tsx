import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 className="brand">edu-timetabelo</h1>
        <p className="muted">Plan your week. Own your time.</p>

        <div className="tabs">
          <button
            className={mode === "login" ? "tab active" : "tab"}
            onClick={() => setMode("login")}
            type="button"
          >
            Log in
          </button>
          <button
            className={mode === "register" ? "tab active" : "tab"}
            onClick={() => setMode("register")}
            type="button"
          >
            Sign up
          </button>
        </div>

        <form onSubmit={onSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          {error && <div className="error">{error}</div>}

          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
