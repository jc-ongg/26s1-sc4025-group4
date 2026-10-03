import { useEffect, useLayoutEffect, useState } from "react";
import { api } from "./api";
import type { User } from "./types";
import { Empty, type Actions } from "./dining-ui";
import { Restaurants, RestaurantDetail } from "./RestaurantPages";
import { Footer } from "./Footer";
import { Discover } from "./Discover";
import { Bookings } from "./Bookings";
import { Groups, GroupDetail } from "./GroupPages";

export function DiningApp({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => Promise<void>;
}) {
  const [route, setRoute] = useState(window.location.hash.slice(1) || "/restaurants");
  const [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    const change = () => {
      setRoute(window.location.hash.slice(1) || "/restaurants");
      setError("");
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useLayoutEffect(() => {
    // Reset after the new page mounts so its layout owns the scroll position.
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  const actions: Actions = {
    revision,
    busy,
    act: async <T,>(
      path: string,
      body: unknown,
      success: string,
      destination?: string | ((data: T) => string),
    ) => {
      setBusy(true);
      setError("");
      try {
        const result = await api<T>(path, body);
        setMessage(success);
        setRevision((n) => n + 1);
        if (destination)
          window.location.hash =
            typeof destination === "function" ? destination(result) : destination;
        return true;
      } catch (e) {
        setError((e as Error).message);
        setRevision((n) => n + 1);
        return false;
      } finally {
        setBusy(false);
      }
    },
  };
  const parts = route.split("/").filter(Boolean),
    page = parts[0],
    id = parts[1];
  return (
    <>
      <div className="topbar">
        <header className="app-header">
          <a className="brand" href="#/restaurants">
            <img src="/images/brand/eatigo.png" alt="Eatigo" />
          </a>
          <nav aria-label="Main navigation">
            {[
              ["/restaurants", "Restaurants"],
              ["/groups", "EatTogether"],
              ["/bookings", "My bookings"],
            ].map(([path, label]) => (
              <a
                key={path}
                className={
                  route.startsWith(path) || (path === "/groups" && page === "discover")
                    ? "active"
                    : ""
                }
                aria-current={
                  route.startsWith(path) || (path === "/groups" && page === "discover")
                    ? "page"
                    : undefined
                }
                href={`#${path}`}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="account">
            <span className="avatar small-avatar">{user.name[0]}</span>
            <span>{user.name}</span>
            <button
              className="text-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onLogout();
                } catch (e) {
                  setError((e as Error).message);
                  setBusy(false);
                }
              }}
            >
              Log out
            </button>
          </div>
        </header>
      </div>
      <main className="app-main">
        {message && (
          <div className="toast" role="status">
            ✓ {message}
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {((page === "groups" && !id) || page === "discover") && (
          <nav className="eatogether-tabs" aria-label="EatTogether views">
            <a href="#/groups" aria-current={page === "groups" ? "page" : undefined}>
              Explore Events
            </a>
            <a href="#/discover" aria-current={page === "discover" ? "page" : undefined}>
              For you
            </a>
          </nav>
        )}
        {page === "discover" ? (
          <Discover />
        ) : page === "restaurants" && id ? (
          <RestaurantDetail key={id} id={id} {...actions} />
        ) : page === "restaurants" ? (
          <Restaurants {...actions} />
        ) : page === "groups" && id ? (
          <GroupDetail key={id} id={id} user={user} {...actions} />
        ) : page === "groups" ? (
          <Groups {...actions} />
        ) : page === "my-groups" ? (
          <Bookings {...actions} />
        ) : page === "bookings" ? (
          <Bookings {...actions} />
        ) : (
          <Empty
            title="Page not found"
            text="Use the navigation above to find your next meal."
          />
        )}
      </main>
      <Footer />
    </>
  );
}
