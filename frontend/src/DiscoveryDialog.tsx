import { useEffect, useRef } from "react";
import { Discover } from "./Discover";
import { CloseIcon } from "./icons";

export function DiscoveryDialog({
  open,
  onClose,
  cuisines,
  initialCuisine,
  eventCounts,
}: {
  open: boolean;
  onClose: () => void;
  cuisines: string[];
  initialCuisine: string;
  eventCounts: Map<string, number> | undefined;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    // Native modal behaviour provides focus trapping, Escape and background isolation.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      id="for-you-dialog"
      className="discovery-dialog"
      aria-labelledby="for-you-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ),
        ].filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        // Keep keyboard navigation inside the popup at both focus boundaries.
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <header className="discovery-dialog-header">
        <h2 id="for-you-title">For you</h2>
        <button
          className="icon-button dialog-close"
          aria-label="Close For you"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>
      <div className="discovery-dialog-body">
        <Discover
          cuisines={cuisines}
          initialCuisine={initialCuisine}
          eventCounts={eventCounts}
        />
      </div>
    </dialog>
  );
}
