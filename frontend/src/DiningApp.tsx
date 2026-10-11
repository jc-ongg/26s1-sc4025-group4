import { useEffect, useLayoutEffect, useState } from "react";
import { api } from "./api";
import type { User } from "./types";
import { Empty, type Actions } from "./dining-ui";
import { Restaurants, RestaurantDetail } from "./RestaurantPages";
import { Footer } from "./Footer";
import { AccountMenu } from "./AccountMenu";
import { Profile } from "./Profile";
import { Bookings } from "./Bookings";
import { GroupDetail } from "./GroupPages";
import { Notifications } from "./Notifications";

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
          <div className="account-controls">
            <Notifications {...actions} />
            <AccountMenu
              user={user}
              busy={busy}
              onLogout={async () => {
                setBusy(true);
                try {
                  await onLogout();
                } catch (e) {
                  setError((e as Error).message);
                  setBusy(false);
                }
              }}
            />
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
        {page === "discover" ? (
          <Restaurants key={page} {...actions} initialDiscoveryOpen />
        ) : page === "restaurants" && id ? (
          <RestaurantDetail key={id} id={id} user={user} {...actions} />
        ) : page === "restaurants" ? (
          <Restaurants key={page} {...actions} />
        ) : page === "groups" && id ? (
          <GroupDetail key={id} id={id} user={user} {...actions} />
        ) : page === "groups" ? (
          <Restaurants key={page} {...actions} initialEatTogether />
        ) : page === "my-groups" ? (
          <Bookings {...actions} user={user} />
        ) : page === "profile" ? (
          <Profile user={user} {...actions} />
        ) : page === "bookings" ? (
          <Bookings {...actions} user={user} />
        ) : (
          <Empty
            title="Page not found"
            text="Select the Eatigo logo to return to restaurants."
          />
        )}
      </main>
      <Footer />
    </>
  );
}
