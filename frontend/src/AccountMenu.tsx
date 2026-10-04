import { useEffect, useRef, useState } from "react";
import type { User } from "./types";

export function AccountMenu({
  user,
  busy,
  onLogout,
}: {
  user: User;
  busy: boolean;
  onLogout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="account-menu" ref={menu}>
      <button
        ref={trigger}
        className="account-trigger"
        aria-expanded={open}
        aria-controls="account-links"
        onClick={() => setOpen(!open)}
      >
        <span className="avatar small-avatar" aria-hidden="true">
          {user.name[0]}
        </span>
        <span>{user.name}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <nav id="account-links" className="account-links" aria-label="Account">
          <a href="#/profile" onClick={() => setOpen(false)}>
            Profile
          </a>
          <a href="#/bookings" onClick={() => setOpen(false)}>
            Bookings
          </a>
          <button
            disabled={busy}
            onClick={async () => {
              setOpen(false);
              await onLogout();
            }}
          >
            Logout
          </button>
        </nav>
      )}
    </div>
  );
}
