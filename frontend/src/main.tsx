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
  const [mode, setMode] = useState<"login" | "register">("login");
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
              <div className="mode-tabs auth-tabs" aria-label="Account access">
                <button
                  type="button"
                  aria-pressed={mode === "login"}
                  className={mode === "login" ? "selected" : ""}
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                >
                  Log in
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "register"}
                  className={mode === "register" ? "selected" : ""}
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                >
                  Register
                </button>
              </div>
              <h2>{mode === "login" ? "Log in" : "Create an account"}</h2>
              {mode === "login" ? (
                <form onSubmit={login}>
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
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
                  <button type="button" className="forgot-password" disabled>
                    Forgot password?
                  </button>
                  <button disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
                </form>
              ) : (
                <form
                  aria-describedby="registration-verification-note"
                  onSubmit={(event) => event.preventDefault()}
                >
                  <label htmlFor="register-name">Full name</label>
                  <input id="register-name" autoComplete="name" placeholder="Full name" />
                  <label htmlFor="register-email">Email address</label>
                  <input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Email address"
                  />
                  <label htmlFor="register-password">Password</label>
                  <input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Password"
                  />
                  <label htmlFor="register-confirm">Confirm password</label>
                  <input
                    id="register-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm password"
                  />
                  <button type="submit" disabled>
                    Create account
                  </button>
                  <p
                    id="registration-verification-note"
                    className="auth-verification-note"
                  >
                    After registering with email and password, you’ll still need to verify
                    your identity through Singpass to create or Join EatTogether Events.
                  </p>
                </form>
              )}
              <div className="auth-divider" aria-hidden="true">
                or
              </div>
              <button type="button" className="singpass-option" disabled>
                {mode === "login" ? "Log in" : "Register"} with <span>Singpass</span>
              </button>
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
