import { useState } from "react";
import { useContentMotion, useModalMotion } from "./motion";
import { Empty, State, useResource, type Actions } from "./dining-ui";
import { CloseIcon } from "./icons";
import { Pagination } from "./Pagination";

type Notice = {
  id: string;
  groupId: string | null;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};
type NoticeResponse = { notifications: Notice[]; unread: number };

function NotificationFeed({
  notices,
  act,
  busy,
  onOpenEvent,
}: Pick<Actions, "act" | "busy"> & {
  notices: Notice[];
  onOpenEvent?: () => void;
}) {
  const [page, setPage] = useState(0),
    pageSize = 3;
  const current = Math.min(page, Math.max(0, Math.ceil(notices.length / pageSize) - 1));
  const feed = useContentMotion<HTMLUListElement>(String(current));
  return (
    <>
      <ul ref={feed} className="notification-list">
        {notices.slice(current * pageSize, (current + 1) * pageSize).map((n) => (
          <li key={n.id} className={n.readAt ? "" : "unread"}>
            <div className="row notification-heading">
              <strong>{n.title}</strong>
              <span className={`notice-state ${n.readAt ? "read" : "unread"}`}>
                {n.readAt ? "Read" : "Unread"}
              </span>
            </div>
            <p className="small">{n.body}</p>
            <div className="row notification-actions">
              <time className="small muted" dateTime={n.createdAt}>
                {new Date(n.createdAt).toLocaleString("en-SG", {
                  timeZone: "Asia/Singapore",
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>
              <div>
                {!n.readAt && (
                  <button
                    className="text-button"
                    disabled={busy}
                    aria-label={`Mark ${n.title} as read`}
                    onClick={() => act("/me/notifications/read", { id: n.id }, "")}
                  >
                    Mark as read
                  </button>
                )}
                {n.groupId && (
                  <a
                    href={`#/groups/${n.groupId}`}
                    onClick={() => {
                      if (!n.readAt) void act("/me/notifications/read", { id: n.id }, "");
                      onOpenEvent?.();
                    }}
                  >
                    View Event →
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Pagination
        total={notices.length}
        page={current}
        pageSize={pageSize}
        onPageChange={setPage}
        label="Notifications"
      />
    </>
  );
}

export function NotificationHistory({ revision, act, busy }: Actions) {
  const resource = useResource<NoticeResponse>("/me/notifications", revision);
  const notices = resource.data?.notifications ?? [];
  return (
    <section className="panel notification-history" aria-label="Notification history">
      <div className="section-heading">
        <h2>Notification history</h2>
        <button
          className="text-button"
          disabled={busy || !resource.data?.unread}
          onClick={() =>
            act("/me/notifications/read", {}, "Notifications marked as read.")
          }
        >
          Mark all as read
        </button>
      </div>
      <State data={resource.data} error={resource.error}>
        {notices.length ? (
          <NotificationFeed notices={notices} act={act} busy={busy} />
        ) : (
          <Empty title="No notifications yet" text="" />
        )}
      </State>
    </section>
  );
}

export function Notifications({ revision, act, busy }: Actions) {
  const { data, error } = useResource<NoticeResponse>("/me/notifications", revision);
  const [open, setOpen] = useState(false);
  const dialog = useModalMotion(open);
  // Reading never removes a record: the bell hides it, Profile retains it.
  const unread = data?.notifications.filter((n) => !n.readAt) ?? [];
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
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        aria-labelledby="notifications-title"
      >
        <div className="row">
          <h2 id="notifications-title">Unread notifications</h2>
          <button
            className="icon-button dialog-close"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          >
            <CloseIcon />
          </button>
        </div>
        <State data={data} error={error}>
          {unread.length ? (
            <>
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  act("/me/notifications/read", {}, "Notifications marked as read.")
                }
              >
                Mark all as read
              </button>
              <NotificationFeed
                key={open ? "open" : "closed"}
                notices={unread}
                act={act}
                busy={busy}
                onOpenEvent={() => setOpen(false)}
              />
            </>
          ) : (
            <p className="muted">You’re all caught up.</p>
          )}
        </State>
        <a
          className="notification-history-link"
          href="#/profile"
          onClick={() => setOpen(false)}
        >
          Notification history →
        </a>
      </dialog>
    </>
  );
}
