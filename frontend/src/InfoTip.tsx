import { useId, useState, type ReactNode } from "react";

export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false),
    [pinned, setPinned] = useState(false),
    [dismissed, setDismissed] = useState(false);
  const open = !dismissed && (hovered || focused || pinned);
  return (
    <span
      className="info-tip"
      onMouseEnter={() => {
        setHovered(true);
        setDismissed(false);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="icon-button info-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
        }}
        onBlur={() => {
          setFocused(false);
          setPinned(false);
        }}
        onClick={() => {
          setPinned(!pinned);
          setDismissed(pinned);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDismissed(true);
            setPinned(false);
          }
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
        </svg>
      </button>
      {open && (
        <span id={id} role="tooltip" className="info-tooltip">
          {children}
        </span>
      )}
    </span>
  );
}
