import { useEffect, useRef, useState } from "react";
import { State, useResource, type Actions } from "./dining-ui";

type Notice = {
  id: string;
  groupId: string | null;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};
export function Notifications({ revision, act, busy }: Actions) {
  const { data, error } = useResource<{ notifications: Notice[]; unread: number }>(
    "/me/notifications",
    revision,
  );
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open || !dialog.current) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current.showModal();
    return () => {
      dialog.current?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  const notices = data?.notifications ?? [],
    pages = Math.max(1, Math.ceil(notices.length / 5));
  const current = Math.min(page, pages - 1);
  return (
    <>
      <button
        className="notification-trigger"
        aria-label={`Notifications${data?.unread ? `, ${data.unread} unread` : ""}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6" />
        </svg>
        {!!data?.unread && <span className="notification-count">{data.unread}</span>}
      </button>
      <dialog
        ref={dialog}
        className="compact-dialog"
        onCancel={() => setOpen(false)}
        aria-labelledby="notifications-title"
      >
        <div className="row">
          <h2 id="notifications-title">Notifications</h2>
          <button
            className="text-button"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>
        <State data={data} error={error}>
          {notices.length ? (
            <>
              <button
                className="text-button"
                disabled={busy || !data?.unread}
                onClick={() =>
                  act("/me/notifications/read", {}, "Notifications marked as read.")
                }
              >
                Mark all as read
              </button>
              <ul className="notification-list">
                {notices.slice(current * 5, current * 5 + 5).map((n) => (
                  <li key={n.id} className={n.readAt ? "" : "unread"}>
                    <strong>{n.title}</strong>
                    <p className="small">{n.body}</p>
                    <div className="row small">
                      <span className="muted">
                        {new Date(n.createdAt).toLocaleString("en-SG", {
                          timeZone: "Asia/Singapore",
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      {n.groupId && (
                        <a
                          href={`#/groups/${n.groupId}`}
                          onClick={() => {
                            void act("/me/notifications/read", { id: n.id }, "");
                            setOpen(false);
                          }}
                        >
                          View Event →
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {pages > 1 && (
                <div className="list-pagination">
                  <span>
                    Page {current + 1} of {pages}
                  </span>
                  <div>
                    <button
                      className="text-button"
                      disabled={current === 0}
                      onClick={() => setPage(current - 1)}
                    >
                      Previous
                    </button>
                    <button
                      className="text-button"
                      disabled={current + 1 === pages}
                      onClick={() => setPage(current + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="muted">No notifications.</p>
          )}
        </State>
      </dialog>
    </>
  );
}
