import { useId, useState } from "react";
import { CloseIcon } from "./icons";
import { useModalMotion } from "./motion";
import { discountedCents, menuFor, money } from "./menu-data";

export function RestaurantMenu({
  restaurantId,
  restaurantName,
  discount,
}: {
  restaurantId: string;
  restaurantName: string;
  discount?: number;
}) {
  const [open, setOpen] = useState(false),
    titleId = useId(),
    dialog = useModalMotion(open);
  const items = menuFor(restaurantId);
  if (!items.length) return null;
  return (
    <>
      <button
        type="button"
        className="secondary menu-trigger"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        View menu
      </button>
      <dialog
        ref={dialog}
        className="compact-dialog menu-dialog"
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
      >
        <div className="row">
          <h2 id={titleId}>Recommended menu</h2>
          <button
            className="icon-button dialog-close"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <CloseIcon />
          </button>
        </div>
        <p className="small">{restaurantName}</p>
        <div className="row menu-discount">
          <strong>Discount</strong>
          <span>
            {discount === undefined
              ? "Select a dining time"
              : discount === 0
                ? "Full price"
                : `${discount}% off`}
          </span>
        </div>
        <ul className="menu-items">
          {items.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <div>
                <strong>{money(discountedCents(item.cents, discount ?? 0))}</strong>
                {!!discount && <del>{money(item.cents)}</del>}
              </div>
            </li>
          ))}
        </ul>
        <p className="small muted">
          Indicative menu prices, before GST and service charge. Prices and availability
          may vary.
        </p>
      </dialog>
    </>
  );
}
