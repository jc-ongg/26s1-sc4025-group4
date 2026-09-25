import { useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { api, ApiError } from "./api";
import { Footer } from "./Footer";
import { DiningApp } from "./DiningApp";
import type { User } from "./types";
import "./style.css";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api<{ user: User }>("/auth/me")
      .then((data) => setUser(data.user))
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) setError(e.message);
      })
      .finally(() => setLoading(false));
    const expire = () => {
      setUser(null);
      setError("Please log in to continue.");
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);
  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setUser((await api<{ user: User }>("/auth/login", { email, password })).user);
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (user)
    return (
      <DiningApp
        user={user}
        onLogout={async () => {
          await api("/auth/logout", {});
          setUser(null);
          window.location.hash = "";
        }}
      />
    );
  return (
    <>
      <header className="login-header">
        <a className="brand" href="#">
          <img src="/images/brand/eatigo.png" alt="Eatigo" />
        </a>
      </header>
      <main className="login-main">
        <section className="intro">
          <h1>Restaurant reservations</h1>
          <img
            className="login-photo"
            src="/images/restaurants/joya.jpg"
            alt="Japanese dishes at Joya Onsen Cafe"
          />
        </section>
        <section className="panel" aria-label="Account">
          {loading ? (
            <p role="status">Checking your session…</p>
          ) : (
            <>
              <h2>Log in</h2>
              <form onSubmit={login}>
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jacob@example.com"
                />
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
              </form>
              <details>
                <summary>Available accounts</summary>
                <p>
                  jacob@example.com
                  <br />
                  alice@example.com
                  <br />
                  bob@example.com
                  <br />
                  charlie@example.com
                </p>
                <p>
                  Password for all accounts: <strong>demo123</strong>
                </p>
              </details>
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
