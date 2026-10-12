import { useModalMotion } from "./motion";
import { Discover } from "./Discover";
import { CloseIcon } from "./icons";

export function DiscoveryDialog({
  open,
  onClose,
  eventCounts,
}: {
  open: boolean;
  onClose: () => void;
  eventCounts: Map<string, number> | undefined;
}) {
  const dialog = useModalMotion(open);

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
        <Discover eventCounts={eventCounts} />
      </div>
    </dialog>
  );
}
