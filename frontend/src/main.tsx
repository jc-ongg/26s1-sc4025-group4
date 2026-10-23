import { useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { api, ApiError } from "./api";
import { Footer } from "./Footer";
import { DiningApp } from "./DiningApp";
import { BusinessApp } from "./BusinessApp";
import type { User } from "./types";
import { EyeIcon } from "./icons";
import { useContentMotion } from "./motion";
import "./style.css";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [audience, setAudience] = useState<"DINER" | "BUSINESS">("DINER");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const account = useContentMotion<HTMLElement>(
    `${audience}:${mode}:${loading}:${!!user}`,
  );
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
      const account = (
        await api<{ user: User }>("/auth/login", {
          email,
          password,
          accountType: audience,
        })
      ).user;
      setUser(account);
      window.location.hash =
        account.role === "BUSINESS" ? "/business/reservations" : "/restaurants";
      setPassword("");
      setPasswordVisible(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const logout = async () => {
    await api("/auth/logout", {});
    setUser(null);
    window.location.hash = "";
  };
  if (user?.role === "BUSINESS") return <BusinessApp user={user} onLogout={logout} />;
  if (user) return <DiningApp user={user} onLogout={logout} />;
  return (
    <>
      <header className="login-header">
        <a className="brand" href="#">
          <img src="/images/brand/eatigo.png" alt="Eatigo" />
        </a>
        <nav className="mode-tabs login-audience" aria-label="Login type">
          {[
            ["DINER", "Diner"],
            ["BUSINESS", "Restaurant"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={audience === value}
              className={audience === value ? "selected" : ""}
              onClick={() => {
                setAudience(value as "DINER" | "BUSINESS");
                setMode("login");
                setEmail("");
                setPassword("");
                setPasswordVisible(false);
                setError("");
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="login-main">
        <section className="intro">
          <h1>
            {audience === "BUSINESS"
              ? "Manage your restaurant"
              : "Restaurant reservations"}
          </h1>
          <img
            className="login-photo"
            src="/images/restaurants/joya.jpg"
            alt="Japanese dishes at Joya Onsen Cafe"
          />
        </section>
        <section ref={account} className="panel" aria-label="Account">
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
                    setPasswordVisible(false);
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
                    setPasswordVisible(false);
                    setError("");
                  }}
                >
                  Register
                </button>
              </div>
              <h2>
                {mode === "login"
                  ? audience === "BUSINESS"
                    ? "Restaurant login"
                    : "Log in"
                  : audience === "BUSINESS"
                    ? "Register your restaurant"
                    : "Create an account"}
              </h2>
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
                  <div className="password-field">
                    <input
                      id="password"
                      type={passwordVisible ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="icon-button password-toggle"
                      aria-label={passwordVisible ? "Hide password" : "Show password"}
                      aria-pressed={passwordVisible}
                      aria-controls="password"
                      onClick={() => setPasswordVisible(!passwordVisible)}
                    >
                      <EyeIcon visible={passwordVisible} />
                    </button>
                  </div>
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
                  <label htmlFor="register-name">
                    {audience === "BUSINESS" ? "Restaurant name" : "Full name"}
                  </label>
                  <input
                    id="register-name"
                    autoComplete="name"
                    placeholder={
                      audience === "BUSINESS" ? "Restaurant name" : "Full name"
                    }
                  />
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
                    {audience === "BUSINESS"
                      ? "Please note that Corppass verification is required to host Restaurant Events!"
                      : "Please note that Singpass verification is required for some features!"}
                  </p>
                </form>
              )}
              <div className="auth-divider" aria-hidden="true">
                or
              </div>
              <button type="button" className="singpass-option" disabled>
                {mode === "login" ? "Log in" : "Register"} with{" "}
                <span>{audience === "BUSINESS" ? "Corppass" : "Singpass"}</span>
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
